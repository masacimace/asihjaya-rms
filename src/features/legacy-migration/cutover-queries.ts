import { and, asc, count, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  itemBarcodes,
  legacyMigrationCutoverRuns,
  legacyMigrationSessions,
  legacyMigrationSoldRecords,
  legacyMigrationVerifications,
  productCategories,
  productItems,
  productMasters,
  users,
} from "@/db/schema";
import type {
  LegacyCutoverBatchIssue,
  LegacyCutoverIssueCode,
  LegacyCutoverSessionSummary,
} from "@/features/legacy-migration/cutover-contracts";
import {
  getLegacyCutoverItemIssues,
  summarizeLegacyCutoverIssueCounts,
} from "@/features/legacy-migration/cutover-rules";
import { getAccessibleLegacyBatch } from "@/features/legacy-migration/management-queries";
import type { AuthContext } from "@/lib/auth/session";

const PRICING_ISSUES = new Set<LegacyCutoverIssueCode>([
  "SELLING_AMOUNT_INVALID",
  "PRICE_PER_GRAM_INVALID",
  "DEDUCTION_PER_GRAM_INVALID",
]);

function incrementIssueCount(
  counts: Map<LegacyCutoverIssueCode, number>,
  code: LegacyCutoverIssueCode,
  amount = 1,
) {
  if (amount <= 0) return;
  counts.set(code, (counts.get(code) ?? 0) + amount);
}

