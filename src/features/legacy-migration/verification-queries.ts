import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  legacyMigrationSessionAssignments,
  legacyMigrationSessions,
  legacyMigrationVerifications,
  legacyProductImportBatches,
  outlets,
  productCategories,
  productMasters,
  users,
} from "@/db/schema";
import type {
  LegacyMigrationScannerSession,
} from "@/features/legacy-migration/verification-contracts";
import { isLegacyMigrationUuid } from "@/features/legacy-migration/safety";
import type { AuthContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/session";

type ScannerAssignmentRole = LegacyMigrationScannerSession["assignmentRole"];

function resolveScannerAssignmentRole(
  canManageAll: boolean,
  assignmentRole: "operator" | "lead" | null,
): ScannerAssignmentRole {
  if (canManageAll) {
    return assignmentRole ?? "manager_override";
  }

  return assignmentRole ?? "operator";
}

export async function getLegacyMigrationScannerSessions(auth: AuthContext) {
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  if (outletIds.length === 0) return [];

  const canManageAll = hasPermission(auth, "migration.session.manage");

  const rows = await db
    .select({
      id: legacyMigrationSessions.id,
      batchId: legacyMigrationSessions.batchId,
      name: legacyMigrationSessions.name,
      locationCode: legacyMigrationSessions.locationCode,
      expectedItemCount: legacyMigrationSessions.expectedItemCount,
      notes: legacyMigrationSessions.notes,
      status: legacyMigrationSessions.status,
      outletName: outlets.name,
      fileName: legacyProductImportBatches.fileName,
      assignmentRole: legacyMigrationSessionAssignments.assignmentRole,
      submittedCount: sql<number>`(
        select count(*)::int
        from ${legacyMigrationVerifications}
        where ${legacyMigrationVerifications.sessionId} = ${legacyMigrationSessions.id}
      )`.mapWith(Number),
      needsReviewCount: sql<number>`(
        select count(*)::int
        from ${legacyMigrationVerifications}
        where ${legacyMigrationVerifications.sessionId} = ${legacyMigrationSessions.id}
          and ${legacyMigrationVerifications.status} = 'needs_review'
      )`.mapWith(Number),
    })
    .from(legacyMigrationSessions)
    .innerJoin(
      legacyProductImportBatches,
      eq(legacyMigrationSessions.batchId, legacyProductImportBatches.id),
    )
    .innerJoin(outlets, eq(legacyMigrationSessions.outletId, outlets.id))
    .leftJoin(
      legacyMigrationSessionAssignments,
      and(
        eq(
          legacyMigrationSessionAssignments.sessionId,
          legacyMigrationSessions.id,
        ),
        eq(legacyMigrationSessionAssignments.userId, auth.user.id),
      ),
    )
    .where(
      and(
        eq(legacyMigrationSessions.organizationId, auth.organization.id),
        inArray(legacyMigrationSessions.outletId, outletIds),
        canManageAll
          ? undefined
          : eq(legacyMigrationSessionAssignments.userId, auth.user.id),
      ),
    )
    .orderBy(
      sql`case ${legacyMigrationSessions.status}
        when 'active' then 0
        when 'locked' then 1
        when 'draft' then 2
        else 3
      end`,
      desc(legacyMigrationSessions.createdAt),
    );

  return rows.map((row) => ({
    ...row,
    assignmentRole: resolveScannerAssignmentRole(
      canManageAll,
      row.assignmentRole,
    ),
  }));
}

export async function getLegacyMigrationScannerSession(
  auth: AuthContext,
  sessionId: string,
) {
  if (!isLegacyMigrationUuid(sessionId)) return null;
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  if (outletIds.length === 0) return null;

  const canManageAll = hasPermission(auth, "migration.session.manage");

  const [session] = await db
    .select({
      id: legacyMigrationSessions.id,
      batchId: legacyMigrationSessions.batchId,
      name: legacyMigrationSessions.name,
      locationCode: legacyMigrationSessions.locationCode,
      expectedItemCount: legacyMigrationSessions.expectedItemCount,
      notes: legacyMigrationSessions.notes,
      status: legacyMigrationSessions.status,
      organizationId: legacyMigrationSessions.organizationId,
      outletId: legacyMigrationSessions.outletId,
      outletName: outlets.name,
      fileName: legacyProductImportBatches.fileName,
      barcodeLength: legacyProductImportBatches.barcodeLength,
      assignmentRole: legacyMigrationSessionAssignments.assignmentRole,
    })
    .from(legacyMigrationSessions)
    .innerJoin(
      legacyProductImportBatches,
      eq(legacyMigrationSessions.batchId, legacyProductImportBatches.id),
    )
    .innerJoin(outlets, eq(legacyMigrationSessions.outletId, outlets.id))
    .leftJoin(
      legacyMigrationSessionAssignments,
      and(
        eq(
          legacyMigrationSessionAssignments.sessionId,
          legacyMigrationSessions.id,
        ),
        eq(legacyMigrationSessionAssignments.userId, auth.user.id),
      ),
    )
    .where(
      and(
        eq(legacyMigrationSessions.id, sessionId),
        eq(legacyMigrationSessions.organizationId, auth.organization.id),
        inArray(legacyMigrationSessions.outletId, outletIds),
        canManageAll
          ? undefined
          : eq(legacyMigrationSessionAssignments.userId, auth.user.id),
      ),
    )
    .limit(1);

  if (!session) return null;

  const [productMasterRows, recentRows, summaryRows] = await Promise.all([
    db
      .select({
        id: productMasters.id,
        code: productMasters.code,
        name: productMasters.name,
        status: productMasters.status,
        categoryName: productCategories.name,
      })
      .from(productMasters)
      .innerJoin(
        productCategories,
        eq(productMasters.categoryId, productCategories.id),
      )
      .where(
        and(
          eq(productMasters.organizationId, auth.organization.id),
          inArray(productMasters.status, ["draft", "active"]),
        ),
      )
      .orderBy(asc(productCategories.name), asc(productMasters.name)),

    db
      .select({
        id: legacyMigrationVerifications.id,
        barcodeValue: legacyMigrationVerifications.barcodeValue,
        source: legacyMigrationVerifications.source,
        status: legacyMigrationVerifications.status,
        verifiedItemName: legacyMigrationVerifications.verifiedItemName,
        submittedByName: users.fullName,
        submittedAt: legacyMigrationVerifications.submittedAt,
      })
      .from(legacyMigrationVerifications)
      .innerJoin(users, eq(legacyMigrationVerifications.submittedBy, users.id))
      .where(eq(legacyMigrationVerifications.sessionId, session.id))
      .orderBy(desc(legacyMigrationVerifications.submittedAt))
      .limit(12),

    db
      .select({
        status: legacyMigrationVerifications.status,
        total: count(),
      })
      .from(legacyMigrationVerifications)
      .where(eq(legacyMigrationVerifications.sessionId, session.id))
      .groupBy(legacyMigrationVerifications.status),
  ]);

  const summary = {
    total: 0,
    submitted: 0,
    needsReview: 0,
    approved: 0,
    returned: 0,
    rejected: 0,
    soldDuringMigration: 0,
    activated: 0,
  };
  for (const row of summaryRows) {
    const total = Number(row.total);
    summary.total += total;
    if (row.status === "submitted") summary.submitted = total;
    if (row.status === "needs_review") summary.needsReview = total;
    if (row.status === "approved") summary.approved = total;
    if (row.status === "returned") summary.returned = total;
    if (row.status === "rejected") summary.rejected = total;
    if (row.status === "sold_during_migration") {
      summary.soldDuringMigration = total;
    }
    if (row.status === "activated") summary.activated = total;
  }

  return {
    session: {
      ...session,
      assignmentRole: resolveScannerAssignmentRole(
        canManageAll,
        session.assignmentRole,
      ),
    },
    productMasters: productMasterRows,
    recentVerifications: recentRows.map((row) => ({
      ...row,
      submittedAt: row.submittedAt.toISOString(),
    })),
    summary,
  };
}
