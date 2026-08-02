import type {
  LegacyCutoverIssue,
  LegacyCutoverIssueCode,
  LegacyCutoverSessionStatus,
} from "@/features/legacy-migration/cutover-contracts";
import {
  isFineGoldLegacyCategory,
  isNonNegativeLegacyMigrationMoney,
  isPositiveLegacyMigrationMoney,
} from "@/features/legacy-migration/pricing-rules";
import type { LegacyVerificationSource } from "@/features/legacy-migration/verification-contracts";

const LEGACY_CUTOVER_ISSUE_LABELS: Record<
  LegacyCutoverIssueCode,
  string
> = {
  SESSION_NOT_LOCKED: "Sesi belum dikunci",
  UNRESOLVED_VERIFICATION: "Verification belum selesai direview",
  CANCELLED_SESSION_HAS_DATA: "Sesi dibatalkan masih memiliki data",
  ITEM_MISSING: "Product Item hasil approval tidak ditemukan",
  ITEM_NOT_ON_HOLD: "Product Item tidak lagi berstatus migration hold",
  ITEM_LINK_INVALID: "Outlet atau barcode Product Item tidak konsisten",
  ITEM_MASTER_MISMATCH: "Product Master item berbeda dari hasil review",
  MASTER_NOT_ACTIVE: "Product Master belum aktif",
  CATEGORY_NOT_ACTIVE: "Kategori Product Master belum aktif",
  SELLING_AMOUNT_INVALID: "Harga label belum valid",
  PRICE_PER_GRAM_INVALID: "Harga per gram belum valid",
  DEDUCTION_PER_GRAM_INVALID: "Potongan per gram belum valid",
  ITEM_CONDITION_INVALID: "Kondisi item belum siap dijual",
  ITEM_LOCATION_INVALID: "Lokasi item bukan stok outlet",
  BARCODE_ALIAS_INVALID: "Alias barcode legacy tidak valid",
  SOLD_CONFLICT: "Barcode sudah ditandai terjual di sistem lama",
  OPENING_MOVEMENT_EXISTS: "Opening inventory movement sudah pernah tercatat",
};

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
  targetProductMasterId: string | null;
  productItemId: string | null;
  itemProductMasterId: string | null;
  itemAvailability: string | null;
  itemIsActive: boolean | null;
  itemOutletId: string | null;
  itemLegacyId: string | null;
  itemSellingAmount: string | null;
  itemPricePerGram: string | null;
  itemDeductionPerGram: string | null;
  itemCondition: string | null;
  itemLocationState: string | null;
  masterStatus: string | null;
  categoryName: string | null;
  categoryIsActive: boolean | null;
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

  if (
    !input.targetProductMasterId ||
    input.itemProductMasterId !== input.targetProductMasterId
  ) {
    issues.push("ITEM_MASTER_MISMATCH");
  }

  if (input.masterStatus !== "active") {
    issues.push("MASTER_NOT_ACTIVE");
  }

  if (!input.categoryIsActive) {
    issues.push("CATEGORY_NOT_ACTIVE");
  }

  if (!isPositiveLegacyMigrationMoney(input.itemSellingAmount)) {
    issues.push("SELLING_AMOUNT_INVALID");
  }

  if (!isPositiveLegacyMigrationMoney(input.itemPricePerGram)) {
    issues.push("PRICE_PER_GRAM_INVALID");
  }

  const deductionIsValid = isFineGoldLegacyCategory(input.categoryName)
    ? input.itemDeductionPerGram === null ||
      isNonNegativeLegacyMigrationMoney(input.itemDeductionPerGram)
    : isNonNegativeLegacyMigrationMoney(input.itemDeductionPerGram);
  if (!deductionIsValid) {
    issues.push("DEDUCTION_PER_GRAM_INVALID");
  }

  if (input.itemCondition !== "good") {
    issues.push("ITEM_CONDITION_INVALID");
  }

  if (input.itemLocationState !== "outlet") {
    issues.push("ITEM_LOCATION_INVALID");
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

export function summarizeLegacyCutoverIssueCounts(
  counts: ReadonlyMap<LegacyCutoverIssueCode, number>,
  hrefs: Partial<Record<LegacyCutoverIssueCode, string>> = {},
): LegacyCutoverIssue[] {
  return Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .map(([code, count]) => ({
      code,
      label: LEGACY_CUTOVER_ISSUE_LABELS[code],
      count,
      href: hrefs[code],
    }));
}

export function summarizeLegacyCutoverIssues(
  codes: LegacyCutoverIssueCode[],
  hrefs: Partial<Record<LegacyCutoverIssueCode, string>> = {},
): LegacyCutoverIssue[] {
  const counts = new Map<LegacyCutoverIssueCode, number>();
  for (const code of codes) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return summarizeLegacyCutoverIssueCounts(counts, hrefs);
}
