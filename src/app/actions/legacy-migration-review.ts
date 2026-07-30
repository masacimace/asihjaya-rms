"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  itemBarcodes,
  legacyMigrationSessions,
  legacyMigrationSoldRecords,
  legacyMigrationVerifications,
  productItems,
  productMasters,
} from "@/db/schema";
import { getNextProductItemIdentifiers } from "@/features/inventory/product-item-identifiers";
import { getAccessibleLegacyBatch } from "@/features/legacy-migration/management-queries";
import {
  buildMigrationItemAttributes,
  canBulkApproveLegacyVerification,
  getLegacyBarcodeAliasSource,
} from "@/features/legacy-migration/review-rules";
import { requirePermission, type AuthContext } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BULK_APPROVAL = 100;

type ReviewTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function readText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function readUuid(formData: FormData, name: string) {
  const value = readText(formData, name, 36);
  return UUID_PATTERN.test(value) ? value : null;
}

function reviewPath(batchId: string) {
  return `/admin/migrasi-produk/${batchId}/review`;
}

function detailPath(batchId: string, verificationId: string) {
  return `${reviewPath(batchId)}/${verificationId}`;
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

async function approveOne(
  transaction: ReviewTransaction,
  input: {
    auth: AuthContext;
    batchId: string;
    verificationId: string;
    reviewNotes: string | null;
    onlyClean: boolean;
    metadata: Awaited<ReturnType<typeof requestMetadata>>;
  },
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-review:${input.auth.organization.id}:${input.verificationId}`}, 0))`,
  );

  const [verification] = await transaction
    .select({
      id: legacyMigrationVerifications.id,
      batchId: legacyMigrationVerifications.batchId,
      sessionId: legacyMigrationVerifications.sessionId,
      organizationId: legacyMigrationVerifications.organizationId,
      outletId: legacyMigrationVerifications.outletId,
      barcodeValue: legacyMigrationVerifications.barcodeValue,
      legacyRowId: legacyMigrationVerifications.legacyRowId,
      source: legacyMigrationVerifications.source,
      status: legacyMigrationVerifications.status,
      targetProductMasterId:
        legacyMigrationVerifications.targetProductMasterId,
      verifiedItemName: legacyMigrationVerifications.verifiedItemName,
      verifiedWeightGram: legacyMigrationVerifications.verifiedWeightGram,
      verifiedPurity: legacyMigrationVerifications.verifiedPurity,
      verifiedExchangePurity:
        legacyMigrationVerifications.verifiedExchangePurity,
      verifiedColor: legacyMigrationVerifications.verifiedColor,
      condition: legacyMigrationVerifications.condition,
      legacyImageUrl: legacyMigrationVerifications.legacyImageUrl,
      imageKey: legacyMigrationVerifications.imageKey,
      staffNotes: legacyMigrationVerifications.staffNotes,
      reviewFlags: legacyMigrationVerifications.reviewFlags,
      productItemId: legacyMigrationVerifications.productItemId,
      locationCode: legacyMigrationSessions.locationCode,
    })
    .from(legacyMigrationVerifications)
    .innerJoin(
      legacyMigrationSessions,
      eq(legacyMigrationVerifications.sessionId, legacyMigrationSessions.id),
    )
    .where(
      and(
        eq(legacyMigrationVerifications.id, input.verificationId),
        eq(legacyMigrationVerifications.batchId, input.batchId),
        eq(
          legacyMigrationVerifications.organizationId,
          input.auth.organization.id,
        ),
      ),
    )
    .limit(1);

  if (!verification) throw new Error("VERIFICATION_NOT_FOUND");
  if (verification.status === "approved" && verification.productItemId) {
    return { itemId: verification.productItemId, idempotent: true };
  }
  if (
    verification.status !== "submitted" &&
    verification.status !== "needs_review"
  ) {
    throw new Error("VERIFICATION_NOT_REVIEWABLE");
  }
  if (
    input.onlyClean &&
    !canBulkApproveLegacyVerification({
      status: verification.status,
      reviewFlags: verification.reviewFlags,
      condition: verification.condition,
    })
  ) {
    throw new Error("VERIFICATION_NOT_CLEAN");
  }

  const [targetMaster] = await transaction
    .select({
      id: productMasters.id,
      code: productMasters.code,
      name: productMasters.name,
      status: productMasters.status,
    })
    .from(productMasters)
    .where(
      and(
        eq(productMasters.id, verification.targetProductMasterId),
        eq(productMasters.organizationId, input.auth.organization.id),
        inArray(productMasters.status, ["draft", "active"]),
      ),
    )
    .limit(1);
  if (!targetMaster) throw new Error("TARGET_MASTER_UNAVAILABLE");

  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-barcode:${input.auth.organization.id}:${verification.barcodeValue}`}, 0))`,
  );

  const [soldRecord] = await transaction
    .select({ id: legacyMigrationSoldRecords.id })
    .from(legacyMigrationSoldRecords)
    .where(
      and(
        eq(
          legacyMigrationSoldRecords.organizationId,
          input.auth.organization.id,
        ),
        eq(
          legacyMigrationSoldRecords.barcodeValue,
          verification.barcodeValue,
        ),
        sql`${legacyMigrationSoldRecords.revertedAt} is null`,
      ),
    )
    .limit(1);
  if (soldRecord) throw new Error("VERIFICATION_SOLD_DURING_MIGRATION");

  const [existingItem, existingAlias] = await Promise.all([
    transaction
      .select({ id: productItems.id })
      .from(productItems)
      .where(
        and(
          eq(productItems.organizationId, input.auth.organization.id),
          eq(productItems.barcode, verification.barcodeValue),
        ),
      )
      .limit(1),
    transaction
      .select({ id: itemBarcodes.id })
      .from(itemBarcodes)
      .where(
        and(
          eq(itemBarcodes.organizationId, input.auth.organization.id),
          eq(itemBarcodes.barcodeValue, verification.barcodeValue),
          eq(itemBarcodes.isActive, true),
        ),
      )
      .limit(1),
  ]);
  if (existingItem[0] || existingAlias[0]) {
    throw new Error("BARCODE_ALREADY_REGISTERED");
  }

  const itemId = randomUUID();
  const identifiers = await getNextProductItemIdentifiers((query) =>
    transaction.execute(query),
  );

  await transaction.insert(productItems).values({
    id: itemId,
    organizationId: input.auth.organization.id,
    productMasterId: verification.targetProductMasterId,
    displayName: verification.verifiedItemName,
    currentOutletId: verification.outletId,
    sku: identifiers.sku,
    barcode: identifiers.barcode,
    qrValue: identifiers.qrValue,
    legacyId: verification.barcodeValue,
    legacyUrl: verification.legacyImageUrl,
    weightGram: verification.verifiedWeightGram,
    purityPercent: verification.verifiedPurity,
    exchangePurityPercent: verification.verifiedExchangePurity,
    color: verification.verifiedColor,
    availability: "migration_hold",
    condition: verification.condition,
    locationState: "outlet",
    locationCode: verification.locationCode,
    imageKey: verification.imageKey,
    attributes: buildMigrationItemAttributes({
      verificationId: verification.id,
      batchId: verification.batchId,
      sessionId: verification.sessionId,
      source: verification.source,
      legacyRowId: verification.legacyRowId,
      reviewFlags: verification.reviewFlags,
      approvedBy: input.auth.user.id,
    }),
    internalNotes: verification.staffNotes,
    isActive: true,
  });

  await transaction.insert(itemBarcodes).values({
    organizationId: input.auth.organization.id,
    itemId,
    barcodeValue: verification.barcodeValue,
    source: getLegacyBarcodeAliasSource(verification.source),
    isPrimary: true,
    isActive: true,
    createdBy: input.auth.user.id,
  });

  const now = new Date();
  await transaction
    .update(legacyMigrationVerifications)
    .set({
      status: "approved",
      productItemId: itemId,
      reviewedBy: input.auth.user.id,
      reviewedAt: now,
      reviewNotes: input.reviewNotes,
      updatedAt: now,
    })
    .where(eq(legacyMigrationVerifications.id, verification.id));

  await transaction.insert(auditLogs).values({
    organizationId: input.auth.organization.id,
    outletId: verification.outletId,
    actorUserId: input.auth.user.id,
    action: "legacy_migration_verification.approve",
    entityType: "legacy_migration_verification",
    entityId: verification.id,
    afterData: {
      productItemId: itemId,
      sku: identifiers.sku,
      internalBarcode: identifiers.barcode,
      legacyBarcode: verification.barcodeValue,
      aliasSource: getLegacyBarcodeAliasSource(verification.source),
      availability: "migration_hold",
      productMasterId: targetMaster.id,
      productMasterCode: targetMaster.code,
    },
    reason:
      input.reviewNotes ??
      "Verification disetujui sebagai item migration hold; belum tersedia di POS.",
    ipAddress: input.metadata.ipAddress,
    userAgent: input.metadata.userAgent,
  });

  return { itemId, idempotent: false };
}

