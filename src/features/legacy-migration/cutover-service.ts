import { createHash, randomUUID } from "node:crypto";

import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  inventoryMovements,
  itemBarcodes,
  legacyMigrationCutoverRuns,
  legacyMigrationSessions,
  legacyMigrationSoldRecords,
  legacyMigrationVerifications,
  legacyProductImportBatches,
  productCategories,
  productItems,
  productMasters,
} from "@/db/schema";
import { LEGACY_CUTOVER_CONFIRMATION } from "@/features/legacy-migration/cutover-contracts";
import { getLegacyCutoverItemIssues } from "@/features/legacy-migration/cutover-rules";
import { getLegacyMigrationSessionLockKey } from "@/features/legacy-migration/safety";

export type LegacyMigrationCutoverErrorCode =
  | "CUTOVER_SESSION_NOT_FOUND"
  | "CUTOVER_SESSION_NOT_LOCKED"
  | "CUTOVER_SESSION_UNRESOLVED"
  | "CUTOVER_SOLD_SESSION_UNASSIGNED"
  | "CUTOVER_APPROVED_ITEM_MISSING"
  | "CUTOVER_ITEM_INVALID"
  | "CUTOVER_ALIAS_BARCODE_MISMATCH"
  | "CUTOVER_OPENING_MOVEMENT_EXISTS"
  | "CUTOVER_MOVEMENT_INSERT_COUNT_MISMATCH"
  | "CUTOVER_ITEM_UPDATE_COUNT_MISMATCH"
  | "CUTOVER_VERIFICATION_UPDATE_COUNT_MISMATCH"
  | "CUTOVER_SESSION_UPDATE_COUNT_MISMATCH"
  | "CUTOVER_UNEXPECTED_ERROR";

export class LegacyMigrationCutoverError extends Error {
  readonly code: LegacyMigrationCutoverErrorCode;
  readonly detail: string | null;

  constructor(code: LegacyMigrationCutoverErrorCode, detail?: string | null) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "LegacyMigrationCutoverError";
    this.code = code;
    this.detail = detail ?? null;
  }
}

export type ExecuteLegacyMigrationCutoverInput = {
  organizationId: string;
  actorUserId: string;
  batchId: string;
  sessionId: string;
  requestMetadata?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  };
};

export type ExecuteLegacyMigrationCutoverResult = {
  runId: string;
  itemCount: number;
  alreadyExecuted: boolean;
  sessionName: string;
  operationId: string;
};

function cutoverMetadataSql(value: Record<string, unknown>) {
  return sql`jsonb_set(
    coalesce(${productItems.attributes}, '{}'::jsonb),
    '{legacyMigrationCutover}',
    ${JSON.stringify(value)}::jsonb,
    true
  )`;
}

function fail(
  code: Exclude<LegacyMigrationCutoverErrorCode, "CUTOVER_UNEXPECTED_ERROR">,
  detail?: string | null,
): never {
  throw new LegacyMigrationCutoverError(code, detail);
}

function readPostgresConstraint(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const constraint = (error as { constraint?: unknown }).constraint;
  return typeof constraint === "string" ? constraint : null;
}

function normalizeLegacyMigrationCutoverError(error: unknown): unknown {
  if (error instanceof LegacyMigrationCutoverError) return error;
  if (
    readPostgresConstraint(error) ===
    "inventory_movements_migration_opening_item_uq"
  ) {
    return new LegacyMigrationCutoverError(
      "CUTOVER_OPENING_MOVEMENT_EXISTS",
      "inventory_movements_migration_opening_item_uq",
    );
  }
  return error;
}

export function getLegacyMigrationCutoverErrorCode(
  error: unknown,
): LegacyMigrationCutoverErrorCode {
  const normalized = normalizeLegacyMigrationCutoverError(error);
  return normalized instanceof LegacyMigrationCutoverError
    ? normalized.code
    : "CUTOVER_UNEXPECTED_ERROR";
}

