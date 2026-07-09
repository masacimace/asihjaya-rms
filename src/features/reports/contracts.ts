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

export type ReportPaymentMethod =
  | "cash"
  | "debit_card"
  | "credit_card"
  | "bank_transfer"
  | "qris_manual"
  | "qris_gateway"
  | "other";

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
  status: "draft" | "awaiting_payment" | "completed" | "cancelled" | "voided" | "partially_refunded" | "refunded";
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
