export const BANK_INFLOW_PAGE_SIZE = 5;

export const bankInflowDateRanges = [
  "today",
  "yesterday",
  "last7",
  "last30",
  "thisMonth",
  "custom",
] as const;

export const bankInflowMethods = ["all", "debit_card", "bank_transfer"] as const;

export type BankInflowDateRange = (typeof bankInflowDateRanges)[number];
export type BankInflowMethodFilter = (typeof bankInflowMethods)[number];
export type BankInflowPaymentMethod = Exclude<BankInflowMethodFilter, "all">;
export type BankInflowMovementKind = "receipt" | "refund";

export type BankInflowFilters = {
  search: string;
  outletId: string | null;
  provider: string | null;
  method: BankInflowMethodFilter;
  dateRange: BankInflowDateRange;
  startDate: string;
  endDate: string;
  page: number;
};

export type BankInflowPeriod = {
  range: BankInflowDateRange;
  label: string;
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
};

export type BankInflowOutletOption = {
  id: string;
  code: string;
  name: string;
};

export type BankInflowMovement = {
  id: string;
  kind: BankInflowMovementKind;
  occurredAt: Date;
  saleId: string;
  invoiceNumber: string;
  customerCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  outletId: string;
  outletCode: string;
  outletName: string;
  method: BankInflowPaymentMethod;
  provider: string;
  amount: number;
  providerReference: string | null;
};

export type BankInflowBankSummary = {
  provider: string;
  edcAmount: number;
  transferAmount: number;
  receiptAmount: number;
  refundAmount: number;
  netAmount: number;
};

export type BankInflowSummary = {
  receiptAmount: number;
  refundAmount: number;
  netAmount: number;
  movementCount: number;
};

export type BankInflowReportData = {
  filters: BankInflowFilters;
  period: BankInflowPeriod;
  outlets: BankInflowOutletOption[];
  providers: string[];
  rows: BankInflowMovement[];
  allRows: BankInflowMovement[];
  bankSummary: BankInflowBankSummary[];
  summary: BankInflowSummary;
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isDateRange(value: string): value is BankInflowDateRange {
  return bankInflowDateRanges.includes(value as BankInflowDateRange);
}

function isMethod(value: string): value is BankInflowMethodFilter {
  return bankInflowMethods.includes(value as BankInflowMethodFilter);
}

export function parseBankInflowFilters(
  searchParams: Record<string, string | string[] | undefined>,
): BankInflowFilters {
  const outletId = readSearchParam(searchParams.outletId).trim();
  const provider = readSearchParam(searchParams.provider).trim().slice(0, 80);
  const dateRange = readSearchParam(searchParams.range).trim();
  const method = readSearchParam(searchParams.method).trim();
  const startDate = readSearchParam(searchParams.startDate).trim();
  const endDate = readSearchParam(searchParams.endDate).trim();
  const page = Number.parseInt(readSearchParam(searchParams.page), 10);

  return {
    search: readSearchParam(searchParams.q).trim().slice(0, 160),
    outletId: UUID_PATTERN.test(outletId) ? outletId : null,
    provider: provider || null,
    method: isMethod(method) ? method : "all",
    dateRange: isDateRange(dateRange) ? dateRange : "thisMonth",
    startDate: DATE_KEY_PATTERN.test(startDate) ? startDate : "",
    endDate: DATE_KEY_PATTERN.test(endDate) ? endDate : "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}
