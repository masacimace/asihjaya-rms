import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { approvals, outlets, sales, users } from "@/db/schema";
import {
  ADMIN_APPROVALS_PAGE_SIZE,
  type AdminApprovalDrawerData,
  type AdminApprovalFilters,
  type AdminApprovalListData,
  type AdminApprovalRequestSummary,
  type AdminApprovalRow,
  type ApprovalType,
} from "@/features/approvals/contracts";
import type { AuthContext } from "@/lib/auth/session";

const approvedByUsers = alias(users, "approval_approved_by_users");
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function getJakartaDateParts(date: Date) {
  const shiftedDate = new Date(date.getTime() + JAKARTA_OFFSET_MS);

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth(),
    day: shiftedDate.getUTCDate(),
  };
}

function getJakartaDayStartUtc(date: Date) {
  const parts = getJakartaDateParts(date);

  return new Date(
    Date.UTC(parts.year, parts.month, parts.day) - JAKARTA_OFFSET_MS,
  );
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);

  return result;
}

function getRangeBounds(filters: AdminApprovalFilters) {
  if (filters.range === "all") {
    return {
      start: null,
      end: null,
      label: "Semua periode",
    };
  }

  const todayStart = getJakartaDayStartUtc(new Date());

  if (filters.range === "today") {
    return {
      start: todayStart,
      end: addDays(todayStart, 1),
      label: "Hari ini",
    };
  }

  if (filters.range === "7d") {
    return {
      start: addDays(todayStart, -6),
      end: addDays(todayStart, 1),
      label: "7 hari terakhir",
    };
  }

  return {
    start: addDays(todayStart, -29),
    end: addDays(todayStart, 1),
    label: "30 hari terakhir",
  };
}

function getAccessibleOutletIds(auth: AuthContext, requestedOutletId: string | null) {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (!requestedOutletId) {
    return outletIds;
  }

  return outletIds.includes(requestedOutletId) ? [requestedOutletId] : [];
}

