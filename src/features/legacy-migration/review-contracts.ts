import type { LegacyVerificationStatus } from "@/features/legacy-migration/verification-contracts";

export const LEGACY_REVIEW_PAGE_SIZE = 25;

export type LegacyReviewStatusFilter =
  | "pending"
  | "submitted"
  | "needs_review"
  | "returned"
  | "approved"
  | "rejected"
  | "all";

export type LegacyReviewQueueFilters = {
  status: LegacyReviewStatusFilter;
  search: string;
  sessionId: string | null;
  page: number;
};

export type LegacyReviewQueueItem = {
  id: string;
  barcodeValue: string;
  source: "legacy_match" | "physical_unmatched";
  status: LegacyVerificationStatus;
  verifiedItemName: string;
  verifiedWeightGram: string;
  verifiedPurity: string;
  condition: "good" | "damaged" | "lost" | "returned";
  reviewFlags: string[];
  productMasterName: string;
  productMasterCode: string;
  sessionName: string;
  submittedByName: string;
  submittedAt: Date;
  productItemId: string | null;
};

export function parseLegacyReviewFilters(
  input: Record<string, string | string[] | undefined>,
): LegacyReviewQueueFilters {
  const read = (value: string | string[] | undefined) =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  const rawStatus = read(input.status);
  const allowed: readonly LegacyReviewStatusFilter[] = [
    "pending",
    "submitted",
    "needs_review",
    "returned",
    "approved",
    "rejected",
    "all",
  ];
  const rawPage = Number.parseInt(read(input.page), 10);
  const rawSessionId = read(input.sessionId).trim();

  return {
    status: allowed.includes(rawStatus as LegacyReviewStatusFilter)
      ? (rawStatus as LegacyReviewStatusFilter)
      : "pending",
    search: read(input.q).trim().slice(0, 120),
    sessionId: /^[0-9a-f-]{36}$/i.test(rawSessionId) ? rawSessionId : null,
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}
