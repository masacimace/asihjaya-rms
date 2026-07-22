import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  manualPaymentProfiles,
  outlets,
  paymentReconciliations,
  payments,
  registers,
  sales,
  users,
} from "@/db/schema";
import {
  RECONCILIATION_PAGE_SIZE,
  reconciliationPaymentMethods,
  type ReconciliationDetailData,
  type ReconciliationFilters,
  type ReconciliationListData,
  type ReconciliationListRow,
  type ReconciliationPaymentMethod,
  type ReconciliationStatus,
} from "@/features/reconciliation/contracts";
import type { AuthContext } from "@/lib/auth/session";

const reconciledByUsers = alias(users, "reconciliation_reconciled_by_users");
const resolvedByUsers = alias(users, "reconciliation_resolved_by_users");
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function getJakartaDateParts(date: Date) {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function getJakartaDayStartUtc(date: Date, offsetDays = 0) {
  const parts = getJakartaDateParts(date);
  return new Date(
    Date.UTC(parts.year, parts.month, parts.day + offsetDays) -
      JAKARTA_OFFSET_MS,
  );
}

function getPeriod(range: ReconciliationFilters["range"], now = new Date()) {
  const today = getJakartaDayStartUtc(now);
  const tomorrow = getJakartaDayStartUtc(now, 1);

  if (range === "yesterday") {
    return { start: getJakartaDayStartUtc(now, -1), end: today };
  }

  if (range === "7d") {
    return { start: getJakartaDayStartUtc(now, -6), end: tomorrow };
  }

  if (range === "30d") {
    return { start: getJakartaDayStartUtc(now, -29), end: tomorrow };
  }

  if (range === "all") return { start: null, end: null };
  return { start: today, end: tomorrow };
}

function getOutletIds(auth: AuthContext) {
  return auth.outlets.map((outlet) => outlet.id);
}

function normalizeStatus(value: string): ReconciliationStatus {
  if (
    value === "pending_settlement" ||
    value === "reconciled" ||
    value === "mismatch" ||
    value === "not_found" ||
    value === "waived"
  ) {
    return value;
  }

  return "unreconciled";
}

function getProfileNameFromMetadata(metadata: Record<string, unknown> | null) {
  const profile = metadata?.manualPaymentProfile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return null;
  }

  const name = (profile as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function buildConditions(
  auth: AuthContext,
  filters: ReconciliationFilters,
): SQL[] {
  const outletIds = getOutletIds(auth);
  const conditions: SQL[] = [
    eq(sales.organizationId, auth.organization.id),
    inArray(sales.outletId, outletIds),
    inArray(payments.method, [...reconciliationPaymentMethods]),
    inArray(payments.status, ["paid", "partially_refunded", "refunded"]),
    ne(payments.settlementStatus, "not_applicable"),
  ];

  if (filters.outletId && outletIds.includes(filters.outletId)) {
    conditions.push(eq(sales.outletId, filters.outletId));
  }

  if (filters.profileId) {
    conditions.push(eq(payments.manualPaymentProfileId, filters.profileId));
  }

  if (filters.method) conditions.push(eq(payments.method, filters.method));
  if (filters.status !== "all") {
    conditions.push(eq(payments.settlementStatus, filters.status));
  }

  const period = getPeriod(filters.range);
  if (period.start) conditions.push(gte(payments.paidAt, period.start));
  if (period.end) conditions.push(lt(payments.paidAt, period.end));

  if (filters.search) {
    const pattern = `%${filters.search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push(
      or(
        ilike(sales.invoiceNumber, pattern),
        ilike(payments.provider, pattern),
        ilike(payments.providerReference, pattern),
        ilike(manualPaymentProfiles.name, pattern),
        ilike(manualPaymentProfiles.code, pattern),
      )!,
    );
  }

  return conditions;
}

const rowSelection = {
  paymentId: payments.id,
  saleId: sales.id,
  invoiceNumber: sales.invoiceNumber,
  saleStatus: sales.status,
  outletId: outlets.id,
  outletCode: outlets.code,
  outletName: outlets.name,
  registerName: registers.name,
  cashierName: users.fullName,
  method: payments.method,
  provider: payments.provider,
  providerReference: payments.providerReference,
  amount: payments.amount,
  paidAt: payments.paidAt,
  paymentStatus: payments.status,
  settlementStatus: payments.settlementStatus,
  profileId: manualPaymentProfiles.id,
  profileName: manualPaymentProfiles.name,
  profileCode: manualPaymentProfiles.code,
  reconciliationId: paymentReconciliations.id,
  settlementGrossAmount: paymentReconciliations.settlementGrossAmount,
  feeAmount: paymentReconciliations.feeAmount,
  taxAmount: paymentReconciliations.taxAmount,
  netSettlementAmount: paymentReconciliations.netSettlementAmount,
  differenceAmount: paymentReconciliations.differenceAmount,
  settlementDate: paymentReconciliations.settlementDate,
  settlementReference: paymentReconciliations.settlementReference,
  reconciledAt: paymentReconciliations.reconciledAt,
  reconciledByName: reconciledByUsers.fullName,
  paymentMetadata: payments.metadata,
};

function mapRow(row: typeof rowSelection extends never ? never : Record<string, unknown>): ReconciliationListRow {
  const metadata = (row.paymentMetadata ?? {}) as Record<string, unknown>;
  return {
    paymentId: String(row.paymentId),
    saleId: String(row.saleId),
    invoiceNumber: String(row.invoiceNumber),
    saleStatus: String(row.saleStatus),
    outletId: String(row.outletId),
    outletCode: String(row.outletCode),
    outletName: String(row.outletName),
    registerName: String(row.registerName),
    cashierName: String(row.cashierName),
    method: row.method as ReconciliationPaymentMethod,
    provider: String(row.provider),
    providerReference:
      typeof row.providerReference === "string" ? row.providerReference : null,
    amount: String(row.amount),
    paidAt: row.paidAt instanceof Date ? row.paidAt : null,
    paymentStatus: String(row.paymentStatus),
    settlementStatus: normalizeStatus(String(row.settlementStatus)),
    profileId: typeof row.profileId === "string" ? row.profileId : null,
    profileName:
      typeof row.profileName === "string"
        ? row.profileName
        : getProfileNameFromMetadata(metadata),
    profileCode: typeof row.profileCode === "string" ? row.profileCode : null,
    reconciliationId:
      typeof row.reconciliationId === "string" ? row.reconciliationId : null,
    settlementGrossAmount:
      row.settlementGrossAmount == null
        ? null
        : String(row.settlementGrossAmount),
    feeAmount: row.feeAmount == null ? null : String(row.feeAmount),
    taxAmount: row.taxAmount == null ? null : String(row.taxAmount),
    netSettlementAmount:
      row.netSettlementAmount == null ? null : String(row.netSettlementAmount),
    differenceAmount:
      row.differenceAmount == null ? null : String(row.differenceAmount),
    settlementDate:
      row.settlementDate instanceof Date ? row.settlementDate : null,
    settlementReference:
      typeof row.settlementReference === "string"
        ? row.settlementReference
        : null,
    reconciledAt:
      row.reconciledAt instanceof Date ? row.reconciledAt : null,
    reconciledByName:
      typeof row.reconciledByName === "string" ? row.reconciledByName : null,
  };
}

export async function getReconciliationListData(
  auth: AuthContext,
  filters: ReconciliationFilters,
): Promise<ReconciliationListData> {
  const outletIds = getOutletIds(auth);
  if (outletIds.length === 0) {
    return {
      filters,
      outlets: [],
      profiles: [],
      rows: [],
      summary: {
        totalCount: 0,
        totalAmount: 0,
        unreconciledCount: 0,
        unreconciledAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
        reconciledCount: 0,
        reconciledGrossAmount: 0,
        reconciledNetAmount: 0,
        totalFeeAmount: 0,
        mismatchCount: 0,
        mismatchAbsoluteAmount: 0,
        notFoundCount: 0,
        waivedCount: 0,
      },
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: RECONCILIATION_PAGE_SIZE,
    };
  }

  const conditions = buildConditions(auth, filters);
  const where = and(...conditions);
  const summaryWhere = and(
    ...buildConditions(auth, { ...filters, status: "all" }),
  );
  const offset = (filters.page - 1) * RECONCILIATION_PAGE_SIZE;

  const [outletRows, profileRows, countRows, rawRows, summaryRows] =
    await Promise.all([
      db
        .select({ id: outlets.id, code: outlets.code, name: outlets.name })
        .from(outlets)
        .where(
          and(
            eq(outlets.organizationId, auth.organization.id),
            inArray(outlets.id, outletIds),
          ),
        )
        .orderBy(asc(outlets.name)),
      db
        .select({
          id: manualPaymentProfiles.id,
          code: manualPaymentProfiles.code,
          name: manualPaymentProfiles.name,
          outletId: manualPaymentProfiles.outletId,
          provider: manualPaymentProfiles.provider,
        })
        .from(manualPaymentProfiles)
        .where(
          and(
            eq(manualPaymentProfiles.organizationId, auth.organization.id),
            inArray(manualPaymentProfiles.outletId, outletIds),
            eq(manualPaymentProfiles.profileType, "edc"),
          ),
        )
        .orderBy(asc(manualPaymentProfiles.name)),
      db
        .select({ value: count() })
        .from(payments)
        .innerJoin(sales, eq(payments.saleId, sales.id))
        .innerJoin(outlets, eq(sales.outletId, outlets.id))
        .innerJoin(registers, eq(sales.registerId, registers.id))
        .innerJoin(users, eq(sales.cashierId, users.id))
        .leftJoin(
          manualPaymentProfiles,
          eq(payments.manualPaymentProfileId, manualPaymentProfiles.id),
        )
        .leftJoin(
          paymentReconciliations,
          eq(payments.id, paymentReconciliations.paymentId),
        )
        .where(where),
      db
        .select(rowSelection)
        .from(payments)
        .innerJoin(sales, eq(payments.saleId, sales.id))
        .innerJoin(outlets, eq(sales.outletId, outlets.id))
        .innerJoin(registers, eq(sales.registerId, registers.id))
        .innerJoin(users, eq(sales.cashierId, users.id))
        .leftJoin(
          manualPaymentProfiles,
          eq(payments.manualPaymentProfileId, manualPaymentProfiles.id),
        )
        .leftJoin(
          paymentReconciliations,
          eq(payments.id, paymentReconciliations.paymentId),
        )
        .leftJoin(
          reconciledByUsers,
          eq(paymentReconciliations.reconciledBy, reconciledByUsers.id),
        )
        .where(where)
        .orderBy(desc(payments.paidAt), desc(payments.createdAt))
        .limit(RECONCILIATION_PAGE_SIZE)
        .offset(offset),
      db
        .select({
          totalCount: count(),
          totalAmount: sql<string>`coalesce(sum(${payments.amount}), 0)`,
          unreconciledCount: sql<number>`count(*) filter (where ${payments.settlementStatus} = 'unreconciled')::int`,
          unreconciledAmount: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.settlementStatus} = 'unreconciled'), 0)`,
          pendingCount: sql<number>`count(*) filter (where ${payments.settlementStatus} = 'pending_settlement')::int`,
          pendingAmount: sql<string>`coalesce(sum(${payments.amount}) filter (where ${payments.settlementStatus} = 'pending_settlement'), 0)`,
          reconciledCount: sql<number>`count(*) filter (where ${payments.settlementStatus} = 'reconciled')::int`,
          reconciledGrossAmount: sql<string>`coalesce(sum(${paymentReconciliations.settlementGrossAmount}) filter (where ${payments.settlementStatus} = 'reconciled'), 0)`,
          reconciledNetAmount: sql<string>`coalesce(sum(${paymentReconciliations.netSettlementAmount}) filter (where ${payments.settlementStatus} = 'reconciled'), 0)`,
          totalFeeAmount: sql<string>`coalesce(sum(${paymentReconciliations.feeAmount}) filter (where ${payments.settlementStatus} = 'reconciled'), 0)`,
          mismatchCount: sql<number>`count(*) filter (where ${payments.settlementStatus} = 'mismatch')::int`,
          mismatchAbsoluteAmount: sql<string>`coalesce(sum(abs(${paymentReconciliations.differenceAmount})) filter (where ${payments.settlementStatus} = 'mismatch'), 0)`,
          notFoundCount: sql<number>`count(*) filter (where ${payments.settlementStatus} = 'not_found')::int`,
          waivedCount: sql<number>`count(*) filter (where ${payments.settlementStatus} = 'waived')::int`,
        })
        .from(payments)
        .innerJoin(sales, eq(payments.saleId, sales.id))
        .innerJoin(outlets, eq(sales.outletId, outlets.id))
        .innerJoin(registers, eq(sales.registerId, registers.id))
        .innerJoin(users, eq(sales.cashierId, users.id))
        .leftJoin(
          manualPaymentProfiles,
          eq(payments.manualPaymentProfileId, manualPaymentProfiles.id),
        )
        .leftJoin(
          paymentReconciliations,
          eq(payments.id, paymentReconciliations.paymentId),
        )
        .where(summaryWhere),
    ]);

  const total = Number(countRows[0]?.value ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / RECONCILIATION_PAGE_SIZE));
  const summary = summaryRows[0];

  return {
    filters,
    outlets: outletRows,
    profiles: profileRows,
    rows: rawRows.map((row) => mapRow(row as unknown as Record<string, unknown>)),
    summary: {
      totalCount: Number(summary?.totalCount ?? 0),
      totalAmount: Number(summary?.totalAmount ?? 0),
      unreconciledCount: Number(summary?.unreconciledCount ?? 0),
      unreconciledAmount: Number(summary?.unreconciledAmount ?? 0),
      pendingCount: Number(summary?.pendingCount ?? 0),
      pendingAmount: Number(summary?.pendingAmount ?? 0),
      reconciledCount: Number(summary?.reconciledCount ?? 0),
      reconciledGrossAmount: Number(summary?.reconciledGrossAmount ?? 0),
      reconciledNetAmount: Number(summary?.reconciledNetAmount ?? 0),
      totalFeeAmount: Number(summary?.totalFeeAmount ?? 0),
      mismatchCount: Number(summary?.mismatchCount ?? 0),
      mismatchAbsoluteAmount: Number(summary?.mismatchAbsoluteAmount ?? 0),
      notFoundCount: Number(summary?.notFoundCount ?? 0),
      waivedCount: Number(summary?.waivedCount ?? 0),
    },
    total,
    page: Math.min(filters.page, pageCount),
    pageCount,
    pageSize: RECONCILIATION_PAGE_SIZE,
  };
}

