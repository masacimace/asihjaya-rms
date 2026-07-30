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
  productItems,
  productMasters,
} from "@/db/schema";
import { LEGACY_CUTOVER_CONFIRMATION } from "@/features/legacy-migration/cutover-contracts";
import { getLegacyMigrationCutoverData } from "@/features/legacy-migration/cutover-queries";
import {
  getLegacyCutoverItemIssues,
  isLegacyCutoverSessionClosed,
} from "@/features/legacy-migration/cutover-rules";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

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
  if (code === "CUTOVER_SESSION_NOT_CLOSED") {
    return "Sesi harus dikunci atau diselesaikan sebelum cutover.";
  }
  if (code === "CUTOVER_GLOBAL_NOT_READY") {
    return "Masih ada sesi terbuka atau verification yang belum selesai direview.";
  }
  if (code === "CUTOVER_TARGET_SHORTFALL") {
    return "Jumlah barang fisik terproses masih di bawah target sesi.";
  }
  if (
    code === "CUTOVER_APPROVED_ITEM_MISSING" ||
    code.startsWith("CUTOVER_ITEM_INVALID:") ||
    code === "CUTOVER_ALIAS_BARCODE_MISMATCH"
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
  const batchId = readText(formData, "batchId", 36);
  const sessionId = readText(formData, "sessionId", 36);
  const confirmation = readText(formData, "confirmation", 40).toUpperCase();

  if (!UUID_PATTERN.test(batchId) || !UUID_PATTERN.test(sessionId)) {
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

    const [session] = await transaction
      .select({
        id: legacyMigrationSessions.id,
        name: legacyMigrationSessions.name,
        status: legacyMigrationSessions.status,
        batchId: legacyMigrationSessions.batchId,
        organizationId: legacyMigrationSessions.organizationId,
        outletId: legacyMigrationSessions.outletId,
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
    if (!isLegacyCutoverSessionClosed(session.status)) {
      throw new Error("CUTOVER_SESSION_NOT_CLOSED");
    }

    const [existingRun] = await transaction
      .select({ id: legacyMigrationCutoverRuns.id })
      .from(legacyMigrationCutoverRuns)
      .where(eq(legacyMigrationCutoverRuns.sessionId, session.id))
      .limit(1);
    if (existingRun) {
      return { itemCount: 0, alreadyExecuted: true, sessionName: session.name };
    }

    const [globalState] = await transaction
      .select({
        openSessions:
          sql<number>`count(*) filter (where ${legacyMigrationSessions.status} in ('draft', 'active'))::int`.mapWith(
            Number,
          ),
        expectedItems:
          sql<number>`coalesce(sum(${legacyMigrationSessions.expectedItemCount}) filter (where ${legacyMigrationSessions.status} <> 'cancelled'), 0)::int`.mapWith(
            Number,
          ),
      })
      .from(legacyMigrationSessions)
      .where(
        and(
          eq(legacyMigrationSessions.batchId, batchId),
          eq(legacyMigrationSessions.organizationId, auth.organization.id),
        ),
      );

    const [verificationState] = await transaction
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
          eq(legacyMigrationVerifications.batchId, batchId),
          eq(legacyMigrationVerifications.organizationId, auth.organization.id),
        ),
      );

    const [soldBeforeScan] = await transaction
      .select({ total: count() })
      .from(legacyMigrationSoldRecords)
      .where(
        and(
          eq(legacyMigrationSoldRecords.batchId, batchId),
          eq(legacyMigrationSoldRecords.organizationId, auth.organization.id),
          isNull(legacyMigrationSoldRecords.verificationId),
          isNull(legacyMigrationSoldRecords.revertedAt),
        ),
      );

    const openSessions = Number(globalState?.openSessions ?? 0);
    const unresolved = Number(verificationState?.unresolved ?? 0);
    const expectedItems = Number(globalState?.expectedItems ?? 0);
    const processedItems =
      Number(verificationState?.total ?? 0) + Number(soldBeforeScan?.total ?? 0);
    if (openSessions > 0 || unresolved > 0) {
      throw new Error("CUTOVER_GLOBAL_NOT_READY");
    }
    if (expectedItems > 0 && processedItems < expectedItems) {
      throw new Error("CUTOVER_TARGET_SHORTFALL");
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
        productItemId: productItems.id,
        itemAvailability: productItems.availability,
        itemIsActive: productItems.isActive,
        itemOutletId: productItems.currentOutletId,
        itemLegacyId: productItems.legacyId,
        masterStatus: productMasters.status,
      })
      .from(legacyMigrationVerifications)
      .innerJoin(
        productItems,
        eq(legacyMigrationVerifications.productItemId, productItems.id),
      )
      .innerJoin(
        productMasters,
        eq(
          legacyMigrationVerifications.targetProductMasterId,
          productMasters.id,
        ),
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
        productItemId: row.productItemId,
        itemAvailability: row.itemAvailability,
        itemIsActive: row.itemIsActive,
        itemOutletId: row.itemOutletId,
        itemLegacyId: row.itemLegacyId,
        masterStatus: row.masterStatus,
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
      await transaction
        .update(productItems)
        .set({
          availability: "available",
          attributes: cutoverMetadataSql(cutoverMetadata),
          updatedAt: executedAt,
        })
        .where(inArray(productItems.id, itemIds));

      await transaction
        .update(legacyMigrationVerifications)
        .set({ status: "activated", updatedAt: executedAt })
        .where(
          inArray(
            legacyMigrationVerifications.id,
            approvedRows.map((row) => row.verificationId),
          ),
        );
    }

    await transaction
      .update(legacyMigrationSessions)
      .set({
        status: "completed",
        completedAt: executedAt,
        updatedAt: executedAt,
      })
      .where(eq(legacyMigrationSessions.id, session.id));

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
