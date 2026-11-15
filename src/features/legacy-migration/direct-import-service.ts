import { randomUUID } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  inventoryMovements,
  itemBarcodes,
  legacyProductImportBatches,
  legacyProductMasterMappings,
  legacyProductRows,
  productCategories,
  productItems,
  productMasters,
} from "@/db/schema";
import {
  formatProductItemIdentifiers,
  getNextProductItemIdentifierBatch,
} from "@/features/inventory/product-item-identifiers";
import {
  getSuggestedCategoryCode,
  normalizeLegacyCategoryName,
  normalizeLegacyLabel,
} from "@/features/legacy-migration/master-mapping";
import { planLegacyInventorySync } from "@/features/legacy-migration/inventory-sync";
import { legacySyncLabel, readLegacyStockStatus, readLegacySyncOutcomes, type LegacySyncOutcome } from "@/features/legacy-migration/sync-policy";
import {
  calculateJewelryBasePrice,
  getActiveGoldPriceRates,
  normalizePurityKey,
} from "@/features/pricing/metal-price-rates";
import type { AuthContext } from "@/lib/auth/session";
import { isProductLifecycleArchived } from "@/features/products/lifecycle-contracts";

const INSERT_CHUNK_SIZE = 250;

export type LegacyDirectImportRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type LegacyDirectImportResult = {
  batchId: string;
  importedItemCount: number;
  createdMasterCount: number;
  reusedMasterCount: number;
  createdCategoryCount: number;
  cleanupItemCount: number;
  legacyBarcodeAliasCount: number;
  systemOnlyBarcodeCount: number;
  imagePendingCount: number;
  imageMissingCount: number;
  syncVersion?: 1;
  processedRowCount?: number;
  existingItemCount?: number;
  updatedStockCount?: number;
  deferredRowCount?: number;
  availableItemCount?: number;
  soldItemCount?: number;
  soldSourceRowCount?: number;
  rowOutcomes?: LegacySyncOutcome[];
};


function readDirectImportResultData(
  batchId: string,
  value: unknown,
): LegacyDirectImportResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as Record<string, unknown>;
  const importedItemCount = Number(data.importedItemCount ?? 0);
  if (!Number.isFinite(importedItemCount) || importedItemCount < 0 || importedItemCount === 0 && data.syncVersion !== 1) {
    return null;
  }

  return {
    batchId,
    importedItemCount,
    createdMasterCount: Number(data.createdMasterCount ?? 0),
    reusedMasterCount: Number(data.reusedMasterCount ?? 0),
    createdCategoryCount: Number(data.createdCategoryCount ?? 0),
    cleanupItemCount: Number(data.cleanupItemCount ?? 0),
    legacyBarcodeAliasCount: Number(data.legacyBarcodeAliasCount ?? 0),
    systemOnlyBarcodeCount: Number(data.systemOnlyBarcodeCount ?? 0),
    imagePendingCount: Number(data.imagePendingCount ?? 0),
    imageMissingCount: Number(data.imageMissingCount ?? 0),
    ...(data.syncVersion === 1 ? {
      syncVersion: 1 as const,
      processedRowCount: Number(data.processedRowCount ?? 0),
      existingItemCount: Number(data.existingItemCount ?? 0),
      updatedStockCount: Number(data.updatedStockCount ?? 0),
      deferredRowCount: Number(data.deferredRowCount ?? 0),
      availableItemCount: Number(data.availableItemCount ?? 0),
      soldItemCount: Number(data.soldItemCount ?? 0),
      soldSourceRowCount: Number(data.soldSourceRowCount ?? 0),
      rowOutcomes: readLegacySyncOutcomes({ directImport: data }),
    } : {}),
  };
}

function readStoredDirectImportResult(
  batchId: string,
  validationSummary: unknown,
): LegacyDirectImportResult | null {
  if (
    !validationSummary ||
    typeof validationSummary !== "object" ||
    Array.isArray(validationSummary)
  ) {
    return null;
  }

  return readDirectImportResultData(
    batchId,
    (validationSummary as Record<string, unknown>).directImport,
  );
}

function readLegacyImportMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const legacyImport = (value as Record<string, unknown>).legacyImport;
  if (!legacyImport || typeof legacyImport !== "object" || Array.isArray(legacyImport)) {
    return null;
  }

  const data = legacyImport as Record<string, unknown>;
  return {
    rowId: typeof data.rowId === "string" ? data.rowId : null,
    needsCleanup: data.needsCleanup === true,
  };
}

export class LegacyDirectImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LegacyDirectImportError";
  }
}

function directImportError(
  code: string,
  message: string,
  statusCode = 400,
  cause?: unknown,
) {
  return new LegacyDirectImportError(
    code,
    message,
    statusCode,
    cause === undefined ? undefined : { cause },
  );
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}

function compactText(value: string | null | undefined, maxLength: number) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
  return normalized || null;
}

