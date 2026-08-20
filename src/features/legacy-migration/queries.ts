import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  legacyProductImportBatches,
  legacyProductRows,
  outlets,
  users,
} from "@/db/schema";
import { isLegacyMigrationUuid } from "@/features/legacy-migration/safety";
import { getLegacyImageSyncSummary } from "@/features/legacy-migration/image-sync-service";
import type { AuthContext } from "@/lib/auth/session";

export type LegacyRowStatusFilter = "all" | "valid" | "warning" | "invalid";

export async function getLegacyMigrationOverview(auth: AuthContext) {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    return {
      outlets: [],
      recentBatches: [],
      totals: {
        batchCount: 0,
        importedRows: 0,
        cleanupRows: 0,
        imageUrlRows: 0,
      },
    };
  }

  const [recentBatches, totalsRows] = await Promise.all([
    db
      .select({
        id: legacyProductImportBatches.id,
        fileName: legacyProductImportBatches.fileName,
        status: legacyProductImportBatches.status,
        totalRows: legacyProductImportBatches.totalRows,
        validRows: legacyProductImportBatches.validRows,
        warningRows: legacyProductImportBatches.warningRows,
        invalidRows: legacyProductImportBatches.invalidRows,
        uniqueMasterCount: legacyProductImportBatches.uniqueMasterCount,
        duplicateBarcodeCount:
          legacyProductImportBatches.duplicateBarcodeCount,
        createdAt: legacyProductImportBatches.createdAt,
        completedAt: legacyProductImportBatches.completedAt,
        outletCode: outlets.code,
        outletName: outlets.name,
        uploadedByName: users.fullName,
      })
      .from(legacyProductImportBatches)
      .innerJoin(outlets, eq(legacyProductImportBatches.outletId, outlets.id))
      .innerJoin(users, eq(legacyProductImportBatches.uploadedBy, users.id))
      .where(
        and(
          eq(
            legacyProductImportBatches.organizationId,
            auth.organization.id,
          ),
          inArray(legacyProductImportBatches.outletId, outletIds),
        ),
      )
      .orderBy(desc(legacyProductImportBatches.createdAt))
      .limit(20),

    db
      .select({
        batchCount: count(),
        importedRows:
          sql<number>`coalesce(sum(${legacyProductImportBatches.totalRows}), 0)::int`.mapWith(
            Number,
          ),
        cleanupRows:
          sql<number>`coalesce(sum(${legacyProductImportBatches.warningRows} + ${legacyProductImportBatches.invalidRows}), 0)::int`.mapWith(
            Number,
          ),
        imageUrlRows:
          sql<number>`coalesce(sum(${legacyProductImportBatches.imageUrlCount}), 0)::int`.mapWith(
            Number,
          ),
      })
      .from(legacyProductImportBatches)
      .where(
        and(
          eq(
            legacyProductImportBatches.organizationId,
            auth.organization.id,
          ),
          inArray(legacyProductImportBatches.outletId, outletIds),
          eq(legacyProductImportBatches.status, "ready"),
        ),
      ),
  ]);

  const totals = totalsRows[0] ?? {
    batchCount: 0,
    importedRows: 0,
    cleanupRows: 0,
    imageUrlRows: 0,
  };

  return {
    outlets: auth.outlets,
    recentBatches,
    totals: {
      batchCount: Number(totals.batchCount),
      importedRows: Number(totals.importedRows),
      cleanupRows: Number(totals.cleanupRows),
      imageUrlRows: Number(totals.imageUrlRows),
    },
  };
}

