import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  legacyMigrationSessions,
  legacyMigrationSoldRecords,
  legacyMigrationVerifications,
  legacyProductRows,
  productCategories,
  productItems,
  productMasters,
  users,
} from "@/db/schema";
import {
  LEGACY_REVIEW_PAGE_SIZE,
  type LegacyReviewQueueFilters,
} from "@/features/legacy-migration/review-contracts";
import { getAccessibleLegacyBatch } from "@/features/legacy-migration/management-queries";
import { isLegacyMigrationUuid } from "@/features/legacy-migration/safety";
import type { AuthContext } from "@/lib/auth/session";

function statusCondition(status: LegacyReviewQueueFilters["status"]) {
  if (status === "all") return undefined;
  if (status === "pending") {
    return inArray(legacyMigrationVerifications.status, [
      "submitted",
      "needs_review",
    ]);
  }
  return eq(legacyMigrationVerifications.status, status);
}

export async function getLegacyMigrationReviewQueue(
  auth: AuthContext,
  batchId: string,
  filters: LegacyReviewQueueFilters,
) {
  const batch = await getAccessibleLegacyBatch(auth, batchId);
  if (!batch) return null;

  const searchCondition = filters.search
    ? or(
        ilike(
          legacyMigrationVerifications.barcodeValue,
          `%${filters.search}%`,
        ),
        ilike(
          legacyMigrationVerifications.verifiedItemName,
          `%${filters.search}%`,
        ),
        ilike(productMasters.name, `%${filters.search}%`),
      )
    : undefined;
  const where = and(
    eq(legacyMigrationVerifications.batchId, batch.id),
    eq(
      legacyMigrationVerifications.organizationId,
      auth.organization.id,
    ),
    statusCondition(filters.status),
    filters.sessionId
      ? eq(legacyMigrationVerifications.sessionId, filters.sessionId)
      : undefined,
    searchCondition,
  );

  const [rows, totalRows, summaryRows, soldSummaryRows, sessions] =
    await Promise.all([
    db
      .select({
        id: legacyMigrationVerifications.id,
        barcodeValue: legacyMigrationVerifications.barcodeValue,
        source: legacyMigrationVerifications.source,
        status: legacyMigrationVerifications.status,
        verifiedItemName: legacyMigrationVerifications.verifiedItemName,
        verifiedWeightGram:
          legacyMigrationVerifications.verifiedWeightGram,
        verifiedPurity: legacyMigrationVerifications.verifiedPurity,
        condition: legacyMigrationVerifications.condition,
        reviewFlags: legacyMigrationVerifications.reviewFlags,
        productMasterName: productMasters.name,
        productMasterCode: productMasters.code,
        sessionName: legacyMigrationSessions.name,
        submittedByName: users.fullName,
        submittedAt: legacyMigrationVerifications.submittedAt,
        productItemId: legacyMigrationVerifications.productItemId,
      })
      .from(legacyMigrationVerifications)
      .innerJoin(
        legacyMigrationSessions,
        eq(
          legacyMigrationVerifications.sessionId,
          legacyMigrationSessions.id,
        ),
      )
      .innerJoin(
        productMasters,
        eq(
          legacyMigrationVerifications.targetProductMasterId,
          productMasters.id,
        ),
      )
      .innerJoin(users, eq(legacyMigrationVerifications.submittedBy, users.id))
      .where(where)
      .orderBy(
        sql`case ${legacyMigrationVerifications.status}
          when 'needs_review' then 0
          when 'submitted' then 1
          when 'returned' then 2
          else 3
        end`,
        desc(legacyMigrationVerifications.submittedAt),
      )
      .limit(LEGACY_REVIEW_PAGE_SIZE)
      .offset((filters.page - 1) * LEGACY_REVIEW_PAGE_SIZE),

    db
      .select({ total: count() })
      .from(legacyMigrationVerifications)
      .innerJoin(
        productMasters,
        eq(
          legacyMigrationVerifications.targetProductMasterId,
          productMasters.id,
        ),
      )
      .where(where),

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
      .select({ total: count() })
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
        id: legacyMigrationSessions.id,
        name: legacyMigrationSessions.name,
        status: legacyMigrationSessions.status,
      })
      .from(legacyMigrationSessions)
      .where(eq(legacyMigrationSessions.batchId, batch.id))
      .orderBy(asc(legacyMigrationSessions.name)),
  ]);

  const summary = {
    submitted: 0,
    needsReview: 0,
    returned: 0,
    approved: 0,
    rejected: 0,
    soldDuringMigration: 0,
    activated: 0,
  };
  for (const row of summaryRows) {
    const total = Number(row.total);
    if (row.status === "submitted") summary.submitted = total;
    if (row.status === "needs_review") summary.needsReview = total;
    if (row.status === "returned") summary.returned = total;
    if (row.status === "approved") summary.approved = total;
    if (row.status === "rejected") summary.rejected = total;
    if (row.status === "activated") summary.activated = total;
  }
  summary.soldDuringMigration = Number(soldSummaryRows[0]?.total ?? 0);

  const total = Number(totalRows[0]?.total ?? 0);
  return {
    batch,
    rows,
    sessions,
    summary,
    pagination: {
      page: filters.page,
      pageSize: LEGACY_REVIEW_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / LEGACY_REVIEW_PAGE_SIZE)),
    },
  };
}

