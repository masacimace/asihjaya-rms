"use server";

import { randomUUID } from "node:crypto";

import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  inventoryMovements,
  itemBarcodes,
  legacyMigrationCutoverRuns,
  legacyMigrationSessions,
  legacyMigrationSoldRecords,
  legacyMigrationVerifications,
  productCategories,
  productItems,
  productMasters,
} from "@/db/schema";
import { LEGACY_CUTOVER_CONFIRMATION } from "@/features/legacy-migration/cutover-contracts";
import { getLegacyMigrationCutoverData } from "@/features/legacy-migration/cutover-queries";
import { getLegacyCutoverItemIssues } from "@/features/legacy-migration/cutover-rules";
import {
  getLegacyMigrationSessionLockKey,
  parseLegacyMigrationUuid,
} from "@/features/legacy-migration/safety";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

function readText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "").trim().slice(0, maxLength);
}

function cutoverPath(batchId: string) {
  return `/admin/migrasi-produk/${batchId}/cutover`;
}

function redirectWithMessage(
  path: string,
  type: "success" | "error",
  message: string,
): never {
  redirect(`${path}?${new URLSearchParams({ type, message }).toString()}`);
}

function explainCutoverError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
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
  if (
    code === "CUTOVER_APPROVED_ITEM_MISSING" ||
    code.startsWith("CUTOVER_ITEM_INVALID:") ||
    code === "CUTOVER_ALIAS_BARCODE_MISMATCH" ||
    code === "CUTOVER_ITEM_UPDATE_COUNT_MISMATCH" ||
    code === "CUTOVER_VERIFICATION_UPDATE_COUNT_MISMATCH" ||
    code === "CUTOVER_SESSION_UPDATE_COUNT_MISMATCH"
  ) {
    return "Data item berubah setelah preflight. Muat ulang rekonsiliasi dan perbaiki blocker yang muncul.";
  }
  return "Cutover gagal dan seluruh transaksi telah di-rollback. Tidak ada stok parsial yang diaktifkan.";
}

function cutoverMetadataSql(value: Record<string, unknown>) {
  return sql`jsonb_set(
    coalesce(${productItems.attributes}, '{}'::jsonb),
    '{legacyMigrationCutover}',
    ${JSON.stringify(value)}::jsonb,
    true
  )`;
}

