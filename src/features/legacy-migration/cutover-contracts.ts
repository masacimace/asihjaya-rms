export const LEGACY_CUTOVER_CONFIRMATION = "AKTIFKAN STOK";

export type LegacyCutoverIssueCode =
  | "SESSION_NOT_LOCKED"
  | "UNRESOLVED_VERIFICATION"
  | "CANCELLED_SESSION_HAS_DATA"
  | "ITEM_MISSING"
  | "ITEM_NOT_ON_HOLD"
  | "ITEM_LINK_INVALID"
  | "ITEM_MASTER_MISMATCH"
  | "MASTER_NOT_ACTIVE"
  | "CATEGORY_NOT_ACTIVE"
  | "SELLING_AMOUNT_INVALID"
  | "PRICE_PER_GRAM_INVALID"
  | "DEDUCTION_PER_GRAM_INVALID"
  | "ITEM_CONDITION_INVALID"
  | "ITEM_LOCATION_INVALID"
  | "BARCODE_ALIAS_INVALID"
  | "SOLD_CONFLICT";

export type LegacyCutoverBatchIssueCode = "SOLD_SESSION_UNASSIGNED";

export type LegacyCutoverIssue = {
  code: LegacyCutoverIssueCode;
  label: string;
  count: number;
  href?: string;
};

export type LegacyCutoverBatchIssue = {
  code: LegacyCutoverBatchIssueCode;
  label: string;
  count: number;
  href: string;
};

export type LegacyCutoverSessionStatus =
  | "draft"
  | "active"
  | "locked"
  | "completed"
  | "cancelled";

export type LegacyCutoverSessionSummary = {
  id: string;
  name: string;
  locationCode: string | null;
  expectedItemCount: number | null;
  status: LegacyCutoverSessionStatus;
  totalVerifications: number;
  processedItemCount: number;
  soldBeforeScanCount: number;
  unresolvedCount: number;
  approvedCount: number;
  activatedCount: number;
  soldCount: number;
  rejectedCount: number;
  targetShortfall: number;
  targetSurplus: number;
  readyItemCount: number;
  pricingBlockerCount: number;
  issueCount: number;
  issues: LegacyCutoverIssue[];
  cutoverRun: {
    id: string;
    itemCount: number;
    executedAt: Date;
    executedByName: string;
  } | null;
  canExecute: boolean;
};
