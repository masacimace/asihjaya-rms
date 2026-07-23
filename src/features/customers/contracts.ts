export const ADMIN_CUSTOMERS_PAGE_SIZE = 20;

export const adminCustomerStatuses = ["active", "inactive", "all"] as const;

export type AdminCustomerStatus = (typeof adminCustomerStatuses)[number];

export type AdminCustomerFilters = {
  search: string;
  status: AdminCustomerStatus;
  outletId: string | null;
  page: number;
};

export type AdminCustomerListRow = {
  id: string;
  customerCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  totalTransactions: number;
  totalSpent: number;
  totalItems: number;
  lastTransaction: {
    id: string;
    invoiceNumber: string;
    completedAt: Date | null;
    createdAt: Date;
    totalAmount: string;
    outletName: string;
    cashierName: string;
  } | null;
};

export type AdminCustomerListData = {
  filters: AdminCustomerFilters;
  outlets: Array<{
    id: string;
    code: string;
    name: string;
    isPrimary: boolean;
  }>;
  rows: AdminCustomerListRow[];
  summary: {
    totalCustomers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    customersWithTransactions: number;
    newCustomersThisMonth: number;
    totalSpent: number;
  };
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

export type AdminCustomerTransactionRow = {
  id: string;
  invoiceNumber: string;
  status:
    | "draft"
    | "awaiting_payment"
    | "completed"
    | "cancelled"
    | "voided"
    | "partially_refunded"
    | "refunded";
  totalAmount: string;
  subtotalAmount: string;
  discountAmount: string;
  completedAt: Date | null;
  createdAt: Date;
  outletName: string;
  registerName: string;
  cashierName: string;
  totalItems: number;
  itemSummary: string[];
  paymentMethods: string[];
};


export type AdminCustomerDepositBalanceRow = {
  outletId: string;
  outletCode: string;
  outletName: string;
  balanceAmount: string;
  balance: number;
  lastLedgerEntryAt: Date | null;
  pendingWithdrawalApproval: {
    id: string;
    amount: number;
    requestedByName: string;
    createdAt: Date;
  } | null;
};

export type AdminCustomerDepositLedgerRow = {
  id: string;
  outletName: string;
  entryType: "deposit_in" | "deposit_used" | "deposit_withdrawal" | "adjustment";
  direction: "credit" | "debit";
  amount: string;
  balanceAfter: string;
  description: string | null;
  invoiceNumber: string | null;
  createdByName: string;
  occurredAt: Date;
  createdAt: Date;
};

export type AdminCustomerDetailData = {
  customer: {
    id: string;
    customerCode: string | null;
    fullName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  summary: {
    totalTransactions: number;
    totalSpent: number;
    totalItems: number;
    averageTransactionAmount: number;
    lastTransactionAt: Date | null;
    lastOutletName: string | null;
    lastCashierName: string | null;
    lastItemName: string | null;
  };
  transactions: AdminCustomerTransactionRow[];
  customerDeposits: {
    totalBalance: number;
    outletsWithBalance: number;
    lastLedgerEntryAt: Date | null;
    balances: AdminCustomerDepositBalanceRow[];
    recentEntries: AdminCustomerDepositLedgerRow[];
  };
};

export type AdminCustomerFormData = AdminCustomerDetailData["customer"];

export type AdminCustomerActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialAdminCustomerActionState: AdminCustomerActionState = {
  status: "idle",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminCustomerFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminCustomerFilters {
  const status = getSearchParam(searchParams, "status");
  const pageValue = Number(getSearchParam(searchParams, "page") ?? "1");
  const outletId = getSearchParam(searchParams, "outletId")?.trim() ?? "";

  return {
    search: (getSearchParam(searchParams, "q") ?? "").trim().slice(0, 120),
    status:
      status === "inactive" || status === "all" || status === "active"
        ? status
        : "active",
    outletId: isUuid(outletId) ? outletId : null,
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1,
  };
}
