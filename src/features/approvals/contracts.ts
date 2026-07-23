export const ADMIN_APPROVALS_PAGE_SIZE = 16;

export const adminApprovalStatuses = [
  "all",
  "pending",
  "approved",
  "rejected",
] as const;

export const adminApprovalTypes = [
  "all",
  "discount",
  "void_receipt",
  "refund_transaction",
  "manual_payment_verification",
  "customer_deposit_withdrawal",
  "stock_adjustment",
  "other",
] as const;

export const adminApprovalRanges = ["today", "7d", "30d", "all"] as const;

export type ApprovalStatus = Exclude<
  (typeof adminApprovalStatuses)[number],
  "all"
>;
export type ApprovalType = Exclude<(typeof adminApprovalTypes)[number], "all">;
export type AdminApprovalStatus = (typeof adminApprovalStatuses)[number];
export type AdminApprovalType = (typeof adminApprovalTypes)[number];
export type AdminApprovalRange = (typeof adminApprovalRanges)[number];

export type AdminApprovalFilters = {
  search: string;
  outletId: string | null;
  status: AdminApprovalStatus;
  type: AdminApprovalType;
  range: AdminApprovalRange;
  page: number;
};

export type AdminApprovalRequestSummary = {
  title: string;
  description: string;
  reason: string | null;
  impactLabel: string | null;
  impactValue: number | null;
  lines: Array<{
    label: string;
    value: string;
    tone?: "default" | "danger" | "success" | "warning";
  }>;
};

export type AdminApprovalRow = {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  outletId: string | null;
  outletCode: string | null;
  outletName: string | null;
  requestedById: string;
  requestedByName: string;
  approvedById: string | null;
  approvedByName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceLabel: string | null;
  notes: string | null;
  responseNotes: string | null;
  createdAtIso: string;
  resolvedAtIso: string | null;
  requestData: Record<string, unknown>;
  summary: AdminApprovalRequestSummary;
  canResolve: boolean;
  resolutionBlockedReason: string | null;
};

export type AdminApprovalListData = {
  filters: AdminApprovalFilters;
  outlets: Array<{
    id: string;
    code: string;
    name: string;
    isPrimary: boolean;
  }>;
  rows: AdminApprovalRow[];
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    highImpactPending: number;
  };
  page: number;
  pageCount: number;
  pageSize: number;
  periodLabel: string;
};

export type AdminApprovalDrawerData = {
  pendingCount: number;
  pending: AdminApprovalRow[];
  recentResolved: AdminApprovalRow[];
};

export type AdminApprovalActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialAdminApprovalActionState: AdminApprovalActionState = {
  status: "idle",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminApprovalFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminApprovalFilters {
  const pageValue = Number(getSearchParam(searchParams, "page") ?? "1");
  const outletId = getSearchParam(searchParams, "outletId")?.trim() ?? "";
  const status = getSearchParam(searchParams, "status")?.trim() ?? "pending";
  const type = getSearchParam(searchParams, "type")?.trim() ?? "all";
  const range = getSearchParam(searchParams, "range")?.trim() ?? "30d";

  return {
    search: (getSearchParam(searchParams, "q") ?? "").trim().slice(0, 120),
    outletId: isUuid(outletId) ? outletId : null,
    status: adminApprovalStatuses.includes(status as AdminApprovalStatus)
      ? (status as AdminApprovalStatus)
      : "pending",
    type: adminApprovalTypes.includes(type as AdminApprovalType)
      ? (type as AdminApprovalType)
      : "all",
    range: adminApprovalRanges.includes(range as AdminApprovalRange)
      ? (range as AdminApprovalRange)
      : "30d",
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1,
  };
}
