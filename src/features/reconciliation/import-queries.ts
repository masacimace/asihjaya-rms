import {
  and,
  count,
  desc,
  eq,
  inArray,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  manualPaymentProfiles,
  outlets,
  payments,
  sales,
  settlementImportBatches,
  settlementImportMappings,
  settlementImportRows,
  users,
} from "@/db/schema";
import {
  SETTLEMENT_IMPORT_PAGE_SIZE,
  createEmptySettlementImportMapping,
  type SettlementImportBatchListRow,
  type SettlementImportColumnMapping,
  type SettlementImportDetailData,
  type SettlementImportStatus,
} from "@/features/reconciliation/import-contracts";
import type { AuthContext } from "@/lib/auth/session";

function getOutletIds(auth: AuthContext) {
  return auth.outlets.map((outlet) => outlet.id);
}

function normalizeMapping(
  value: Record<string, string | null> | null,
): SettlementImportColumnMapping {
  return {
    ...createEmptySettlementImportMapping(),
    ...(value ?? {}),
  };
}

export async function getSettlementImportSetupData(auth: AuthContext) {
  const outletIds = getOutletIds(auth);
  if (outletIds.length === 0) {
    return { outlets: [], profiles: [], recentBatches: [] };
  }

  const [profileRows, recentRows] = await Promise.all([
    db
      .select({
        id: manualPaymentProfiles.id,
        code: manualPaymentProfiles.code,
        name: manualPaymentProfiles.name,
        provider: manualPaymentProfiles.provider,
        profileType: manualPaymentProfiles.profileType,
        outletId: outlets.id,
        outletCode: outlets.code,
        outletName: outlets.name,
        savedDelimiter: settlementImportMappings.delimiter,
        savedMapping: settlementImportMappings.columnMapping,
      })
      .from(manualPaymentProfiles)
      .innerJoin(outlets, eq(manualPaymentProfiles.outletId, outlets.id))
      .leftJoin(
        settlementImportMappings,
        eq(manualPaymentProfiles.id, settlementImportMappings.profileId),
      )
      .where(
        and(
          eq(manualPaymentProfiles.organizationId, auth.organization.id),
          inArray(manualPaymentProfiles.outletId, outletIds),
          eq(manualPaymentProfiles.isActive, true),
        ),
      )
      .orderBy(outlets.name, manualPaymentProfiles.displayOrder),
    db
      .select({
        id: settlementImportBatches.id,
        fileName: settlementImportBatches.fileName,
        status: settlementImportBatches.status,
        outletName: outlets.name,
        profileName: manualPaymentProfiles.name,
        uploadedByName: users.fullName,
        rowCount: settlementImportBatches.rowCount,
        matchedCount: settlementImportBatches.matchedCount,
        appliedCount: settlementImportBatches.appliedCount,
        ambiguousCount: settlementImportBatches.ambiguousCount,
        mismatchCount: settlementImportBatches.mismatchCount,
        notFoundCount: settlementImportBatches.notFoundCount,
        duplicateCount: settlementImportBatches.duplicateCount,
        failedCount: settlementImportBatches.failedCount,
        createdAt: settlementImportBatches.createdAt,
        completedAt: settlementImportBatches.completedAt,
      })
      .from(settlementImportBatches)
      .innerJoin(outlets, eq(settlementImportBatches.outletId, outlets.id))
      .innerJoin(
        manualPaymentProfiles,
        eq(settlementImportBatches.profileId, manualPaymentProfiles.id),
      )
      .innerJoin(users, eq(settlementImportBatches.uploadedBy, users.id))
      .where(
        and(
          eq(settlementImportBatches.organizationId, auth.organization.id),
          inArray(settlementImportBatches.outletId, outletIds),
        ),
      )
      .orderBy(desc(settlementImportBatches.createdAt))
      .limit(15),
  ]);

  const recentBatches: SettlementImportBatchListRow[] = recentRows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    status: row.status as SettlementImportStatus,
    outletName: row.outletName,
    profileName: row.profileName,
    uploadedByName: row.uploadedByName,
    rowCount: row.rowCount,
    matchedCount: row.matchedCount,
    appliedCount: row.appliedCount,
    issueCount:
      row.ambiguousCount +
      row.mismatchCount +
      row.notFoundCount +
      row.duplicateCount +
      row.failedCount,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }));

  return {
    outlets: auth.outlets.map((outlet) => ({
      id: outlet.id,
      code: outlet.code,
      name: outlet.name,
    })),
    profiles: profileRows.map((row) => ({
      ...row,
      savedMapping: normalizeMapping(row.savedMapping),
    })),
    recentBatches,
  };
}

