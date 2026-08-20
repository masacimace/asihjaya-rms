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
import {
  calculateJewelryBasePrice,
  getActiveGoldPriceRates,
  normalizePurityKey,
} from "@/features/pricing/metal-price-rates";
import type { AuthContext } from "@/lib/auth/session";

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
};


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

  const prior = (validationSummary as Record<string, unknown>).directImport;
  if (!prior || typeof prior !== "object" || Array.isArray(prior)) {
    return null;
  }

  const data = prior as Record<string, unknown>;
  const importedItemCount = Number(data.importedItemCount ?? 0);
  if (!Number.isFinite(importedItemCount) || importedItemCount <= 0) {
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
  if (code) return `CODE:${code}`;

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
      if (storedResult) {
        if (batch.status !== "ready") {
          await transaction
            .update(legacyProductImportBatches)
            .set({
              status: "ready",
              errorMessage: null,
              completedAt: now,
              updatedAt: now,
            })
            .where(eq(legacyProductImportBatches.id, batchId));

          await transaction.insert(auditLogs).values({
            organizationId: auth.organization.id,
            outletId: batch.outletId,
            actorUserId: auth.user.id,
            action: "legacy_product_import.status_recovered",
            entityType: "legacy_product_import_batch",
            entityId: batchId,
            afterData: storedResult,
            reason:
              "Status batch dipulihkan menjadi ready karena direct import sebelumnya sudah committed dan memiliki summary final.",
            ipAddress: requestMetadata.ipAddress ?? null,
            userAgent: requestMetadata.userAgent?.slice(0, 500) ?? null,
          });
        }

        return storedResult;
      }
      if (batch.status !== "processing" && batch.status !== "failed") {
        throw directImportError(
          "BATCH_STATUS_INVALID",
          `Batch dengan status ${batch.status} tidak dapat diimport langsung.`,
          409,
        );
      }

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

      const [categoryRows, existingMasters, existingAliases, existingItemBarcodes] = await Promise.all([
        transaction
          .select({
            id: productCategories.id,
            code: productCategories.code,
            name: productCategories.name,
            isActive: productCategories.isActive,
          })
          .from(productCategories)
          .where(eq(productCategories.organizationId, auth.organization.id)),
        transaction
          .select({
            id: productMasters.id,
            code: productMasters.code,
            name: productMasters.name,
            categoryId: productMasters.categoryId,
            status: productMasters.status,
          })
          .from(productMasters)
          .where(eq(productMasters.organizationId, auth.organization.id)),
        transaction
          .select({ barcodeValue: itemBarcodes.barcodeValue })
          .from(itemBarcodes)
          .where(
            and(
              eq(itemBarcodes.organizationId, auth.organization.id),
              eq(itemBarcodes.isActive, true),
            ),
          ),
        transaction
          .select({ barcode: productItems.barcode })
          .from(productItems)
          .where(eq(productItems.organizationId, auth.organization.id)),
      ]);

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
      for (const row of rows) {
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
      const masterIdByGroup = new Map<string, string>();
      const masterResolutionByLegacyCode = new Map<
        string,
        { id: string; source: "existing" | "created"; categoryId: string }
      >();
      let createdMasterCount = 0;
      let reusedMasterCount = 0;

      for (const row of rows) {
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
          ? existingMasterByCode.get(legacyCode.toLocaleUpperCase("id-ID"))
          : null;

        if (existing && existing.categoryId === categoryId) {
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

        existingMasterByCode.set(code.toLocaleUpperCase("id-ID"), {
          id,
          code,
          name,
          categoryId,
          status: "active",
        });
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

      const sequenceValues = await getNextProductItemIdentifierBatch(
        (query) => transaction.execute(query),
        rows.length,
      );
      if (sequenceValues.length !== rows.length) {
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

      for (const [index, row] of rows.entries()) {
        const identifiers = formatProductItemIdentifiers(sequenceValues[index]!);
        const itemId = randomUUID();
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
          availability: "available",
          condition: "good",
          locationState: "outlet",
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

        movementValues.push({
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
          "Semua baris XLSX legacy diimport langsung sebagai item tersedia tanpa stock opname, review, migration hold, reconciliation, atau cutover.",
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
