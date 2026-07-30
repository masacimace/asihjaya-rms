import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  itemBarcodes,
  legacyMigrationSessions,
  legacyMigrationSoldRecords,
  legacyMigrationVerifications,
  productItems,
  productMasters,
} from "@/db/schema";
import type { LegacyReconciliationIssue } from "@/features/legacy-migration/reconciliation-contracts";
import { getAccessibleLegacyBatch } from "@/features/legacy-migration/management-queries";
import {
  getLegacyPhotoMigrationMetadata,
  getLegacyPhotoMigrationStatus,
  isLegacyPhotoMigrationItemEligible,
} from "@/features/legacy-migration/reconciliation-rules";
import type { AuthContext } from "@/lib/auth/session";

function reconciliationPath(batchId: string) {
  return `/admin/migrasi-produk/${batchId}/rekonsiliasi`;
}

export async function getLegacyMigrationReconciliationData(
  auth: AuthContext,
  batchId: string,
) {
  const batch = await getAccessibleLegacyBatch(auth, batchId);
  if (!batch) return null;

  const [sessionRows, verificationStatusRows, soldRows, approvedRows] =
    await Promise.all([
      db
        .select({
          status: legacyMigrationSessions.status,
          total: count(),
          expectedItemCount:
            sql<number>`coalesce(sum(${legacyMigrationSessions.expectedItemCount}), 0)::int`.mapWith(
              Number,
            ),
          missingTarget:
            sql<number>`count(*) filter (where ${legacyMigrationSessions.expectedItemCount} is null)::int`.mapWith(
              Number,
            ),
        })
        .from(legacyMigrationSessions)
        .where(
          and(
            eq(legacyMigrationSessions.batchId, batch.id),
            eq(
              legacyMigrationSessions.organizationId,
              auth.organization.id,
            ),
          ),
        )
        .groupBy(legacyMigrationSessions.status),

      db
        .select({
          status: legacyMigrationVerifications.status,
          total: count(),
        })
        .from(legacyMigrationVerifications)
        .where(
          and(
            eq(legacyMigrationVerifications.batchId, batch.id),
            eq(
              legacyMigrationVerifications.organizationId,
              auth.organization.id,
            ),
          ),
        )
        .groupBy(legacyMigrationVerifications.status),

      db
        .select({
          total: sql<number>`count(*)::int`.mapWith(Number),
          beforeScan:
            sql<number>`count(*) filter (where ${legacyMigrationSoldRecords.verificationId} is null)::int`.mapWith(
              Number,
            ),
        })
        .from(legacyMigrationSoldRecords)
        .where(
          and(
            eq(legacyMigrationSoldRecords.batchId, batch.id),
            eq(
              legacyMigrationSoldRecords.organizationId,
              auth.organization.id,
            ),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        ),

      db
        .select({
          verificationId: legacyMigrationVerifications.id,
          verificationStatus: legacyMigrationVerifications.status,
          barcodeValue: legacyMigrationVerifications.barcodeValue,
          source: legacyMigrationVerifications.source,
          useLegacyImage: legacyMigrationVerifications.useLegacyImage,
          legacyImageUrl: legacyMigrationVerifications.legacyImageUrl,
          productItemId: legacyMigrationVerifications.productItemId,
          itemAvailability: productItems.availability,
          itemIsActive: productItems.isActive,
          itemOutletId: productItems.currentOutletId,
          itemLegacyId: productItems.legacyId,
          itemImageKey: productItems.imageKey,
          itemAttributes: productItems.attributes,
          masterStatus: productMasters.status,
          masterImageKey: productMasters.imageKey,
          aliasId: itemBarcodes.id,
          aliasSource: itemBarcodes.source,
          aliasIsActive: itemBarcodes.isActive,
          aliasIsPrimary: itemBarcodes.isPrimary,
        })
        .from(legacyMigrationVerifications)
        .leftJoin(
          productItems,
          eq(
            legacyMigrationVerifications.productItemId,
            productItems.id,
          ),
        )
        .leftJoin(
          productMasters,
          eq(
            legacyMigrationVerifications.targetProductMasterId,
            productMasters.id,
          ),
        )
        .leftJoin(
          itemBarcodes,
          and(
            eq(itemBarcodes.itemId, productItems.id),
            eq(
              itemBarcodes.barcodeValue,
              legacyMigrationVerifications.barcodeValue,
            ),
          ),
        )
        .where(
          and(
            eq(legacyMigrationVerifications.batchId, batch.id),
            eq(
              legacyMigrationVerifications.organizationId,
              auth.organization.id,
            ),
            inArray(legacyMigrationVerifications.status, [
              "approved",
              "activated",
            ]),
          ),
        )
        .orderBy(asc(legacyMigrationVerifications.barcodeValue)),
    ]);

  const sessionSummary = {
    total: 0,
    open: 0,
    closed: 0,
    cancelled: 0,
    expectedItems: 0,
    missingTarget: 0,
  };
  for (const row of sessionRows) {
    const total = Number(row.total);
    sessionSummary.total += total;
    if (row.status === "draft" || row.status === "active") {
      sessionSummary.open += total;
    } else if (row.status === "cancelled") {
      sessionSummary.cancelled += total;
    } else {
      sessionSummary.closed += total;
    }
    if (row.status !== "cancelled") {
      sessionSummary.expectedItems += Number(row.expectedItemCount);
      sessionSummary.missingTarget += Number(row.missingTarget);
    }
  }

  const verificationSummary = {
    total: 0,
    submitted: 0,
    needsReview: 0,
    returned: 0,
    approved: 0,
    rejected: 0,
    sold: 0,
    activated: 0,
  };
  for (const row of verificationStatusRows) {
    const total = Number(row.total);
    verificationSummary.total += total;
    if (row.status === "submitted") verificationSummary.submitted = total;
    if (row.status === "needs_review") verificationSummary.needsReview = total;
    if (row.status === "returned") verificationSummary.returned = total;
    if (row.status === "approved") verificationSummary.approved = total;
    if (row.status === "rejected") verificationSummary.rejected = total;
    if (row.status === "sold_during_migration") verificationSummary.sold = total;
    if (row.status === "activated") verificationSummary.activated = total;
  }

  const soldSummary = soldRows[0] ?? { total: 0, beforeScan: 0 };
  const processedPhysicalCount =
    verificationSummary.total + Number(soldSummary.beforeScan);
  const unresolvedCount =
    verificationSummary.submitted +
    verificationSummary.needsReview +
    verificationSummary.returned;

  const integrity = {
    itemMissing: 0,
    holdStateInvalid: 0,
    itemLinkInvalid: 0,
    masterNotActive: 0,
    aliasInvalid: 0,
  };
  const photos = {
    totalApproved: approvedRows.length,
    actualUpload: 0,
    pending: 0,
    copied: 0,
    failed: 0,
    masterFallback: 0,
    noFallback: 0,
  };
  const failedPhotos: Array<{
    barcodeValue: string;
    itemId: string;
    errorMessage: string;
    attemptedAt: string;
  }> = [];

  for (const row of approvedRows) {
    if (!row.productItemId || !row.itemAvailability) {
      integrity.itemMissing += 1;
      continue;
    }
    if (
      !row.itemIsActive ||
      !isLegacyPhotoMigrationItemEligible({
        verificationStatus: row.verificationStatus,
        itemAvailability: row.itemAvailability,
      })
    ) {
      integrity.holdStateInvalid += 1;
    }
    if (
      row.itemOutletId !== batch.outletId ||
      row.itemLegacyId !== row.barcodeValue
    ) {
      integrity.itemLinkInvalid += 1;
    }
    if (row.masterStatus !== "active") {
      integrity.masterNotActive += 1;
    }
    const expectedAliasSource =
      row.source === "legacy_match"
        ? "legacy_import"
        : "legacy_physical_label";
    if (
      !row.aliasId ||
      !row.aliasIsActive ||
      !row.aliasIsPrimary ||
      row.aliasSource !== expectedAliasSource
    ) {
      integrity.aliasInvalid += 1;
    }

    const photoStatus = getLegacyPhotoMigrationStatus({
      useLegacyImage: row.useLegacyImage,
      itemImageKey: row.itemImageKey,
      attributes: row.itemAttributes,
    });
    if (photoStatus === "not_required") photos.actualUpload += 1;
    if (photoStatus === "pending") photos.pending += 1;
    if (photoStatus === "copied") photos.copied += 1;
    if (photoStatus === "failed") photos.failed += 1;

    if (photoStatus === "pending" || photoStatus === "failed") {
      if (row.masterImageKey) photos.masterFallback += 1;
      else photos.noFallback += 1;
    }

    if (photoStatus === "failed" && row.productItemId) {
      const metadata = getLegacyPhotoMigrationMetadata(row.itemAttributes);
      failedPhotos.push({
        barcodeValue: row.barcodeValue,
        itemId: row.productItemId,
        errorMessage:
          metadata?.errorMessage ?? "Foto legacy gagal disalin.",
        attemptedAt: metadata?.attemptedAt ?? "",
      });
    }
  }

  const targetShortfall =
    sessionSummary.expectedItems > 0
      ? Math.max(0, sessionSummary.expectedItems - processedPhysicalCount)
      : 0;
  const issues: LegacyReconciliationIssue[] = [];
  if (sessionSummary.total === 0) {
    issues.push({
      code: "NO_SESSION",
      label: "Belum ada sesi migrasi",
      count: 1,
      href: `/admin/migrasi-produk/${batch.id}/sesi`,
    });
  }
  if (sessionSummary.open > 0) {
    issues.push({
      code: "OPEN_SESSION",
      label: "Sesi masih draft atau aktif",
      count: sessionSummary.open,
      href: `/admin/migrasi-produk/${batch.id}/sesi`,
    });
  }
  if (unresolvedCount > 0) {
    issues.push({
      code: "UNRESOLVED_VERIFICATION",
      label: "Verification belum selesai direview",
      count: unresolvedCount,
      href: `/admin/migrasi-produk/${batch.id}/review?status=pending`,
    });
  }
  if (targetShortfall > 0) {
    issues.push({
      code: "TARGET_SHORTFALL",
      label: "Jumlah proses masih di bawah target sesi",
      count: targetShortfall,
      href: `/admin/migrasi-produk/${batch.id}/sesi`,
    });
  }
  if (integrity.itemMissing > 0) {
    issues.push({
      code: "APPROVED_ITEM_MISSING",
      label: "Approval tidak memiliki Product Item",
      count: integrity.itemMissing,
      href: `/admin/migrasi-produk/${batch.id}/review?status=approved`,
    });
  }
  if (integrity.holdStateInvalid > 0) {
    issues.push({
      code: "HOLD_STATE_INVALID",
      label: "Status inventory hold tidak konsisten",
      count: integrity.holdStateInvalid,
      href: `/admin/migrasi-produk/${batch.id}/review?status=approved`,
    });
  }
  if (integrity.itemLinkInvalid > 0) {
    issues.push({
      code: "ITEM_LINK_INVALID",
      label: "Product Item tidak sesuai outlet atau barcode legacy",
      count: integrity.itemLinkInvalid,
      href: `/admin/migrasi-produk/${batch.id}/review?status=approved`,
    });
  }
  if (integrity.masterNotActive > 0) {
    issues.push({
      code: "MASTER_NOT_ACTIVE",
      label: "Product Master belum aktif",
      count: integrity.masterNotActive,
      href: `/admin/migrasi-produk/${batch.id}/mapping`,
    });
  }
  if (integrity.aliasInvalid > 0) {
    issues.push({
      code: "BARCODE_ALIAS_INVALID",
      label: "Alias barcode legacy tidak valid",
      count: integrity.aliasInvalid,
      href: `/admin/migrasi-produk/${batch.id}/review?status=approved`,
    });
  }

  return {
    batch,
    sessionSummary,
    verificationSummary,
    soldSummary: {
      total: Number(soldSummary.total),
      beforeScan: Number(soldSummary.beforeScan),
    },
    processedPhysicalCount,
    targetShortfall,
    integrity,
    photos,
    failedPhotos: failedPhotos.slice(0, 20),
    issues,
    blockerCount: issues.reduce((total, issue) => total + issue.count, 0),
    isReadyForCutover: issues.length === 0,
    path: reconciliationPath(batch.id),
  };
}

export async function getLegacyPhotoMigrationCandidates(
  auth: AuthContext,
  batchId: string,
  mode: "pending" | "failed",
  limit: number,
) {
  const batch = await getAccessibleLegacyBatch(auth, batchId);
  if (!batch) return null;

  const rows = await db
    .select({
      verificationId: legacyMigrationVerifications.id,
      barcodeValue: legacyMigrationVerifications.barcodeValue,
      legacyImageUrl: legacyMigrationVerifications.legacyImageUrl,
      productItemId: productItems.id,
    })
    .from(legacyMigrationVerifications)
    .innerJoin(
      productItems,
      eq(legacyMigrationVerifications.productItemId, productItems.id),
    )
    .leftJoin(
      legacyMigrationSoldRecords,
      and(
        eq(
          legacyMigrationSoldRecords.organizationId,
          auth.organization.id,
        ),
        eq(
          legacyMigrationSoldRecords.barcodeValue,
          legacyMigrationVerifications.barcodeValue,
        ),
        isNull(legacyMigrationSoldRecords.revertedAt),
      ),
    )
    .where(
      and(
        eq(legacyMigrationVerifications.batchId, batch.id),
        eq(
          legacyMigrationVerifications.organizationId,
          auth.organization.id,
        ),
        inArray(legacyMigrationVerifications.status, [
          "approved",
          "activated",
        ]),
        eq(legacyMigrationVerifications.useLegacyImage, true),
        sql`${legacyMigrationVerifications.legacyImageUrl} is not null`,
        inArray(productItems.availability, [
          "migration_hold",
          "available",
        ]),
        eq(productItems.isActive, true),
        isNull(productItems.imageKey),
        isNull(legacyMigrationSoldRecords.id),
        mode === "failed"
          ? sql`${productItems.attributes} #>> '{legacyPhotoMigration,status}' = 'failed'`
          : sql`coalesce(${productItems.attributes} #>> '{legacyPhotoMigration,status}', 'pending') <> 'failed'`,
      ),
    )
    .orderBy(asc(legacyMigrationVerifications.submittedAt))
    .limit(limit);

  return { batch, rows };
}