export async function getLegacyMigrationCutoverData(
  auth: AuthContext,
  batchId: string,
) {
  const batch = await getAccessibleLegacyBatch(auth, batchId);
  if (!batch) return null;

  const [sessions, verifications, soldRows, approvedRows, runs, unassignedRows] =
    await Promise.all([
      db
        .select({
          id: legacyMigrationSessions.id,
          name: legacyMigrationSessions.name,
          locationCode: legacyMigrationSessions.locationCode,
          expectedItemCount: legacyMigrationSessions.expectedItemCount,
          status: legacyMigrationSessions.status,
          createdAt: legacyMigrationSessions.createdAt,
        })
        .from(legacyMigrationSessions)
        .where(
          and(
            eq(legacyMigrationSessions.batchId, batch.id),
            eq(legacyMigrationSessions.organizationId, auth.organization.id),
          ),
        )
        .orderBy(asc(legacyMigrationSessions.createdAt)),

      db
        .select({
          sessionId: legacyMigrationVerifications.sessionId,
          status: legacyMigrationVerifications.status,
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
        ),

      db
        .select({
          sessionId: legacyMigrationSoldRecords.sessionId,
          total: count(),
        })
        .from(legacyMigrationSoldRecords)
        .where(
          and(
            eq(legacyMigrationSoldRecords.batchId, batch.id),
            eq(
              legacyMigrationSoldRecords.organizationId,
              auth.organization.id,
            ),
            isNull(legacyMigrationSoldRecords.verificationId),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        )
        .groupBy(legacyMigrationSoldRecords.sessionId),

      db
        .select({
          sessionId: legacyMigrationVerifications.sessionId,
          source: legacyMigrationVerifications.source,
          barcodeValue: legacyMigrationVerifications.barcodeValue,
          targetProductMasterId:
            legacyMigrationVerifications.targetProductMasterId,
          productItemId: legacyMigrationVerifications.productItemId,
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
          aliasId: itemBarcodes.id,
          aliasSource: itemBarcodes.source,
          aliasIsPrimary: itemBarcodes.isPrimary,
          aliasIsActive: itemBarcodes.isActive,
          soldRecordId: legacyMigrationSoldRecords.id,
        })
        .from(legacyMigrationVerifications)
        .leftJoin(
          productItems,
          eq(legacyMigrationVerifications.productItemId, productItems.id),
        )
        .leftJoin(
          productMasters,
          eq(productItems.productMasterId, productMasters.id),
        )
        .leftJoin(
          productCategories,
          eq(productMasters.categoryId, productCategories.id),
        )
        .leftJoin(
          itemBarcodes,
          and(
            eq(itemBarcodes.organizationId, auth.organization.id),
            eq(itemBarcodes.itemId, productItems.id),
            eq(
              itemBarcodes.barcodeValue,
              legacyMigrationVerifications.barcodeValue,
            ),
            eq(itemBarcodes.isActive, true),
          ),
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
            eq(legacyMigrationVerifications.status, "approved"),
          ),
        )
        .orderBy(asc(legacyMigrationVerifications.barcodeValue)),

      db
        .select({
          id: legacyMigrationCutoverRuns.id,
          sessionId: legacyMigrationCutoverRuns.sessionId,
          itemCount: legacyMigrationCutoverRuns.itemCount,
          executedAt: legacyMigrationCutoverRuns.executedAt,
          executedByName: users.fullName,
        })
        .from(legacyMigrationCutoverRuns)
        .innerJoin(users, eq(legacyMigrationCutoverRuns.executedBy, users.id))
        .where(
          and(
            eq(legacyMigrationCutoverRuns.batchId, batch.id),
            eq(
              legacyMigrationCutoverRuns.organizationId,
              auth.organization.id,
            ),
          ),
        )
        .orderBy(asc(legacyMigrationCutoverRuns.executedAt)),

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
            isNull(legacyMigrationSoldRecords.sessionId),
            isNull(legacyMigrationSoldRecords.revertedAt),
          ),
        ),
    ]);

  const verificationBySession = new Map<
    string,
    {
      total: number;
      unresolved: number;
      approved: number;
      activated: number;
      sold: number;
      rejected: number;
    }
  >();

  for (const row of verifications) {
    const summary = verificationBySession.get(row.sessionId) ?? {
      total: 0,
      unresolved: 0,
      approved: 0,
      activated: 0,
      sold: 0,
      rejected: 0,
    };
    summary.total += 1;
    if (["submitted", "needs_review", "returned"].includes(row.status)) {
      summary.unresolved += 1;
    }
    if (row.status === "approved") summary.approved += 1;
    if (row.status === "activated") summary.activated += 1;
    if (row.status === "sold_during_migration") summary.sold += 1;
    if (row.status === "rejected") summary.rejected += 1;
    verificationBySession.set(row.sessionId, summary);
  }

  const soldBeforeScanBySession = new Map<string, number>();
  for (const row of soldRows) {
    if (row.sessionId) {
      soldBeforeScanBySession.set(row.sessionId, Number(row.total));
    }
  }

  const issueCountsBySession = new Map<
    string,
    Map<LegacyCutoverIssueCode, number>
  >();
  const readyItemsBySession = new Map<string, number>();
  for (const row of approvedRows) {
    const itemIssues = getLegacyCutoverItemIssues({
      source: row.source,
      barcodeValue: row.barcodeValue,
      batchOutletId: batch.outletId,
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
      aliasId: row.aliasId,
      aliasSource: row.aliasSource,
      aliasIsPrimary: row.aliasIsPrimary,
      aliasIsActive: row.aliasIsActive,
      hasActiveSoldRecord: Boolean(row.soldRecordId),
    });
    const issueCounts =
      issueCountsBySession.get(row.sessionId) ??
      new Map<LegacyCutoverIssueCode, number>();
    for (const issue of itemIssues) incrementIssueCount(issueCounts, issue);
    issueCountsBySession.set(row.sessionId, issueCounts);
    if (itemIssues.length === 0) {
      readyItemsBySession.set(
        row.sessionId,
        (readyItemsBySession.get(row.sessionId) ?? 0) + 1,
      );
    }
  }

  const runsBySession = new Map(runs.map((run) => [run.sessionId, run]));
  const unassignedSoldCount = Number(unassignedRows[0]?.total ?? 0);
  const batchIssues: LegacyCutoverBatchIssue[] = unassignedSoldCount
    ? [
        {
          code: "SOLD_SESSION_UNASSIGNED",
          label: "Barang terjual belum ditentukan sesi etalasenya",
          count: unassignedSoldCount,
          href: `/admin/migrasi-produk/${batch.id}/sold`,
        },
      ]
    : [];

  const sessionSummaries: LegacyCutoverSessionSummary[] = sessions.map(
    (session) => {
      const counts = verificationBySession.get(session.id) ?? {
        total: 0,
        unresolved: 0,
        approved: 0,
        activated: 0,
        sold: 0,
        rejected: 0,
      };
      const soldBeforeScanCount = soldBeforeScanBySession.get(session.id) ?? 0;
      const processedItemCount = counts.total + soldBeforeScanCount;
      const expected = session.expectedItemCount;
      const targetIsApplicable =
        session.status !== "cancelled" && expected !== null;
      const targetShortfall = targetIsApplicable
        ? Math.max(0, expected - processedItemCount)
        : 0;
      const targetSurplus = targetIsApplicable
        ? Math.max(0, processedItemCount - expected)
        : 0;
      const issueCounts = new Map(
        issueCountsBySession.get(session.id) ??
          new Map<LegacyCutoverIssueCode, number>(),
      );

      if (session.status === "cancelled") {
        incrementIssueCount(
          issueCounts,
          "CANCELLED_SESSION_HAS_DATA",
          processedItemCount > 0 ? 1 : 0,
        );
      } else if (session.status !== "completed") {
        incrementIssueCount(
          issueCounts,
          "SESSION_NOT_LOCKED",
          session.status === "locked" ? 0 : 1,
        );
        incrementIssueCount(
          issueCounts,
          "UNRESOLVED_VERIFICATION",
          counts.unresolved,
        );
      }

      const issueHrefBase = `/admin/migrasi-produk/${batch.id}`;
      const issues = summarizeLegacyCutoverIssueCounts(issueCounts, {
        SESSION_NOT_LOCKED: `${issueHrefBase}/sesi`,
        UNRESOLVED_VERIFICATION: `${issueHrefBase}/review?status=pending&sessionId=${session.id}`,
        CANCELLED_SESSION_HAS_DATA: `${issueHrefBase}/sesi`,
        ITEM_MISSING: `${issueHrefBase}/review?status=approved&sessionId=${session.id}`,
        ITEM_NOT_ON_HOLD: `${issueHrefBase}/review?status=approved&sessionId=${session.id}`,
        ITEM_LINK_INVALID: `${issueHrefBase}/review?status=approved&sessionId=${session.id}`,
        ITEM_MASTER_MISMATCH: `${issueHrefBase}/review?status=approved&sessionId=${session.id}`,
        MASTER_NOT_ACTIVE: `${issueHrefBase}/mapping`,
        CATEGORY_NOT_ACTIVE: `${issueHrefBase}/mapping`,
        SELLING_AMOUNT_INVALID: `${issueHrefBase}/review?status=approved&sessionId=${session.id}`,
        PRICE_PER_GRAM_INVALID: `${issueHrefBase}/review?status=approved&sessionId=${session.id}`,
        DEDUCTION_PER_GRAM_INVALID: `${issueHrefBase}/review?status=approved&sessionId=${session.id}`,
        ITEM_CONDITION_INVALID: `${issueHrefBase}/review?status=approved&sessionId=${session.id}`,
        ITEM_LOCATION_INVALID: `${issueHrefBase}/review?status=approved&sessionId=${session.id}`,
        BARCODE_ALIAS_INVALID: `${issueHrefBase}/review?status=approved&sessionId=${session.id}`,
        SOLD_CONFLICT: `${issueHrefBase}/sold`,
      });
      const cutoverRun = runsBySession.get(session.id) ?? null;
      const pricingBlockerCount = Array.from(issueCounts.entries()).reduce(
        (total, [code, count]) =>
          total + (PRICING_ISSUES.has(code) ? count : 0),
        0,
      );

      return {
        id: session.id,
        name: session.name,
        locationCode: session.locationCode,
        expectedItemCount: expected,
        status: session.status,
        totalVerifications: counts.total,
        processedItemCount,
        soldBeforeScanCount,
        unresolvedCount: counts.unresolved,
        approvedCount: counts.approved,
        activatedCount: counts.activated,
        soldCount: counts.sold,
        rejectedCount: counts.rejected,
        targetShortfall,
        targetSurplus,
        readyItemCount: readyItemsBySession.get(session.id) ?? 0,
        pricingBlockerCount,
        issueCount: issues.reduce((total, issue) => total + issue.count, 0),
        issues,
        cutoverRun,
        canExecute:
          unassignedSoldCount === 0 &&
          !cutoverRun &&
          session.status === "locked" &&
          issues.length === 0,
      };
    },
  );

  return {
    batch,
    sessions: sessionSummaries,
    batchIssues,
    blockerCount:
      batchIssues.reduce((total, issue) => total + issue.count, 0) +
      sessionSummaries.reduce((total, session) => total + session.issueCount, 0),
    executableSessionCount: sessionSummaries.filter((session) => session.canExecute)
      .length,
    totalProcessedItems: sessionSummaries.reduce(
      (total, session) => total + session.processedItemCount,
      0,
    ),
    totalReadyItems: sessionSummaries.reduce(
      (total, session) => total + session.readyItemCount,
      0,
    ),
    totalApprovedItems: sessionSummaries.reduce(
      (total, session) => total + session.approvedCount,
      0,
    ),
    totalActivatedItems: sessionSummaries.reduce(
      (total, session) => total + session.activatedCount,
      0,
    ),
    totalSoldItems: sessionSummaries.reduce(
      (total, session) =>
        total + session.soldCount + session.soldBeforeScanCount,
      0,
    ),
    completedRunCount: runs.length,
  };
}
