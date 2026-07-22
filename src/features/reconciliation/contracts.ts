export const RECONCILIATION_PAGE_SIZE = 20;

export const reconciliationStatuses = [
  "unreconciled",
  "pending_settlement",
  "reconciled",
  "mismatch",
  "not_found",
  "waived",
] as const;

export const reconciliationFilterStatuses = [
  "all",
  ...reconciliationStatuses,
] as const;

export const reconciliationPaymentMethods = [
  "debit_card",
  "credit_card",
] as const;

export const reconciliationDateRanges = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "all",
] as const;

export type ReconciliationStatus = (typeof reconciliationStatuses)[number];
export type ReconciliationFilterStatus =
  (typeof reconciliationFilterStatuses)[number];
export type ReconciliationPaymentMethod =
  (typeof reconciliationPaymentMethods)[number];
export type ReconciliationDateRange =
  (typeof reconciliationDateRanges)[number];

export type ReconciliationFilters = {
  search: string;
  outletId: string | null;
  profileId: string | null;
  method: ReconciliationPaymentMethod | null;
  status: ReconciliationFilterStatus;
  range: ReconciliationDateRange;
  page: number;
};

export type ReconciliationListRow = {
  paymentId: string;
  saleId: string;
  invoiceNumber: string;
  saleStatus: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  registerName: string;
  cashierName: string;
  method: ReconciliationPaymentMethod;
  provider: string;
  providerReference: string | null;
  amount: string;
  paidAt: Date | null;
  paymentStatus: string;
  settlementStatus: ReconciliationStatus;
  profileId: string | null;
  profileName: string | null;
  profileCode: string | null;
  reconciliationId: string | null;
  settlementGrossAmount: string | null;
  feeAmount: string | null;
  taxAmount: string | null;
  netSettlementAmount: string | null;
  differenceAmount: string | null;
  settlementDate: Date | null;
  settlementReference: string | null;
  reconciledAt: Date | null;
  reconciledByName: string | null;
};

export type ReconciliationSummary = {
  totalCount: number;
  totalAmount: number;
  unreconciledCount: number;
  unreconciledAmount: number;
  pendingCount: number;
  pendingAmount: number;
  reconciledCount: number;
  reconciledGrossAmount: number;
  reconciledNetAmount: number;
  totalFeeAmount: number;
  mismatchCount: number;
  mismatchAbsoluteAmount: number;
  notFoundCount: number;
  waivedCount: number;
};

export type ReconciliationListData = {
  filters: ReconciliationFilters;
  outlets: Array<{ id: string; code: string; name: string }>;
  profiles: Array<{
    id: string;
    code: string;
    name: string;
    outletId: string;
    provider: string;
  }>;
  rows: ReconciliationListRow[];
  summary: ReconciliationSummary;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

export type ReconciliationDetailData = ReconciliationListRow & {
  paymentMetadata: Record<string, unknown>;
  verificationSource: string | null;
  providerPaidAt: Date | null;
  verificationStatus: string;
  evidenceKey: string | null;
  reconciliationEvidenceKey: string | null;
  reconciliationNotes: string | null;
  resolvedAt: Date | null;
  resolvedByName: string | null;
  createdAt: Date;
};

function getParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseReconciliationFilters(
  params: Record<string, string | string[] | undefined>,
): ReconciliationFilters {
  const rawStatus = getParam(params.status);
  const rawMethod = getParam(params.method);
  const rawRange = getParam(params.range);
  const parsedPage = Number(getParam(params.page));

  return {
    search: (getParam(params.q) ?? "").trim().slice(0, 120),
    outletId: (getParam(params.outletId) ?? "").trim() || null,
    profileId: (getParam(params.profileId) ?? "").trim() || null,
    method: reconciliationPaymentMethods.includes(
      rawMethod as ReconciliationPaymentMethod,
    )
      ? (rawMethod as ReconciliationPaymentMethod)
      : null,
    status: reconciliationFilterStatuses.includes(
      rawStatus as ReconciliationFilterStatus,
    )
      ? (rawStatus as ReconciliationFilterStatus)
      : "unreconciled",
    range: reconciliationDateRanges.includes(
      rawRange as ReconciliationDateRange,
    )
      ? (rawRange as ReconciliationDateRange)
      : "30d",
    page:
      Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}
