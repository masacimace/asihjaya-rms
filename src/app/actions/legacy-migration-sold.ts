"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  itemBarcodes,
  legacyMigrationSoldRecords,
  legacyMigrationVerifications,
  legacyProductRows,
  productItems,
} from "@/db/schema";
import { getAccessibleLegacyBatch } from "@/features/legacy-migration/management-queries";
import {
  isSoldDuringMigrationEligibleStatus,
  parseSoldDuringMigrationBarcodes,
} from "@/features/legacy-migration/sold-rules";
import { parseLegacyMigrationUuid } from "@/features/legacy-migration/safety";
import { requirePermission, type AuthContext } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";
import { getStartOfBusinessDateKey } from "@/lib/time/business-time";

type SoldOutcome =
  | "marked"
  | "already_marked"
  | "not_found"
  | "blocked";

function readText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function readUuid(formData: FormData, name: string) {
  return parseLegacyMigrationUuid(readText(formData, name, 36));
}

function soldPath(batchId: string) {
  return `/admin/migrasi-produk/${batchId}/sold`;
}

function redirectWithMessage(
  path: string,
  type: "success" | "error",
  message: string,
): never {
  redirect(`${path}?${new URLSearchParams({ type, message }).toString()}`);
}

async function requestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

async function requireAccessibleBatch(auth: AuthContext, batchId: string) {
  const batch = await getAccessibleLegacyBatch(auth, batchId);
  if (!batch) {
    redirectWithMessage(
      "/admin/migrasi-produk",
      "error",
      "Batch migrasi tidak ditemukan atau tidak dapat diakses.",
    );
  }
  return batch;
}

function revalidateSoldPaths(batchId: string) {
  revalidatePath(`/admin/migrasi-produk/${batchId}`);
  revalidatePath(`/admin/migrasi-produk/${batchId}/review`);
  revalidatePath(`/admin/migrasi-produk/${batchId}/sesi`);
  revalidatePath(soldPath(batchId));
}