function explainApprovalError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "VERIFICATION_NOT_FOUND") return "Verification tidak ditemukan.";
  if (message === "VERIFICATION_NOT_REVIEWABLE") {
    return "Status verification sudah berubah dan tidak dapat direview.";
  }
  if (message === "VERIFICATION_ALREADY_APPROVED") {
    return "Verification sudah disetujui dan item inventory telah dibuat.";
  }
  if (message === "VERIFICATION_NOT_CLEAN") {
    return "Bulk approval hanya untuk item clean berstatus submitted dan kondisi baik.";
  }
  if (message === "TARGET_MASTER_UNAVAILABLE") {
    return "Product Master tidak tersedia atau sudah dinonaktifkan.";
  }
  if (message === "BARCODE_ALREADY_REGISTERED") {
    return "Barcode sudah terhubung ke item lain pada sistem baru.";
  }
  if (message === "VERIFICATION_SOLD_DURING_MIGRATION") {
    return "Barcode sudah ditandai terjual di sistem lama dan tidak dapat direview atau disetujui.";
  }
  return "Approval gagal diproses. Tidak ada item parsial yang disimpan.";
}

export async function approveLegacyMigrationVerificationAction(
  formData: FormData,
) {
  const auth = await requirePermission("migration.verification.approve");
  const batchId = readUuid(formData, "batchId");
  const verificationId = readUuid(formData, "verificationId");
  const notes = readText(formData, "reviewNotes", 2000) || null;
  if (!batchId || !verificationId) {
    redirectWithMessage("/admin/migrasi-produk", "error", "Data approval tidak valid.");
  }
  await requireAccessibleBatch(auth, batchId);
  const metadata = await requestMetadata();

  try {
    const result = await db.transaction((transaction) =>
      approveOne(transaction, {
        auth,
        batchId,
        verificationId,
        reviewNotes: notes,
        onlyClean: false,
        metadata,
      }),
    );
    revalidatePath(reviewPath(batchId));
    revalidatePath(detailPath(batchId, verificationId));
    revalidatePath(`/admin/inventaris/item/${result.itemId}`);
    redirectWithMessage(
      detailPath(batchId, verificationId),
      "success",
      result.idempotent
        ? "Verification sebelumnya sudah disetujui; retry aman."
        : "Item dibuat sebagai migration hold dan barcode lama disimpan sebagai alias primary.",
    );
  } catch (error) {
    console.error("legacy_migration_verification.approve_failed", error);
    redirectWithMessage(
      detailPath(batchId, verificationId),
      "error",
      explainApprovalError(error),
    );
  }
}