export function explainLegacyMigrationCutoverError(error: unknown) {
  const code = getLegacyMigrationCutoverErrorCode(error);
  if (code === "CUTOVER_SESSION_NOT_FOUND") {
    return "Sesi migrasi tidak ditemukan atau tidak dapat diakses.";
  }
  if (code === "CUTOVER_SESSION_NOT_LOCKED") {
    return "Sesi harus berstatus locked sebelum cutover.";
  }
  if (code === "CUTOVER_SESSION_UNRESOLVED") {
    return "Masih ada verification pada sesi ini yang belum selesai direview.";
  }
  if (code === "CUTOVER_SOLD_SESSION_UNASSIGNED") {
    return "Masih ada barang terjual yang belum ditentukan sesi etalasenya.";
  }
  if (code === "CUTOVER_OPENING_MOVEMENT_EXISTS") {
    return "Saldo awal migrasi untuk salah satu item sudah pernah tercatat. Cutover dibatalkan agar movement tidak terduplikasi.";
  }
  if (
    code === "CUTOVER_APPROVED_ITEM_MISSING" ||
    code === "CUTOVER_ITEM_INVALID" ||
    code === "CUTOVER_ALIAS_BARCODE_MISMATCH" ||
    code === "CUTOVER_MOVEMENT_INSERT_COUNT_MISMATCH" ||
    code === "CUTOVER_ITEM_UPDATE_COUNT_MISMATCH" ||
    code === "CUTOVER_VERIFICATION_UPDATE_COUNT_MISMATCH" ||
    code === "CUTOVER_SESSION_UPDATE_COUNT_MISMATCH"
  ) {
    return "Data item berubah setelah preflight. Muat ulang rekonsiliasi dan perbaiki blocker yang muncul.";
  }
  return "Cutover gagal dan seluruh transaksi telah di-rollback. Tidak ada stok parsial yang diaktifkan.";
}

async function recordFailedCutoverAttempt(input: {
  operationId: string;
  startedAt: Date;
  cutover: ExecuteLegacyMigrationCutoverInput;
  error: unknown;
}) {
  const errorCode = getLegacyMigrationCutoverErrorCode(input.error);
  const errorDetail =
    input.error instanceof LegacyMigrationCutoverError
      ? input.error.detail
      : null;
  const finishedAt = new Date();

  const [session] = await db
    .select({
      outletId: legacyMigrationSessions.outletId,
      name: legacyMigrationSessions.name,
    })
    .from(legacyMigrationSessions)
    .where(
      and(
        eq(legacyMigrationSessions.id, input.cutover.sessionId),
        eq(legacyMigrationSessions.batchId, input.cutover.batchId),
        eq(
          legacyMigrationSessions.organizationId,
          input.cutover.organizationId,
        ),
      ),
    )
    .limit(1);

  await db.insert(auditLogs).values({
    organizationId: input.cutover.organizationId,
    outletId: session?.outletId ?? null,
    actorUserId: input.cutover.actorUserId,
    action: "legacy_migration_cutover.failed",
    entityType: "legacy_migration_session",
    entityId: input.cutover.sessionId,
    requestId: input.operationId,
    afterData: {
      status: "failed",
      operationId: input.operationId,
      batchId: input.cutover.batchId,
      sessionId: input.cutover.sessionId,
      sessionName: session?.name ?? null,
      errorCode,
      errorDetail,
      rollbackGuaranteed: true,
      rollbackConfirmed: true,
      retryAllowed: true,
      startedAt: input.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Math.max(0, finishedAt.getTime() - input.startedAt.getTime()),
    },
    reason: explainLegacyMigrationCutoverError(input.error),
    ipAddress: input.cutover.requestMetadata?.ipAddress ?? null,
    userAgent: input.cutover.requestMetadata?.userAgent ?? null,
    metadata: {
      milestone: "MIGRATION-R5F3",
      rollbackGuaranteed: true,
      rollbackConfirmed: true,
    },
  });
}

