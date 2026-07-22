export const ADMIN_SALES_PAGE_SIZE = 20;

export const adminSaleStatuses = [
  "draft",
  "awaiting_payment",
  "completed",
  "cancelled",
  "voided",
  "partially_refunded",
  "refunded",
] as const;

export const adminPaymentMethods = [
  "cash",
  "debit_card",
  "credit_card",
  "bank_transfer",
  "qris_manual",
  "qris_gateway",
  "other",
] as const;

export const adminSalesDateRanges = [
  "today",
  "yesterday",
  "last7",
  "last30",
  "thisMonth",
  "all",
] as const;

export type AdminSaleStatus = (typeof adminSaleStatuses)[number];
export type AdminPaymentMethod = (typeof adminPaymentMethods)[number];

export const activeAdminPaymentMethodOptions = [
  "cash",
  "debit_card",
  "credit_card",
] as const satisfies readonly AdminPaymentMethod[];
export type AdminSalesDateRange = (typeof adminSalesDateRanges)[number];

export type AdminSalesFilters = {
  search: string;
  outletId: string | null;
  status: AdminSaleStatus | null;
  paymentMethod: AdminPaymentMethod | null;
  dateRange: AdminSalesDateRange;
  page: number;
};

export type AdminSalesPeriod = {
  range: AdminSalesDateRange;
  label: string;
  start: Date | null;
  end: Date | null;
};

export type AdminSalesOutletOption = {
  id: string;
  code: string;
  name: string;
  isPrimary: boolean;
};

export type AdminSalesPaymentSummary = {
  method: AdminPaymentMethod;
  amount: number;
  paymentCount: number;
  transactionCount: number;
};

export type AdminSalesSummary = {
  totalTransactions: number;
  totalAmount: number;
  paidAmount: number;
  averageTransactionAmount: number;
  totalItems: number;
  cashAmount: number;
  nonCashAmount: number;
};

export type AdminSaleListPayment = {
  method: AdminPaymentMethod;
  provider: string;
  amount: string;
  status: string;
  providerReference: string | null;
};

export type AdminSaleListItemPreview = {
  productItemId: string;
  sku: string;
  barcode: string;
  productName: string;
  categoryName: string;
  finalPriceAmount: string;
};

export type AdminSalePrintStatus =
  | "not_queued"
  | "pending"
  | "claimed"
  | "processing"
  | "printing"
  | "submitted"
  | "completed"
  | "failed"
  | "unknown_outcome"
  | "expired"
  | "cancelled";

export type AdminSaleListRow = {
  id: string;
  invoiceNumber: string;
  status: AdminSaleStatus;
  subtotalAmount: string;
  discountAmount: string;
  additionalFeeAmount: string;
  totalAmount: string;
  paidAmount: number;
  refundedAmount: number;
  paymentStatus: "paid" | "partial" | "pending";
  completedAt: Date | null;
  createdAt: Date;
  outletId: string;
  outletCode: string;
  outletName: string;
  registerName: string;
  cashierName: string;
  customerCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  totalItems: number;
  items: AdminSaleListItemPreview[];
  payments: AdminSaleListPayment[];
  paymentMethods: AdminPaymentMethod[];
  printStatus: AdminSalePrintStatus;
};


export type AdminSalesExportItem = {
  productName: string;
  sku: string;
  barcode: string;
  categoryName: string;
  finalPriceAmount: string;
};

export type AdminSalesExportRow = {
  id: string;
  invoiceNumber: string;
  status: AdminSaleStatus;
  subtotalAmount: string;
  discountAmount: string;
  additionalFeeAmount: string;
  totalAmount: string;
  paidAmount: number;
  refundedAmount: number;
  receivedAmount: number;
  changeAmount: number;
  completedAt: Date | null;
  createdAt: Date;
  outletCode: string;
  outletName: string;
  registerCode: string;
  registerName: string;
  cashierName: string;
  customerCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  totalItems: number;
  items: AdminSalesExportItem[];
  paymentMethods: AdminPaymentMethod[];
  printStatus: AdminSalePrintStatus;
};

