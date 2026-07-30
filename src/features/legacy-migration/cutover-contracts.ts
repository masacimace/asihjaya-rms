export const LEGACY_CUTOVER_CONFIRMATION = "AKTIFKAN STOK";

export type LegacyCutoverIssueCode =
  | "SESSION_NOT_CLOSED"
  | "UNRESOLVED_VERIFICATION"
  | "ITEM_MISSING"
  | "ITEM_NOT_ON_HOLD"
  | "ITEM_LINK_INVALID"
  | "MASTER_NOT_ACTIVE"
  | "BARCODE_ALIAS_INVALID"
  | "SOLD_CONFLICT";

export type LegacyCutoverIssue = {
  code: LegacyCutoverIssueCode;
  label: string;
  count: number;
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
  unresolvedCount: number;
  approvedCount: number;
  activatedCount: number;
  soldCount: number;
  rejectedCount: number;
  readyItemCount: number;
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
