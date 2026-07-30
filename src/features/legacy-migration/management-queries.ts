import {
  and,
  asc,
  count,
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
  legacyProductMasterMappings,
  outlets,
  productCategories,
  productMasters,
  roles,
  userOutlets,
  userRoles,
  users,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getAccessibleLegacyBatch(
  auth: AuthContext,
  batchId: string,
) {
  if (!UUID_PATTERN.test(batchId)) return null;
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  if (outletIds.length === 0) return null;

  const [batch] = await db
    .select({
      id: legacyProductImportBatches.id,
      organizationId: legacyProductImportBatches.organizationId,
      outletId: legacyProductImportBatches.outletId,
      fileName: legacyProductImportBatches.fileName,
      status: legacyProductImportBatches.status,
      totalRows: legacyProductImportBatches.totalRows,
      uniqueMasterCount: legacyProductImportBatches.uniqueMasterCount,
      outletCode: outlets.code,
      outletName: outlets.name,
    })
    .from(legacyProductImportBatches)
    .innerJoin(outlets, eq(legacyProductImportBatches.outletId, outlets.id))
    .where(
      and(
        eq(legacyProductImportBatches.id, batchId),
        eq(legacyProductImportBatches.organizationId, auth.organization.id),
        inArray(legacyProductImportBatches.outletId, outletIds),
      ),
    )
    .limit(1);

  return batch ?? null;
}

export async function getLegacyMasterMappingData(
  auth: AuthContext,
  batchId: string,
) {
  const batch = await getAccessibleLegacyBatch(auth, batchId);
  if (!batch) return null;

  const [mappingRows, categoryRows, productMasterRows, statusRows] =
    await Promise.all([
      db
        .select({
          id: legacyProductMasterMappings.id,
          legacyMasterCode: legacyProductMasterMappings.legacyMasterCode,
          legacyMasterName: legacyProductMasterMappings.legacyMasterName,
          legacyCategory: legacyProductMasterMappings.legacyCategory,
          normalizedCategoryName:
            legacyProductMasterMappings.normalizedCategoryName,
          itemCount: legacyProductMasterMappings.itemCount,
          status: legacyProductMasterMappings.status,
          mappingSource: legacyProductMasterMappings.mappingSource,
          targetCategoryId: legacyProductMasterMappings.targetCategoryId,
          targetProductMasterId:
            legacyProductMasterMappings.targetProductMasterId,
          reviewNotes: legacyProductMasterMappings.reviewNotes,
          reviewedAt: legacyProductMasterMappings.reviewedAt,
          targetCategoryCode: productCategories.code,
          targetCategoryName: productCategories.name,
          targetProductMasterCode: productMasters.code,
          targetProductMasterName: productMasters.name,
          targetProductMasterStatus: productMasters.status,
          reviewedByName: users.fullName,
        })
        .from(legacyProductMasterMappings)
        .leftJoin(
          productCategories,
          eq(
            legacyProductMasterMappings.targetCategoryId,
            productCategories.id,
          ),
        )
        .leftJoin(
          productMasters,
          eq(
            legacyProductMasterMappings.targetProductMasterId,
            productMasters.id,
          ),
        )
        .leftJoin(users, eq(legacyProductMasterMappings.reviewedBy, users.id))
        .where(eq(legacyProductMasterMappings.batchId, batch.id))
        .orderBy(asc(legacyProductMasterMappings.legacyMasterCode)),

      db
        .select({
          id: productCategories.id,
          code: productCategories.code,
          name: productCategories.name,
          isActive: productCategories.isActive,
        })
        .from(productCategories)
        .where(eq(productCategories.organizationId, auth.organization.id))
        .orderBy(asc(productCategories.displayOrder), asc(productCategories.name)),

      db
        .select({
          id: productMasters.id,
          code: productMasters.code,
          name: productMasters.name,
          status: productMasters.status,
          categoryId: productMasters.categoryId,
          categoryName: productCategories.name,
        })
        .from(productMasters)
        .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
        .where(eq(productMasters.organizationId, auth.organization.id))
        .orderBy(asc(productMasters.name), asc(productMasters.code)),

      db
        .select({
          status: legacyProductMasterMappings.status,
          total: count(),
          itemCount:
            sql<number>`coalesce(sum(${legacyProductMasterMappings.itemCount}), 0)::int`.mapWith(
              Number,
            ),
        })
        .from(legacyProductMasterMappings)
        .where(eq(legacyProductMasterMappings.batchId, batch.id))
        .groupBy(legacyProductMasterMappings.status),
    ]);

  const totals = {
    pending: 0,
    mapped: 0,
    ignored: 0,
    mappedItemCount: 0,
  };

  for (const row of statusRows) {
    totals[row.status] = Number(row.total);
    if (row.status === "mapped") totals.mappedItemCount = Number(row.itemCount);
  }

  return {
    batch,
    mappings: mappingRows,
    categories: categoryRows,
    productMasters: productMasterRows,
    totals,
  };
}

export async function getLegacyMigrationSessionData(
  auth: AuthContext,
  batchId: string,
) {
  const batch = await getAccessibleLegacyBatch(auth, batchId);
  if (!batch) return null;

  const [staffRows, roleRows, sessionRows] = await Promise.all([
    db
      .selectDistinct({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        email: users.email,
      })
      .from(users)
      .innerJoin(userOutlets, eq(users.id, userOutlets.userId))
      .where(
        and(
          eq(users.organizationId, auth.organization.id),
          eq(users.status, "active"),
          eq(userOutlets.outletId, batch.outletId),
        ),
      )
      .orderBy(asc(users.fullName)),

    db
      .select({
        userId: userRoles.userId,
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(eq(users.organizationId, auth.organization.id))
      .orderBy(asc(roles.name)),

    db
      .select({
        id: legacyMigrationSessions.id,
        name: legacyMigrationSessions.name,
        locationCode: legacyMigrationSessions.locationCode,
        expectedItemCount: legacyMigrationSessions.expectedItemCount,
        notes: legacyMigrationSessions.notes,
        status: legacyMigrationSessions.status,
        createdAt: legacyMigrationSessions.createdAt,
        startedAt: legacyMigrationSessions.startedAt,
        lockedAt: legacyMigrationSessions.lockedAt,
        completedAt: legacyMigrationSessions.completedAt,
        cancelledAt: legacyMigrationSessions.cancelledAt,
        createdByName: users.fullName,
      })
      .from(legacyMigrationSessions)
      .innerJoin(users, eq(legacyMigrationSessions.createdBy, users.id))
      .where(eq(legacyMigrationSessions.batchId, batch.id))
      .orderBy(asc(legacyMigrationSessions.createdAt)),
  ]);

  const roleNamesByUser = new Map<string, string[]>();
  for (const row of roleRows) {
    const names = roleNamesByUser.get(row.userId) ?? [];
    names.push(row.roleName);
    roleNamesByUser.set(row.userId, names);
  }

  const sessionIds = sessionRows.map((session) => session.id);
  const assignmentRows =
    sessionIds.length === 0
      ? []
      : await db
          .select({
            sessionId: legacyMigrationSessionAssignments.sessionId,
            userId: legacyMigrationSessionAssignments.userId,
            assignmentRole:
              legacyMigrationSessionAssignments.assignmentRole,
            fullName: users.fullName,
            username: users.username,
          })
          .from(legacyMigrationSessionAssignments)
          .innerJoin(users, eq(legacyMigrationSessionAssignments.userId, users.id))
          .where(
            inArray(legacyMigrationSessionAssignments.sessionId, sessionIds),
          )
          .orderBy(
            asc(legacyMigrationSessionAssignments.assignmentRole),
            asc(users.fullName),
          );

  const verificationSummaryRows =
    sessionIds.length === 0
      ? []
      : await db
          .select({
            sessionId: legacyMigrationVerifications.sessionId,
            status: legacyMigrationVerifications.status,
            total: count(),
          })
          .from(legacyMigrationVerifications)
          .where(inArray(legacyMigrationVerifications.sessionId, sessionIds))
          .groupBy(
            legacyMigrationVerifications.sessionId,
            legacyMigrationVerifications.status,
          );

  const verificationSummaryBySession = new Map<
    string,
    { total: number; submitted: number; needsReview: number }
  >();
  for (const row of verificationSummaryRows) {
    const summary = verificationSummaryBySession.get(row.sessionId) ?? {
      total: 0,
      submitted: 0,
      needsReview: 0,
    };
    const total = Number(row.total);
    summary.total += total;
    if (row.status === "submitted") summary.submitted += total;
    if (row.status === "needs_review") summary.needsReview += total;
    verificationSummaryBySession.set(row.sessionId, summary);
  }

  const assignmentsBySession = new Map<
    string,
    Array<(typeof assignmentRows)[number]>
  >();
  for (const assignment of assignmentRows) {
    const assignments = assignmentsBySession.get(assignment.sessionId) ?? [];
    assignments.push(assignment);
    assignmentsBySession.set(assignment.sessionId, assignments);
  }

  return {
    batch,
    staff: staffRows.map((staff) => ({
      ...staff,
      roleNames: roleNamesByUser.get(staff.id) ?? [],
    })),
    sessions: sessionRows.map((session) => ({
      ...session,
      assignments: assignmentsBySession.get(session.id) ?? [],
      verificationSummary: verificationSummaryBySession.get(session.id) ?? {
        total: 0,
        submitted: 0,
        needsReview: 0,
      },
    })),
  };
}