export async function getLegacyMigrationBatchDetail(
  auth: AuthContext,
  input: {
    batchId: string;
    page: number;
    status: LegacyRowStatusFilter;
    search: string;
  },
) {
  if (!isLegacyMigrationUuid(input.batchId)) return null;

  const outletIds = auth.outlets.map((outlet) => outlet.id);
  if (outletIds.length === 0) return null;

  const [batch] = await db
    .select({
      id: legacyProductImportBatches.id,
      fileName: legacyProductImportBatches.fileName,
      fileHash: legacyProductImportBatches.fileHash,
      fileSizeBytes: legacyProductImportBatches.fileSizeBytes,
      worksheetName: legacyProductImportBatches.worksheetName,
      barcodeLength: legacyProductImportBatches.barcodeLength,
      status: legacyProductImportBatches.status,
      totalRows: legacyProductImportBatches.totalRows,
      validRows: legacyProductImportBatches.validRows,
      warningRows: legacyProductImportBatches.warningRows,
      invalidRows: legacyProductImportBatches.invalidRows,
      uniqueMasterCount: legacyProductImportBatches.uniqueMasterCount,
      duplicateBarcodeCount:
        legacyProductImportBatches.duplicateBarcodeCount,
      leadingZeroBarcodeCount:
        legacyProductImportBatches.leadingZeroBarcodeCount,
      imageUrlCount: legacyProductImportBatches.imageUrlCount,
      headers: legacyProductImportBatches.headers,
      validationSummary: legacyProductImportBatches.validationSummary,
      errorMessage: legacyProductImportBatches.errorMessage,
      createdAt: legacyProductImportBatches.createdAt,
      completedAt: legacyProductImportBatches.completedAt,
      outletCode: outlets.code,
      outletName: outlets.name,
      uploadedByName: users.fullName,
    })
    .from(legacyProductImportBatches)
    .innerJoin(outlets, eq(legacyProductImportBatches.outletId, outlets.id))
    .innerJoin(users, eq(legacyProductImportBatches.uploadedBy, users.id))
    .where(
      and(
        eq(legacyProductImportBatches.id, input.batchId),
        eq(legacyProductImportBatches.organizationId, auth.organization.id),
        inArray(legacyProductImportBatches.outletId, outletIds),
      ),
    )
    .limit(1);

  if (!batch) return null;

  const conditions: SQL[] = [eq(legacyProductRows.batchId, batch.id)];

  if (input.status !== "all") {
    conditions.push(eq(legacyProductRows.validationStatus, input.status));
  }

  const search = input.search.trim().slice(0, 120);
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const searchCondition = or(
      ilike(legacyProductRows.normalizedBarcode, pattern),
      ilike(legacyProductRows.legacyMasterCode, pattern),
      ilike(legacyProductRows.legacyMasterName, pattern),
      ilike(legacyProductRows.legacyItemName, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const pageSize = 50;
  const requestedPage = Number.isFinite(input.page)
    ? Math.max(1, Math.floor(input.page))
    : 1;
  const where = and(...conditions);

  const [countRows, issueRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(legacyProductRows)
      .where(where),
    db
      .select({
        status: legacyProductRows.validationStatus,
        total: count(),
      })
      .from(legacyProductRows)
      .where(eq(legacyProductRows.batchId, batch.id))
      .groupBy(legacyProductRows.validationStatus)
      .orderBy(asc(legacyProductRows.validationStatus)),
  ]);

  const totalRows = Number(countRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const page = Math.min(requestedPage, pageCount);

  const rows = await db
    .select({
      id: legacyProductRows.id,
      rowNumber: legacyProductRows.rowNumber,
      sourceSequence: legacyProductRows.sourceSequence,
      legacyBarcode: legacyProductRows.legacyBarcode,
      normalizedBarcode: legacyProductRows.normalizedBarcode,
      legacyCategory: legacyProductRows.legacyCategory,
      legacyMasterCode: legacyProductRows.legacyMasterCode,
      legacyMasterName: legacyProductRows.legacyMasterName,
      legacyItemName: legacyProductRows.legacyItemName,
      legacyPurity: legacyProductRows.legacyPurity,
      legacyExchangePurity: legacyProductRows.legacyExchangePurity,
      legacyPricePerGram: legacyProductRows.legacyPricePerGram,
      legacyDeductionPerGram: legacyProductRows.legacyDeductionPerGram,
      legacyWeightGram: legacyProductRows.legacyWeightGram,
      legacyColor: legacyProductRows.legacyColor,
      legacyImageUrl: legacyProductRows.legacyImageUrl,
      validationStatus: legacyProductRows.validationStatus,
      validationIssues: legacyProductRows.validationIssues,
    })
    .from(legacyProductRows)
    .where(where)
    .orderBy(asc(legacyProductRows.rowNumber))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const statusCounts = {
    valid: 0,
    warning: 0,
    invalid: 0,
  };
  for (const row of issueRows) {
    statusCounts[row.status] = Number(row.total);
  }

  const imageSync =
    batch.status === "ready"
      ? await getLegacyImageSyncSummary({ auth, batchId: batch.id })
      : {
          batchId: batch.id,
          pendingCount: 0,
          syncedCount: 0,
          totalFailedCount: 0,
          missingCount: 0,
          totalWithSourceCount: batch.imageUrlCount,
        };

  return {
    batch,
    imageSync,
    rows,
    pagination: {
      page,
      pageSize,
      pageCount,
      totalRows,
    },
    statusCounts,
    filters: {
      status: input.status,
      search,
    },
  };
}
