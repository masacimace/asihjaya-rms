export const LEGACY_PHOTO_MIGRATION_BATCH_SIZE = 100;

export type LegacyPhotoMigrationStatus =
  | "not_required"
  | "pending"
  | "copied"
  | "failed";

export type LegacyPhotoMigrationMetadata = {
  status: "copied" | "failed";
  attemptedAt: string;
  sourceUrl: string;
  finalUrl?: string;
  imageKey?: string;
  sourceBytes?: number;
  contentType?: string;
  copiedAt?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type LegacyReconciliationIssue = {
  code:
    | "NO_SESSION"
    | "OPEN_SESSION"
    | "UNRESOLVED_VERIFICATION"
    | "TARGET_SHORTFALL"
    | "APPROVED_ITEM_MISSING"
    | "HOLD_STATE_INVALID"
    | "ITEM_LINK_INVALID"
    | "MASTER_NOT_ACTIVE"
    | "BARCODE_ALIAS_INVALID";
  label: string;
  count: number;
  href: string;
};