export async function bulkApproveLegacyMigrationVerificationsAction(
  formData: FormData,
) {
  const auth = await requirePermission("migration.verification.approve");
  const batchId = readUuid(formData, "batchId");
  const ids = Array.from(
    new Set(
      formData
        .getAll("verificationIds")
        .map((value) => String(value))
        .filter((value) => UUID_PATTERN.test(value)),
    ),
  );
  if (!batchId || ids.length === 0 || ids.length > MAX_BULK_APPROVAL) {
    redirectWithMessage(
      batchId ? reviewPath(batchId) : "/admin/migrasi-produk",
      "error",
      `Pilih 1-${MAX_BULK_APPROVAL} item clean untuk bulk approval.`,
    );
  }
  await requireAccessibleBatch(auth, batchId);
  const metadata = await requestMetadata();

  try {
    await db.transaction(async (transaction) => {
      for (const verificationId of ids) {
        await approveOne(transaction, {
          auth,
          batchId,
          verificationId,
          reviewNotes: "Bulk approval item clean",
          onlyClean: true,
          metadata,
        });
      }
    });
    revalidatePath(reviewPath(batchId));
    redirectWithMessage(
      reviewPath(batchId),
      "success",
      `${ids.length} item clean disetujui sebagai migration hold.`,
    );
  } catch (error) {
    console.error("legacy_migration_verification.bulk_approve_failed", error);
    redirectWithMessage(reviewPath(batchId), "error", explainApprovalError(error));
  }
}

