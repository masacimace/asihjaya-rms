export type ReportPeriodRange = "today" | "yesterday" | "last7" | "last30" | "thisMonth";

export type ReportSummaryFilters = {
  range: ReportPeriodRange;
  outletId: string | null;
};

export type ReportPeriodMetadata = {
  range: ReportPeriodRange;
  label: string;
  description: string;
  comparisonLabel: string;
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  trendStart: Date;
  trendEnd: Date;
};

export type ReportComparisonMetric = {
  current: number;
  previous: number;
};

export type ReportSaleStatus =
  | "draft"
  | "awaiting_payment"
  | "completed"
  | "cancelled"
  | "voided"
  | "partially_refunded"
  | "refunded";

export type ReportPaymentMethod =
  | "cash"
  | "debit_card"
  | "credit_card"
  | "bank_transfer"
  | "qris_manual"
  | "qris_gateway"
  | "other";

export type ReportSummaryData = {
  filters: ReportSummaryFilters;
  period: ReportPeriodMetadata;
  outlets: Array<{
    id: string;
    code: string;
    name: string;
    isPrimary: boolean;
  }>;
  selectedOutlet: {
    id: string;
    code: string;
    name: string;
  } | null;
  summary: {
    revenue: ReportComparisonMetric;
    transactionCount: ReportComparisonMetric;
    itemSold: ReportComparisonMetric;
    weightSoldGram: ReportComparisonMetric;
    grossProfit: ReportComparisonMetric;
    discountAmount: ReportComparisonMetric;
    averageTransactionAmount: ReportComparisonMetric;
    voidRefundImpact: number;
    voidRefundCount: number;
    activeShiftCount: number;
    pendingApprovalCount: number;
    availableStockCount: number;
    stockReturnCount: number;
  };
  salesTrend: ReportTrendPoint[];
  paymentBreakdown: ReportPaymentBreakdownRow[];
  outletPerformance: ReportOutletPerformanceRow[];
  recentSales: ReportRecentSaleRow[];
  cashSnapshot: ReportCashSnapshot;
};

export type ReportTrendPoint = {
  key: string;
  label: string;
  revenue: number;
  transactionCount: number;
};

export type ReportPaymentBreakdownRow = {
  method: ReportPaymentMethod;
  amount: number;
  transactionCount: number;
};

export type ReportOutletPerformanceRow = {
  outletId: string;
  outletCode: string;
  outletName: string;
  revenue: number;
  transactionCount: number;
  itemSold: number;
};

export type ReportRecentSaleRow = {
  id: string;
  invoiceNumber: string;
  outletName: string;
  customerName: string | null;
  cashierName: string;
  status: ReportSaleStatus;
  totalAmount: number;
  completedAt: Date | null;
  createdAt: Date;
};

export type ReportCashSnapshot = {
  cashSales: number;
  cashRefunds: number;
  manualCashIn: number;
  manualCashOut: number;
  closingAdjustments: number;
  netCashMovement: number;
};

export type ReportSalesStatusFilter = "all" | ReportSaleStatus;
export type ReportSalesPaymentFilter = "all" | ReportPaymentMethod;

export type ReportSalesFilters = ReportSummaryFilters & {
  query: string;
  status: ReportSalesStatusFilter;
  paymentMethod: ReportSalesPaymentFilter;
};

export type ReportSalesSummary = {
  grossRevenue: number;
  completedTransactionCount: number;
  allTransactionCount: number;
  itemSold: number;
  weightSoldGram: number;
  grossProfit: number;
  discountAmount: number;
  averageTransactionAmount: number;
  voidRefundImpact: number;
  voidRefundCount: number;
  cashRevenue: number;
  nonCashRevenue: number;
};

export type ReportSalesStatusBreakdownRow = {
  status: ReportSaleStatus;
  transactionCount: number;
  amount: number;
};

export type ReportSalesPaymentBreakdownRow = ReportPaymentBreakdownRow & {
  percentage: number;
};

