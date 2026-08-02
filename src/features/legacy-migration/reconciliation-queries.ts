import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  legacyMigrationSoldRecords,
  legacyMigrationVerifications,
  productItems,
  productMasters,
} from "@/db/schema";
import { getLegacyMigrationCutoverData } from "@/features/legacy-migration/cutover-queries";
import type { LegacyReconciliationIssue } from "@/features/legacy-migration/reconciliation-contracts";
import { getAccessibleLegacyBatch } from "@/features/legacy-migration/management-queries";
import {
  getLegacyPhotoMigrationMetadata,
  getLegacyPhotoMigrationStatus,
} from "@/features/legacy-migration/reconciliation-rules";
import type { AuthContext } from "@/lib/auth/session";

function reconciliationPath(batchId: string) {
  return `/admin/migrasi-produk/${batchId}/rekonsiliasi`;
}

export async function getLegacyMigrationReconciliationData(
  auth: AuthContext,
  batchId: string,
) {
  const readiness = await getLegacyMigrationCutoverData(auth, batchId);
  if (!readiness) return null;

  const [verificationStatusRows, soldRows, approvedRows] = await Promise.all([
    db
      .select({
        status: legacyMigrationVerifications.status,
        total: count(),
      })
      .from(legacyMigrationVerifications)
      .where(
        and(
          eq(legacyMigrationVerifications.batchId, readiness.batch.id),
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
          eq(legacyMigrationSoldRecords.batchId, readiness.batch.id),
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
        useLegacyImage: legacyMigrationVerifications.useLegacyImage,
        legacyImageUrl: legacyMigrationVerifications.legacyImageUrl,
        productItemId: legacyMigrationVerifications.productItemId,
        itemImageKey: productItems.imageKey,
        itemAttributes: productItems.attributes,
        masterImageKey: productMasters.imageKey,
      })
      .from(legacyMigrationVerifications)
      .leftJoin(
        productItems,
        eq(legacyMigrationVerifications.productItemId, productItems.id),
      )
      .leftJoin(
        productMasters,
        eq(
          legacyMigrationVerifications.targetProductMasterId,
          productMasters.id,
        ),
      )
      .where(
        and(
          eq(legacyMigrationVerifications.batchId, readiness.batch.id),
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
    total: readiness.sessions.length,
    open: readiness.sessions.filter((session) =>
      ["draft", "active"].includes(session.status),
    ).length,
    closed: readiness.sessions.filter((session) =>
      ["locked", "completed"].includes(session.status),
    ).length,
    cancelled: readiness.sessions.filter(
      (session) => session.status === "cancelled",
    ).length,
  };

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
        errorMessage: metadata?.errorMessage ?? "Foto legacy gagal disalin.",
        attemptedAt: metadata?.attemptedAt ?? "",
      });
    }
  }

  const issueMap = new Map<string, LegacyReconciliationIssue>();
  for (const issue of readiness.batchIssues) {
    issueMap.set(issue.code, issue);
  }
  for (const session of readiness.sessions) {
    for (const issue of session.issues) {
      if (!issue.href) continue;
      const existing = issueMap.get(issue.code);
      issueMap.set(issue.code, {
        code: issue.code,
        label: issue.label,
        count: (existing?.count ?? 0) + issue.count,
        href: existing?.href ?? issue.href,
      });
    }
  }

  const issues = Array.from(issueMap.values());
  const soldSummaryRow = soldRows[0] ?? { total: 0, beforeScan: 0 };

  return {
    batch: readiness.batch,
    sessions: readiness.sessions,
    batchIssues: readiness.batchIssues,
    sessionSummary,
    verificationSummary,
    soldSummary: {
      total: Number(soldSummaryRow.total),
      beforeScan: Number(soldSummaryRow.beforeScan),
    },
    processedPhysicalCount: readiness.totalProcessedItems,
    integrity: {
      itemMissing: issues.find((issue) => issue.code === "ITEM_MISSING")?.count ?? 0,
      holdStateInvalid:
        issues.find((issue) => issue.code === "ITEM_NOT_ON_HOLD")?.count ?? 0,
      itemLinkInvalid:
        issues.find((issue) => issue.code === "ITEM_LINK_INVALID")?.count ?? 0,
      masterNotActive:
        issues.find((issue) => issue.code === "MASTER_NOT_ACTIVE")?.count ?? 0,
      aliasInvalid:
        issues.find((issue) => issue.code === "BARCODE_ALIAS_INVALID")?.count ?? 0,
    },
    photos,
    failedPhotos: failedPhotos.slice(0, 20),
    issues,
    blockerCount: readiness.blockerCount,
    executableSessionCount: readiness.executableSessionCount,
    isReadyForCutover: readiness.executableSessionCount > 0,
    path: reconciliationPath(readiness.batch.id),
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
        inArray(productItems.availability, ["migration_hold", "available"]),
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