export async function executeLegacyMigrationCutoverAction(
  formData: FormData,
) {
  const auth = await requirePermission("migration.cutover.execute");
  const batchId = parseLegacyMigrationUuid(
    readText(formData, "batchId", 36),
  );
  const sessionId = parseLegacyMigrationUuid(
    readText(formData, "sessionId", 36),
  );
  const confirmation = readText(formData, "confirmation", 40).toUpperCase();

  if (!batchId || !sessionId) {
    redirectWithMessage(
      "/admin/migrasi-produk",
      "error",
      "Batch atau sesi cutover tidak valid.",
    );
  }
  if (confirmation !== LEGACY_CUTOVER_CONFIRMATION) {
    redirectWithMessage(
      cutoverPath(batchId),
      "error",
      `Ketik ${LEGACY_CUTOVER_CONFIRMATION} untuk menjalankan aktivasi.`,
    );
  }

  const preflight = await getLegacyMigrationCutoverData(auth, batchId);
  const selectedPreflight = preflight?.sessions.find(
    (session) => session.id === sessionId,
  );
  if (!preflight || !selectedPreflight) {
    redirectWithMessage(
      "/admin/migrasi-produk",
      "error",
      "Batch atau sesi migrasi tidak ditemukan.",
    );
  }
  if (selectedPreflight.cutoverRun) {
    redirectWithMessage(
      cutoverPath(batchId),
      "success",
      "Sesi tersebut sudah pernah diaktifkan. Tidak ada perubahan kedua yang dibuat.",
    );
  }
  if (!selectedPreflight.canExecute) {
    redirectWithMessage(
      cutoverPath(batchId),
      "error",
      "Preflight belum siap. Selesaikan blocker rekonsiliasi sebelum aktivasi.",
    );
  }

  const headerStore = await headers();
  const requestMetadata = {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };

  let result: {
    itemCount: number;
    alreadyExecuted: boolean;
    sessionName: string;
  };
  try {
    result = await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-cutover:${auth.organization.id}:${batchId}`}, 0))`,
      );
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${getLegacyMigrationSessionLockKey({
          organizationId: auth.organization.id,
          sessionId,
        })}, 0))`,
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
      })
      .from(legacyMigrationSessions)
      .where(
        and(
          eq(legacyMigrationSessions.id, sessionId),
          eq(legacyMigrationSessions.batchId, batchId),
          eq(legacyMigrationSessions.organizationId, auth.organization.id),
          eq(legacyMigrationSessions.outletId, preflight.batch.outletId),
        ),
      )
      .limit(1)
      .for("update");

      if (!session) throw new Error("CUTOVER_SESSION_NOT_FOUND");

      const [existingRun] = await transaction
        .select({ id: legacyMigrationCutoverRuns.id })
        .from(legacyMigrationCutoverRuns)
        .where(eq(legacyMigrationCutoverRuns.sessionId, session.id))
        .limit(1);
      if (existingRun) {
        return {
          itemCount: 0,
          alreadyExecuted: true,
          sessionName: session.name,
        };
      }

      if (session.status !== "locked") {
        throw new Error("CUTOVER_SESSION_NOT_LOCKED");
      }

      const [sessionState] = await transaction
        .select({
          total: count(),
          unresolved:
            sql<number>`count(*) filter (where ${legacyMigrationVerifications.status} in ('submitted', 'needs_review', 'returned'))::int`.mapWith(
              Number,
            ),
        })
        .from(legacyMigrationVerifications)
        .where(
          and(
            eq(legacyMigrationVerifications.sessionId, session.id),
            eq(legacyMigrationVerifications.batchId, batchId),
            eq(legacyMigrationVerifications.organizationId, auth.organization.id),
          ),
        );

      const [soldBeforeScan] = await transaction
        .select({ total: count() })
        .from(legacyMigrationSoldRecords)
        .where(
          and(
            eq(legacyMigrationSoldRecords.sessionId, session.id),
            eq(legacyMigrationSoldRecords.batchId, batchId),
            eq(legacyMigrationSoldRecords.organizationId, auth.organization.id),
            isNull(legacyMigrationSoldRecords.verificationId),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        );

      const [unassignedSold] = await transaction
        .select({ total: count() })
        .from(legacyMigrationSoldRecords)
        .where(
          and(
            eq(legacyMigrationSoldRecords.batchId, batchId),
            eq(legacyMigrationSoldRecords.organizationId, auth.organization.id),
            isNull(legacyMigrationSoldRecords.sessionId),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        );

      const unresolved = Number(sessionState?.unresolved ?? 0);
      const processedItems =
        Number(sessionState?.total ?? 0) + Number(soldBeforeScan?.total ?? 0);
      if (unresolved > 0) throw new Error("CUTOVER_SESSION_UNRESOLVED");
      if (Number(unassignedSold?.total ?? 0) > 0) {
        throw new Error("CUTOVER_SOLD_SESSION_UNASSIGNED");
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
            eq(legacyMigrationVerifications.batchId, batchId),
            eq(legacyMigrationVerifications.organizationId, auth.organization.id),
            eq(legacyMigrationVerifications.status, "approved"),
          ),
        );

      const barcodeValues = initialRows
        .map((row) => row.barcodeValue)
        .sort((left, right) => left.localeCompare(right));
      for (const barcodeValue of barcodeValues) {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-barcode:${auth.organization.id}:${barcodeValue}`}, 0))`,
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
            eq(legacyMigrationVerifications.batchId, batchId),
            eq(legacyMigrationVerifications.organizationId, auth.organization.id),
            eq(legacyMigrationVerifications.status, "approved"),
          ),
        )
        .orderBy(legacyMigrationVerifications.barcodeValue)
        .for("update");

      if (approvedRows.length !== initialRows.length) {
        throw new Error("CUTOVER_APPROVED_ITEM_MISSING");
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
                eq(itemBarcodes.organizationId, auth.organization.id),
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
                  auth.organization.id,
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

      for (const row of approvedRows) {
        const alias =
          aliasByItemAndBarcode.get(
            `${row.productItemId}:${row.barcodeValue}`,
          ) ?? null;
        const issues = getLegacyCutoverItemIssues({
          source: row.source,
          barcodeValue: row.barcodeValue,
          batchOutletId: preflight.batch.outletId,
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
        if (issues.length > 0) throw new Error(`CUTOVER_ITEM_INVALID:${issues[0]}`);
        if (alias?.barcodeValue !== row.barcodeValue) {
          throw new Error("CUTOVER_ALIAS_BARCODE_MISMATCH");
        }
      }

      const executedAt = new Date();
      const runId = randomUUID();
      await transaction.insert(legacyMigrationCutoverRuns).values({
        id: runId,
        batchId,
        sessionId: session.id,
        organizationId: auth.organization.id,
        outletId: session.outletId,
        itemCount: approvedRows.length,
        executedBy: auth.user.id,
        executedAt,
        metadata: {
          confirmation: LEGACY_CUTOVER_CONFIRMATION,
          sessionName: session.name,
          barcodeCount: approvedRows.length,
          expectedItemCount: session.expectedItemCount,
          processedItemCount: processedItems,
          soldBeforeScanCount: Number(soldBeforeScan?.total ?? 0),
          pricingValidated: true,
          preflightBlockerCount: 0,
        },
      });

      if (approvedRows.length > 0) {
        await transaction.insert(inventoryMovements).values(
          approvedRows.map((row) => ({
            organizationId: auth.organization.id,
            itemId: row.productItemId,
            movementType: "migration_opening" as const,
            fromOutletId: null,
            toOutletId: session.outletId,
            referenceType: "legacy_migration_cutover",
            referenceId: runId,
            reason: "Saldo awal stok dari cutover migrasi legacy.",
            metadata: {
              batchId,
              sessionId: session.id,
              verificationId: row.verificationId,
              legacyBarcode: row.barcodeValue,
            },
            performedBy: auth.user.id,
            approvedBy: auth.user.id,
            occurredAt: executedAt,
          })),
        );

        const cutoverMetadata = {
          runId,
          batchId,
          sessionId: session.id,
          activatedAt: executedAt.toISOString(),
          activatedBy: auth.user.id,
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
              eq(productItems.organizationId, auth.organization.id),
              eq(productItems.availability, "migration_hold"),
            ),
          )
          .returning({ id: productItems.id });
        if (updatedItems.length !== approvedRows.length) {
          throw new Error("CUTOVER_ITEM_UPDATE_COUNT_MISMATCH");
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
          throw new Error("CUTOVER_VERIFICATION_UPDATE_COUNT_MISMATCH");
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
            eq(legacyMigrationSessions.organizationId, auth.organization.id),
            eq(legacyMigrationSessions.status, session.status),
          ),
        )
        .returning({ id: legacyMigrationSessions.id });
      if (completedSessions.length !== 1) {
        throw new Error("CUTOVER_SESSION_UPDATE_COUNT_MISMATCH");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: session.outletId,
        actorUserId: auth.user.id,
        action: "legacy_migration_cutover.execute",
        entityType: "legacy_migration_cutover_run",
        entityId: runId,
        afterData: {
          batchId,
          sessionId: session.id,
          sessionName: session.name,
          itemCount: approvedRows.length,
          expectedItemCount: session.expectedItemCount,
          processedItemCount: processedItems,
          pricingValidated: true,
          movementType: "migration_opening",
          resultingAvailability: "available",
        },
        reason: "Mengaktifkan stok hasil migrasi secara transactional.",
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return {
        itemCount: approvedRows.length,
        alreadyExecuted: false,
        sessionName: session.name,
      };
    });
  } catch (error) {
    redirectWithMessage(
      cutoverPath(batchId),
      "error",
      explainCutoverError(error),
    );
  }

  revalidatePath(cutoverPath(batchId));
  revalidatePath(`/admin/migrasi-produk/${batchId}/rekonsiliasi`);
  revalidatePath(`/admin/migrasi-produk/${batchId}`);
  revalidatePath(`/admin/inventaris`);
  revalidatePath(`/pos`);

  redirectWithMessage(
    cutoverPath(batchId),
    "success",
    result.alreadyExecuted
      ? `Sesi ${result.sessionName} sudah pernah diaktifkan; tidak ada duplikasi.`
      : result.itemCount > 0
        ? `${result.itemCount} item pada sesi ${result.sessionName} berhasil diaktifkan menjadi stok tersedia.`
        : `Sesi ${result.sessionName} diselesaikan tanpa item stok yang perlu diaktifkan.`,
  );
}
