import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  approvals,
  cashMovements,
  customers,
  inventoryMovements,
  outlets,
  payments,
  productCategories,
  productMasters,
  productItems,
  saleItems,
  sales,
  shifts,
  users,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";
import type {
  ReportCashSnapshot,
  ReportOutletPerformanceRow,
  ReportPaymentBreakdownRow,
  ReportPaymentMethod,
  ReportPeriodMetadata,
  ReportPeriodRange,
  ReportRecentSaleRow,
  ReportSaleStatus,
  ReportInventoryMovementType,
  ReportSlowMovingStockRow,
  ReportSalesData,
  ReportSalesFilters,
  ReportSalesPaymentBreakdownRow,
  ReportSalesRow,
  ReportSalesStatusBreakdownRow,
  ReportStockCategoryRow,
  ReportStockData,
  ReportStockFilters,
  ReportStockMovementRow,
  ReportStockOutletRow,
  ReportStockProductPerformanceRow,
  ReportStockTrendPoint,
  ReportSummaryData,
  ReportSummaryFilters,
  ReportTrendPoint,
} from "./contracts";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseAmount(value: string | number | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function getJakartaDateParts(date: Date) {
  const shiftedDate = new Date(date.getTime() + JAKARTA_OFFSET_MS);

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth(),
    day: shiftedDate.getUTCDate(),
  };
}

function getJakartaDayStartUtc(date: Date, dayOffset = 0) {
  const parts = getJakartaDateParts(date);

  return new Date(
    Date.UTC(parts.year, parts.month, parts.day + dayOffset) -
      JAKARTA_OFFSET_MS,
  );
}