export type ReportSalesDailyPoint = ReportTrendPoint & {
  itemSold: number;
  grossProfit: number;
};

export type ReportSalesRow = {
  id: string;
  invoiceNumber: string;
  outletName: string;
  outletCode: string;
  customerName: string | null;
  cashierName: string;
  status: ReportSaleStatus;
  paymentMethods: ReportPaymentMethod[];
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  itemCount: number;
  weightSoldGram: number;
  grossProfit: number;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
};

export type ReportSalesData = {
  filters: ReportSalesFilters;
  period: ReportPeriodMetadata;
  outlets: ReportSummaryData["outlets"];
  selectedOutlet: ReportSummaryData["selectedOutlet"];
  summary: ReportSalesSummary;
  dailySales: ReportSalesDailyPoint[];
  paymentBreakdown: ReportSalesPaymentBreakdownRow[];
  statusBreakdown: ReportSalesStatusBreakdownRow[];
  topOutlets: ReportOutletPerformanceRow[];
  sales: ReportSalesRow[];
};

export const reportPeriodOptions: Array<{
  value: ReportPeriodRange;
  label: string;
}> = [
  { value: "today", label: "Hari ini" },
  { value: "yesterday", label: "Kemarin" },
  { value: "last7", label: "7 hari terakhir" },
  { value: "last30", label: "30 hari terakhir" },
  { value: "thisMonth", label: "Bulan ini" },
];

export const reportSalesStatusOptions: Array<{
  value: ReportSalesStatusFilter;
  label: string;
}> = [
  { value: "all", label: "Semua status" },
  { value: "completed", label: "Selesai" },
  { value: "voided", label: "Void" },
  { value: "refunded", label: "Refund" },
  { value: "partially_refunded", label: "Refund parsial" },
  { value: "cancelled", label: "Dibatalkan" },
  { value: "awaiting_payment", label: "Menunggu bayar" },
  { value: "draft", label: "Draft" },
];

export const reportPaymentMethodOptions: Array<{
  value: ReportSalesPaymentFilter;
  label: string;
}> = [
  { value: "all", label: "Semua metode bayar" },
  { value: "cash", label: "Cash" },
  { value: "debit_card", label: "Debit Card" },
  { value: "credit_card", label: "Credit Card" },
  { value: "bank_transfer", label: "Transfer Bank" },
  { value: "qris_manual", label: "QRIS Manual" },
  { value: "qris_gateway", label: "QRIS Gateway" },
  { value: "other", label: "Lainnya" },
];

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseReportSummaryFilters(
  params: Record<string, string | string[] | undefined>,
): ReportSummaryFilters {
  const rawRange = getSingleParam(params.range);
  const rawOutletId = getSingleParam(params.outletId);

  const range: ReportPeriodRange =
    rawRange === "yesterday" ||
    rawRange === "last7" ||
    rawRange === "last30" ||
    rawRange === "thisMonth"
      ? rawRange
      : "today";

  return {
    range,
    outletId: rawOutletId && rawOutletId !== "all" ? rawOutletId : null,
  };
}

export function parseReportSalesFilters(
  params: Record<string, string | string[] | undefined>,
): ReportSalesFilters {
  const baseFilters = parseReportSummaryFilters(params);
  const rawQuery = getSingleParam(params.q)?.trim() ?? "";
  const rawStatus = getSingleParam(params.status);
  const rawPaymentMethod = getSingleParam(params.paymentMethod);

  const status: ReportSalesStatusFilter = reportSalesStatusOptions.some(
    (option) => option.value === rawStatus,
  )
    ? (rawStatus as ReportSalesStatusFilter)
    : "all";

  const paymentMethod: ReportSalesPaymentFilter = reportPaymentMethodOptions.some(
    (option) => option.value === rawPaymentMethod,
  )
    ? (rawPaymentMethod as ReportSalesPaymentFilter)
    : "all";

  return {
    ...baseFilters,
    query: rawQuery,
    status,
    paymentMethod,
  };
}
