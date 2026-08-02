import type { LegacyVerificationStatus } from "@/features/legacy-migration/verification-contracts";
import { normalizePhysicalBarcode } from "@/features/legacy-migration/verification-rules";

export const MAX_SOLD_DURING_MIGRATION_BARCODES = 500;

const SOLD_ELIGIBLE_STATUSES = new Set<LegacyVerificationStatus>([
  "submitted",
  "needs_review",
  "returned",
  "approved",
  "rejected",
]);

export function isSoldDuringMigrationEligibleStatus(
  status: LegacyVerificationStatus,
) {
  return SOLD_ELIGIBLE_STATUSES.has(status);
}

export function parseSoldDuringMigrationBarcodes(
  value: FormDataEntryValue | string | null,
  barcodeLength: number,
) {
  const rawValues = String(value ?? "")
    .split(/[\s,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const barcodes: string[] = [];
  const invalidBarcodes: string[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;
  let truncatedCount = 0;

  for (const rawValue of rawValues) {
    const barcode = normalizePhysicalBarcode(rawValue, barcodeLength);
    if (!barcode) {
      invalidBarcodes.push(rawValue.slice(0, 120));
      continue;
    }
    if (seen.has(barcode)) {
      duplicateCount += 1;
      continue;
    }
    if (barcodes.length >= MAX_SOLD_DURING_MIGRATION_BARCODES) {
      truncatedCount += 1;
      continue;
    }
    seen.add(barcode);
    barcodes.push(barcode);
  }

  return {
    barcodes,
    invalidBarcodes,
    duplicateCount,
    truncatedCount,
  };
}
