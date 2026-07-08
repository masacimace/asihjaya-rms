export const ADMIN_CASH_MOVEMENTS_PAGE_SIZE = 20;

export const adminCashMovementTypes = [
  "all",
  "opening_balance",
  "cash_sale",
  "cash_refund",
  "cash_in",
  "cash_out",
  "closing_adjustment",
] as const;

export const adminCashMovementRanges = ["today", "7d", "30d", "all"] as const;

export type AdminCashMovementType = (typeof adminCashMovementTypes)[number];
export type AdminCashMovementRange = (typeof adminCashMovementRanges)[number];

export type CashMovementType = Exclude<AdminCashMovementType, "all">;
export type ManualCashMovementType = "cash_in" | "cash_out";

export type AdminCashMovementFilters = {
  search: string;
  outletId: string | null;
  type: AdminCashMovementType;
  range: AdminCashMovementRange;
  page: number;
};

export type AdminCashMovementRow = {
  id: string;
  shiftId: string;
  type: CashMovementType;
  amount: string;
  referenceType: string | null;
  referenceId: string | null;
  referenceLabel: string | null;
  reason: string | null;
  createdAt: Date;
  createdByName: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  registerId: string;
  registerCode: string;
  registerName: string;
  shiftStatus: "open" | "closing" | "closed";
  shiftOpenedAt: Date;
};

export type AdminCashMovementActiveShift = {
  id: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  registerId: string;
  registerCode: string;
  registerName: string;
  openedByName: string;
  openedAt: Date;
  expectedCash: string | null;
};

export type AdminCashMovementListData = {
  filters: AdminCashMovementFilters;
  outlets: Array<{
    id: string;
    code: string;
    name: string;
    isPrimary: boolean;
  }>;
  activeShifts: AdminCashMovementActiveShift[];
  rows: AdminCashMovementRow[];
  summary: {
    totalMovements: number;
    openingBalance: number;
    cashSales: number;
    manualCashIn: number;
    manualCashOut: number;
    cashRefunds: number;
    closingAdjustments: number;
    netMovement: number;
    activeShiftCount: number;
  };
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  periodLabel: string;
};

export type AdminCashMovementActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialAdminCashMovementActionState: AdminCashMovementActionState = {
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

export function parseAdminCashMovementFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminCashMovementFilters {
  const pageValue = Number(getSearchParam(searchParams, "page") ?? "1");
  const outletId = getSearchParam(searchParams, "outletId")?.trim() ?? "";
  const type = getSearchParam(searchParams, "type")?.trim() ?? "all";
  const range = getSearchParam(searchParams, "range")?.trim() ?? "today";

  return {
    search: (getSearchParam(searchParams, "q") ?? "").trim().slice(0, 120),
    outletId: isUuid(outletId) ? outletId : null,
    type: adminCashMovementTypes.includes(type as AdminCashMovementType)
      ? (type as AdminCashMovementType)
      : "all",
    range: adminCashMovementRanges.includes(range as AdminCashMovementRange)
      ? (range as AdminCashMovementRange)
      : "today",
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1,
  };
}
