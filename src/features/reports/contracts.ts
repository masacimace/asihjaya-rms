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



export type ReportInventoryMovementType =
  | "goods_receipt"
  | "sale"
  | "sale_return"
  | "transfer_out"
  | "transfer_in"
  | "reservation"
  | "reservation_release"
  | "adjustment"
  | "damaged"
  | "lost"
  | "repair_out"
  | "repair_in"
  | "reversal";

export type ReportStockMovementFilter = "all" | ReportInventoryMovementType;

export type ReportStockFilters = ReportSummaryFilters & {
  query: string;
  movementType: ReportStockMovementFilter;
};

export type ReportStockSummary = {
  availableItemCount: number;
  availableWeightGram: number;
  availableCostValue: number;
  movementCount: number;
  stockInCount: number;
  stockOutCount: number;
  saleCount: number;
  returnCount: number;
  adjustmentCount: number;
};

export type ReportStockTrendPoint = {
  key: string;
  label: string;
  stockInCount: number;
  stockOutCount: number;
  returnCount: number;
};

export type ReportStockOutletRow = {
  outletId: string;
  outletCode: string;
  outletName: string;
  availableItemCount: number;
  availableWeightGram: number;
  availableCostValue: number;
};

export type ReportStockCategoryRow = {
  categoryId: string;
  categoryName: string;
  itemCount: number;
  weightGram: number;
  costValue: number;
};

export type ReportStockProductPerformanceRow = {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string;
  soldCount: number;
  soldWeightGram: number;
  revenue: number;
  availableCount: number;
};

export type ReportSlowMovingStockRow = {
  itemId: string;
  sku: string;
  barcode: string;
  productName: string;
  outletName: string | null;
  weightGram: number;
  sellingAmount: number;
  stockAgeDays: number;
  createdAt: Date;
};

export type ReportStockMovementRow = {
  id: string;
  itemId: string;
  sku: string;
  barcode: string;
  productName: string;
  categoryName: string;
  movementType: ReportInventoryMovementType;
  fromOutletName: string | null;
  toOutletName: string | null;
  currentOutletName: string | null;
  performerName: string;
  referenceType: string | null;
  referenceId: string | null;
  invoiceNumber: string | null;
  reason: string | null;
  weightGram: number;
  costAmount: number;
  sellingAmount: number;
  occurredAt: Date;
};

export type ReportStockData = {
  filters: ReportStockFilters;
  period: ReportPeriodMetadata;
  outlets: ReportSummaryData["outlets"];
  selectedOutlet: ReportSummaryData["selectedOutlet"];
  summary: ReportStockSummary;
  movementTrend: ReportStockTrendPoint[];
  outletStock: ReportStockOutletRow[];
  categoryStock: ReportStockCategoryRow[];
  fastMovingProducts: ReportStockProductPerformanceRow[];
  slowMovingItems: ReportSlowMovingStockRow[];
  movements: ReportStockMovementRow[];
};

export const reportStockMovementOptions: Array<{
  value: ReportStockMovementFilter;
  label: string;
}> = [
  { value: "all", label: "Semua movement" },
  { value: "goods_receipt", label: "Barang masuk" },
  { value: "sale", label: "Terjual" },
  { value: "sale_return", label: "Retur penjualan" },
  { value: "reversal", label: "Reversal/Void" },
  { value: "transfer_out", label: "Transfer keluar" },
  { value: "transfer_in", label: "Transfer masuk" },
  { value: "reservation", label: "Reservasi" },
  { value: "reservation_release", label: "Lepas reservasi" },
  { value: "adjustment", label: "Adjustment" },
  { value: "damaged", label: "Rusak" },
  { value: "lost", label: "Hilang" },
  { value: "repair_out", label: "Keluar repair" },
  { value: "repair_in", label: "Masuk repair" },
];

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
  { value: "debit_card", label: "Debit EDC" },
  { value: "credit_card", label: "Credit EDC" },
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

export function parseReportStockFilters(
  params: Record<string, string | string[] | undefined>,
): ReportStockFilters {
  const baseFilters = parseReportSummaryFilters(params);
  const rawQuery = getSingleParam(params.q)?.trim() ?? "";
  const rawMovementType = getSingleParam(params.movementType);

  const movementType: ReportStockMovementFilter = reportStockMovementOptions.some(
    (option) => option.value === rawMovementType,
  )
    ? (rawMovementType as ReportStockMovementFilter)
    : "all";

  return {
    ...baseFilters,
    query: rawQuery,
    movementType,
  };
}

