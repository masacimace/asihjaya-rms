import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  approvals,
  cashMovements,
  customers,
  inventoryMovements,
  outlets,
  payments,
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
  ReportPeriodMetadata,
  ReportPeriodRange,
  ReportRecentSaleRow,
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
