import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  itemBarcodes,
  legacyMigrationCutoverRuns,
  legacyMigrationSessions,
  legacyMigrationSoldRecords,
  legacyMigrationVerifications,
  productItems,
  productMasters,
  users,
} from "@/db/schema";
import type {
  LegacyCutoverIssueCode,
  LegacyCutoverSessionSummary,
} from "@/features/legacy-migration/cutover-contracts";
import {
  getLegacyCutoverItemIssues,
  isLegacyCutoverSessionClosed,
  summarizeLegacyCutoverIssues,
} from "@/features/legacy-migration/cutover-rules";
import { getLegacyMigrationReconciliationData } from "@/features/legacy-migration/reconciliation-queries";
import type { AuthContext } from "@/lib/auth/session";

export async function getLegacyMigrationCutoverData(
  auth: AuthContext,
  batchId: string,
) {
  const reconciliation = await getLegacyMigrationReconciliationData(
    auth,
    batchId,
  );
  if (!reconciliation) return null;

  const [sessions, verifications, approvedRows, runs] = await Promise.all([
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
          eq(legacyMigrationSessions.batchId, reconciliation.batch.id),
          eq(
            legacyMigrationSessions.organizationId,
            auth.organization.id,
          ),
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
          eq(legacyMigrationVerifications.batchId, reconciliation.batch.id),
          eq(
            legacyMigrationVerifications.organizationId,
            auth.organization.id,
          ),
        ),
      ),

    db
      .select({
        sessionId: legacyMigrationVerifications.sessionId,
        source: legacyMigrationVerifications.source,
        barcodeValue: legacyMigrationVerifications.barcodeValue,
        productItemId: legacyMigrationVerifications.productItemId,
        itemAvailability: productItems.availability,
        itemIsActive: productItems.isActive,
        itemOutletId: productItems.currentOutletId,
        itemLegacyId: productItems.legacyId,
        masterStatus: productMasters.status,
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
          eq(legacyMigrationVerifications.batchId, reconciliation.batch.id),
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
          eq(legacyMigrationCutoverRuns.batchId, reconciliation.batch.id),
          eq(
            legacyMigrationCutoverRuns.organizationId,
            auth.organization.id,
          ),
        ),
      )
      .orderBy(asc(legacyMigrationCutoverRuns.executedAt)),
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
    if (
      row.status === "submitted" ||
      row.status === "needs_review" ||
      row.status === "returned"
    ) {
      summary.unresolved += 1;
    }
    if (row.status === "approved") summary.approved += 1;
    if (row.status === "activated") summary.activated += 1;
    if (row.status === "sold_during_migration") summary.sold += 1;
    if (row.status === "rejected") summary.rejected += 1;
    verificationBySession.set(row.sessionId, summary);
  }

  const issueCodesBySession = new Map<string, LegacyCutoverIssueCode[]>();
  for (const row of approvedRows) {
    const codes = issueCodesBySession.get(row.sessionId) ?? [];
    codes.push(
      ...getLegacyCutoverItemIssues({
        source: row.source,
        barcodeValue: row.barcodeValue,
        batchOutletId: reconciliation.batch.outletId,
        productItemId: row.productItemId,
        itemAvailability: row.itemAvailability,
        itemIsActive: row.itemIsActive,
        itemOutletId: row.itemOutletId,
        itemLegacyId: row.itemLegacyId,
        masterStatus: row.masterStatus,
        aliasId: row.aliasId,
        aliasSource: row.aliasSource,
        aliasIsPrimary: row.aliasIsPrimary,
        aliasIsActive: row.aliasIsActive,
        hasActiveSoldRecord: Boolean(row.soldRecordId),
      }),
    );
    issueCodesBySession.set(row.sessionId, codes);
  }

  const runsBySession = new Map(runs.map((run) => [run.sessionId, run]));
  const globalReady = reconciliation.isReadyForCutover;

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
      const issueCodes = issueCodesBySession.get(session.id) ?? [];
      if (!isLegacyCutoverSessionClosed(session.status)) {
        issueCodes.unshift("SESSION_NOT_CLOSED");
      }
      if (counts.unresolved > 0) {
        issueCodes.unshift(
          ...Array.from(
            { length: counts.unresolved },
            () => "UNRESOLVED_VERIFICATION" as const,
          ),
        );
      }
      const issues = summarizeLegacyCutoverIssues(issueCodes);
      const cutoverRun = runsBySession.get(session.id) ?? null;

      return {
        id: session.id,
        name: session.name,
        locationCode: session.locationCode,
        expectedItemCount: session.expectedItemCount,
        status: session.status,
        totalVerifications: counts.total,
        unresolvedCount: counts.unresolved,
        approvedCount: counts.approved,
        activatedCount: counts.activated,
        soldCount: counts.sold,
        rejectedCount: counts.rejected,
        readyItemCount: counts.approved,
        issueCount: issues.reduce((total, issue) => total + issue.count, 0),
        issues,
        cutoverRun,
        canExecute:
          globalReady &&
          !cutoverRun &&
          isLegacyCutoverSessionClosed(session.status) &&
          issues.length === 0,
      };
    },
  );

  return {
    batch: reconciliation.batch,
    reconciliation,
    sessions: sessionSummaries,
    totalReadyItems: sessionSummaries.reduce(
      (total, session) => total + session.readyItemCount,
      0,
    ),
    totalActivatedItems: sessionSummaries.reduce(
      (total, session) => total + session.activatedCount,
      0,
    ),
    completedRunCount: runs.length,
  };
}
