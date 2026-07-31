import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  legacyMigrationSessions,
  legacyMigrationSoldRecords,
  productItems,
  users,
} from "@/db/schema";
import type {
  LegacySoldRecordItem,
  LegacySoldSummary,
} from "@/features/legacy-migration/sold-contracts";
import { getAccessibleLegacyBatch } from "@/features/legacy-migration/management-queries";
import type { AuthContext } from "@/lib/auth/session";

export async function getLegacySoldDuringMigrationData(
  auth: AuthContext,
  batchId: string,
) {
  const batch = await getAccessibleLegacyBatch(auth, batchId);
  if (!batch) return null;

  const activeWhere = and(
    eq(legacyMigrationSoldRecords.batchId, batch.id),
    eq(legacyMigrationSoldRecords.organizationId, auth.organization.id),
    isNull(legacyMigrationSoldRecords.revertedAt),
  );

  const [summaryRows, recentRows, sessions] = await Promise.all([
    db
      .select({
        totalActive: sql<number>`count(*)::int`.mapWith(Number),
        beforeScan:
          sql<number>`count(*) filter (where ${legacyMigrationSoldRecords.verificationId} is null)::int`.mapWith(
            Number,
          ),
        unassignedSession:
          sql<number>`count(*) filter (where ${legacyMigrationSoldRecords.sessionId} is null)::int`.mapWith(
            Number,
          ),
        verificationExcluded:
          sql<number>`count(*) filter (where ${legacyMigrationSoldRecords.verificationId} is not null)::int`.mapWith(
            Number,
          ),
        holdMarkedSold:
          sql<number>`count(*) filter (where ${legacyMigrationSoldRecords.productItemId} is not null)::int`.mapWith(
            Number,
          ),
      })
      .from(legacyMigrationSoldRecords)
      .where(activeWhere),

    db
      .select({
        id: legacyMigrationSoldRecords.id,
        sessionId: legacyMigrationSoldRecords.sessionId,
        sessionName: legacyMigrationSessions.name,
        barcodeValue: legacyMigrationSoldRecords.barcodeValue,
        soldAt: legacyMigrationSoldRecords.soldAt,
        reportedAt: legacyMigrationSoldRecords.reportedAt,
        legacyReference: legacyMigrationSoldRecords.legacyReference,
        notes: legacyMigrationSoldRecords.notes,
        reportedByName: users.fullName,
        verificationId: legacyMigrationSoldRecords.verificationId,
        previousVerificationStatus:
          legacyMigrationSoldRecords.previousVerificationStatus,
        productItemId: legacyMigrationSoldRecords.productItemId,
        itemSku: productItems.sku,
        itemName: productItems.displayName,
      })
      .from(legacyMigrationSoldRecords)
      .innerJoin(users, eq(legacyMigrationSoldRecords.reportedBy, users.id))
      .leftJoin(
        legacyMigrationSessions,
        eq(legacyMigrationSoldRecords.sessionId, legacyMigrationSessions.id),
      )
      .leftJoin(
        productItems,
        eq(legacyMigrationSoldRecords.productItemId, productItems.id),
      )
      .where(activeWhere)
      .orderBy(
        desc(legacyMigrationSoldRecords.soldAt),
        desc(legacyMigrationSoldRecords.reportedAt),
      )
      .limit(100),

    db
      .select({
        id: legacyMigrationSessions.id,
        name: legacyMigrationSessions.name,
        locationCode: legacyMigrationSessions.locationCode,
        status: legacyMigrationSessions.status,
      })
      .from(legacyMigrationSessions)
      .where(
        and(
          eq(legacyMigrationSessions.batchId, batch.id),
          eq(legacyMigrationSessions.organizationId, auth.organization.id),
          inArray(legacyMigrationSessions.status, ["draft", "active", "locked"]),
        ),
      )
      .orderBy(asc(legacyMigrationSessions.createdAt)),
  ]);

  const summary: LegacySoldSummary = summaryRows[0] ?? {
    totalActive: 0,
    beforeScan: 0,
    unassignedSession: 0,
    verificationExcluded: 0,
    holdMarkedSold: 0,
  };

  return {
    batch,
    summary,
    records: recentRows satisfies LegacySoldRecordItem[],
    sessions,
  };
}