export async function getSettlementImportBatchDetail(
  auth: AuthContext,
  batchId: string,
  page = 1,
): Promise<SettlementImportDetailData | null> {
  const outletIds = getOutletIds(auth);
  if (outletIds.length === 0) return null;

  const [batch] = await db
    .select({
      id: settlementImportBatches.id,
      fileName: settlementImportBatches.fileName,
      fileKey: settlementImportBatches.fileKey,
      fileHash: settlementImportBatches.fileHash,
      fileSizeBytes: settlementImportBatches.fileSizeBytes,
      status: settlementImportBatches.status,
      delimiter: settlementImportBatches.delimiter,
      headers: settlementImportBatches.headers,
      columnMapping: settlementImportBatches.columnMapping,
      rowCount: settlementImportBatches.rowCount,
      validRowCount: settlementImportBatches.validRowCount,
      matchedCount: settlementImportBatches.matchedCount,
      appliedCount: settlementImportBatches.appliedCount,
      ambiguousCount: settlementImportBatches.ambiguousCount,
      mismatchCount: settlementImportBatches.mismatchCount,
      notFoundCount: settlementImportBatches.notFoundCount,
      duplicateCount: settlementImportBatches.duplicateCount,
      ignoredCount: settlementImportBatches.ignoredCount,
      failedCount: settlementImportBatches.failedCount,
      errorMessage: settlementImportBatches.errorMessage,
      createdAt: settlementImportBatches.createdAt,
      completedAt: settlementImportBatches.completedAt,
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
      profileId: manualPaymentProfiles.id,
      profileCode: manualPaymentProfiles.code,
      profileName: manualPaymentProfiles.name,
      provider: manualPaymentProfiles.provider,
      uploadedByName: users.fullName,
    })
    .from(settlementImportBatches)
    .innerJoin(outlets, eq(settlementImportBatches.outletId, outlets.id))
    .innerJoin(
      manualPaymentProfiles,
      eq(settlementImportBatches.profileId, manualPaymentProfiles.id),
    )
    .innerJoin(users, eq(settlementImportBatches.uploadedBy, users.id))
    .where(
      and(
        eq(settlementImportBatches.id, batchId),
        eq(settlementImportBatches.organizationId, auth.organization.id),
        inArray(settlementImportBatches.outletId, outletIds),
      ),
    )
    .limit(1);

  if (!batch) return null;

  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const [totalRow] = await db
    .select({ total: count() })
    .from(settlementImportRows)
    .where(eq(settlementImportRows.batchId, batchId));
  const total = totalRow?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / SETTLEMENT_IMPORT_PAGE_SIZE));
  const currentPage = Math.min(safePage, pageCount);

  const rowRecords = await db
    .select()
    .from(settlementImportRows)
    .where(eq(settlementImportRows.batchId, batchId))
    .orderBy(settlementImportRows.rowNumber)
    .limit(SETTLEMENT_IMPORT_PAGE_SIZE)
    .offset((currentPage - 1) * SETTLEMENT_IMPORT_PAGE_SIZE);

  const candidateIds = Array.from(
    new Set(
      rowRecords.flatMap((row) => [
        ...(row.candidatePaymentIds ?? []),
        ...(row.matchedPaymentId ? [row.matchedPaymentId] : []),
      ]),
    ),
  );

  const candidateRows = candidateIds.length
    ? await db
        .select({
          paymentId: payments.id,
          invoiceNumber: sales.invoiceNumber,
          providerReference: payments.providerReference,
          amount: payments.amount,
          paidAt: payments.paidAt,
          settlementStatus: payments.settlementStatus,
        })
        .from(payments)
        .innerJoin(sales, eq(payments.saleId, sales.id))
        .where(
          and(
            inArray(payments.id, candidateIds),
            eq(sales.organizationId, auth.organization.id),
            inArray(sales.outletId, outletIds),
          ),
        )
    : [];
  const candidatesById = new Map(
    candidateRows.map((candidate) => [candidate.paymentId, candidate]),
  );

  return {
    batch: {
      ...batch,
      status: batch.status as SettlementImportStatus,
      headers: batch.headers ?? [],
      columnMapping: normalizeMapping(batch.columnMapping),
    },
    rows: rowRecords.map((row) => ({
      ...row,
      status: row.status,
      rawData: row.rawData ?? {},
      candidatePaymentIds: row.candidatePaymentIds ?? [],
      candidates: Array.from(
        new Set([
          ...(row.matchedPaymentId ? [row.matchedPaymentId] : []),
          ...(row.candidatePaymentIds ?? []),
        ]),
      )
        .map((id) => candidatesById.get(id))
        .filter((candidate): candidate is NonNullable<typeof candidate> =>
          Boolean(candidate),
        ),
    })),
    page: currentPage,
    pageCount,
    total,
  };
}

export async function getSettlementImportFileRecord(
  auth: AuthContext,
  key: string,
) {
  const outletIds = getOutletIds(auth);
  if (!outletIds.length) return null;
  const [row] = await db
    .select({
      id: settlementImportBatches.id,
      fileName: settlementImportBatches.fileName,
      fileKey: settlementImportBatches.fileKey,
      organizationId: settlementImportBatches.organizationId,
      outletId: settlementImportBatches.outletId,
    })
    .from(settlementImportBatches)
    .where(
      and(
        eq(settlementImportBatches.fileKey, key),
        eq(settlementImportBatches.organizationId, auth.organization.id),
        inArray(settlementImportBatches.outletId, outletIds),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getSettlementImportSummary(auth: AuthContext) {
  const outletIds = getOutletIds(auth);
  if (!outletIds.length) return { active: 0, issues: 0 };
  const [row] = await db
    .select({
      active: sql<number>`count(*) filter (where ${settlementImportBatches.status} in ('uploaded', 'ready', 'processing'))::int`,
      issues: sql<number>`coalesce(sum(${settlementImportBatches.ambiguousCount} + ${settlementImportBatches.mismatchCount} + ${settlementImportBatches.notFoundCount} + ${settlementImportBatches.duplicateCount} + ${settlementImportBatches.failedCount}) filter (where ${settlementImportBatches.status} in ('ready', 'completed_with_issues')), 0)::int`,
    })
    .from(settlementImportBatches)
    .where(
      and(
        eq(settlementImportBatches.organizationId, auth.organization.id),
        inArray(settlementImportBatches.outletId, outletIds),
      ),
    );
  return row ?? { active: 0, issues: 0 };
}