function normalizeCategoryCode(value: string | null | undefined) {
  const suggested = getSuggestedCategoryCode(value);
  if (suggested) return suggested;

  const slug = normalizeLegacyLabel(value)
    .toLocaleUpperCase("id-ID")
    .normalize("NFKD")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 34);

  return slug ? `LEGACY_${slug}` : "LEGACY_UNCATEGORIZED";
}

function getCategoryName(value: string | null | undefined) {
  return normalizeLegacyCategoryName(value) ?? "Belum Dikategorikan";
}

function normalizeMasterCode(value: string | null | undefined) {
  const normalized = compactText(value, 64)?.toLocaleUpperCase("id-ID");
  return normalized || null;
}

function uniqueCode(candidate: string, used: Set<string>, maxLength: number) {
  const normalized = candidate.slice(0, maxLength);
  if (!used.has(normalized.toLocaleUpperCase("id-ID"))) {
    used.add(normalized.toLocaleUpperCase("id-ID"));
    return normalized;
  }

  for (let suffix = 2; suffix <= 99_999; suffix += 1) {
    const suffixText = `-${suffix}`;
    const next = `${normalized.slice(0, maxLength - suffixText.length)}${suffixText}`;
    const key = next.toLocaleUpperCase("id-ID");
    if (!used.has(key)) {
      used.add(key);
      return next;
    }
  }

  throw directImportError(
    "MASTER_CODE_EXHAUSTED",
    `Kode Product Master ${candidate} tidak dapat dibuat unik.`,
    409,
  );
}

function numericString(value: string | null, options?: { positive?: boolean }) {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (options?.positive && numeric <= 0) return null;
  return String(numeric);
}


function normalizeLegacyPurityForItem(
  value: string | null,
  category: string | null,
) {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const isFineGold = normalizeLegacyLabel(category)
    .toLocaleUpperCase("id-ID")
    .includes("LOGAM MULIA");
  const normalized = isFineGold && numeric > 100 && numeric <= 1_000
    ? numeric / 10
    : numeric;

  return String(Number(normalized.toFixed(3)));
}

function wholeMoneyString(value: string | null) {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return String(Math.round(numeric));
}

function masterGroupingKey(row: {
  id: string;
  rowNumber: number;
  legacyCategory: string | null;
  legacyMasterCode: string | null;
  legacyMasterName: string | null;
  legacyItemName: string | null;
}) {
  const code = normalizeMasterCode(row.legacyMasterCode);
  if (code) return JSON.stringify(["CODE", code, legacySyncLabel(row.legacyCategory), legacySyncLabel(row.legacyMasterName)]);

  const category = getCategoryName(row.legacyCategory).toLocaleUpperCase("id-ID");
  const name = compactText(row.legacyMasterName, 200)
    ?? compactText(row.legacyItemName, 200);
  if (name) return `NAME:${category}:${name.toLocaleUpperCase("id-ID")}`;

  return `ROW:${row.id}:${row.rowNumber}`;
}

function readValidationIssues(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];
}

function importAttributes(input: {
  batchId: string;
  rowId: string;
  rowNumber: number;
  sourceSequence: number | null;
  rowFingerprint: string;
  legacyBarcode: string | null;
  legacyCategory: string | null;
  legacyMasterCode: string | null;
  legacyMasterName: string | null;
  legacyPricePerGram: string | null;
  validationStatus: "valid" | "warning" | "invalid";
  validationIssues: unknown;
  imageStatus: "pending" | "missing";
  importedAt: Date;
  needsCleanup: boolean;
}) {
  return {
    legacyImport: {
      batchId: input.batchId,
      rowId: input.rowId,
      rowNumber: input.rowNumber,
      sourceSequence: input.sourceSequence,
      rowFingerprint: input.rowFingerprint,
      sourceBarcode: input.legacyBarcode,
      sourceCategory: input.legacyCategory,
      sourceMasterCode: input.legacyMasterCode,
      sourceMasterName: input.legacyMasterName,
      legacyPricePerGram: input.legacyPricePerGram,
      validationStatus: input.validationStatus,
      validationIssues: readValidationIssues(input.validationIssues),
      needsCleanup: input.needsCleanup,
      imageStatus: input.imageStatus,
      importedAt: input.importedAt.toISOString(),
    },
  } satisfies Record<string, unknown>;
}