export type AdminSalesListData = {
  filters: AdminSalesFilters;
  period: AdminSalesPeriod;
  outlets: AdminSalesOutletOption[];
  rows: AdminSaleListRow[];
  summary: AdminSalesSummary;
  paymentSummary: AdminSalesPaymentSummary[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

export type AdminSaleDetailPayment = AdminSaleListPayment & {
  id: string;
  paidAt: Date | null;
  verifiedAt: Date | null;
  receivedAmount: number | null;
  changeAmount: number | null;
  note: string | null;
  verificationStatus:
    | "self_verified"
    | "co_verification_required"
    | "co_verified"
    | "rejected";
  verificationSource: string | null;
  providerPaidAt: Date | null;
  coVerifiedAt: Date | null;
  coVerifiedByName: string | null;
  evidenceKey: string | null;
  settlementStatus:
    | "not_applicable"
    | "unreconciled"
    | "pending_settlement"
    | "reconciled"
    | "mismatch"
    | "not_found"
    | "waived";
  verificationDetails: Record<string, string | null>;
};

export type AdminSaleDetailItem = AdminSaleListItemPreview & {
  id: string;
  lineNumber: number;
  serialNumber: string | null;
  weightGram: string | null;
  purityPercent: string | null;
  exchangePurityPercent: string | null;
  size: string | null;
  color: string | null;
  gemstone: string | null;
  listPriceAmount: string;
  discountAmount: string;
};

export type AdminSaleHardwareJob = {
  id: string;
  jobType: string;
  deviceType: string;
  status: AdminSalePrintStatus;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
};


export type AdminSaleSensitiveApprovalExecutionStatus =
  | "awaiting_r3c_2"
  | "void_executed"
  | "refund_executed"
  | "executing"
  | "failed"
  | "cancelled"
  | null;

export type AdminSaleSensitiveApproval = {
  id: string;
  type: "void_receipt" | "refund_transaction";
  status: "pending" | "approved" | "rejected";
  requestedByName: string;
  approvedByName: string | null;
  notes: string | null;
  responseNotes: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  requestData: Record<string, unknown>;
  executionStatus: AdminSaleSensitiveApprovalExecutionStatus;
  executionError: string | null;
  executedAt: Date | null;
  executedByName: string | null;
};

export type AdminSaleAuditLog = {
  id: string;
  action: string;
  entityType: string;
  reason: string | null;
  actorName: string | null;
  createdAt: Date;
};

export type AdminSaleTimelineEvent = {
  id: string;
  label: string;
  description: string;
  createdAt: Date;
  tone: "neutral" | "success" | "warning" | "danger";
};

export type AdminSaleDetailData = {
  id: string;
  invoiceNumber: string;
  status: AdminSaleStatus;
  subtotalAmount: string;
  discountAmount: string;
  discountReason: string | null;
  additionalFeeAmount: string;
  totalAmount: string;
  paidAmount: number;
  paymentStatus: "paid" | "partial" | "pending";
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  notes: string | null;
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  register: {
    id: string;
    code: string;
    name: string;
  };
  shift: {
    id: string;
    status: string | null;
    openedAt: Date | null;
    closedAt: Date | null;
  };
  cashier: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    code: string | null;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  items: AdminSaleDetailItem[];
  payments: AdminSaleDetailPayment[];
  hardwareJobs: AdminSaleHardwareJob[];
  auditLogs: AdminSaleAuditLog[];
  sensitiveApprovals: AdminSaleSensitiveApproval[];
  timeline: AdminSaleTimelineEvent[];
  receiptCertificate: {
    isReady: boolean;
    downloadHref: string;
    htmlHref: string;
    verificationUrl: string | null;
  };
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function isAdminSaleStatus(value: string): value is AdminSaleStatus {
  return adminSaleStatuses.includes(value as AdminSaleStatus);
}

function isAdminPaymentMethod(value: string): value is AdminPaymentMethod {
  return adminPaymentMethods.includes(value as AdminPaymentMethod);
}

function isAdminSalesDateRange(value: string): value is AdminSalesDateRange {
  return adminSalesDateRanges.includes(value as AdminSalesDateRange);
}

export function parseAdminSalesFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminSalesFilters {
  const search = readSearchParam(searchParams.q).trim().slice(0, 160);
  const outletIdRaw = readSearchParam(searchParams.outletId).trim();
  const statusRaw = readSearchParam(searchParams.status).trim();
  const paymentMethodRaw = readSearchParam(searchParams.paymentMethod).trim();
  const dateRangeRaw = readSearchParam(searchParams.range).trim();
  const parsedPage = Number.parseInt(readSearchParam(searchParams.page), 10);

  return {
    search,
    outletId: isUuid(outletIdRaw) ? outletIdRaw : null,
    status: isAdminSaleStatus(statusRaw) ? statusRaw : null,
    paymentMethod: isAdminPaymentMethod(paymentMethodRaw)
      ? paymentMethodRaw
      : null,
    dateRange: isAdminSalesDateRange(dateRangeRaw) ? dateRangeRaw : "today",
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}