function getRecordValue(data: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = data[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getNumberValue(data: Record<string, unknown>, keys: readonly string[]) {
  const value = getRecordValue(data, keys);

  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = Number(value.replace(/[^0-9.-]/g, ""));

    if (Number.isFinite(normalized)) return normalized;
  }

  return null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getApprovalTypeTitle(type: ApprovalType) {
  if (type === "discount") return "Permintaan Diskon Khusus";
  if (type === "void_receipt") return "Pembatalan Nota (Void)";
  if (type === "stock_adjustment") return "Penyesuaian Stok";

  return "Approval Operasional";
}

export function summarizeApprovalRequest(
  type: ApprovalType,
  requestData: Record<string, unknown>,
): AdminApprovalRequestSummary {
  const reason = getRecordValue(requestData, ["reason", "notes", "note"]);
  const item = getRecordValue(requestData, [
    "item",
    "itemName",
    "productName",
    "sku",
    "barcode",
  ]);
  const invoice = getRecordValue(requestData, [
    "invoiceNumber",
    "invoice",
    "referenceLabel",
    "saleInvoiceNumber",
  ]);
  const discountAmount = getNumberValue(requestData, [
    "discountRequested",
    "discountAmount",
    "discountValue",
    "amount",
  ]);
  const price = getNumberValue(requestData, ["price", "labelPrice", "subtotal"]);
  const adjustmentQty = getRecordValue(requestData, [
    "quantityDelta",
    "qtyDelta",
    "delta",
    "adjustment",
  ]);

  if (type === "discount") {
    const itemCount = getNumberValue(requestData, ["itemCount"]);
    const customer = getRecordValue(requestData, ["customerName", "customerCode"]);
    const requestedTotalAmount = getNumberValue(requestData, [
      "requestedTotalAmount",
      "totalAfterDiscount",
      "finalTotal",
    ]);
    const discountPercent = getNumberValue(requestData, ["discountPercent"]);
    const cartLabel = item
      ? stringifyValue(item)
      : itemCount
        ? `${itemCount} item cart POS`
        : null;

    const lines = [
      cartLabel ? { label: "Item", value: cartLabel } : null,
      customer ? { label: "Customer", value: stringifyValue(customer) } : null,
      price ? { label: "Subtotal", value: formatMoney(price) } : null,
      discountAmount
        ? {
            label: "Diskon diminta",
            value: discountPercent
              ? `${formatMoney(discountAmount)} (${discountPercent}%)`
              : formatMoney(discountAmount),
            tone: "danger" as const,
          }
        : null,
      requestedTotalAmount
        ? {
            label: "Total setelah diskon",
            value: formatMoney(requestedTotalAmount),
            tone: "success" as const,
          }
        : null,
      reason ? { label: "Alasan", value: stringifyValue(reason) } : null,
    ].filter(Boolean) as AdminApprovalRequestSummary["lines"];

    return {
      title: "Permintaan Diskon Khusus",
      description: cartLabel
        ? `Diskon khusus untuk ${cartLabel}`
        : "Kasir meminta diskon di luar batas normal.",
      reason: reason ? stringifyValue(reason) : null,
      impactLabel: discountAmount ? "Nominal diskon" : null,
      impactValue: discountAmount,
      lines,
    };
  }

  if (type === "void_receipt") {
    const lines = [
      invoice ? { label: "Nota", value: stringifyValue(invoice) } : null,
      reason ? { label: "Alasan void", value: stringifyValue(reason) } : null,
    ].filter(Boolean) as AdminApprovalRequestSummary["lines"];

    return {
      title: "Pembatalan Nota (Void)",
      description: invoice
        ? `Permintaan pembatalan nota ${stringifyValue(invoice)}`
        : "Kasir meminta pembatalan nota transaksi.",
      reason: reason ? stringifyValue(reason) : null,
      impactLabel: null,
      impactValue: null,
      lines,
    };
  }

  if (type === "stock_adjustment") {
    const lines = [
      item ? { label: "Item", value: stringifyValue(item) } : null,
      adjustmentQty
        ? {
            label: "Penyesuaian",
            value: stringifyValue(adjustmentQty),
            tone: "warning" as const,
          }
        : null,
      reason ? { label: "Alasan", value: stringifyValue(reason) } : null,
    ].filter(Boolean) as AdminApprovalRequestSummary["lines"];

    return {
      title: "Penyesuaian Stok",
      description: item
        ? `Permintaan penyesuaian stok ${stringifyValue(item)}`
        : "Permintaan koreksi stok/inventaris.",
      reason: reason ? stringifyValue(reason) : null,
      impactLabel: null,
      impactValue: null,
      lines,
    };
  }

  const fallbackLines = Object.entries(requestData)
    .slice(0, 5)
    .map(([label, value]) => ({ label, value: stringifyValue(value) }));

  return {
    title: getApprovalTypeTitle(type),
    description: reason
      ? stringifyValue(reason)
      : "Permintaan approval operasional membutuhkan tinjauan manager.",
    reason: reason ? stringifyValue(reason) : null,
    impactLabel: null,
    impactValue: null,
    lines: fallbackLines,
  };
}

function createSearchCondition(search: string) {
  if (!search) {
    return null;
  }

  const pattern = `%${search}%`;

  return or(
    ilike(approvals.referenceType, pattern),
    ilike(approvals.notes, pattern),
    ilike(approvals.responseNotes, pattern),
    ilike(users.fullName, pattern),
    ilike(approvedByUsers.fullName, pattern),
    ilike(outlets.code, pattern),
    ilike(outlets.name, pattern),
    ilike(sales.invoiceNumber, pattern),
    sql`${approvals.requestData}::text ILIKE ${pattern}`,
  );
}

function createApprovalConditions({
  auth,
  filters,
  outletIds,
}: {
  auth: AuthContext;
  filters: AdminApprovalFilters;
  outletIds: string[];
}) {
  const conditions: SQL[] = [eq(approvals.organizationId, auth.organization.id)];

  if (filters.outletId) {
    if (outletIds.length === 0) {
      conditions.push(sql`false`);
    } else {
      conditions.push(
        or(isNull(approvals.outletId), inArray(approvals.outletId, outletIds)) ??
          sql`false`,
      );
    }
  } else if (auth.outlets.length > 0) {
    conditions.push(
      or(
        isNull(approvals.outletId),
        inArray(
          approvals.outletId,
          auth.outlets.map((outlet) => outlet.id),
        ),
      ) ?? sql`false`,
    );
  }

  if (filters.status !== "all") {
    conditions.push(eq(approvals.status, filters.status));
  }

  if (filters.type !== "all") {
    conditions.push(eq(approvals.type, filters.type));
  }

  const rangeBounds = getRangeBounds(filters);

  if (rangeBounds.start) {
    conditions.push(gte(approvals.createdAt, rangeBounds.start));
  }

  if (rangeBounds.end) {
    conditions.push(lte(approvals.createdAt, rangeBounds.end));
  }

  const searchCondition = createSearchCondition(filters.search);

  if (searchCondition) {
    conditions.push(searchCondition);
  }

  return {
    conditions,
    periodLabel: rangeBounds.label,
  };
}

function mapApprovalRow(row: {
  id: string;
  type: ApprovalType;
  status: "pending" | "approved" | "rejected";
  outletId: string | null;
  outletCode: string | null;
  outletName: string | null;
  requestedById: string;
  requestedByName: string;
  approvedById: string | null;
  approvedByName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  saleInvoiceNumber: string | null;
  notes: string | null;
  responseNotes: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  requestData: Record<string, unknown>;
}): AdminApprovalRow {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    outletId: row.outletId,
    outletCode: row.outletCode,
    outletName: row.outletName,
    requestedById: row.requestedById,
    requestedByName: row.requestedByName,
    approvedById: row.approvedById,
    approvedByName: row.approvedByName,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceLabel: row.saleInvoiceNumber ?? row.referenceType,
    notes: row.notes,
    responseNotes: row.responseNotes,
    createdAtIso: row.createdAt.toISOString(),
    resolvedAtIso: row.resolvedAt?.toISOString() ?? null,
    requestData: row.requestData,
    summary: summarizeApprovalRequest(row.type, row.requestData),
  };
}

async function selectApprovalRows(whereClause: SQL, limit: number, offset = 0) {
  const rows = await db
    .select({
      id: approvals.id,
      type: approvals.type,
      status: approvals.status,
      outletId: approvals.outletId,
      outletCode: outlets.code,
      outletName: outlets.name,
      requestedById: approvals.requestedBy,
      requestedByName: users.fullName,
      approvedById: approvals.approvedBy,
      approvedByName: approvedByUsers.fullName,
      referenceType: approvals.referenceType,
      referenceId: approvals.referenceId,
      saleInvoiceNumber: sales.invoiceNumber,
      notes: approvals.notes,
      responseNotes: approvals.responseNotes,
      createdAt: approvals.createdAt,
      resolvedAt: approvals.resolvedAt,
      requestData: approvals.requestData,
    })
    .from(approvals)
    .innerJoin(users, eq(approvals.requestedBy, users.id))
    .leftJoin(approvedByUsers, eq(approvals.approvedBy, approvedByUsers.id))
    .leftJoin(outlets, eq(approvals.outletId, outlets.id))
    .leftJoin(sales, eq(approvals.referenceId, sales.id))
    .where(whereClause)
    .orderBy(desc(approvals.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map(mapApprovalRow);
}

function createEmptyData(
  auth: AuthContext,
  filters: AdminApprovalFilters,
  periodLabel: string,
): AdminApprovalListData {
  return {
    filters,
    outlets: auth.outlets,
    rows: [],
    summary: {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      highImpactPending: 0,
    },
    page: 1,
    pageCount: 1,
    pageSize: ADMIN_APPROVALS_PAGE_SIZE,
    periodLabel,
  };
}

export async function getAdminApprovalListData(
  auth: AuthContext,
  filters: AdminApprovalFilters,
): Promise<AdminApprovalListData> {
  const outletIds = getAccessibleOutletIds(auth, filters.outletId);
  const { conditions, periodLabel } = createApprovalConditions({
    auth,
    filters,
    outletIds,
  });
  const whereClause = and(...conditions);

  if (!whereClause) {
    return createEmptyData(auth, filters, periodLabel);
  }

  const offset = (filters.page - 1) * ADMIN_APPROVALS_PAGE_SIZE;

  const [totalRows, summaryRows, rows] = await Promise.all([
    db.select({ value: count() }).from(approvals).where(whereClause),
    db
      .select({ status: approvals.status, value: count() })
      .from(approvals)
      .where(whereClause)
      .groupBy(approvals.status),
    selectApprovalRows(whereClause, ADMIN_APPROVALS_PAGE_SIZE, offset),
  ]);

  const total = totalRows[0]?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_APPROVALS_PAGE_SIZE));

  const summary = summaryRows.reduce(
    (accumulator, row) => {
      accumulator[row.status] = row.value;
      return accumulator;
    },
    { pending: 0, approved: 0, rejected: 0 } as Record<
      "pending" | "approved" | "rejected",
      number
    >,
  );

  const highImpactPending = rows.filter(
    (row) => row.status === "pending" && (row.summary.impactValue ?? 0) > 0,
  ).length;

  return {
    filters,
    outlets: auth.outlets,
    rows,
    summary: {
      total,
      pending: summary.pending,
      approved: summary.approved,
      rejected: summary.rejected,
      highImpactPending,
    },
    page: Math.min(filters.page, pageCount),
    pageCount,
    pageSize: ADMIN_APPROVALS_PAGE_SIZE,
    periodLabel,
  };
}

function createDrawerWhereClause(auth: AuthContext, status?: "pending") {
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const conditions: SQL[] = [eq(approvals.organizationId, auth.organization.id)];

  if (outletIds.length > 0) {
    conditions.push(
      or(isNull(approvals.outletId), inArray(approvals.outletId, outletIds)) ??
        sql`false`,
    );
  }

  if (status) {
    conditions.push(eq(approvals.status, status));
  }

  return and(...conditions) ?? sql`false`;
}

export async function getAdminApprovalDrawerData(
  auth: AuthContext,
): Promise<AdminApprovalDrawerData> {
  const pendingWhereClause = createDrawerWhereClause(auth, "pending");
  const allWhereClause = createDrawerWhereClause(auth);

  const [pendingCountRows, pending, recentResolved] = await Promise.all([
    db.select({ value: count() }).from(approvals).where(pendingWhereClause),
    selectApprovalRows(pendingWhereClause, 5),
    selectApprovalRows(
      and(allWhereClause, sql`${approvals.status} <> 'pending'`) ?? sql`false`,
      5,
    ),
  ]);

  return {
    pendingCount: pendingCountRows[0]?.value ?? 0,
    pending,
    recentResolved,
  };
}