export async function getReconciliationDetailData(
  auth: AuthContext,
  paymentId: string,
): Promise<ReconciliationDetailData | null> {
  const outletIds = getOutletIds(auth);
  if (outletIds.length === 0) return null;

  const [row] = await db
    .select({
      ...rowSelection,
      verificationSource: payments.verificationSource,
      providerPaidAt: payments.providerPaidAt,
      verificationStatus: payments.verificationStatus,
      evidenceKey: payments.evidenceKey,
      reconciliationEvidenceKey: paymentReconciliations.evidenceKey,
      reconciliationNotes: paymentReconciliations.notes,
      resolvedAt: paymentReconciliations.resolvedAt,
      resolvedByName: resolvedByUsers.fullName,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(sales, eq(payments.saleId, sales.id))
    .innerJoin(outlets, eq(sales.outletId, outlets.id))
    .innerJoin(registers, eq(sales.registerId, registers.id))
    .innerJoin(users, eq(sales.cashierId, users.id))
    .leftJoin(
      manualPaymentProfiles,
      eq(payments.manualPaymentProfileId, manualPaymentProfiles.id),
    )
    .leftJoin(
      paymentReconciliations,
      eq(payments.id, paymentReconciliations.paymentId),
    )
    .leftJoin(
      reconciledByUsers,
      eq(paymentReconciliations.reconciledBy, reconciledByUsers.id),
    )
    .leftJoin(
      resolvedByUsers,
      eq(paymentReconciliations.resolvedBy, resolvedByUsers.id),
    )
    .where(
      and(
        eq(payments.id, paymentId),
        eq(sales.organizationId, auth.organization.id),
        inArray(sales.outletId, outletIds),
        inArray(payments.method, [...reconciliationPaymentMethods]),
        ne(payments.settlementStatus, "not_applicable"),
      ),
    )
    .limit(1);

  if (!row) return null;
  const mapped = mapRow(row as unknown as Record<string, unknown>);

  return {
    ...mapped,
    paymentMetadata: row.paymentMetadata ?? {},
    verificationSource: row.verificationSource,
    providerPaidAt: row.providerPaidAt,
    verificationStatus: row.verificationStatus,
    evidenceKey: row.evidenceKey,
    reconciliationEvidenceKey: row.reconciliationEvidenceKey,
    reconciliationNotes: row.reconciliationNotes,
    resolvedAt: row.resolvedAt,
    resolvedByName: row.resolvedByName,
    createdAt: row.createdAt,
  };
}