async function changeReviewStatus(input: {
  auth: AuthContext;
  batchId: string;
  verificationId: string;
  status: "returned" | "rejected";
  notes: string;
  metadata: Awaited<ReturnType<typeof requestMetadata>>;
}) {
  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-review:${input.auth.organization.id}:${input.verificationId}`}, 0))`,
    );
    const [verification] = await transaction
      .select({
        id: legacyMigrationVerifications.id,
        outletId: legacyMigrationVerifications.outletId,
        barcodeValue: legacyMigrationVerifications.barcodeValue,
        status: legacyMigrationVerifications.status,
        productItemId: legacyMigrationVerifications.productItemId,
      })
      .from(legacyMigrationVerifications)
      .where(
        and(
          eq(legacyMigrationVerifications.id, input.verificationId),
          eq(legacyMigrationVerifications.batchId, input.batchId),
          eq(
            legacyMigrationVerifications.organizationId,
            input.auth.organization.id,
          ),
        ),
      )
      .limit(1);
    if (!verification) throw new Error("VERIFICATION_NOT_FOUND");
    if (verification.productItemId || verification.status === "approved") {
      throw new Error("VERIFICATION_ALREADY_APPROVED");
    }
    if (
      verification.status !== "submitted" &&
      verification.status !== "needs_review"
    ) {
      throw new Error("VERIFICATION_NOT_REVIEWABLE");
    }

    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-barcode:${input.auth.organization.id}:${verification.barcodeValue}`}, 0))`,
    );
    const [soldRecord] = await transaction
      .select({ id: legacyMigrationSoldRecords.id })
      .from(legacyMigrationSoldRecords)
      .where(
        and(
          eq(
            legacyMigrationSoldRecords.organizationId,
            input.auth.organization.id,
          ),
          eq(
            legacyMigrationSoldRecords.barcodeValue,
            verification.barcodeValue,
          ),
          sql`${legacyMigrationSoldRecords.revertedAt} is null`,
        ),
      )
      .limit(1);
    if (soldRecord) throw new Error("VERIFICATION_SOLD_DURING_MIGRATION");

    const now = new Date();
    await transaction
      .update(legacyMigrationVerifications)
      .set({
        status: input.status,
        reviewedBy: input.auth.user.id,
        reviewedAt: now,
        reviewNotes: input.notes,
        updatedAt: now,
      })
      .where(eq(legacyMigrationVerifications.id, verification.id));

    await transaction.insert(auditLogs).values({
      organizationId: input.auth.organization.id,
      outletId: verification.outletId,
      actorUserId: input.auth.user.id,
      action: `legacy_migration_verification.${input.status}`,
      entityType: "legacy_migration_verification",
      entityId: verification.id,
      afterData: { status: input.status },
      reason: input.notes,
      ipAddress: input.metadata.ipAddress,
      userAgent: input.metadata.userAgent,
    });
  });
}

export async function returnLegacyMigrationVerificationAction(
  formData: FormData,
) {
  const auth = await requirePermission("migration.verification.review");
  const batchId = readUuid(formData, "batchId");
  const verificationId = readUuid(formData, "verificationId");
  const notes = readText(formData, "reviewNotes", 2000);
  if (!batchId || !verificationId || notes.length < 5) {
    redirectWithMessage(
      batchId && verificationId
        ? detailPath(batchId, verificationId)
        : "/admin/migrasi-produk",
      "error",
      "Alasan pengembalian minimal 5 karakter.",
    );
  }
  await requireAccessibleBatch(auth, batchId);
  try {
    await changeReviewStatus({
      auth,
      batchId,
      verificationId,
      status: "returned",
      notes,
      metadata: await requestMetadata(),
    });
    revalidatePath(reviewPath(batchId));
    revalidatePath(detailPath(batchId, verificationId));
    redirectWithMessage(
      detailPath(batchId, verificationId),
      "success",
      "Verification dikembalikan ke operator untuk diperbaiki dan dikirim ulang.",
    );
  } catch (error) {
    redirectWithMessage(
      detailPath(batchId, verificationId),
      "error",
      explainApprovalError(error),
    );
  }
}

export async function rejectLegacyMigrationVerificationAction(
  formData: FormData,
) {
  const auth = await requirePermission("migration.verification.review");
  const batchId = readUuid(formData, "batchId");
  const verificationId = readUuid(formData, "verificationId");
  const notes = readText(formData, "reviewNotes", 2000);
  if (!batchId || !verificationId || notes.length < 5) {
    redirectWithMessage(
      batchId && verificationId
        ? detailPath(batchId, verificationId)
        : "/admin/migrasi-produk",
      "error",
      "Alasan penolakan minimal 5 karakter.",
    );
  }
  await requireAccessibleBatch(auth, batchId);
  try {
    await changeReviewStatus({
      auth,
      batchId,
      verificationId,
      status: "rejected",
      notes,
      metadata: await requestMetadata(),
    });
    revalidatePath(reviewPath(batchId));
    revalidatePath(detailPath(batchId, verificationId));
    redirectWithMessage(
      detailPath(batchId, verificationId),
      "success",
      "Verification ditolak dan tidak membuat item inventory.",
    );
  } catch (error) {
    redirectWithMessage(
      detailPath(batchId, verificationId),
      "error",
      explainApprovalError(error),
    );
  }
}
