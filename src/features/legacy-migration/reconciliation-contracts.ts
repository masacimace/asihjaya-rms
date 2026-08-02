import type {
  LegacyCutoverBatchIssueCode,
  LegacyCutoverIssueCode,
} from "@/features/legacy-migration/cutover-contracts";

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
  code: LegacyCutoverIssueCode | LegacyCutoverBatchIssueCode;
  label: string;
  count: number;
  href: string;
};