export async function getLegacyMigrationReviewDetail(
  auth: AuthContext,
  batchId: string,
  verificationId: string,
) {
  if (!isLegacyMigrationUuid(verificationId)) return null;
  const batch = await getAccessibleLegacyBatch(auth, batchId);
  if (!batch) return null;

  const [row] = await db
    .select({
      id: legacyMigrationVerifications.id,
      batchId: legacyMigrationVerifications.batchId,
      sessionId: legacyMigrationVerifications.sessionId,
      outletId: legacyMigrationVerifications.outletId,
      barcodeValue: legacyMigrationVerifications.barcodeValue,
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
      useLegacyImage: legacyMigrationVerifications.useLegacyImage,
      legacyImageUrl: legacyMigrationVerifications.legacyImageUrl,
      imageKey: legacyMigrationVerifications.imageKey,
      staffNotes: legacyMigrationVerifications.staffNotes,
      reviewFlags: legacyMigrationVerifications.reviewFlags,
      submittedAt: legacyMigrationVerifications.submittedAt,
      reviewedAt: legacyMigrationVerifications.reviewedAt,
      reviewNotes: legacyMigrationVerifications.reviewNotes,
      revision: legacyMigrationVerifications.revision,
      productItemId: legacyMigrationVerifications.productItemId,
      productMasterCode: productMasters.code,
      productMasterName: productMasters.name,
      productMasterStatus: productMasters.status,
      categoryName: productCategories.name,
      sessionName: legacyMigrationSessions.name,
      sessionLocationCode: legacyMigrationSessions.locationCode,
      submittedByName: users.fullName,
      legacyRowNumber: legacyProductRows.rowNumber,
      legacyCategory: legacyProductRows.legacyCategory,
      legacyMasterCode: legacyProductRows.legacyMasterCode,
      legacyMasterName: legacyProductRows.legacyMasterName,
      legacyItemName: legacyProductRows.legacyItemName,
      legacyWeightGram: legacyProductRows.legacyWeightGram,
      legacyPurity: legacyProductRows.legacyPurity,
      legacyExchangePurity: legacyProductRows.legacyExchangePurity,
      legacyColor: legacyProductRows.legacyColor,
      legacyValidationStatus: legacyProductRows.validationStatus,
      legacyValidationIssues: legacyProductRows.validationIssues,
      itemSku: productItems.sku,
      itemAvailability: productItems.availability,
      soldRecordId: legacyMigrationSoldRecords.id,
      soldAt: legacyMigrationSoldRecords.soldAt,
      soldLegacyReference: legacyMigrationSoldRecords.legacyReference,
      soldNotes: legacyMigrationSoldRecords.notes,
    })
    .from(legacyMigrationVerifications)
    .innerJoin(
      legacyMigrationSessions,
      eq(legacyMigrationVerifications.sessionId, legacyMigrationSessions.id),
    )
    .innerJoin(
      productMasters,
      eq(
        legacyMigrationVerifications.targetProductMasterId,
        productMasters.id,
      ),
    )
    .innerJoin(
      productCategories,
      eq(productMasters.categoryId, productCategories.id),
    )
    .innerJoin(users, eq(legacyMigrationVerifications.submittedBy, users.id))
    .leftJoin(
      legacyProductRows,
      eq(legacyMigrationVerifications.legacyRowId, legacyProductRows.id),
    )
    .leftJoin(
      productItems,
      eq(legacyMigrationVerifications.productItemId, productItems.id),
    )
    .leftJoin(
      legacyMigrationSoldRecords,
      and(
        eq(
          legacyMigrationSoldRecords.verificationId,
          legacyMigrationVerifications.id,
        ),
        isNull(legacyMigrationSoldRecords.revertedAt),
      ),
    )
    .where(
      and(
        eq(legacyMigrationVerifications.id, verificationId),
        eq(legacyMigrationVerifications.batchId, batch.id),
        eq(
          legacyMigrationVerifications.organizationId,
          auth.organization.id,
        ),
      ),
    )
    .limit(1);

  return row ? { batch, verification: row } : null;
}