export async function markLegacySoldDuringMigrationAction(formData: FormData) {
  const auth = await requirePermission("migration.sold.manage");
  const batchId = readUuid(formData, "batchId");
  if (!batchId) {
    redirectWithMessage(
      "/admin/migrasi-produk",
      "error",
      "Batch migrasi tidak valid.",
    );
  }

  const batch = await requireAccessibleBatch(auth, batchId);
  const parsed = parseSoldDuringMigrationBarcodes(
    formData.get("barcodes"),
    batch.barcodeLength,
  );
  const soldAt = getStartOfBusinessDateKey(
    readText(formData, "soldDate", 10),
    auth.organization.timezone,
  );
  const legacyReference = readText(formData, "legacyReference", 160) || null;
  const notes = readText(formData, "notes", 2000) || null;

  if (!soldAt) {
    redirectWithMessage(
      soldPath(batch.id),
      "error",
      "Tanggal penjualan legacy tidak valid.",
    );
  }
  if (parsed.barcodes.length === 0) {
    redirectWithMessage(
      soldPath(batch.id),
      "error",
      "Masukkan minimal satu barcode enam digit yang valid.",
    );
  }

  const metadata = await requestMetadata();
  const barcodesForTransaction = [...parsed.barcodes].sort();
  const stagingRows = await db
    .select({ barcodeValue: legacyProductRows.normalizedBarcode })
    .from(legacyProductRows)
    .where(
      and(
        eq(legacyProductRows.batchId, batch.id),
        eq(legacyProductRows.organizationId, auth.organization.id),
        inArray(legacyProductRows.normalizedBarcode, barcodesForTransaction),
      ),
    );
  const stagingBarcodes = new Set(
    stagingRows.flatMap((row) =>
      row.barcodeValue ? [row.barcodeValue] : [],
    ),
  );

  const outcomes = await db.transaction(async (transaction) => {
    const result: Record<SoldOutcome, number> = {
      marked: 0,
      already_marked: 0,
      not_found: 0,
      blocked: 0,
    };

    for (const barcode of barcodesForTransaction) {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-barcode:${auth.organization.id}:${barcode}`}, 0))`,
      );

      const [activeRecord] = await transaction
        .select({ id: legacyMigrationSoldRecords.id })
        .from(legacyMigrationSoldRecords)
        .where(
          and(
            eq(
              legacyMigrationSoldRecords.organizationId,
              auth.organization.id,
            ),
            eq(legacyMigrationSoldRecords.barcodeValue, barcode),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        )
        .limit(1);
      if (activeRecord) {
        result.already_marked += 1;
        continue;
      }

      const [verification] = await transaction
        .select({
          id: legacyMigrationVerifications.id,
          status: legacyMigrationVerifications.status,
          outletId: legacyMigrationVerifications.outletId,
          productItemId: legacyMigrationVerifications.productItemId,
        })
        .from(legacyMigrationVerifications)
        .where(
          and(
            eq(legacyMigrationVerifications.batchId, batch.id),
            eq(
              legacyMigrationVerifications.organizationId,
              auth.organization.id,
            ),
            eq(legacyMigrationVerifications.barcodeValue, barcode),
          ),
        )
        .limit(1);

      if (!verification && !stagingBarcodes.has(barcode)) {
        result.not_found += 1;
        continue;
      }
      if (
        verification &&
        !isSoldDuringMigrationEligibleStatus(verification.status)
      ) {
        result.blocked += 1;
        continue;
      }

      let previousItemAvailability: "migration_hold" | null = null;
      if (verification?.productItemId) {
        const [item] = await transaction
          .select({
            availability: productItems.availability,
            isActive: productItems.isActive,
          })
          .from(productItems)
          .where(
            and(
              eq(productItems.id, verification.productItemId),
              eq(productItems.organizationId, auth.organization.id),
              eq(productItems.currentOutletId, batch.outletId),
            ),
          )
          .limit(1);
        if (item?.availability !== "migration_hold" || !item.isActive) {
          result.blocked += 1;
          continue;
        }
        previousItemAvailability = "migration_hold";
      }

      const [soldRecord] = await transaction
        .insert(legacyMigrationSoldRecords)
        .values({
          batchId: batch.id,
          organizationId: auth.organization.id,
          outletId: verification?.outletId ?? batch.outletId,
          barcodeValue: barcode,
          verificationId: verification?.id ?? null,
          productItemId: verification?.productItemId ?? null,
          previousVerificationStatus: verification?.status ?? null,
          previousItemAvailability,
          soldAt,
          legacyReference,
          notes,
          reportedBy: auth.user.id,
        })
        .returning({ id: legacyMigrationSoldRecords.id });
      if (!soldRecord) throw new Error("SOLD_RECORD_INSERT_FAILED");

      if (verification) {
        const updatedVerification = await transaction
          .update(legacyMigrationVerifications)
          .set({
            status: "sold_during_migration",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(legacyMigrationVerifications.id, verification.id),
              eq(legacyMigrationVerifications.status, verification.status),
            ),
          )
          .returning({ id: legacyMigrationVerifications.id });
        if (updatedVerification.length !== 1) {
          throw new Error("VERIFICATION_STATUS_CHANGED");
        }
      }

      if (verification?.productItemId) {
        const updatedItems = await transaction
          .update(productItems)
          .set({
            availability: "sold",
            isActive: false,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(productItems.id, verification.productItemId),
              eq(productItems.availability, "migration_hold"),
              eq(productItems.isActive, true),
            ),
          )
          .returning({ id: productItems.id });
        if (updatedItems.length !== 1) {
          throw new Error("MIGRATION_HOLD_UPDATE_FAILED");
        }

        const updatedAliases = await transaction
          .update(itemBarcodes)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(itemBarcodes.organizationId, auth.organization.id),
              eq(itemBarcodes.itemId, verification.productItemId),
              eq(itemBarcodes.barcodeValue, barcode),
              eq(itemBarcodes.isActive, true),
            ),
          )
          .returning({ id: itemBarcodes.id });
        if (updatedAliases.length !== 1) {
          throw new Error("LEGACY_ALIAS_DEACTIVATION_FAILED");
        }
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: verification?.outletId ?? batch.outletId,
        actorUserId: auth.user.id,
        action: "legacy_migration_sold.mark",
        entityType: "legacy_migration_sold_record",
        entityId: soldRecord.id,
        afterData: {
          batchId: batch.id,
          barcode,
          verificationId: verification?.id ?? null,
          previousVerificationStatus: verification?.status ?? null,
          productItemId: verification?.productItemId ?? null,
          previousItemAvailability,
          soldAt: soldAt.toISOString(),
          legacyReference,
        },
        reason:
          notes ??
          "Barcode dikecualikan dari cutover karena terjual pada sistem legacy.",
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
      result.marked += 1;
    }

    return result;
  });

  revalidateSoldPaths(batch.id);
  const extras = [
    parsed.invalidBarcodes.length > 0
      ? `${parsed.invalidBarcodes.length} format tidak valid`
      : null,
    parsed.duplicateCount > 0
      ? `${parsed.duplicateCount} duplikat input diabaikan`
      : null,
    parsed.truncatedCount > 0
      ? `${parsed.truncatedCount} melewati batas input`
      : null,
    outcomes.already_marked > 0
      ? `${outcomes.already_marked} sudah pernah ditandai`
      : null,
    outcomes.not_found > 0
      ? `${outcomes.not_found} tidak ditemukan pada batch`
      : null,
    outcomes.blocked > 0
      ? `${outcomes.blocked} statusnya tidak dapat diubah`
      : null,
  ].filter((item): item is string => Boolean(item));

  redirectWithMessage(
    soldPath(batch.id),
    outcomes.marked > 0 ? "success" : "error",
    `${outcomes.marked} barcode ditandai terjual di sistem lama${
      extras.length > 0 ? `. ${extras.join("; ")}.` : "."
    }`,
  );
}