export async function importLegacyBatchDirectlyToInventory({
  auth,
  batchId,
  requestMetadata = {},
  now = new Date(),
}: {
  auth: AuthContext;
  batchId: string;
  requestMetadata?: LegacyDirectImportRequestMetadata;
  now?: Date;
}): Promise<LegacyDirectImportResult> {
  if (!auth.permissionCodes.includes("migration.import")) {
    throw directImportError(
      "IMPORT_PERMISSION_REQUIRED",
      "Permission migration.import diperlukan untuk import produk legacy.",
      403,
    );
  }

  const activeRates = await getActiveGoldPriceRates({
    organizationId: auth.organization.id,
    at: now,
  });
  const activeRateByPurity = new Map(
    activeRates.map((rate) => [rate.purityKey, rate.ratePerGram]),
  );

  try {
    return await db.transaction(async (transaction) => {
      // Different uploads for one organization must also serialize. A batch-only
      // lock cannot prevent two refreshed workbooks from creating the same SKU.
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`legacy-inventory-sync:${auth.organization.id}`}))`,
      );
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`legacy-direct-import:${auth.organization.id}:${batchId}`}))`,
      );

      const [batch] = await transaction
        .select({
          id: legacyProductImportBatches.id,
          organizationId: legacyProductImportBatches.organizationId,
          outletId: legacyProductImportBatches.outletId,
          status: legacyProductImportBatches.status,
          validationSummary: legacyProductImportBatches.validationSummary,
        })
        .from(legacyProductImportBatches)
        .where(
          and(
            eq(legacyProductImportBatches.id, batchId),
            eq(legacyProductImportBatches.organizationId, auth.organization.id),
          ),
        )
        .limit(1);

      if (!batch) {
        throw directImportError(
          "BATCH_NOT_FOUND",
          "Batch import legacy tidak ditemukan.",
          404,
        );
      }
      if (!auth.outlets.some((outlet) => outlet.id === batch.outletId)) {
        throw directImportError(
          "OUTLET_FORBIDDEN",
          "Kamu tidak memiliki akses ke outlet tujuan import.",
          403,
        );
      }
      const storedResult = readStoredDirectImportResult(
        batchId,
        batch.validationSummary,
      );

      const rows = await transaction
        .select({
          id: legacyProductRows.id,
          rowNumber: legacyProductRows.rowNumber,
          sourceSequence: legacyProductRows.sourceSequence,
          legacyBarcode: legacyProductRows.legacyBarcode,
          normalizedBarcode: legacyProductRows.normalizedBarcode,
          legacyCategory: legacyProductRows.legacyCategory,
          legacyMasterCode: legacyProductRows.legacyMasterCode,
          legacyMasterName: legacyProductRows.legacyMasterName,
          legacyItemName: legacyProductRows.legacyItemName,
          legacyPurity: legacyProductRows.legacyPurity,
          legacyExchangePurity: legacyProductRows.legacyExchangePurity,
          legacyPricePerGram: legacyProductRows.legacyPricePerGram,
          legacyDeductionPerGram: legacyProductRows.legacyDeductionPerGram,
          legacyWeightGram: legacyProductRows.legacyWeightGram,
          legacyColor: legacyProductRows.legacyColor,
          legacyImageUrl: legacyProductRows.legacyImageUrl,
          validationStatus: legacyProductRows.validationStatus,
          validationIssues: legacyProductRows.validationIssues,
          rowFingerprint: legacyProductRows.rowFingerprint,
          rawData: legacyProductRows.rawData,
        })
        .from(legacyProductRows)
        .where(eq(legacyProductRows.batchId, batchId))
        .orderBy(asc(legacyProductRows.rowNumber));

      if (rows.length === 0) {
        throw directImportError(
          "BATCH_EMPTY",
          "Batch import tidak memiliki baris produk.",
          409,
        );
      }

      // Idempotency source of truth is the committed Product Item rows, not only
      // the batch status/summary. A previous Server Action may fail after the DB
      // transaction commits (for example during redirect), so retry must never
      // create a second Physical Item for the same batch + source row.
      const existingImportedItems = await transaction
        .select({
          id: productItems.id,
          legacyUrl: productItems.legacyUrl,
          attributes: productItems.attributes,
        })
        .from(productItems)
        .where(
          and(
            eq(productItems.organizationId, auth.organization.id),
            sql`${productItems.attributes}->'legacyImport'->>'batchId' = ${batchId}`,
          ),
        );

      if (storedResult?.syncVersion === 1) {
        const outcomes = storedResult.rowOutcomes ?? [];
        const expected = new Set(rows.map(row => row.id));
        const created = outcomes.filter(row => row.kind === "created");
        const byRow = new Map(created.map(row => [row.rowId, row.itemId]));
        const consistent = batch.status === "ready" &&
          storedResult.processedRowCount === rows.length && outcomes.length === rows.length &&
          new Set(outcomes.map(row => row.rowId)).size === rows.length &&
          outcomes.every(row => expected.has(row.rowId)) &&
          created.length === storedResult.importedItemCount &&
          outcomes.filter(row => row.kind === "deferred").length === storedResult.deferredRowCount &&
          outcomes.filter(row => row.kind === "existing" || row.kind === "stock_updated").length === storedResult.existingItemCount &&
          existingImportedItems.length === created.length &&
          existingImportedItems.every(item => byRow.get(readLegacyImportMetadata(item.attributes)?.rowId ?? "") === item.id);
        if (!consistent) throw directImportError("SYNC_RESULT_INCONSISTENT", "Hasil sinkronisasi sebelumnya tidak konsisten. Proses dihentikan agar tidak membuat item ganda.", 409);
        return storedResult;
      }

      if (existingImportedItems.length > 0) {
        const expectedRowIds = new Set(rows.map((row) => row.id));
        const itemCountByRowId = new Map<string, number>();
        let unknownMetadataCount = 0;

        for (const item of existingImportedItems) {
          const metadata = readLegacyImportMetadata(item.attributes);
          if (!metadata?.rowId || !expectedRowIds.has(metadata.rowId)) {
            unknownMetadataCount += 1;
            continue;
          }
          itemCountByRowId.set(
            metadata.rowId,
            (itemCountByRowId.get(metadata.rowId) ?? 0) + 1,
          );
        }

        const duplicateRowCount = Array.from(itemCountByRowId.values()).filter(
          (count) => count > 1,
        ).length;
        const missingRowCount = rows.reduce(
          (total, row) => total + (itemCountByRowId.has(row.id) ? 0 : 1),
          0,
        );
        const completeCommittedImport =
          existingImportedItems.length === rows.length &&
          unknownMetadataCount === 0 &&
          duplicateRowCount === 0 &&
          missingRowCount === 0;

        if (!completeCommittedImport) {
          throw directImportError(
            "DIRECT_IMPORT_EXISTING_ITEMS_INCONSISTENT",
            `Batch sudah memiliki ${existingImportedItems.length.toLocaleString("id-ID")} item hasil import, tetapi identitas source row tidak konsisten (duplicate ${duplicateRowCount.toLocaleString("id-ID")}, missing ${missingRowCount.toLocaleString("id-ID")}, metadata tidak dikenal ${unknownMetadataCount.toLocaleString("id-ID")}). Import dihentikan agar retry tidak membuat duplikat baru.`,
            409,
          );
        }

        let recoveredResult = storedResult;
        if (!recoveredResult) {
          const [firstCommitAudit] = await transaction
            .select({ afterData: auditLogs.afterData })
            .from(auditLogs)
            .where(
              and(
                eq(auditLogs.organizationId, auth.organization.id),
                eq(auditLogs.action, "legacy_product_import.direct_commit"),
                eq(auditLogs.entityType, "legacy_product_import_batch"),
                eq(auditLogs.entityId, batchId),
              ),
            )
            .orderBy(asc(auditLogs.createdAt))
            .limit(1);

          recoveredResult = readDirectImportResultData(
            batchId,
            firstCommitAudit?.afterData,
          );
        }

        if (!recoveredResult) {
          const cleanupItemCount = existingImportedItems.reduce((total, item) => {
            return total + (readLegacyImportMetadata(item.attributes)?.needsCleanup ? 1 : 0);
          }, 0);
          const imagePendingCount = existingImportedItems.filter(
            (item) => Boolean(item.legacyUrl),
          ).length;
          const [aliasCountRow] = await transaction
            .select({
              count: sql<number>`count(*)::int`,
            })
            .from(itemBarcodes)
            .innerJoin(productItems, eq(itemBarcodes.itemId, productItems.id))
            .where(
              and(
                eq(productItems.organizationId, auth.organization.id),
                eq(itemBarcodes.source, "legacy_import"),
                eq(itemBarcodes.isActive, true),
                sql`${productItems.attributes}->'legacyImport'->>'batchId' = ${batchId}`,
              ),
            );
          const legacyBarcodeAliasCount = Number(aliasCountRow?.count ?? 0);

          recoveredResult = {
            batchId,
            importedItemCount: existingImportedItems.length,
            createdMasterCount: 0,
            reusedMasterCount: 0,
            createdCategoryCount: 0,
            cleanupItemCount,
            legacyBarcodeAliasCount,
            systemOnlyBarcodeCount:
              existingImportedItems.length - legacyBarcodeAliasCount,
            imagePendingCount,
            imageMissingCount: existingImportedItems.length - imagePendingCount,
          };
        }

        const previousSummary =
          batch.validationSummary &&
          typeof batch.validationSummary === "object" &&
          !Array.isArray(batch.validationSummary)
            ? (batch.validationSummary as Record<string, unknown>)
            : {};

        await transaction
          .update(legacyProductImportBatches)
          .set({
            status: "ready",
            validationSummary: {
              ...previousSummary,
              directImport: {
                ...recoveredResult,
                recoveredAt: now.toISOString(),
              },
            },
            errorMessage: null,
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(legacyProductImportBatches.id, batchId));

        if (batch.status !== "ready" || !storedResult) {
          await transaction.insert(auditLogs).values({
            organizationId: auth.organization.id,
            outletId: batch.outletId,
            actorUserId: auth.user.id,
            action: "legacy_product_import.status_recovered",
            entityType: "legacy_product_import_batch",
            entityId: batchId,
            afterData: recoveredResult,
            reason:
              "Retry menemukan satu Product Item committed untuk setiap source row. Batch dipulihkan tanpa membuat item baru.",
            ipAddress: requestMetadata.ipAddress ?? null,
            userAgent: requestMetadata.userAgent?.slice(0, 500) ?? null,
          });
        }

        return recoveredResult;
      }

      if (storedResult) {
        throw directImportError(
          "DIRECT_IMPORT_SUMMARY_WITHOUT_ITEMS",
          "Batch memiliki summary direct import tetapi Product Item hasil batch tidak ditemukan. Import dihentikan untuk mencegah duplikasi atau kehilangan jejak data.",
          409,
        );
      }

      if (batch.status !== "processing" && batch.status !== "failed") {
        throw directImportError(
          "BATCH_STATUS_INVALID",
          `Batch dengan status ${batch.status} tidak dapat diimport langsung.`,
          409,
        );
      }

      const sync = await planLegacyInventorySync(transaction, {
        organizationId: auth.organization.id, outletId: batch.outletId, batchId,
        actorUserId: auth.user.id, now, rows,
      });
      let rowsToCreate = sync.newRows;
      const outcomeByRowId = new Map(sync.outcomes.map(outcome => [outcome.rowId, outcome]));

      const categoryRows = await transaction
          .select({
            id: productCategories.id,
            code: productCategories.code,
            name: productCategories.name,
            isActive: productCategories.isActive,
          })
          .from(productCategories)
          .where(eq(productCategories.organizationId, auth.organization.id));
      const existingMasters = await transaction
          .select({
            id: productMasters.id,
            code: productMasters.code,
            name: productMasters.name,
            categoryId: productMasters.categoryId,
            status: productMasters.status,
            attributes: productMasters.attributes,
          })
          .from(productMasters)
          .where(eq(productMasters.organizationId, auth.organization.id));
      const existingAliases = await transaction
          .select({ barcodeValue: itemBarcodes.barcodeValue })
          .from(itemBarcodes)
          .where(
            and(
              eq(itemBarcodes.organizationId, auth.organization.id),
              eq(itemBarcodes.isActive, true),
            ),
          );
      const existingItemBarcodes = await transaction
          .select({ barcode: productItems.barcode })
          .from(productItems)
          .where(eq(productItems.organizationId, auth.organization.id));

      rowsToCreate = rowsToCreate.filter(row => {
        const category = categoryRows.find(candidate => candidate.code.toLocaleUpperCase("id-ID") === normalizeCategoryCode(row.legacyCategory).toLocaleUpperCase("id-ID"))
          ?? categoryRows.find(candidate => legacySyncLabel(candidate.name) === legacySyncLabel(getCategoryName(row.legacyCategory)));
        if (!category) return true;
        const matchingCode = existingMasters.filter(master => {
          const metadata = master.attributes?.legacyImport as Record<string, unknown> | undefined;
          const sourceCode = typeof metadata?.legacyMasterCode === "string" ? metadata.legacyMasterCode : master.code;
          return master.categoryId === category.id && normalizeMasterCode(sourceCode) === normalizeMasterCode(row.legacyMasterCode);
        });
        const activeMatch = matchingCode.some(master => !isProductLifecycleArchived(master.attributes) && legacySyncLabel(master.name) === legacySyncLabel(row.legacyMasterName));
        if (!activeMatch && matchingCode.some(master => isProductLifecycleArchived(master.attributes))) {
          const outcome = outcomeByRowId.get(row.id)!;
          outcome.kind = "deferred";
          outcome.reason = "master_archived";
          return false;
        }
        return true;
      });

      const categoryByCode = new Map(
        categoryRows.map((row) => [row.code.toLocaleUpperCase("id-ID"), row]),
      );
      const categoryByName = new Map(
        categoryRows.map((row) => [row.name.toLocaleUpperCase("id-ID"), row]),
      );
      const usedCategoryCodes = new Set(
        categoryRows.map((row) => row.code.toLocaleUpperCase("id-ID")),
      );
      let createdCategoryCount = 0;

      const categoryIdByLegacyName = new Map<string, string>();
      for (const row of rowsToCreate) {
        const legacyName = getCategoryName(row.legacyCategory);
        const categoryKey = legacyName.toLocaleUpperCase("id-ID");
        if (categoryIdByLegacyName.has(categoryKey)) continue;

        const desiredCode = normalizeCategoryCode(row.legacyCategory);
        let category =
          categoryByCode.get(desiredCode.toLocaleUpperCase("id-ID")) ??
          categoryByName.get(categoryKey) ??
          null;

        if (!category) {
          const code = uniqueCode(desiredCode, usedCategoryCodes, 48);
          const categoryId = randomUUID();
          await transaction.insert(productCategories).values({
            id: categoryId,
            organizationId: auth.organization.id,
            code,
            name: legacyName.slice(0, 120),
            description: "Kategori otomatis dari import produk legacy.",
            displayOrder: 999,
            attributeSchema: {},
            isActive: true,
          });
          category = {
            id: categoryId,
            code,
            name: legacyName.slice(0, 120),
            isActive: true,
          };
          categoryByCode.set(code.toLocaleUpperCase("id-ID"), category);
          categoryByName.set(category.name.toLocaleUpperCase("id-ID"), category);
          createdCategoryCount += 1;
        } else if (!category.isActive) {
          await transaction
            .update(productCategories)
            .set({ isActive: true, updatedAt: now })
            .where(eq(productCategories.id, category.id));
        }

        categoryIdByLegacyName.set(categoryKey, category.id);
      }

      const usedMasterCodes = new Set(
        existingMasters.map((master) => master.code.toLocaleUpperCase("id-ID")),
      );
      const existingMasterByCode = new Map(
        existingMasters.map((master) => [
          master.code.toLocaleUpperCase("id-ID"),
          master,
        ]),
      );
      const masterKey = (code: string, categoryId: string, name: string | null) =>
        JSON.stringify([legacySyncLabel(code), categoryId, legacySyncLabel(name)]);
      const masterByIdentity = new Map(existingMasters.map(master => {
        const metadata = master.attributes?.legacyImport as Record<string, unknown> | undefined;
        const sourceCode = typeof metadata?.legacyMasterCode === "string" ? metadata.legacyMasterCode : master.code;
        return [masterKey(sourceCode, master.categoryId, master.name), master];
      }));
      const masterIdByGroup = new Map<string, string>();
      const masterResolutionByLegacyCode = new Map<
        string,
        { id: string; source: "existing" | "created"; categoryId: string }
      >();
      let createdMasterCount = 0;
      let reusedMasterCount = 0;

      for (const row of rowsToCreate) {
        const groupKey = masterGroupingKey(row);
        if (masterIdByGroup.has(groupKey)) continue;

        const categoryName = getCategoryName(row.legacyCategory);
        const categoryId = categoryIdByLegacyName.get(
          categoryName.toLocaleUpperCase("id-ID"),
        );
        if (!categoryId) {
          throw directImportError(
            "CATEGORY_RESOLUTION_FAILED",
            `Kategori ${categoryName} gagal dibuat untuk import.`,
            500,
          );
        }

        const legacyCode = normalizeMasterCode(row.legacyMasterCode);
        const existing = legacyCode
          ? masterByIdentity.get(masterKey(legacyCode, categoryId, row.legacyMasterName)) ?? existingMasterByCode.get(legacyCode.toLocaleUpperCase("id-ID"))
          : null;

        if (existing && existing.categoryId === categoryId && legacySyncLabel(existing.name) === legacySyncLabel(row.legacyMasterName)) {
          if (existing.status !== "active") {
            await transaction
              .update(productMasters)
              .set({ status: "active", updatedAt: now })
              .where(eq(productMasters.id, existing.id));
          }
          masterIdByGroup.set(groupKey, existing.id);
          reusedMasterCount += 1;
          if (legacyCode) {
            masterResolutionByLegacyCode.set(legacyCode, {
              id: existing.id,
              source: "existing",
              categoryId,
            });
          }
          continue;
        }

        const fallbackCode = `LEGACY/${row.sourceSequence ?? row.rowNumber}`;
        const desiredCode = legacyCode ?? fallbackCode;
        const code = uniqueCode(desiredCode, usedMasterCodes, 64);
        const name = (
          compactText(row.legacyMasterName, 200) ??
          compactText(row.legacyItemName, 200) ??
          `Produk Legacy ${code}`
        ).slice(0, 200);
        const id = randomUUID();

        await transaction.insert(productMasters).values({
          id,
          organizationId: auth.organization.id,
          categoryId,
          code,
          name,
          description: "Product Master hasil import otomatis dari sistem legacy.",
          attributes: {
            legacyImport: {
              batchId,
              legacyMasterCode: row.legacyMasterCode,
              legacyCategory: row.legacyCategory,
              importedAt: now.toISOString(),
            },
          },
          status: "active",
        });

        const createdMaster = {
          id,
          code,
          name,
          categoryId,
          status: "active" as const,
          attributes: { legacyImport: { legacyMasterCode: row.legacyMasterCode } },
        };
        existingMasterByCode.set(code.toLocaleUpperCase("id-ID"), createdMaster);
        if (legacyCode) masterByIdentity.set(masterKey(legacyCode, categoryId, row.legacyMasterName), createdMaster);
        masterIdByGroup.set(groupKey, id);
        createdMasterCount += 1;
        if (legacyCode) {
          masterResolutionByLegacyCode.set(legacyCode, {
            id,
            source: "created",
            categoryId,
          });
        }
      }

      const mappingRows = await transaction
        .select({
          id: legacyProductMasterMappings.id,
          legacyMasterCode: legacyProductMasterMappings.legacyMasterCode,
        })
        .from(legacyProductMasterMappings)
        .where(eq(legacyProductMasterMappings.batchId, batchId));

      for (const mapping of mappingRows) {
        const resolution = masterResolutionByLegacyCode.get(
          normalizeMasterCode(mapping.legacyMasterCode) ?? "",
        );
        if (!resolution) continue;
        await transaction
          .update(legacyProductMasterMappings)
          .set({
            status: "mapped",
            mappingSource: resolution.source,
            targetCategoryId: resolution.categoryId,
            targetProductMasterId: resolution.id,
            reviewNotes: "Mapping dibuat otomatis saat direct import.",
            reviewedBy: auth.user.id,
            reviewedAt: now,
            updatedAt: now,
          })
          .where(eq(legacyProductMasterMappings.id, mapping.id));
      }

      const sequenceValues = rowsToCreate.length ? await getNextProductItemIdentifierBatch(
        (query) => transaction.execute(query),
        rowsToCreate.length,
      ) : [];
      if (sequenceValues.length !== rowsToCreate.length) {
        throw directImportError(
          "IDENTIFIER_ALLOCATION_FAILED",
          "Jumlah identitas item yang dialokasikan tidak sesuai jumlah baris import.",
          500,
        );
      }

      const activeAliasValues = new Set([
        ...existingAliases.map((row) => row.barcodeValue),
        ...existingItemBarcodes.map((row) => row.barcode),
      ]);
      let cleanupItemCount = 0;
      let legacyBarcodeAliasCount = 0;
      let systemOnlyBarcodeCount = 0;
      let imagePendingCount = 0;
      let imageMissingCount = 0;

      const itemValues: Array<typeof productItems.$inferInsert> = [];
      const aliasValues: Array<typeof itemBarcodes.$inferInsert> = [];
      const movementValues: Array<typeof inventoryMovements.$inferInsert> = [];

      for (const [index, row] of rowsToCreate.entries()) {
        const identifiers = formatProductItemIdentifiers(sequenceValues[index]!);
        const itemId = randomUUID();
        outcomeByRowId.get(row.id)!.itemId = itemId;
        const stockStatus = readLegacyStockStatus(row.rawData);
        const groupKey = masterGroupingKey(row);
        const productMasterId = masterIdByGroup.get(groupKey);
        if (!productMasterId) {
          throw directImportError(
            "MASTER_RESOLUTION_FAILED",
            `Product Master gagal ditentukan untuk Excel baris ${row.rowNumber}.`,
            500,
          );
        }

        const normalizedLegacyBarcode = compactText(row.normalizedBarcode, 120);
        const canUseLegacyAlias = Boolean(
          normalizedLegacyBarcode &&
            /^\d{6}$/.test(normalizedLegacyBarcode) &&
            !activeAliasValues.has(normalizedLegacyBarcode),
        );
        const legacyAlias = canUseLegacyAlias ? normalizedLegacyBarcode : null;
        if (legacyAlias) {
          activeAliasValues.add(legacyAlias);
          legacyBarcodeAliasCount += 1;
        } else {
          systemOnlyBarcodeCount += 1;
        }
        activeAliasValues.add(identifiers.barcode);

        const purity = normalizeLegacyPurityForItem(
          row.legacyPurity,
          row.legacyCategory,
        );
        const exchangePurity = normalizeLegacyPurityForItem(
          row.legacyExchangePurity,
          row.legacyCategory,
        );
        const weight = numericString(row.legacyWeightGram, { positive: true });
        const purityKey = normalizePurityKey(purity);
        const activeRate = purityKey
          ? activeRateByPurity.get(purityKey) ?? null
          : null;
        const basePrice = calculateJewelryBasePrice({
          weightGram: weight,
          ratePerGram: activeRate,
        });
        const deductionPerGram = wholeMoneyString(row.legacyDeductionPerGram);
        const imageStatus = row.legacyImageUrl ? "pending" : "missing";
        const needsCleanup =
          row.validationStatus !== "valid" ||
          !legacyAlias ||
          !weight ||
          !purity ||
          !compactText(row.legacyItemName, 220) ||
          !compactText(row.legacyMasterCode, 64);

        if (needsCleanup) cleanupItemCount += 1;
        if (row.legacyImageUrl) imagePendingCount += 1;
        else imageMissingCount += 1;

        itemValues.push({
          id: itemId,
          organizationId: auth.organization.id,
          productMasterId,
          displayName:
            compactText(row.legacyItemName, 220) ??
            compactText(row.legacyMasterName, 220) ??
            `Item Legacy ${row.sourceSequence ?? row.rowNumber}`,
          currentOutletId: batch.outletId,
          sku: identifiers.sku,
          barcode: identifiers.barcode,
          qrValue: identifiers.qrValue,
          legacyId: compactText(row.legacyBarcode, 120),
          legacyUrl: compactText(row.legacyImageUrl, 2_000),
          weightGram: weight,
          purityPercent: purity,
          exchangePurityPercent: exchangePurity,
          color: compactText(row.legacyColor, 64),
          costAmount: null,
          sellingAmount: basePrice === null ? null : String(basePrice),
          pricePerGram: activeRate,
          deductionPerGram,
          availability: stockStatus === "sold" ? "sold" : "available",
          condition: "good",
          locationState: stockStatus === "sold" ? "customer" : "outlet",
          locationCode: null,
          imageKey: null,
          attributes: importAttributes({
            batchId,
            rowId: row.id,
            rowNumber: row.rowNumber,
            sourceSequence: row.sourceSequence,
            rowFingerprint: row.rowFingerprint,
            legacyBarcode: row.legacyBarcode,
            legacyCategory: row.legacyCategory,
            legacyMasterCode: row.legacyMasterCode,
            legacyMasterName: row.legacyMasterName,
            legacyPricePerGram: row.legacyPricePerGram,
            validationStatus: row.validationStatus,
            validationIssues: row.validationIssues,
            imageStatus,
            importedAt: now,
            needsCleanup,
          }),
          internalNotes: null,
          isActive: true,
        });

        if (legacyAlias) {
          aliasValues.push({
            organizationId: auth.organization.id,
            itemId,
            barcodeValue: legacyAlias,
            barcodeFormat: "legacy-6-digit",
            source: "legacy_import",
            isPrimary: true,
            isActive: true,
            createdBy: auth.user.id,
          });
        }
        aliasValues.push({
          organizationId: auth.organization.id,
          itemId,
          barcodeValue: identifiers.barcode,
          barcodeFormat: "code128",
          source: "system_generated",
          isPrimary: !legacyAlias,
          isActive: true,
          createdBy: auth.user.id,
        });

        if (stockStatus === "available") movementValues.push({
          organizationId: auth.organization.id,
          itemId,
          movementType: "migration_opening",
          fromOutletId: null,
          toOutletId: batch.outletId,
          referenceType: "legacy_product_import_batch",
          referenceId: batchId,
          reason: "Direct import produk legacy ke stok tersedia.",
          metadata: {
            rowId: row.id,
            rowNumber: row.rowNumber,
            legacyBarcode: row.legacyBarcode,
            validationStatus: row.validationStatus,
            needsCleanup,
          },
          performedBy: auth.user.id,
          approvedBy: null,
          occurredAt: now,
        });
      }

      for (const values of chunk(itemValues, INSERT_CHUNK_SIZE)) {
        await transaction.insert(productItems).values(values);
      }
      for (const values of chunk(aliasValues, INSERT_CHUNK_SIZE)) {
        await transaction.insert(itemBarcodes).values(values);
      }
      for (const values of chunk(movementValues, INSERT_CHUNK_SIZE)) {
        await transaction.insert(inventoryMovements).values(values);
      }

      const result: LegacyDirectImportResult = {
        batchId,
        importedItemCount: itemValues.length,
        createdMasterCount,
        reusedMasterCount,
        createdCategoryCount,
        cleanupItemCount,
        legacyBarcodeAliasCount,
        systemOnlyBarcodeCount,
        imagePendingCount,
        imageMissingCount,
        syncVersion: 1,
        processedRowCount: rows.length,
        existingItemCount: sync.outcomes.filter(row => row.kind === "existing" || row.kind === "stock_updated").length,
        updatedStockCount: sync.outcomes.filter(row => row.kind === "stock_updated").length,
        deferredRowCount: sync.outcomes.filter(row => row.kind === "deferred").length,
        availableItemCount: rowsToCreate.filter(row => readLegacyStockStatus(row.rawData) === "available").length,
        soldItemCount: rowsToCreate.filter(row => readLegacyStockStatus(row.rawData) === "sold").length,
        soldSourceRowCount: sync.outcomes.filter(row => row.stockStatus === "sold").length,
        rowOutcomes: sync.outcomes,
      };

      const previousSummary =
        batch.validationSummary &&
        typeof batch.validationSummary === "object" &&
        !Array.isArray(batch.validationSummary)
          ? (batch.validationSummary as Record<string, unknown>)
          : {};

      await transaction
        .update(legacyProductImportBatches)
        .set({
          status: "ready",
          validationSummary: {
            ...previousSummary,
            directImport: {
              ...result,
              completedAt: now.toISOString(),
            },
          },
          errorMessage: null,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(legacyProductImportBatches.id, batchId));

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: batch.outletId,
        actorUserId: auth.user.id,
        action: "legacy_product_import.direct_commit",
        entityType: "legacy_product_import_batch",
        entityId: batchId,
        afterData: result,
        reason:
          "Sinkronisasi XLSX legacy: produk lama dikenali, produk baru ditambahkan sesuai status, dan baris ambigu ditunda. Transaksi RMS tetap dipertahankan.",
        ipAddress: requestMetadata.ipAddress ?? null,
        userAgent: requestMetadata.userAgent?.slice(0, 500) ?? null,
      });

      return result;
    });
  } catch (error) {
    if (error instanceof LegacyDirectImportError) throw error;
    throw directImportError(
      "DIRECT_IMPORT_FAILED",
      "Direct import produk legacy gagal. Tidak ada item parsial yang diaktifkan.",
      500,
      error,
    );
  }
}
