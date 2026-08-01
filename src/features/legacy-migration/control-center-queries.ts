import { asc, count, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  legacyMigrationSessionAssignments,
  legacyProductMasterMappings,
  users,
} from "@/db/schema";
import { getLegacyMigrationReconciliationData } from "@/features/legacy-migration/reconciliation-queries";
import type { AuthContext } from "@/lib/auth/session";

export async function getLegacyMigrationControlCenterData(
  auth: AuthContext,
  batchId: string,
) {
  const readiness = await getLegacyMigrationReconciliationData(auth, batchId);
  if (!readiness) return null;

  const sessionIds = readiness.sessions.map((session) => session.id);
  const [mappingRows, assignmentRows] = await Promise.all([
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
      .where(eq(legacyProductMasterMappings.batchId, readiness.batch.id))
      .groupBy(legacyProductMasterMappings.status),

    sessionIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            sessionId: legacyMigrationSessionAssignments.sessionId,
            userId: legacyMigrationSessionAssignments.userId,
            assignmentRole:
              legacyMigrationSessionAssignments.assignmentRole,
            fullName: users.fullName,
            username: users.username,
          })
          .from(legacyMigrationSessionAssignments)
          .innerJoin(
            users,
            eq(legacyMigrationSessionAssignments.userId, users.id),
          )
          .where(
            inArray(legacyMigrationSessionAssignments.sessionId, sessionIds),
          )
          .orderBy(
            asc(legacyMigrationSessionAssignments.assignmentRole),
            asc(users.fullName),
          ),
  ]);

  const mapping = {
    pending: 0,
    mapped: 0,
    ignored: 0,
    pendingItemCount: 0,
    mappedItemCount: 0,
    ignoredItemCount: 0,
  };

  for (const row of mappingRows) {
    const total = Number(row.total);
    const itemCount = Number(row.itemCount);
    if (row.status === "pending") {
      mapping.pending = total;
      mapping.pendingItemCount = itemCount;
    }
    if (row.status === "mapped") {
      mapping.mapped = total;
      mapping.mappedItemCount = itemCount;
    }
    if (row.status === "ignored") {
      mapping.ignored = total;
      mapping.ignoredItemCount = itemCount;
    }
  }

  const assignmentsBySession = new Map<
    string,
    Array<(typeof assignmentRows)[number]>
  >();
  for (const assignment of assignmentRows) {
    const current = assignmentsBySession.get(assignment.sessionId) ?? [];
    current.push(assignment);
    assignmentsBySession.set(assignment.sessionId, current);
  }

  return {
    batch: readiness.batch,
    mapping,
    sessionSummary: readiness.sessionSummary,
    verificationSummary: readiness.verificationSummary,
    soldSummary: readiness.soldSummary,
    photos: readiness.photos,
    batchIssues: readiness.batchIssues,
    blockerCount: readiness.blockerCount,
    executableSessionCount: readiness.executableSessionCount,
    processedPhysicalCount: readiness.processedPhysicalCount,
    sessions: readiness.sessions.map((session) => ({
      ...session,
      assignments: assignmentsBySession.get(session.id) ?? [],
    })),
  };
}

export type LegacyMigrationControlCenterData = NonNullable<
  Awaited<ReturnType<typeof getLegacyMigrationControlCenterData>>
>;