async function recoverCommittedCutoverAfterError(input: {
  operationId: string;
  cutover: ExecuteLegacyMigrationCutoverInput;
  error: unknown;
}): Promise<ExecuteLegacyMigrationCutoverResult | null> {
  const [run] = await db
    .select({
      id: legacyMigrationCutoverRuns.id,
      itemCount: legacyMigrationCutoverRuns.itemCount,
      sessionName: legacyMigrationSessions.name,
      outletId: legacyMigrationSessions.outletId,
    })
    .from(legacyMigrationCutoverRuns)
    .innerJoin(
      legacyMigrationSessions,
      eq(legacyMigrationCutoverRuns.sessionId, legacyMigrationSessions.id),
    )
    .where(
      and(
        eq(legacyMigrationCutoverRuns.sessionId, input.cutover.sessionId),
        eq(legacyMigrationCutoverRuns.batchId, input.cutover.batchId),
        eq(
          legacyMigrationCutoverRuns.organizationId,
          input.cutover.organizationId,
        ),
      ),
    )
    .limit(1);

  if (!run) return null;

  await db
    .insert(auditLogs)
    .values({
      organizationId: input.cutover.organizationId,
      outletId: run.outletId,
      actorUserId: input.cutover.actorUserId,
      action: "legacy_migration_cutover.recovered_after_error",
      entityType: "legacy_migration_cutover_run",
      entityId: run.id,
      requestId: input.operationId,
      afterData: {
        status: "succeeded",
        batchId: input.cutover.batchId,
        sessionId: input.cutover.sessionId,
        runId: run.id,
        itemCount: run.itemCount,
        originalErrorCode: getLegacyMigrationCutoverErrorCode(input.error),
        duplicateChangesCreated: false,
      },
      reason:
        "Koneksi mengembalikan error, tetapi cutover run sudah tersimpan. Hasil dipulihkan sebagai sukses tanpa perubahan kedua.",
      ipAddress: input.cutover.requestMetadata?.ipAddress ?? null,
      userAgent: input.cutover.requestMetadata?.userAgent ?? null,
      metadata: {
        milestone: "MIGRATION-R5F3",
        recoveredCommittedOutcome: true,
      },
    })
    .catch(() => undefined);

  return {
    runId: run.id,
    itemCount: run.itemCount,
    alreadyExecuted: true,
    sessionName: run.sessionName,
    operationId: input.operationId,
  };
}