export async function revertLegacySoldDuringMigrationAction(
  formData: FormData,
) {
  const auth = await requirePermission("migration.sold.manage");
  const batchId = readUuid(formData, "batchId");
  const soldRecordId = readUuid(formData, "soldRecordId");
  const reason = readText(formData, "revertReason", 2000);
  if (!batchId || !soldRecordId || reason.length < 5) {
    redirectWithMessage(
      batchId ? soldPath(batchId) : "/admin/migrasi-produk",
      "error",
      "Alasan pembatalan minimal 5 karakter.",
    );
  }

  const batch = await requireAccessibleBatch(auth, batchId);
  const metadata = await requestMetadata();

  try {
    await db.transaction(async (transaction) => {
      const [initialRecord] = await transaction
        .select({ barcodeValue: legacyMigrationSoldRecords.barcodeValue })
        .from(legacyMigrationSoldRecords)
        .where(
          and(
            eq(legacyMigrationSoldRecords.id, soldRecordId),
            eq(legacyMigrationSoldRecords.batchId, batch.id),
            eq(
              legacyMigrationSoldRecords.organizationId,
              auth.organization.id,
            ),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        )
        .limit(1);
      if (!initialRecord) throw new Error("SOLD_RECORD_NOT_FOUND");

      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-barcode:${auth.organization.id}:${initialRecord.barcodeValue}`}, 0))`,
      );

      const [record] = await transaction
        .select({
          id: legacyMigrationSoldRecords.id,
          outletId: legacyMigrationSoldRecords.outletId,
          barcodeValue: legacyMigrationSoldRecords.barcodeValue,
          verificationId: legacyMigrationSoldRecords.verificationId,
          productItemId: legacyMigrationSoldRecords.productItemId,
          previousVerificationStatus:
            legacyMigrationSoldRecords.previousVerificationStatus,
          previousItemAvailability:
            legacyMigrationSoldRecords.previousItemAvailability,
        })
        .from(legacyMigrationSoldRecords)
        .where(
          and(
            eq(legacyMigrationSoldRecords.id, soldRecordId),
            eq(legacyMigrationSoldRecords.batchId, batch.id),
            eq(
              legacyMigrationSoldRecords.organizationId,
              auth.organization.id,
            ),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        )
        .limit(1);
      if (!record) throw new Error("SOLD_RECORD_NOT_FOUND");

      if (record.verificationId) {
        if (
          !record.previousVerificationStatus ||
          !isSoldDuringMigrationEligibleStatus(
            record.previousVerificationStatus,
          )
        ) {
          throw new Error("INVALID_PREVIOUS_VERIFICATION_STATUS");
        }
        const restored = await transaction
          .update(legacyMigrationVerifications)
          .set({
            status: record.previousVerificationStatus,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(legacyMigrationVerifications.id, record.verificationId),
              eq(
                legacyMigrationVerifications.status,
                "sold_during_migration",
              ),
            ),
          )
          .returning({ id: legacyMigrationVerifications.id });
        if (restored.length !== 1) {
          throw new Error("VERIFICATION_RESTORE_CONFLICT");
        }
      }

      if (record.productItemId) {
        if (record.previousItemAvailability !== "migration_hold") {
          throw new Error("INVALID_PREVIOUS_ITEM_STATUS");
        }
        const [activeConflict] = await transaction
          .select({ id: itemBarcodes.id })
          .from(itemBarcodes)
          .where(
            and(
              eq(itemBarcodes.organizationId, auth.organization.id),
              eq(itemBarcodes.barcodeValue, record.barcodeValue),
              eq(itemBarcodes.isActive, true),
            ),
          )
          .limit(1);
        if (activeConflict) throw new Error("BARCODE_ALIAS_CONFLICT");

        const restoredItems = await transaction
          .update(productItems)
          .set({
            availability: "migration_hold",
            isActive: true,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(productItems.id, record.productItemId),
              eq(productItems.availability, "sold"),
              eq(productItems.isActive, false),
            ),
          )
          .returning({ id: productItems.id });
        if (restoredItems.length !== 1) {
          throw new Error("ITEM_RESTORE_CONFLICT");
        }

        const restoredAliases = await transaction
          .update(itemBarcodes)
          .set({ isActive: true, updatedAt: new Date() })
          .where(
            and(
              eq(itemBarcodes.organizationId, auth.organization.id),
              eq(itemBarcodes.itemId, record.productItemId),
              eq(itemBarcodes.barcodeValue, record.barcodeValue),
              eq(itemBarcodes.isActive, false),
            ),
          )
          .returning({ id: itemBarcodes.id });
        if (restoredAliases.length !== 1) {
          throw new Error("BARCODE_ALIAS_RESTORE_FAILED");
        }
      }

      const reverted = await transaction
        .update(legacyMigrationSoldRecords)
        .set({
          revertedBy: auth.user.id,
          revertedAt: new Date(),
          revertReason: reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(legacyMigrationSoldRecords.id, record.id),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        )
        .returning({ id: legacyMigrationSoldRecords.id });
      if (reverted.length !== 1) throw new Error("SOLD_RECORD_REVERT_CONFLICT");

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: record.outletId,
        actorUserId: auth.user.id,
        action: "legacy_migration_sold.revert",
        entityType: "legacy_migration_sold_record",
        entityId: record.id,
        beforeData: {
          barcode: record.barcodeValue,
          verificationStatus: "sold_during_migration",
          itemAvailability: record.productItemId ? "sold" : null,
        },
        afterData: {
          verificationStatus: record.previousVerificationStatus,
          itemAvailability: record.previousItemAvailability,
        },
        reason,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
    });
  } catch (error) {
    console.error("legacy_migration_sold.revert_failed", error);
    const code = error instanceof Error ? error.message : "";
    const message =
      code === "SOLD_RECORD_NOT_FOUND"
        ? "Penandaan sudah dibatalkan atau tidak ditemukan."
        : code === "BARCODE_ALIAS_CONFLICT"
          ? "Barcode sudah dipakai item aktif lain dan tidak dapat dipulihkan."
          : "Pembatalan gagal karena status barang sudah berubah. Tidak ada data parsial yang disimpan.";
    redirectWithMessage(soldPath(batch.id), "error", message);
  }

  revalidateSoldPaths(batch.id);
  redirectWithMessage(
    soldPath(batch.id),
    "success",
    "Penandaan terjual dibatalkan dan status sebelumnya dipulihkan.",
  );
}