function getJakartaMonthStartUtc(date: Date, monthOffset = 0) {
  const parts = getJakartaDateParts(date);

  return new Date(
    Date.UTC(parts.year, parts.month + monthOffset, 1) - JAKARTA_OFFSET_MS,
  );
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getJakartaDateKey(date: Date) {
  const parts = getJakartaDateParts(date);

  return [
    parts.year,
    String(parts.month + 1).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function getJakartaShortDateLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function createPeriodMetadata({
  range,
  now,
}: {
  range: ReportPeriodRange;
  now: Date;
}): ReportPeriodMetadata {
  const todayStart = getJakartaDayStartUtc(now);
  const tomorrowStart = getJakartaDayStartUtc(now, 1);

  if (range === "yesterday") {
    const currentStart = getJakartaDayStartUtc(now, -1);
    const currentEnd = todayStart;

    return {
      range,
      label: "Kemarin",
      description: "Ringkasan performa outlet untuk hari kemarin.",
      comparisonLabel: "dari hari sebelumnya",
      currentStart,
      currentEnd,
      previousStart: getJakartaDayStartUtc(now, -2),
      previousEnd: currentStart,
      trendStart: addUtcDays(currentStart, -6),
      trendEnd: currentEnd,
    };
  }

  if (range === "last7") {
    const currentStart = getJakartaDayStartUtc(now, -6);
    const currentEnd = tomorrowStart;

    return {
      range,
      label: "7 hari terakhir",
      description: "Ringkasan performa outlet selama tujuh hari terakhir.",
      comparisonLabel: "dari 7 hari sebelumnya",
      currentStart,
      currentEnd,
      previousStart: addUtcDays(currentStart, -7),
      previousEnd: currentStart,
      trendStart: currentStart,
      trendEnd: currentEnd,
    };
  }

  if (range === "last30") {
    const currentStart = getJakartaDayStartUtc(now, -29);
    const currentEnd = tomorrowStart;

    return {
      range,
      label: "30 hari terakhir",
      description: "Ringkasan performa outlet selama tiga puluh hari terakhir.",
      comparisonLabel: "dari 30 hari sebelumnya",
      currentStart,
      currentEnd,
      previousStart: addUtcDays(currentStart, -30),
      previousEnd: currentStart,
      trendStart: currentStart,
      trendEnd: currentEnd,
    };
  }

  if (range === "thisMonth") {
    const currentStart = getJakartaMonthStartUtc(now);
    const currentEnd = tomorrowStart;
    const currentDurationMs = currentEnd.getTime() - currentStart.getTime();

    return {
      range,
      label: "Bulan ini",
      description: "Ringkasan performa outlet untuk bulan berjalan.",
      comparisonLabel: "dari periode sebelumnya",
      currentStart,
      currentEnd,
      previousStart: new Date(currentStart.getTime() - currentDurationMs),
      previousEnd: currentStart,
      trendStart: currentStart,
      trendEnd: currentEnd,
    };
  }

  return {
    range: "today",
    label: "Hari ini",
    description: "Ringkasan performa outlet hari ini berdasarkan penjualan, stok, approval, dan kas.",
    comparisonLabel: "dari kemarin",
    currentStart: todayStart,
    currentEnd: tomorrowStart,
    previousStart: getJakartaDayStartUtc(now, -1),
    previousEnd: todayStart,
    trendStart: addUtcDays(todayStart, -6),
    trendEnd: tomorrowStart,
  };
}

function createTrendSkeleton(start: Date, end: Date): ReportTrendPoint[] {
  const points: ReportTrendPoint[] = [];

  for (let cursor = start; cursor < end; cursor = addUtcDays(cursor, 1)) {
    points.push({
      key: getJakartaDateKey(cursor),
      label: getJakartaShortDateLabel(cursor),
      revenue: 0,
      transactionCount: 0,
    });
  }

  return points;
}

function getAccessibleOutletIds(auth: AuthContext, requestedOutletId: string | null) {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (!requestedOutletId) {
    return outletIds;
  }

  return outletIds.includes(requestedOutletId) ? [requestedOutletId] : [];
}

function createEmptyData(
  auth: AuthContext,
  filters: ReportSummaryFilters,
  period: ReportPeriodMetadata,
): ReportSummaryData {
  return {
    filters,
    period,
    outlets: auth.outlets,
    selectedOutlet: null,
    summary: {
      revenue: { current: 0, previous: 0 },
      transactionCount: { current: 0, previous: 0 },
      itemSold: { current: 0, previous: 0 },
      weightSoldGram: { current: 0, previous: 0 },
      grossProfit: { current: 0, previous: 0 },
      discountAmount: { current: 0, previous: 0 },
      averageTransactionAmount: { current: 0, previous: 0 },
      voidRefundImpact: 0,
      voidRefundCount: 0,
      activeShiftCount: 0,
      pendingApprovalCount: 0,
      availableStockCount: 0,
      stockReturnCount: 0,
    },
    salesTrend: createTrendSkeleton(period.trendStart, period.trendEnd),
    paymentBreakdown: [],
    outletPerformance: [],
    recentSales: [],
    cashSnapshot: {
      cashSales: 0,
      cashRefunds: 0,
      manualCashIn: 0,
      manualCashOut: 0,
      closingAdjustments: 0,
      netCashMovement: 0,
    },
  };
}

export async function getReportSummaryData(
  auth: AuthContext,
  filters: ReportSummaryFilters,
): Promise<ReportSummaryData> {
  const outletIds = getAccessibleOutletIds(auth, filters.outletId);
  const now = new Date();
  const period = createPeriodMetadata({ range: filters.range, now });
  const selectedOutlet = filters.outletId
    ? auth.outlets.find((outlet) => outlet.id === filters.outletId) ?? null
    : null;

  if (outletIds.length === 0) {
    return createEmptyData(auth, filters, period);
  }

  const currentSalesWhere = and(
    eq(sales.organizationId, auth.organization.id),
    inArray(sales.outletId, outletIds),
    eq(sales.status, "completed"),
    gte(sales.completedAt, period.currentStart),
    lt(sales.completedAt, period.currentEnd),
  );

  const previousSalesWhere = and(
    eq(sales.organizationId, auth.organization.id),
    inArray(sales.outletId, outletIds),
    eq(sales.status, "completed"),
    gte(sales.completedAt, period.previousStart),
    lt(sales.completedAt, period.previousEnd),
  );

  const trendBucketSql = sql<string>`to_char(${sales.completedAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;

  const [
    currentSalesRows,
    previousSalesRows,
    currentItemRows,
    previousItemRows,
    trendRows,
    paymentRows,
    outletRows,
    recentSaleRows,
    cashRows,
    voidRefundRows,
    activeShiftRows,
    pendingApprovalRows,
    availableStockRows,
    stockReturnRows,
  ] = await Promise.all([
    db
      .select({
        revenue: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        discountAmount: sql<number>`coalesce(sum(${sales.discountAmount}), 0)`.mapWith(Number),
        transactionCount: count(),
        averageTransactionAmount: sql<number>`coalesce(avg(${sales.totalAmount}), 0)`.mapWith(Number),
      })
      .from(sales)
      .where(currentSalesWhere),

    db
      .select({
        revenue: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        discountAmount: sql<number>`coalesce(sum(${sales.discountAmount}), 0)`.mapWith(Number),
        transactionCount: count(),
        averageTransactionAmount: sql<number>`coalesce(avg(${sales.totalAmount}), 0)`.mapWith(Number),
      })
      .from(sales)
      .where(previousSalesWhere),

    db
      .select({
        itemSold: count(),
        weightSoldGram: sql<number>`coalesce(sum(coalesce(${productItems.weightGram}, 0)::numeric), 0)`.mapWith(Number),
        grossProfit: sql<number>`coalesce(sum(${saleItems.finalPriceAmount}::numeric - coalesce(${productItems.costAmount}, 0)::numeric), 0)`.mapWith(Number),
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
      .where(currentSalesWhere),

    db
      .select({
        itemSold: count(),
        weightSoldGram: sql<number>`coalesce(sum(coalesce(${productItems.weightGram}, 0)::numeric), 0)`.mapWith(Number),
        grossProfit: sql<number>`coalesce(sum(${saleItems.finalPriceAmount}::numeric - coalesce(${productItems.costAmount}, 0)::numeric), 0)`.mapWith(Number),
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
      .where(previousSalesWhere),

    db
      .select({
        bucket: trendBucketSql,
        revenue: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        transactionCount: count(),
      })
      .from(sales)
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          eq(sales.status, "completed"),
          gte(sales.completedAt, period.trendStart),
          lt(sales.completedAt, period.trendEnd),
        ),
      )
      .groupBy(trendBucketSql)
      .orderBy(trendBucketSql),

    db
      .select({
        method: payments.method,
        amount: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number),
        transactionCount: count(),
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          eq(sales.status, "completed"),
          eq(payments.status, "paid"),
          gte(sales.completedAt, period.currentStart),
          lt(sales.completedAt, period.currentEnd),
        ),
      )
      .groupBy(payments.method)
      .orderBy(desc(sql`coalesce(sum(${payments.amount}), 0)`)),

    db
      .select({
        outletId: outlets.id,
        outletCode: outlets.code,
        outletName: outlets.name,
        revenue: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        transactionCount: count(),
        itemSold: sql<number>`(
          select count(*)::integer
          from ${saleItems} as report_outlet_sale_items
          inner join ${sales} as report_outlet_sales
            on report_outlet_sale_items.sale_id = report_outlet_sales.id
          where report_outlet_sales.outlet_id = ${outlets.id}
            and report_outlet_sales.organization_id = ${auth.organization.id}
            and report_outlet_sales.status = 'completed'
            and report_outlet_sales.completed_at >= ${period.currentStart}
            and report_outlet_sales.completed_at < ${period.currentEnd}
        )`.mapWith(Number),
      })
      .from(sales)
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .where(currentSalesWhere)
      .groupBy(outlets.id, outlets.code, outlets.name)
      .orderBy(desc(sql`coalesce(sum(${sales.totalAmount}), 0)`))
      .limit(5),

    db
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        outletName: outlets.name,
        customerName: customers.fullName,
        cashierName: users.fullName,
        status: sales.status,
        totalAmount: sales.totalAmount,
        completedAt: sales.completedAt,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .innerJoin(users, eq(sales.cashierId, users.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          gte(sales.createdAt, period.currentStart),
          lt(sales.createdAt, period.currentEnd),
        ),
      )
      .orderBy(desc(sales.createdAt))
      .limit(6),

    db
      .select({
        cashSales: sql<number>`coalesce(sum(case when ${cashMovements.type} = 'cash_sale' then ${cashMovements.amount}::numeric else 0 end), 0)`.mapWith(Number),
        cashRefunds: sql<number>`coalesce(sum(case when ${cashMovements.type} = 'cash_refund' then ${cashMovements.amount}::numeric else 0 end), 0)`.mapWith(Number),
        manualCashIn: sql<number>`coalesce(sum(case when ${cashMovements.type} = 'cash_in' then ${cashMovements.amount}::numeric else 0 end), 0)`.mapWith(Number),
        manualCashOut: sql<number>`coalesce(sum(case when ${cashMovements.type} = 'cash_out' then ${cashMovements.amount}::numeric else 0 end), 0)`.mapWith(Number),
        closingAdjustments: sql<number>`coalesce(sum(case when ${cashMovements.type} = 'closing_adjustment' then ${cashMovements.amount}::numeric else 0 end), 0)`.mapWith(Number),
      })
      .from(cashMovements)
      .innerJoin(shifts, eq(cashMovements.shiftId, shifts.id))
      .innerJoin(outlets, eq(shifts.outletId, outlets.id))
      .where(
        and(
          eq(outlets.organizationId, auth.organization.id),
          inArray(shifts.outletId, outletIds),
          gte(cashMovements.createdAt, period.currentStart),
          lt(cashMovements.createdAt, period.currentEnd),
        ),
      ),

    db
      .select({
        amount: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        transactionCount: count(),
      })
      .from(sales)
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          or(eq(sales.status, "voided"), eq(sales.status, "refunded")),
          gte(sales.cancelledAt, period.currentStart),
          lt(sales.cancelledAt, period.currentEnd),
        ),
      ),

    db
      .select({ total: count() })
      .from(shifts)
      .innerJoin(outlets, eq(shifts.outletId, outlets.id))
      .where(
        and(
          eq(outlets.organizationId, auth.organization.id),
          inArray(shifts.outletId, outletIds),
          eq(shifts.status, "open"),
        ),
      ),

    db
      .select({ total: count() })
      .from(approvals)
      .where(
        and(
          eq(approvals.organizationId, auth.organization.id),
          or(isNull(approvals.outletId), inArray(approvals.outletId, outletIds)),
          eq(approvals.status, "pending"),
        ),
      ),

    db
      .select({ total: count() })
      .from(productItems)
      .where(
        and(
          eq(productItems.organizationId, auth.organization.id),
          inArray(productItems.currentOutletId, outletIds),
          eq(productItems.isActive, true),
          eq(productItems.availability, "available"),
        ),
      ),

    db
      .select({ total: count() })
      .from(inventoryMovements)
      .innerJoin(productItems, eq(inventoryMovements.itemId, productItems.id))
      .where(
        and(
          eq(inventoryMovements.organizationId, auth.organization.id),
          inArray(productItems.currentOutletId, outletIds),
          eq(inventoryMovements.movementType, "sale_return"),
          gte(inventoryMovements.occurredAt, period.currentStart),
          lt(inventoryMovements.occurredAt, period.currentEnd),
        ),
      ),
  ]);

  const currentSales = currentSalesRows[0];
  const previousSales = previousSalesRows[0];
  const currentItems = currentItemRows[0];
  const previousItems = previousItemRows[0];
  const cash = cashRows[0];

  const trendMap = new Map(
    trendRows.map((row) => [
      row.bucket,
      {
        revenue: row.revenue,
        transactionCount: row.transactionCount,
      },
    ]),
  );

  const salesTrend = createTrendSkeleton(period.trendStart, period.trendEnd).map(
    (point) => {
      const source = trendMap.get(point.key);

      return {
        ...point,
        revenue: source?.revenue ?? 0,
        transactionCount: source?.transactionCount ?? 0,
      };
    },
  );

  const paymentBreakdown: ReportPaymentBreakdownRow[] = paymentRows.map(
    (row) => ({
      method: row.method,
      amount: row.amount,
      transactionCount: row.transactionCount,
    }),
  );

  const outletPerformance: ReportOutletPerformanceRow[] = outletRows.map(
    (row) => ({
      outletId: row.outletId,
      outletCode: row.outletCode,
      outletName: row.outletName,
      revenue: row.revenue,
      transactionCount: row.transactionCount,
      itemSold: row.itemSold,
    }),
  );

  const recentSales: ReportRecentSaleRow[] = recentSaleRows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    outletName: row.outletName,
    customerName: row.customerName,
    cashierName: row.cashierName,
    status: row.status,
    totalAmount: parseAmount(row.totalAmount),
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  }));

  const cashSales = cash?.cashSales ?? 0;
  const cashRefunds = cash?.cashRefunds ?? 0;
  const manualCashIn = cash?.manualCashIn ?? 0;
  const manualCashOut = cash?.manualCashOut ?? 0;
  const closingAdjustments = cash?.closingAdjustments ?? 0;
  const cashSnapshot: ReportCashSnapshot = {
    cashSales,
    cashRefunds,
    manualCashIn,
    manualCashOut,
    closingAdjustments,
    netCashMovement:
      cashSales + manualCashIn + closingAdjustments - cashRefunds - manualCashOut,
  };

  return {
    filters,
    period,
    outlets: auth.outlets,
    selectedOutlet,
    summary: {
      revenue: {
        current: currentSales?.revenue ?? 0,
        previous: previousSales?.revenue ?? 0,
      },
      transactionCount: {
        current: currentSales?.transactionCount ?? 0,
        previous: previousSales?.transactionCount ?? 0,
      },
      itemSold: {
        current: currentItems?.itemSold ?? 0,
        previous: previousItems?.itemSold ?? 0,
      },
      weightSoldGram: {
        current: currentItems?.weightSoldGram ?? 0,
        previous: previousItems?.weightSoldGram ?? 0,
      },
      grossProfit: {
        current: currentItems?.grossProfit ?? 0,
        previous: previousItems?.grossProfit ?? 0,
      },
      discountAmount: {
        current: currentSales?.discountAmount ?? 0,
        previous: previousSales?.discountAmount ?? 0,
      },
      averageTransactionAmount: {
        current: currentSales?.averageTransactionAmount ?? 0,
        previous: previousSales?.averageTransactionAmount ?? 0,
      },
      voidRefundImpact: voidRefundRows[0]?.amount ?? 0,
      voidRefundCount: voidRefundRows[0]?.transactionCount ?? 0,
      activeShiftCount: activeShiftRows[0]?.total ?? 0,
      pendingApprovalCount: pendingApprovalRows[0]?.total ?? 0,
      availableStockCount: availableStockRows[0]?.total ?? 0,
      stockReturnCount: stockReturnRows[0]?.total ?? 0,
    },
    salesTrend,
    paymentBreakdown,
    outletPerformance,
    recentSales,
    cashSnapshot,
  };
}

function createEmptySalesData(
  auth: AuthContext,
  filters: ReportSalesFilters,
  period: ReportPeriodMetadata,
): ReportSalesData {
  return {
    filters,
    period,
    outlets: auth.outlets,
    selectedOutlet: null,
    summary: {
      grossRevenue: 0,
      completedTransactionCount: 0,
      allTransactionCount: 0,
      itemSold: 0,
      weightSoldGram: 0,
      grossProfit: 0,
      discountAmount: 0,
      averageTransactionAmount: 0,
      voidRefundImpact: 0,
      voidRefundCount: 0,
      cashRevenue: 0,
      nonCashRevenue: 0,
    },
    dailySales: createTrendSkeleton(period.trendStart, period.trendEnd).map(
      (point) => ({ ...point, itemSold: 0, grossProfit: 0 }),
    ),
    paymentBreakdown: [],
    statusBreakdown: [],
    topOutlets: [],
    sales: [],
  };
}

function buildPaymentMethodCondition(
  filters: Pick<ReportSalesFilters, "paymentMethod">,
) {
  if (filters.paymentMethod === "all") return undefined;

  return sql<boolean>`exists (
    select 1
    from payments as report_payment_filter
    where report_payment_filter.sale_id = ${sales.id}
      and report_payment_filter.method = ${filters.paymentMethod}
  )`;
}

function buildSalesSearchCondition(filters: Pick<ReportSalesFilters, "query">) {
  if (!filters.query) return undefined;

  const keyword = `%${filters.query}%`;

  return or(
    ilike(sales.invoiceNumber, keyword),
    ilike(customers.fullName, keyword),
    ilike(users.fullName, keyword),
    ilike(outlets.name, keyword),
    ilike(outlets.code, keyword),
  );
}

function isReportPaymentMethod(value: string): value is ReportPaymentMethod {
  return (
    value === "cash" ||
    value === "debit_card" ||
    value === "credit_card" ||
    value === "bank_transfer" ||
    value === "qris_manual" ||
    value === "qris_gateway" ||
    value === "other"
  );
}

function toPaymentMethods(value: unknown): ReportPaymentMethod[] {
  const rawMethods = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .replace(/^\{/, "")
          .replace(/\}$/, "")
          .split(",")
          .map((method) => method.replace(/^"|"$/g, "").trim())
          .filter(Boolean)
      : [];

  return rawMethods
    .map((method) => String(method))
    .filter(isReportPaymentMethod);
}

export async function getReportSalesData(
  auth: AuthContext,
  filters: ReportSalesFilters,
  options: { rowLimit?: number } = {},
): Promise<ReportSalesData> {
  const outletIds = getAccessibleOutletIds(auth, filters.outletId);
  const now = new Date();
  const period = createPeriodMetadata({ range: filters.range, now });
  const selectedOutlet = filters.outletId
    ? auth.outlets.find((outlet) => outlet.id === filters.outletId) ?? null
    : null;

  if (outletIds.length === 0) {
    return createEmptySalesData(auth, filters, period);
  }

  const paymentMethodCondition = buildPaymentMethodCondition(filters);
  const searchCondition = buildSalesSearchCondition(filters);
  const activityAtSql = sql<Date>`coalesce(${sales.completedAt}, ${sales.cancelledAt}, ${sales.createdAt})`;
  const completedSalesWhere = and(
    eq(sales.organizationId, auth.organization.id),
    inArray(sales.outletId, outletIds),
    eq(sales.status, "completed"),
    gte(sales.completedAt, period.currentStart),
    lt(sales.completedAt, period.currentEnd),
    paymentMethodCondition,
  );
  const listSalesWhere = and(
    eq(sales.organizationId, auth.organization.id),
    inArray(sales.outletId, outletIds),
    sql<boolean>`${activityAtSql} >= ${period.currentStart}`,
    sql<boolean>`${activityAtSql} < ${period.currentEnd}`,
    filters.status === "all" ? undefined : eq(sales.status, filters.status),
    paymentMethodCondition,
    searchCondition,
  );
  const dailyBucketSql = sql<string>`to_char(${sales.completedAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;

  const [
    salesSummaryRows,
    itemSummaryRows,
    voidRefundRows,
    cashRevenueRows,
    allTransactionRows,
    dailySalesRows,
    dailyItemRows,
    paymentRows,
    statusRows,
    topOutletRows,
    saleRows,
  ] = await Promise.all([
    db
      .select({
        grossRevenue: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        completedTransactionCount: count(),
        discountAmount: sql<number>`coalesce(sum(${sales.discountAmount}), 0)`.mapWith(Number),
        averageTransactionAmount: sql<number>`coalesce(avg(${sales.totalAmount}), 0)`.mapWith(Number),
      })
      .from(sales)
      .where(completedSalesWhere),

    db
      .select({
        itemSold: count(),
        weightSoldGram: sql<number>`coalesce(sum(coalesce(${productItems.weightGram}, 0)::numeric), 0)`.mapWith(Number),
        grossProfit: sql<number>`coalesce(sum(${saleItems.finalPriceAmount}::numeric - coalesce(${productItems.costAmount}, 0)::numeric), 0)`.mapWith(Number),
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
      .where(completedSalesWhere),

    db
      .select({
        amount: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        transactionCount: count(),
      })
      .from(sales)
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          or(eq(sales.status, "voided"), eq(sales.status, "refunded")),
          gte(sales.cancelledAt, period.currentStart),
          lt(sales.cancelledAt, period.currentEnd),
          paymentMethodCondition,
        ),
      ),

    db
      .select({
        cashRevenue: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number),
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          eq(sales.status, "completed"),
          eq(payments.status, "paid"),
          eq(payments.method, "cash"),
          gte(sales.completedAt, period.currentStart),
          lt(sales.completedAt, period.currentEnd),
        ),
      ),

    db
      .select({ transactionCount: count() })
      .from(sales)
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .innerJoin(users, eq(sales.cashierId, users.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(listSalesWhere),

    db
      .select({
        bucket: dailyBucketSql,
        revenue: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        transactionCount: count(),
      })
      .from(sales)
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          eq(sales.status, "completed"),
          gte(sales.completedAt, period.trendStart),
          lt(sales.completedAt, period.trendEnd),
          paymentMethodCondition,
        ),
      )
      .groupBy(dailyBucketSql)
      .orderBy(dailyBucketSql),

    db
      .select({
        bucket: dailyBucketSql,
        itemSold: count(),
        grossProfit: sql<number>`coalesce(sum(${saleItems.finalPriceAmount}::numeric - coalesce(${productItems.costAmount}, 0)::numeric), 0)`.mapWith(Number),
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          eq(sales.status, "completed"),
          gte(sales.completedAt, period.trendStart),
          lt(sales.completedAt, period.trendEnd),
          paymentMethodCondition,
        ),
      )
      .groupBy(dailyBucketSql)
      .orderBy(dailyBucketSql),

    db
      .select({
        method: payments.method,
        amount: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number),
        transactionCount: count(),
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          eq(sales.status, "completed"),
          eq(payments.status, "paid"),
          gte(sales.completedAt, period.currentStart),
          lt(sales.completedAt, period.currentEnd),
        ),
      )
      .groupBy(payments.method)
      .orderBy(desc(sql`coalesce(sum(${payments.amount}), 0)`)),

    db
      .select({
        status: sales.status,
        transactionCount: count(),
        amount: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
      })
      .from(sales)
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .innerJoin(users, eq(sales.cashierId, users.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          sql<boolean>`${activityAtSql} >= ${period.currentStart}`,
          sql<boolean>`${activityAtSql} < ${period.currentEnd}`,
          paymentMethodCondition,
          searchCondition,
        ),
      )
      .groupBy(sales.status)
      .orderBy(desc(sql`count(*)`)),

    db
      .select({
        outletId: outlets.id,
        outletCode: outlets.code,
        outletName: outlets.name,
        revenue: sql<number>`coalesce(sum(${sales.totalAmount}), 0)`.mapWith(Number),
        transactionCount: count(),
        itemSold: sql<number>`(
          select count(*)::integer
          from ${saleItems} as report_top_sale_items
          inner join ${sales} as report_top_sales
            on report_top_sale_items.sale_id = report_top_sales.id
          where report_top_sales.outlet_id = ${outlets.id}
            and report_top_sales.organization_id = ${auth.organization.id}
            and report_top_sales.status = 'completed'
            and report_top_sales.completed_at >= ${period.currentStart}
            and report_top_sales.completed_at < ${period.currentEnd}
        )`.mapWith(Number),
      })
      .from(sales)
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .where(completedSalesWhere)
      .groupBy(outlets.id, outlets.code, outlets.name)
      .orderBy(desc(sql`coalesce(sum(${sales.totalAmount}), 0)`))
      .limit(5),

    db
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        outletName: outlets.name,
        outletCode: outlets.code,
        customerName: customers.fullName,
        cashierName: users.fullName,
        status: sales.status,
        subtotalAmount: sales.subtotalAmount,
        discountAmount: sales.discountAmount,
        totalAmount: sales.totalAmount,
        completedAt: sales.completedAt,
        cancelledAt: sales.cancelledAt,
        createdAt: sales.createdAt,
        itemCount: sql<number>`(
          select count(*)::integer
          from ${saleItems} as report_row_sale_items
          where report_row_sale_items.sale_id = ${sales.id}
        )`.mapWith(Number),
        weightSoldGram: sql<number>`coalesce((
          select sum(coalesce(report_row_product_items.weight_gram, 0)::numeric)
          from ${saleItems} as report_row_sale_items
          inner join ${productItems} as report_row_product_items
            on report_row_sale_items.product_item_id = report_row_product_items.id
          where report_row_sale_items.sale_id = ${sales.id}
        ), 0)`.mapWith(Number),
        grossProfit: sql<number>`coalesce((
          select sum(report_row_sale_items.final_price_amount::numeric - coalesce(report_row_product_items.cost_amount, 0)::numeric)
          from ${saleItems} as report_row_sale_items
          inner join ${productItems} as report_row_product_items
            on report_row_sale_items.product_item_id = report_row_product_items.id
          where report_row_sale_items.sale_id = ${sales.id}
        ), 0)`.mapWith(Number),
        paymentMethods: sql<ReportPaymentMethod[]>`coalesce(array_agg(distinct ${payments.method}) filter (where ${payments.id} is not null), '{}')`,
      })
      .from(sales)
      .innerJoin(outlets, eq(sales.outletId, outlets.id))
      .innerJoin(users, eq(sales.cashierId, users.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .leftJoin(payments, eq(payments.saleId, sales.id))
      .where(listSalesWhere)
      .groupBy(
        sales.id,
        sales.invoiceNumber,
        outlets.name,
        outlets.code,
        customers.fullName,
        users.fullName,
        sales.status,
        sales.subtotalAmount,
        sales.discountAmount,
        sales.totalAmount,
        sales.completedAt,
        sales.cancelledAt,
        sales.createdAt,
      )
      .orderBy(desc(activityAtSql))
      .limit(options.rowLimit ?? 50),
  ]);

  const salesSummary = salesSummaryRows[0];
  const itemSummary = itemSummaryRows[0];
  const voidRefund = voidRefundRows[0];
  const cashRevenue = cashRevenueRows[0]?.cashRevenue ?? 0;
  const grossRevenue = salesSummary?.grossRevenue ?? 0;

  const dailyRevenueMap = new Map(
    dailySalesRows.map((row) => [
      row.bucket,
      {
        revenue: row.revenue,
        transactionCount: row.transactionCount,
      },
    ]),
  );
  const dailyItemMap = new Map(
    dailyItemRows.map((row) => [
      row.bucket,
      {
        itemSold: row.itemSold,
        grossProfit: row.grossProfit,
      },
    ]),
  );

  const dailySales = createTrendSkeleton(period.trendStart, period.trendEnd).map(
    (point) => {
      const revenueSource = dailyRevenueMap.get(point.key);
      const itemSource = dailyItemMap.get(point.key);

      return {
        ...point,
        revenue: revenueSource?.revenue ?? 0,
        transactionCount: revenueSource?.transactionCount ?? 0,
        itemSold: itemSource?.itemSold ?? 0,
        grossProfit: itemSource?.grossProfit ?? 0,
      };
    },
  );

  const paymentTotal = paymentRows.reduce((total, row) => total + row.amount, 0);
  const paymentBreakdown: ReportSalesPaymentBreakdownRow[] = paymentRows.map(
    (row) => ({
      method: row.method,
      amount: row.amount,
      transactionCount: row.transactionCount,
      percentage: paymentTotal > 0 ? (row.amount / paymentTotal) * 100 : 0,
    }),
  );

  const statusBreakdown: ReportSalesStatusBreakdownRow[] = statusRows.map(
    (row) => ({
      status: row.status as ReportSaleStatus,
      transactionCount: row.transactionCount,
      amount: row.amount,
    }),
  );

  const topOutlets: ReportOutletPerformanceRow[] = topOutletRows.map((row) => ({
    outletId: row.outletId,
    outletCode: row.outletCode,
    outletName: row.outletName,
    revenue: row.revenue,
    transactionCount: row.transactionCount,
    itemSold: row.itemSold,
  }));

  const salesRows: ReportSalesRow[] = saleRows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    outletName: row.outletName,
    outletCode: row.outletCode,
    customerName: row.customerName,
    cashierName: row.cashierName,
    status: row.status as ReportSaleStatus,
    paymentMethods: toPaymentMethods(row.paymentMethods),
    subtotalAmount: parseAmount(row.subtotalAmount),
    discountAmount: parseAmount(row.discountAmount),
    totalAmount: parseAmount(row.totalAmount),
    itemCount: row.itemCount,
    weightSoldGram: row.weightSoldGram,
    grossProfit: row.grossProfit,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
  }));

  return {
    filters,
    period,
    outlets: auth.outlets,
    selectedOutlet,
    summary: {
      grossRevenue,
      completedTransactionCount: salesSummary?.completedTransactionCount ?? 0,
      allTransactionCount: allTransactionRows[0]?.transactionCount ?? 0,
      itemSold: itemSummary?.itemSold ?? 0,
      weightSoldGram: itemSummary?.weightSoldGram ?? 0,
      grossProfit: itemSummary?.grossProfit ?? 0,
      discountAmount: salesSummary?.discountAmount ?? 0,
      averageTransactionAmount: salesSummary?.averageTransactionAmount ?? 0,
      voidRefundImpact: voidRefund?.amount ?? 0,
      voidRefundCount: voidRefund?.transactionCount ?? 0,
      cashRevenue,
      nonCashRevenue: Math.max(grossRevenue - cashRevenue, 0),
    },
    dailySales,
    paymentBreakdown,
    statusBreakdown,
    topOutlets,
    sales: salesRows,
  };
}

