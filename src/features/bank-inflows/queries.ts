import {
  and,
  asc,
  eq,
  gte,
  inArray,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  customers,
  outlets,
  paymentRefunds,
  payments,
  sales,
} from "@/db/schema";
import {
  BANK_INFLOW_PAGE_SIZE,
  type BankInflowBankSummary,
  type BankInflowFilters,
  type BankInflowMovement,
  type BankInflowPaymentMethod,
  type BankInflowPeriod,
  type BankInflowReportData,
} from "@/features/bank-inflows/contracts";
import type { AuthContext } from "@/lib/auth/session";
import {
  addBusinessDays,
  getBusinessDateTimeParts,
  getStartOfBusinessDateKey,
  getStartOfBusinessDay,
  getStartOfBusinessMonth,
} from "@/lib/time/business-time";

const BANK_METHODS: BankInflowPaymentMethod[] = [
  "debit_card",
  "bank_transfer",
];

function formatDateKey(date: Date, timeZone: string) {
  const parts = getBusinessDateTimeParts(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function formatDateLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

function resolvePeriod(
  filters: BankInflowFilters,
  timeZone: string,
  now = new Date(),
): BankInflowPeriod {
  const today = getStartOfBusinessDay(now, timeZone);
  const tomorrow = getStartOfBusinessDay(now, timeZone, 1);

  if (filters.dateRange === "yesterday") {
    const start = getStartOfBusinessDay(now, timeZone, -1);
    return {
      range: "yesterday",
      label: "Kemarin",
      start,
      end: today,
      startDate: formatDateKey(start, timeZone),
      endDate: formatDateKey(start, timeZone),
    };
  }

  if (filters.dateRange === "last7") {
    const start = getStartOfBusinessDay(now, timeZone, -6);
    return {
      range: "last7",
      label: "7 hari terakhir",
      start,
      end: tomorrow,
      startDate: formatDateKey(start, timeZone),
      endDate: formatDateKey(today, timeZone),
    };
  }

  if (filters.dateRange === "last30") {
    const start = getStartOfBusinessDay(now, timeZone, -29);
    return {
      range: "last30",
      label: "30 hari terakhir",
      start,
      end: tomorrow,
      startDate: formatDateKey(start, timeZone),
      endDate: formatDateKey(today, timeZone),
    };
  }

  if (filters.dateRange === "today") {
    return {
      range: "today",
      label: "Hari ini",
      start: today,
      end: tomorrow,
      startDate: formatDateKey(today, timeZone),
      endDate: formatDateKey(today, timeZone),
    };
  }

  if (filters.dateRange === "custom") {
    let start = filters.startDate
      ? getStartOfBusinessDateKey(filters.startDate, timeZone)
      : null;
    let endInclusive = filters.endDate
      ? getStartOfBusinessDateKey(filters.endDate, timeZone)
      : null;

    if (!start) start = getStartOfBusinessMonth(now, timeZone);
    if (!endInclusive) endInclusive = today;

    if (start.getTime() > endInclusive.getTime()) {
      const temporary = start;
      start = endInclusive;
      endInclusive = temporary;
    }

    return {
      range: "custom",
      label: `${formatDateLabel(start, timeZone)} – ${formatDateLabel(endInclusive, timeZone)}`,
      start,
      end: addBusinessDays(endInclusive, 1, timeZone),
      startDate: formatDateKey(start, timeZone),
      endDate: formatDateKey(endInclusive, timeZone),
    };
  }

  const start = getStartOfBusinessMonth(now, timeZone);
  return {
    range: "thisMonth",
    label: "Bulan ini",
    start,
    end: tomorrow,
    startDate: formatDateKey(start, timeZone),
    endDate: formatDateKey(today, timeZone),
  };
}

function normalizeProvider(value: string | null | undefined) {
  const provider = String(value ?? "").trim();
  const normalized = provider.toLocaleLowerCase("id-ID");

  if (!provider || normalized === "manual" || normalized === "cash") {
    return "Tidak diketahui";
  }

  return provider;
}

function readProfileName(metadata: Record<string, unknown> | null | undefined) {
  const profile = metadata?.manualPaymentProfile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return null;
  }

  const name = (profile as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function resolveProvider(
  provider: string | null | undefined,
  metadata?: Record<string, unknown> | null,
) {
  const normalized = normalizeProvider(provider);
  if (normalized !== "Tidak diketahui") return normalized;

  const profileName = readProfileName(metadata);
  return profileName ?? normalized;
}

function matchesSearch(row: BankInflowMovement, search: string) {
  if (!search) return true;
  const normalized = search.toLocaleLowerCase("id-ID");
  const haystack = [
    row.invoiceNumber,
    row.customerCode,
    row.customerName,
    row.customerPhone,
    row.outletCode,
    row.outletName,
    row.provider,
    row.providerReference,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("id-ID");
  return haystack.includes(normalized);
}

function summarizeRows(rows: BankInflowMovement[]) {
  const receiptAmount = rows
    .filter((row) => row.kind === "receipt")
    .reduce((total, row) => total + row.amount, 0);
  const refundAmount = rows
    .filter((row) => row.kind === "refund")
    .reduce((total, row) => total + row.amount, 0);

  return {
    receiptAmount,
    refundAmount,
    netAmount: receiptAmount - refundAmount,
    movementCount: rows.length,
  };
}

function summarizeBanks(rows: BankInflowMovement[]): BankInflowBankSummary[] {
  const summaries = new Map<string, BankInflowBankSummary>();

  for (const row of rows) {
    const key = row.provider.toLocaleLowerCase("id-ID");
    const current = summaries.get(key) ?? {
      provider: row.provider,
      edcAmount: 0,
      transferAmount: 0,
      receiptAmount: 0,
      refundAmount: 0,
      netAmount: 0,
    };

    if (row.kind === "receipt") {
      current.receiptAmount += row.amount;
      if (row.method === "debit_card") current.edcAmount += row.amount;
      if (row.method === "bank_transfer") current.transferAmount += row.amount;
    } else {
      current.refundAmount += row.amount;
    }

    current.netAmount = current.receiptAmount - current.refundAmount;
    summaries.set(key, current);
  }

  return Array.from(summaries.values()).sort((left, right) =>
    left.provider.localeCompare(right.provider, "id-ID", { sensitivity: "base" }),
  );
}

async function loadBankMovements(
  auth: AuthContext,
  filters: BankInflowFilters,
  period: BankInflowPeriod,
  validOutletId: string | null,
) {
  const paymentDate = sql<Date>`coalesce(${payments.paidAt}, ${payments.createdAt})`;
  const paymentConditions: SQL[] = [
    eq(sales.organizationId, auth.organization.id),
    inArray(payments.method, BANK_METHODS),
    inArray(payments.status, ["paid", "partially_refunded", "refunded"]),
    gte(paymentDate, period.start),
    lt(paymentDate, period.end),
  ];
  if (validOutletId) paymentConditions.push(eq(sales.outletId, validOutletId));
  if (filters.method !== "all") paymentConditions.push(eq(payments.method, filters.method));

  const refundConditions: SQL[] = [
    eq(paymentRefunds.organizationId, auth.organization.id),
    inArray(paymentRefunds.method, BANK_METHODS),
    eq(paymentRefunds.status, "confirmed"),
    gte(paymentRefunds.confirmedAt, period.start),
    lt(paymentRefunds.confirmedAt, period.end),
  ];
  if (validOutletId) refundConditions.push(eq(paymentRefunds.outletId, validOutletId));
  if (filters.method !== "all") refundConditions.push(eq(paymentRefunds.method, filters.method));

  const [paymentRows, refundRows] = await Promise.all([
    db
      .select({
        id: payments.id,
        saleId: sales.id,
        invoiceNumber: sales.invoiceNumber,
        customerCode: customers.customerCode,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        outletId: outlets.id,
        outletCode: outlets.code,
        outletName: outlets.name,
        method: payments.method,
        provider: payments.provider,
        amount: payments.amount,
        providerReference: payments.providerReference,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        metadata: payments.metadata,
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(and(...paymentConditions)),
    db
      .select({
        id: paymentRefunds.id,
        saleId: sales.id,
        invoiceNumber: sales.invoiceNumber,
        customerCode: customers.customerCode,
        customerName: customers.fullName,
        customerPhone: customers.phone,
        outletId: outlets.id,
        outletCode: outlets.code,
        outletName: outlets.name,
        method: paymentRefunds.method,
        provider: paymentRefunds.provider,
        amount: paymentRefunds.amount,
        providerReference: paymentRefunds.providerReference,
        confirmedAt: paymentRefunds.confirmedAt,
        metadata: paymentRefunds.metadata,
      })
      .from(paymentRefunds)
      .innerJoin(sales, eq(paymentRefunds.saleId, sales.id))
      .innerJoin(outlets, eq(paymentRefunds.outletId, outlets.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(and(...refundConditions)),
  ]);

  const receiptMovements: BankInflowMovement[] = paymentRows.flatMap((row) => {
    if (row.method !== "debit_card" && row.method !== "bank_transfer") return [];
    const amount = Number(row.amount);
    const profileName = readProfileName(row.metadata);
    return [{
      id: `payment:${row.id}`,
      kind: "receipt" as const,
      occurredAt: row.paidAt ?? row.createdAt,
      saleId: row.saleId,
      invoiceNumber: row.invoiceNumber,
      customerCode: row.customerCode,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      outletId: row.outletId,
      outletCode: row.outletCode,
      outletName: row.outletName,
      method: row.method,
      provider: resolveProvider(row.provider, row.metadata),
      amount: Number.isFinite(amount) ? amount : 0,
      providerReference: row.providerReference ?? profileName,
    }];
  });

  const refundMovements: BankInflowMovement[] = refundRows.flatMap((row) => {
    if (row.method !== "debit_card" && row.method !== "bank_transfer") return [];
    if (!row.confirmedAt) return [];
    const amount = Number(row.amount);
    const originalMetadata = row.metadata?.originalPaymentMetadata;
    const metadata =
      originalMetadata && typeof originalMetadata === "object" && !Array.isArray(originalMetadata)
        ? (originalMetadata as Record<string, unknown>)
        : null;
    const profileName = readProfileName(metadata);
    return [{
      id: `refund:${row.id}`,
      kind: "refund" as const,
      occurredAt: row.confirmedAt,
      saleId: row.saleId,
      invoiceNumber: row.invoiceNumber,
      customerCode: row.customerCode,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      outletId: row.outletId,
      outletCode: row.outletCode,
      outletName: row.outletName,
      method: row.method,
      provider: resolveProvider(row.provider, metadata),
      amount: Number.isFinite(amount) ? amount : 0,
      providerReference: row.providerReference ?? profileName,
    }];
  });

  return [...receiptMovements, ...refundMovements].sort((left, right) => {
    const dateDifference = right.occurredAt.getTime() - left.occurredAt.getTime();
    if (dateDifference !== 0) return dateDifference;
    if (left.kind !== right.kind) return left.kind === "refund" ? -1 : 1;
    return left.invoiceNumber.localeCompare(right.invoiceNumber, "id-ID");
  });
}

export async function getBankInflowReportData(
  auth: AuthContext,
  filters: BankInflowFilters,
): Promise<BankInflowReportData> {
  const outletRows = await db
    .select({ id: outlets.id, code: outlets.code, name: outlets.name })
    .from(outlets)
    .where(eq(outlets.organizationId, auth.organization.id))
    .orderBy(asc(outlets.name), asc(outlets.code));

  const validOutletId = filters.outletId && outletRows.some((outlet) => outlet.id === filters.outletId)
    ? filters.outletId
    : null;
  const normalizedFilters = { ...filters, outletId: validOutletId };
  const period = resolvePeriod(normalizedFilters, auth.organization.timezone);
  const sourceRows = await loadBankMovements(auth, normalizedFilters, period, validOutletId);
  const providerSet = new Set(sourceRows.map((row) => row.provider));
  if (normalizedFilters.provider) providerSet.add(normalizedFilters.provider);
  const providers = Array.from(providerSet).sort((left, right) =>
    left.localeCompare(right, "id-ID", { sensitivity: "base" }),
  );

  const filteredRows = sourceRows.filter((row) => {
    if (
      normalizedFilters.provider &&
      row.provider.toLocaleLowerCase("id-ID") !==
        normalizedFilters.provider.toLocaleLowerCase("id-ID")
    ) {
      return false;
    }
    return matchesSearch(row, normalizedFilters.search);
  });

  const total = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(total / BANK_INFLOW_PAGE_SIZE));
  const page = Math.min(normalizedFilters.page, pageCount);
  const pageStart = (page - 1) * BANK_INFLOW_PAGE_SIZE;

  return {
    filters: { ...normalizedFilters, page },
    period,
    outlets: outletRows,
    providers,
    rows: filteredRows.slice(pageStart, pageStart + BANK_INFLOW_PAGE_SIZE),
    allRows: filteredRows,
    bankSummary: summarizeBanks(filteredRows),
    summary: summarizeRows(filteredRows),
    total,
    page,
    pageCount,
    pageSize: BANK_INFLOW_PAGE_SIZE,
  };
}
