import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
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

  const [summaryRows, recentRows] = await Promise.all([
    db
      .select({
        totalActive: sql<number>`count(*)::int`.mapWith(Number),
        beforeScan:
          sql<number>`count(*) filter (where ${legacyMigrationSoldRecords.verificationId} is null)::int`.mapWith(
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
        productItems,
        eq(legacyMigrationSoldRecords.productItemId, productItems.id),
      )
      .where(activeWhere)
      .orderBy(
        desc(legacyMigrationSoldRecords.soldAt),
        desc(legacyMigrationSoldRecords.reportedAt),
      )
      .limit(100),
  ]);

  const summary: LegacySoldSummary = summaryRows[0] ?? {
    totalActive: 0,
    beforeScan: 0,
    verificationExcluded: 0,
    holdMarkedSold: 0,
  };

  return {
    batch,
    summary,
    records: recentRows satisfies LegacySoldRecordItem[],
  };
}
