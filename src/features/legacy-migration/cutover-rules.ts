import type {
  LegacyCutoverIssue,
  LegacyCutoverIssueCode,
  LegacyCutoverSessionStatus,
} from "@/features/legacy-migration/cutover-contracts";
import type { LegacyVerificationSource } from "@/features/legacy-migration/verification-contracts";

export function isLegacyCutoverSessionClosed(
  status: LegacyCutoverSessionStatus,
) {
  return status === "locked" || status === "completed";
}

export function getLegacyCutoverAliasSource(
  source: LegacyVerificationSource,
): "legacy_import" | "legacy_physical_label" {
  return source === "legacy_match"
    ? "legacy_import"
    : "legacy_physical_label";
}

export function getLegacyCutoverItemIssues(input: {
  source: LegacyVerificationSource;
  barcodeValue: string;
  batchOutletId: string;
  productItemId: string | null;
  itemAvailability: string | null;
  itemIsActive: boolean | null;
  itemOutletId: string | null;
  itemLegacyId: string | null;
  masterStatus: string | null;
  aliasId: string | null;
  aliasSource: string | null;
  aliasIsPrimary: boolean | null;
  aliasIsActive: boolean | null;
  hasActiveSoldRecord: boolean;
}): LegacyCutoverIssueCode[] {
  const issues: LegacyCutoverIssueCode[] = [];

  if (!input.productItemId) {
    issues.push("ITEM_MISSING");
    return issues;
  }

  if (input.itemAvailability !== "migration_hold" || !input.itemIsActive) {
    issues.push("ITEM_NOT_ON_HOLD");
  }

  if (
    input.itemOutletId !== input.batchOutletId ||
    input.itemLegacyId !== input.barcodeValue
  ) {
    issues.push("ITEM_LINK_INVALID");
  }

  if (input.masterStatus !== "active") {
    issues.push("MASTER_NOT_ACTIVE");
  }

  if (
    !input.aliasId ||
    !input.aliasIsPrimary ||
    !input.aliasIsActive ||
    input.aliasSource !== getLegacyCutoverAliasSource(input.source)
  ) {
    issues.push("BARCODE_ALIAS_INVALID");
  }

  if (input.hasActiveSoldRecord) {
    issues.push("SOLD_CONFLICT");
  }

  return issues;
}

export function summarizeLegacyCutoverIssues(
  codes: LegacyCutoverIssueCode[],
): LegacyCutoverIssue[] {
  const labels: Record<LegacyCutoverIssueCode, string> = {
    SESSION_NOT_CLOSED: "Sesi belum dikunci atau diselesaikan",
    UNRESOLVED_VERIFICATION: "Verification belum selesai direview",
    ITEM_MISSING: "Product Item hasil approval tidak ditemukan",
    ITEM_NOT_ON_HOLD: "Product Item tidak lagi berstatus migration hold",
    ITEM_LINK_INVALID: "Outlet atau barcode Product Item tidak konsisten",
    MASTER_NOT_ACTIVE: "Product Master belum aktif",
    BARCODE_ALIAS_INVALID: "Alias barcode legacy tidak valid",
    SOLD_CONFLICT: "Barcode sudah ditandai terjual di sistem lama",
  };

  const counts = new Map<LegacyCutoverIssueCode, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);

  return Array.from(counts.entries()).map(([code, count]) => ({
    code,
    label: labels[code],
    count,
  }));
}