function createEmptyStockData(
  auth: AuthContext,
  filters: ReportStockFilters,
  period: ReportPeriodMetadata,
): ReportStockData {
  return {
    filters,
    period,
    outlets: auth.outlets,
    selectedOutlet: null,
    summary: {
      availableItemCount: 0,
      availableWeightGram: 0,
      availableCostValue: 0,
      movementCount: 0,
      stockInCount: 0,
      stockOutCount: 0,
      saleCount: 0,
      returnCount: 0,
      adjustmentCount: 0,
    },
    movementTrend: createTrendSkeleton(period.trendStart, period.trendEnd).map(
      (point) => ({
        key: point.key,
        label: point.label,
        stockInCount: 0,
        stockOutCount: 0,
        returnCount: 0,
      }),
    ),
    outletStock: [],
    categoryStock: [],
    fastMovingProducts: [],
    slowMovingItems: [],
    movements: [],
  };
}

function createStockTrendSkeleton(
  period: ReportPeriodMetadata,
): ReportStockTrendPoint[] {
  return createTrendSkeleton(period.trendStart, period.trendEnd).map((point) => ({
    key: point.key,
    label: point.label,
    stockInCount: 0,
    stockOutCount: 0,
    returnCount: 0,
  }));
}

export async function getReportStockData(
  auth: AuthContext,
  filters: ReportStockFilters,
  options: { movementLimit?: number } = {},
): Promise<ReportStockData> {
  const outletIds = getAccessibleOutletIds(auth, filters.outletId);
  const now = new Date();
  const period = createPeriodMetadata({ range: filters.range, now });
  const selectedOutlet = filters.outletId
    ? auth.outlets.find((outlet) => outlet.id === filters.outletId) ?? null
    : null;

  if (outletIds.length === 0) {
    return createEmptyStockData(auth, filters, period);
  }

  const fromOutlet = alias(outlets, "report_stock_from_outlet");
  const toOutlet = alias(outlets, "report_stock_to_outlet");
  const currentOutlet = alias(outlets, "report_stock_current_outlet");
  const movementOutletCondition = or(
    inArray(inventoryMovements.fromOutletId, outletIds),
    inArray(inventoryMovements.toOutletId, outletIds),
    inArray(productItems.currentOutletId, outletIds),
  );
  const stockSearchKeyword = filters.query ? `%${filters.query}%` : null;
  const searchCondition = stockSearchKeyword
    ? or(
        ilike(productItems.sku, stockSearchKeyword),
        ilike(productItems.barcode, stockSearchKeyword),
        ilike(productItems.displayName, stockSearchKeyword),
        ilike(productMasters.code, stockSearchKeyword),
        ilike(productMasters.name, stockSearchKeyword),
        ilike(productCategories.name, stockSearchKeyword),
        ilike(fromOutlet.name, stockSearchKeyword),
        ilike(toOutlet.name, stockSearchKeyword),
        ilike(currentOutlet.name, stockSearchKeyword),
        ilike(users.fullName, stockSearchKeyword),
        ilike(inventoryMovements.reason, stockSearchKeyword),
        ilike(sales.invoiceNumber, stockSearchKeyword),
      )
    : undefined;
  const movementTypeCondition =
    filters.movementType === "all"
      ? undefined
      : eq(inventoryMovements.movementType, filters.movementType);
  const movementWhere = and(
    eq(inventoryMovements.organizationId, auth.organization.id),
    movementOutletCondition,
    gte(inventoryMovements.occurredAt, period.currentStart),
    lt(inventoryMovements.occurredAt, period.currentEnd),
    movementTypeCondition,
    searchCondition,
  );
  const availableStockWhere = and(
    eq(productItems.organizationId, auth.organization.id),
    eq(productItems.isActive, true),
    eq(productItems.availability, "available"),
    inArray(productItems.currentOutletId, outletIds),
  );
  const movementBucketSql = sql<string>`to_char(${inventoryMovements.occurredAt} at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`;
  const outletIdSqlList = sql.join(
    outletIds.map((outletId) => sql`${outletId}`),
    sql`, `,
  );

  const [
    stockSummaryRows,
    movementSummaryRows,
    trendRows,
    outletStockRows,
    categoryStockRows,
    fastMovingRows,
    slowMovingRows,
    movementRows,
  ] = await Promise.all([
    db
      .select({
        availableItemCount: count(),
        availableWeightGram: sql<number>`coalesce(sum(coalesce(${productItems.weightGram}, 0)::numeric), 0)`.mapWith(Number),
        availableCostValue: sql<number>`coalesce(sum(coalesce(${productItems.costAmount}, 0)::numeric), 0)`.mapWith(Number),
      })
      .from(productItems)
      .where(availableStockWhere),

    db
      .select({
        movementCount: count(),
        stockInCount: sql<number>`coalesce(sum(case when ${inventoryMovements.movementType} in ('goods_receipt', 'transfer_in', 'reservation_release', 'sale_return', 'repair_in', 'reversal') then 1 else 0 end), 0)`.mapWith(Number),
        stockOutCount: sql<number>`coalesce(sum(case when ${inventoryMovements.movementType} in ('sale', 'transfer_out', 'reservation', 'repair_out', 'damaged', 'lost') then 1 else 0 end), 0)`.mapWith(Number),
        saleCount: sql<number>`coalesce(sum(case when ${inventoryMovements.movementType} = 'sale' then 1 else 0 end), 0)`.mapWith(Number),
        returnCount: sql<number>`coalesce(sum(case when ${inventoryMovements.movementType} in ('sale_return', 'reversal') then 1 else 0 end), 0)`.mapWith(Number),
        adjustmentCount: sql<number>`coalesce(sum(case when ${inventoryMovements.movementType} in ('adjustment', 'damaged', 'lost') then 1 else 0 end), 0)`.mapWith(Number),
      })
      .from(inventoryMovements)
      .innerJoin(productItems, eq(inventoryMovements.itemId, productItems.id))
      .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
      .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
      .leftJoin(fromOutlet, eq(inventoryMovements.fromOutletId, fromOutlet.id))
      .leftJoin(toOutlet, eq(inventoryMovements.toOutletId, toOutlet.id))
      .leftJoin(currentOutlet, eq(productItems.currentOutletId, currentOutlet.id))
      .innerJoin(users, eq(inventoryMovements.performedBy, users.id))
      .leftJoin(
        sales,
        and(
          eq(inventoryMovements.referenceId, sales.id),
          or(
            eq(inventoryMovements.referenceType, "sale"),
            eq(inventoryMovements.referenceType, "sale_void"),
            eq(inventoryMovements.referenceType, "sale_refund"),
          ),
        ),
      )
      .where(movementWhere),

    db
      .select({
        bucket: movementBucketSql,
        stockInCount: sql<number>`coalesce(sum(case when ${inventoryMovements.movementType} in ('goods_receipt', 'transfer_in', 'reservation_release', 'sale_return', 'repair_in', 'reversal') then 1 else 0 end), 0)`.mapWith(Number),
        stockOutCount: sql<number>`coalesce(sum(case when ${inventoryMovements.movementType} in ('sale', 'transfer_out', 'reservation', 'repair_out', 'damaged', 'lost') then 1 else 0 end), 0)`.mapWith(Number),
        returnCount: sql<number>`coalesce(sum(case when ${inventoryMovements.movementType} in ('sale_return', 'reversal') then 1 else 0 end), 0)`.mapWith(Number),
      })
      .from(inventoryMovements)
      .innerJoin(productItems, eq(inventoryMovements.itemId, productItems.id))
      .where(
        and(
          eq(inventoryMovements.organizationId, auth.organization.id),
          movementOutletCondition,
          gte(inventoryMovements.occurredAt, period.trendStart),
          lt(inventoryMovements.occurredAt, period.trendEnd),
          movementTypeCondition,
        ),
      )
      .groupBy(movementBucketSql)
      .orderBy(movementBucketSql),

    db
      .select({
        outletId: outlets.id,
        outletCode: outlets.code,
        outletName: outlets.name,
        availableItemCount: count(),
        availableWeightGram: sql<number>`coalesce(sum(coalesce(${productItems.weightGram}, 0)::numeric), 0)`.mapWith(Number),
        availableCostValue: sql<number>`coalesce(sum(coalesce(${productItems.costAmount}, 0)::numeric), 0)`.mapWith(Number),
      })
      .from(productItems)
      .innerJoin(outlets, eq(productItems.currentOutletId, outlets.id))
      .where(availableStockWhere)
      .groupBy(outlets.id, outlets.code, outlets.name)
      .orderBy(desc(sql`count(*)`)),

    db
      .select({
        categoryId: productCategories.id,
        categoryName: productCategories.name,
        itemCount: count(),
        weightGram: sql<number>`coalesce(sum(coalesce(${productItems.weightGram}, 0)::numeric), 0)`.mapWith(Number),
        costValue: sql<number>`coalesce(sum(coalesce(${productItems.costAmount}, 0)::numeric), 0)`.mapWith(Number),
      })
      .from(productItems)
      .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
      .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
      .where(availableStockWhere)
      .groupBy(productCategories.id, productCategories.name)
      .orderBy(desc(sql`count(*)`))
      .limit(8),

    db
      .select({
        productId: productMasters.id,
        productCode: productMasters.code,
        productName: productMasters.name,
        categoryName: productCategories.name,
        soldCount: count(),
        soldWeightGram: sql<number>`coalesce(sum(coalesce(${productItems.weightGram}, 0)::numeric), 0)`.mapWith(Number),
        revenue: sql<number>`coalesce(sum(${saleItems.finalPriceAmount}::numeric), 0)`.mapWith(Number),
        availableCount: sql<number>`(
          select count(*)::integer
          from ${productItems} as report_available_product_items
          where report_available_product_items.product_master_id = ${productMasters.id}
            and report_available_product_items.organization_id = ${auth.organization.id}
            and report_available_product_items.availability = 'available'
            and report_available_product_items.current_outlet_id in (${outletIdSqlList})
        )`.mapWith(Number),
      })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
      .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
      .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
      .where(
        and(
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, outletIds),
          eq(sales.status, "completed"),
          gte(sales.completedAt, period.currentStart),
          lt(sales.completedAt, period.currentEnd),
        ),
      )
      .groupBy(
        productMasters.id,
        productMasters.code,
        productMasters.name,
        productCategories.name,
      )
      .orderBy(desc(sql`count(*)`), desc(sql`coalesce(sum(${saleItems.finalPriceAmount}::numeric), 0)`))
      .limit(6),

    db
      .select({
        itemId: productItems.id,
        sku: productItems.sku,
        barcode: productItems.barcode,
        productName: sql<string>`coalesce(${productItems.displayName}, ${productMasters.name})`,
        outletName: outlets.name,
        weightGram: productItems.weightGram,
        sellingAmount: productItems.sellingAmount,
        stockAgeDays: sql<number>`greatest(0, floor(extract(epoch from (now() - ${productItems.createdAt})) / 86400))`.mapWith(Number),
        createdAt: productItems.createdAt,
      })
      .from(productItems)
      .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
      .leftJoin(outlets, eq(productItems.currentOutletId, outlets.id))
      .where(availableStockWhere)
      .orderBy(productItems.createdAt)
      .limit(6),

    db
      .select({
        id: inventoryMovements.id,
        itemId: productItems.id,
        sku: productItems.sku,
        barcode: productItems.barcode,
        productName: sql<string>`coalesce(${productItems.displayName}, ${productMasters.name})`,
        categoryName: productCategories.name,
        movementType: inventoryMovements.movementType,
        fromOutletName: fromOutlet.name,
        toOutletName: toOutlet.name,
        currentOutletName: currentOutlet.name,
        performerName: users.fullName,
        referenceType: inventoryMovements.referenceType,
        referenceId: inventoryMovements.referenceId,
        invoiceNumber: sales.invoiceNumber,
        reason: inventoryMovements.reason,
        weightGram: productItems.weightGram,
        costAmount: productItems.costAmount,
        sellingAmount: productItems.sellingAmount,
        occurredAt: inventoryMovements.occurredAt,
      })
      .from(inventoryMovements)
      .innerJoin(productItems, eq(inventoryMovements.itemId, productItems.id))
      .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
      .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
      .leftJoin(fromOutlet, eq(inventoryMovements.fromOutletId, fromOutlet.id))
      .leftJoin(toOutlet, eq(inventoryMovements.toOutletId, toOutlet.id))
      .leftJoin(currentOutlet, eq(productItems.currentOutletId, currentOutlet.id))
      .innerJoin(users, eq(inventoryMovements.performedBy, users.id))
      .leftJoin(
        sales,
        and(
          eq(inventoryMovements.referenceId, sales.id),
          or(
            eq(inventoryMovements.referenceType, "sale"),
            eq(inventoryMovements.referenceType, "sale_void"),
            eq(inventoryMovements.referenceType, "sale_refund"),
          ),
        ),
      )
      .where(movementWhere)
      .orderBy(desc(inventoryMovements.occurredAt))
      .limit(options.movementLimit ?? 80),
  ]);

  const stockSummary = stockSummaryRows[0];
  const movementSummary = movementSummaryRows[0];
  const trendMap = new Map(
    trendRows.map((row) => [
      row.bucket,
      {
        stockInCount: row.stockInCount,
        stockOutCount: row.stockOutCount,
        returnCount: row.returnCount,
      },
    ]),
  );
  const movementTrend = createStockTrendSkeleton(period).map((point) => {
    const source = trendMap.get(point.key);

    return {
      ...point,
      stockInCount: source?.stockInCount ?? 0,
      stockOutCount: source?.stockOutCount ?? 0,
      returnCount: source?.returnCount ?? 0,
    };
  });
  const outletStock: ReportStockOutletRow[] = outletStockRows.map((row) => ({
    outletId: row.outletId,
    outletCode: row.outletCode,
    outletName: row.outletName,
    availableItemCount: row.availableItemCount,
    availableWeightGram: row.availableWeightGram,
    availableCostValue: row.availableCostValue,
  }));
  const categoryStock: ReportStockCategoryRow[] = categoryStockRows.map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    itemCount: row.itemCount,
    weightGram: row.weightGram,
    costValue: row.costValue,
  }));
  const fastMovingProducts: ReportStockProductPerformanceRow[] = fastMovingRows.map(
    (row) => ({
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      categoryName: row.categoryName,
      soldCount: row.soldCount,
      soldWeightGram: row.soldWeightGram,
      revenue: row.revenue,
      availableCount: row.availableCount,
    }),
  );
  const slowMovingItems: ReportSlowMovingStockRow[] = slowMovingRows.map((row) => ({
    itemId: row.itemId,
    sku: row.sku,
    barcode: row.barcode,
    productName: row.productName,
    outletName: row.outletName,
    weightGram: parseAmount(row.weightGram),
    sellingAmount: parseAmount(row.sellingAmount),
    stockAgeDays: row.stockAgeDays,
    createdAt: row.createdAt,
  }));
  const movements: ReportStockMovementRow[] = movementRows.map((row) => ({
    id: row.id,
    itemId: row.itemId,
    sku: row.sku,
    barcode: row.barcode,
    productName: row.productName,
    categoryName: row.categoryName,
    movementType: row.movementType as ReportInventoryMovementType,
    fromOutletName: row.fromOutletName,
    toOutletName: row.toOutletName,
    currentOutletName: row.currentOutletName,
    performerName: row.performerName,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    invoiceNumber: row.invoiceNumber,
    reason: row.reason,
    weightGram: parseAmount(row.weightGram),
    costAmount: parseAmount(row.costAmount),
    sellingAmount: parseAmount(row.sellingAmount),
    occurredAt: row.occurredAt,
  }));

  return {
    filters,
    period,
    outlets: auth.outlets,
    selectedOutlet,
    summary: {
      availableItemCount: stockSummary?.availableItemCount ?? 0,
      availableWeightGram: stockSummary?.availableWeightGram ?? 0,
      availableCostValue: stockSummary?.availableCostValue ?? 0,
      movementCount: movementSummary?.movementCount ?? 0,
      stockInCount: movementSummary?.stockInCount ?? 0,
      stockOutCount: movementSummary?.stockOutCount ?? 0,
      saleCount: movementSummary?.saleCount ?? 0,
      returnCount: movementSummary?.returnCount ?? 0,
      adjustmentCount: movementSummary?.adjustmentCount ?? 0,
    },
    movementTrend,
    outletStock,
    categoryStock,
    fastMovingProducts,
    slowMovingItems,
    movements,
  };
}