export async function executeLegacyMigrationCutover(
  input: ExecuteLegacyMigrationCutoverInput,
): Promise<ExecuteLegacyMigrationCutoverResult> {
  const operationId = randomUUID();
  const startedAt = new Date();

  try {
    return await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-cutover:${input.organizationId}:${input.batchId}`}, 0))`,
      );
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${getLegacyMigrationSessionLockKey(
          {
            organizationId: input.organizationId,
            sessionId: input.sessionId,
          },
        )}, 0))`,
      );

      const [session] = await transaction
        .select({
          id: legacyMigrationSessions.id,
          name: legacyMigrationSessions.name,
          status: legacyMigrationSessions.status,
          batchId: legacyMigrationSessions.batchId,
          organizationId: legacyMigrationSessions.organizationId,
          outletId: legacyMigrationSessions.outletId,
          expectedItemCount: legacyMigrationSessions.expectedItemCount,
          batchOutletId: legacyProductImportBatches.outletId,
        })
        .from(legacyMigrationSessions)
        .innerJoin(
          legacyProductImportBatches,
          eq(legacyMigrationSessions.batchId, legacyProductImportBatches.id),
        )
        .where(
          and(
            eq(legacyMigrationSessions.id, input.sessionId),
            eq(legacyMigrationSessions.batchId, input.batchId),
            eq(legacyMigrationSessions.organizationId, input.organizationId),
            eq(
              legacyProductImportBatches.organizationId,
              input.organizationId,
            ),
          ),
        )
        .limit(1)
        .for("update");

      if (!session || session.outletId !== session.batchOutletId) {
        fail("CUTOVER_SESSION_NOT_FOUND");
      }

      const [existingRun] = await transaction
        .select({
          id: legacyMigrationCutoverRuns.id,
          itemCount: legacyMigrationCutoverRuns.itemCount,
        })
        .from(legacyMigrationCutoverRuns)
        .where(eq(legacyMigrationCutoverRuns.sessionId, session.id))
        .limit(1);

      if (existingRun) {
        await transaction.insert(auditLogs).values({
          organizationId: input.organizationId,
          outletId: session.outletId,
          actorUserId: input.actorUserId,
          action: "legacy_migration_cutover.idempotent_retry",
          entityType: "legacy_migration_cutover_run",
          entityId: existingRun.id,
          requestId: operationId,
          afterData: {
            batchId: input.batchId,
            sessionId: session.id,
            sessionName: session.name,
            existingRunId: existingRun.id,
            itemCount: existingRun.itemCount,
            duplicateChangesCreated: false,
          },
          reason: "Mengenali retry cutover yang sudah berhasil sebelumnya.",
          ipAddress: input.requestMetadata?.ipAddress ?? null,
          userAgent: input.requestMetadata?.userAgent ?? null,
          metadata: { milestone: "MIGRATION-R5F3" },
        });

        return {
          runId: existingRun.id,
          itemCount: existingRun.itemCount,
          alreadyExecuted: true,
          sessionName: session.name,
          operationId,
        };
      }

      if (session.status !== "locked") {
        fail("CUTOVER_SESSION_NOT_LOCKED");
      }

      const [sessionState] = await transaction
        .select({
          total: count(),
          unresolved:
            sql<number>`count(*) filter (where ${legacyMigrationVerifications.status} in ('submitted', 'needs_review', 'returned'))::int`.mapWith(
              Number,
            ),
          approved:
            sql<number>`count(*) filter (where ${legacyMigrationVerifications.status} = 'approved')::int`.mapWith(
              Number,
            ),
          activated:
            sql<number>`count(*) filter (where ${legacyMigrationVerifications.status} = 'activated')::int`.mapWith(
              Number,
            ),
          sold:
            sql<number>`count(*) filter (where ${legacyMigrationVerifications.status} = 'sold_during_migration')::int`.mapWith(
              Number,
            ),
          rejected:
            sql<number>`count(*) filter (where ${legacyMigrationVerifications.status} = 'rejected')::int`.mapWith(
              Number,
            ),
        })
        .from(legacyMigrationVerifications)
        .where(
          and(
            eq(legacyMigrationVerifications.sessionId, session.id),
            eq(legacyMigrationVerifications.batchId, input.batchId),
            eq(
              legacyMigrationVerifications.organizationId,
              input.organizationId,
            ),
          ),
        );

      const [soldBeforeScan] = await transaction
        .select({ total: count() })
        .from(legacyMigrationSoldRecords)
        .where(
          and(
            eq(legacyMigrationSoldRecords.sessionId, session.id),
            eq(legacyMigrationSoldRecords.batchId, input.batchId),
            eq(
              legacyMigrationSoldRecords.organizationId,
              input.organizationId,
            ),
            isNull(legacyMigrationSoldRecords.verificationId),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        );

      const [unassignedSold] = await transaction
        .select({ total: count() })
        .from(legacyMigrationSoldRecords)
        .where(
          and(
            eq(legacyMigrationSoldRecords.batchId, input.batchId),
            eq(
              legacyMigrationSoldRecords.organizationId,
              input.organizationId,
            ),
            isNull(legacyMigrationSoldRecords.sessionId),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        );

      const unresolved = Number(sessionState?.unresolved ?? 0);
      const processedItems =
        Number(sessionState?.total ?? 0) + Number(soldBeforeScan?.total ?? 0);
      if (unresolved > 0) fail("CUTOVER_SESSION_UNRESOLVED");
      if (Number(unassignedSold?.total ?? 0) > 0) {
        fail("CUTOVER_SOLD_SESSION_UNASSIGNED");
      }

      const initialRows = await transaction
        .select({
          verificationId: legacyMigrationVerifications.id,
          barcodeValue: legacyMigrationVerifications.barcodeValue,
        })
        .from(legacyMigrationVerifications)
        .where(
          and(
            eq(legacyMigrationVerifications.sessionId, session.id),
            eq(legacyMigrationVerifications.batchId, input.batchId),
            eq(
              legacyMigrationVerifications.organizationId,
              input.organizationId,
            ),
            eq(legacyMigrationVerifications.status, "approved"),
          ),
        );

      const barcodeValues = initialRows
        .map((row) => row.barcodeValue)
        .sort((left, right) => left.localeCompare(right));
      for (const barcodeValue of barcodeValues) {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-barcode:${input.organizationId}:${barcodeValue}`}, 0))`,
        );
      }

      const approvedRows = await transaction
        .select({
          verificationId: legacyMigrationVerifications.id,
          barcodeValue: legacyMigrationVerifications.barcodeValue,
          source: legacyMigrationVerifications.source,
          targetProductMasterId:
            legacyMigrationVerifications.targetProductMasterId,
          productItemId: productItems.id,
          itemProductMasterId: productItems.productMasterId,
          itemAvailability: productItems.availability,
          itemIsActive: productItems.isActive,
          itemOutletId: productItems.currentOutletId,
          itemLegacyId: productItems.legacyId,
          itemSellingAmount: productItems.sellingAmount,
          itemPricePerGram: productItems.pricePerGram,
          itemDeductionPerGram: productItems.deductionPerGram,
          itemCondition: productItems.condition,
          itemLocationState: productItems.locationState,
          masterStatus: productMasters.status,
          categoryName: productCategories.name,
          categoryIsActive: productCategories.isActive,
        })
        .from(legacyMigrationVerifications)
        .innerJoin(
          productItems,
          eq(legacyMigrationVerifications.productItemId, productItems.id),
        )
        .innerJoin(
          productMasters,
          eq(productItems.productMasterId, productMasters.id),
        )
        .innerJoin(
          productCategories,
          eq(productMasters.categoryId, productCategories.id),
        )
        .where(
          and(
            eq(legacyMigrationVerifications.sessionId, session.id),
            eq(legacyMigrationVerifications.batchId, input.batchId),
            eq(
              legacyMigrationVerifications.organizationId,
              input.organizationId,
            ),
            eq(legacyMigrationVerifications.status, "approved"),
          ),
        )
        .orderBy(legacyMigrationVerifications.barcodeValue)
        .for("update");

      if (approvedRows.length !== initialRows.length) {
        fail("CUTOVER_APPROVED_ITEM_MISSING");
      }

      const itemIds = approvedRows.map((row) => row.productItemId);
      const aliases = itemIds.length
        ? await transaction
            .select({
              id: itemBarcodes.id,
              itemId: itemBarcodes.itemId,
              barcodeValue: itemBarcodes.barcodeValue,
              source: itemBarcodes.source,
              isPrimary: itemBarcodes.isPrimary,
              isActive: itemBarcodes.isActive,
            })
            .from(itemBarcodes)
            .where(
              and(
                eq(itemBarcodes.organizationId, input.organizationId),
                inArray(itemBarcodes.itemId, itemIds),
                inArray(itemBarcodes.barcodeValue, barcodeValues),
                eq(itemBarcodes.isActive, true),
              ),
            )
            .for("update")
        : [];
      const aliasByItemAndBarcode = new Map(
        aliases.map((alias) => [
          `${alias.itemId}:${alias.barcodeValue}`,
          alias,
        ]),
      );

      const activeSoldRecords = barcodeValues.length
        ? await transaction
            .select({ barcodeValue: legacyMigrationSoldRecords.barcodeValue })
            .from(legacyMigrationSoldRecords)
            .where(
              and(
                eq(
                  legacyMigrationSoldRecords.organizationId,
                  input.organizationId,
                ),
                inArray(legacyMigrationSoldRecords.barcodeValue, barcodeValues),
                isNull(legacyMigrationSoldRecords.revertedAt),
              ),
            )
            .for("update")
        : [];
      const soldBarcodeSet = new Set(
        activeSoldRecords.map((record) => record.barcodeValue),
      );

      const existingOpeningMovements = itemIds.length
        ? await transaction
            .select({ itemId: inventoryMovements.itemId })
            .from(inventoryMovements)
            .where(
              and(
                eq(inventoryMovements.organizationId, input.organizationId),
                inArray(inventoryMovements.itemId, itemIds),
                eq(inventoryMovements.movementType, "migration_opening"),
              ),
            )
            .for("update")
        : [];
      if (existingOpeningMovements.length > 0) {
        fail(
          "CUTOVER_OPENING_MOVEMENT_EXISTS",
          existingOpeningMovements[0]?.itemId ?? null,
        );
      }

      for (const row of approvedRows) {
        const alias =
          aliasByItemAndBarcode.get(
            `${row.productItemId}:${row.barcodeValue}`,
          ) ?? null;
        const issues = getLegacyCutoverItemIssues({
          source: row.source,
          barcodeValue: row.barcodeValue,
          batchOutletId: session.batchOutletId,
          targetProductMasterId: row.targetProductMasterId,
          productItemId: row.productItemId,
          itemProductMasterId: row.itemProductMasterId,
          itemAvailability: row.itemAvailability,
          itemIsActive: row.itemIsActive,
          itemOutletId: row.itemOutletId,
          itemLegacyId: row.itemLegacyId,
          itemSellingAmount: row.itemSellingAmount,
          itemPricePerGram: row.itemPricePerGram,
          itemDeductionPerGram: row.itemDeductionPerGram,
          itemCondition: row.itemCondition,
          itemLocationState: row.itemLocationState,
          masterStatus: row.masterStatus,
          categoryName: row.categoryName,
          categoryIsActive: row.categoryIsActive,
          aliasId: alias?.id ?? null,
          aliasSource: alias?.source ?? null,
          aliasIsPrimary: alias?.isPrimary ?? null,
          aliasIsActive: alias?.isActive ?? null,
          hasActiveSoldRecord: soldBarcodeSet.has(row.barcodeValue),
        });
        if (issues.length > 0) {
          fail("CUTOVER_ITEM_INVALID", issues[0] ?? null);
        }
        if (alias?.barcodeValue !== row.barcodeValue) {
          fail("CUTOVER_ALIAS_BARCODE_MISMATCH");
        }
      }

      const executedAt = new Date();
      const runId = randomUUID();
      const barcodeSnapshot = approvedRows.map((row) => ({
        verificationId: row.verificationId,
        productItemId: row.productItemId,
        barcodeValue: row.barcodeValue,
      }));
      const barcodeDigest = createHash("sha256")
        .update(JSON.stringify(barcodeSnapshot))
        .digest("hex");
      const durationMs = Math.max(0, executedAt.getTime() - startedAt.getTime());

      await transaction.insert(legacyMigrationCutoverRuns).values({
        id: runId,
        batchId: input.batchId,
        sessionId: session.id,
        organizationId: input.organizationId,
        outletId: session.outletId,
        itemCount: approvedRows.length,
        executedBy: input.actorUserId,
        executedAt,
        metadata: {
          milestone: "MIGRATION-R5F3",
          operationId,
          confirmation: LEGACY_CUTOVER_CONFIRMATION,
          sessionName: session.name,
          barcodeCount: approvedRows.length,
          barcodeDigest,
          expectedItemCount: session.expectedItemCount,
          processedItemCount: processedItems,
          approvedVerificationCount: Number(sessionState?.approved ?? 0),
          activatedVerificationCountBeforeRun: Number(
            sessionState?.activated ?? 0,
          ),
          soldVerificationCount: Number(sessionState?.sold ?? 0),
          rejectedVerificationCount: Number(sessionState?.rejected ?? 0),
          soldBeforeScanCount: Number(soldBeforeScan?.total ?? 0),
          pricingValidated: true,
          preflightBlockerCount: 0,
          startedAt: startedAt.toISOString(),
          finishedAt: executedAt.toISOString(),
          durationMs,
        },
      });

      if (approvedRows.length > 0) {
        const insertedMovements = await transaction
          .insert(inventoryMovements)
          .values(
            approvedRows.map((row) => ({
              organizationId: input.organizationId,
              itemId: row.productItemId,
              movementType: "migration_opening" as const,
              fromOutletId: null,
              toOutletId: session.outletId,
              referenceType: "legacy_migration_cutover",
              referenceId: runId,
              reason: "Saldo awal stok dari cutover migrasi legacy.",
              metadata: {
                batchId: input.batchId,
                sessionId: session.id,
                verificationId: row.verificationId,
                legacyBarcode: row.barcodeValue,
              },
              performedBy: input.actorUserId,
              approvedBy: input.actorUserId,
              occurredAt: executedAt,
            })),
          )
          .returning({ id: inventoryMovements.id });
        if (insertedMovements.length !== approvedRows.length) {
          fail("CUTOVER_MOVEMENT_INSERT_COUNT_MISMATCH");
        }

        const cutoverMetadata = {
          runId,
          operationId,
          batchId: input.batchId,
          sessionId: session.id,
          activatedAt: executedAt.toISOString(),
          activatedBy: input.actorUserId,
          barcodeDigest,
        };
        const updatedItems = await transaction
          .update(productItems)
          .set({
            availability: "available",
            attributes: cutoverMetadataSql(cutoverMetadata),
            updatedAt: executedAt,
          })
          .where(
            and(
              inArray(productItems.id, itemIds),
              eq(productItems.organizationId, input.organizationId),
              eq(productItems.availability, "migration_hold"),
            ),
          )
          .returning({ id: productItems.id });
        if (updatedItems.length !== approvedRows.length) {
          fail("CUTOVER_ITEM_UPDATE_COUNT_MISMATCH");
        }

        const updatedVerifications = await transaction
          .update(legacyMigrationVerifications)
          .set({ status: "activated", updatedAt: executedAt })
          .where(
            and(
              inArray(
                legacyMigrationVerifications.id,
                approvedRows.map((row) => row.verificationId),
              ),
              eq(legacyMigrationVerifications.sessionId, session.id),
              eq(legacyMigrationVerifications.status, "approved"),
            ),
          )
          .returning({ id: legacyMigrationVerifications.id });
        if (updatedVerifications.length !== approvedRows.length) {
          fail("CUTOVER_VERIFICATION_UPDATE_COUNT_MISMATCH");
        }
      }

      const completedSessions = await transaction
        .update(legacyMigrationSessions)
        .set({
          status: "completed",
          completedAt: executedAt,
          updatedAt: executedAt,
        })
        .where(
          and(
            eq(legacyMigrationSessions.id, session.id),
            eq(legacyMigrationSessions.organizationId, input.organizationId),
            eq(legacyMigrationSessions.status, "locked"),
          ),
        )
        .returning({ id: legacyMigrationSessions.id });
      if (completedSessions.length !== 1) {
        fail("CUTOVER_SESSION_UPDATE_COUNT_MISMATCH");
      }

      await transaction.insert(auditLogs).values({
        organizationId: input.organizationId,
        outletId: session.outletId,
        actorUserId: input.actorUserId,
        action: "legacy_migration_cutover.execute",
        entityType: "legacy_migration_cutover_run",
        entityId: runId,
        requestId: operationId,
        afterData: {
          status: "succeeded",
          batchId: input.batchId,
          sessionId: session.id,
          sessionName: session.name,
          itemCount: approvedRows.length,
          movementCount: approvedRows.length,
          expectedItemCount: session.expectedItemCount,
          processedItemCount: processedItems,
          pricingValidated: true,
          barcodeDigest,
          movementType: "migration_opening",
          resultingAvailability: "available",
          startedAt: startedAt.toISOString(),
          finishedAt: executedAt.toISOString(),
          durationMs,
        },
        reason: "Mengaktifkan stok hasil migrasi secara transactional.",
        ipAddress: input.requestMetadata?.ipAddress ?? null,
        userAgent: input.requestMetadata?.userAgent ?? null,
        metadata: {
          milestone: "MIGRATION-R5F3",
          rollbackOnFailure: true,
        },
      });

      return {
        runId,
        itemCount: approvedRows.length,
        alreadyExecuted: false,
        sessionName: session.name,
        operationId,
      };
    });
  } catch (error) {
    const normalizedError = normalizeLegacyMigrationCutoverError(error);
    let recovered: ExecuteLegacyMigrationCutoverResult | null;
    try {
      recovered = await recoverCommittedCutoverAfterError({
        operationId,
        cutover: input,
        error: normalizedError,
      });
    } catch {
      // Outcome belum dapat dikonfirmasi ketika database tidak bisa dibaca ulang.
      // Retry berikutnya tetap aman karena session/run idempotency guard.
      throw normalizedError;
    }
    if (recovered) return recovered;

    await recordFailedCutoverAttempt({
      operationId,
      startedAt,
      cutover: input,
      error: normalizedError,
    }).catch(() => undefined);
    throw normalizedError;
  }
}
