import { createHash } from "node:crypto";

export function normalizePhysicalBarcode(
  input: unknown,
  expectedLength: number,
): string | null {
  const normalized = String(input ?? "")
    .normalize("NFKC")
    .trim()
    .slice(0, 120);

  if (!normalized) return null;

  if (/^\d+$/.test(normalized) && normalized.length <= expectedLength) {
    return normalized.padStart(expectedLength, "0");
  }

  if (!/^[A-Za-z0-9._/-]+$/.test(normalized)) return null;
  return normalized;
}

export function normalizeVerificationText(
  input: unknown,
  maxLength: number,
): string | null {
  const value = String(input ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

  return value || null;
}

export function parsePositiveDecimal(
  input: unknown,
  max: number,
): { value: string | null; numberValue: number | null } {
  const text = String(input ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");

  if (!text) return { value: null, numberValue: null };
  if (!/^\d+(?:\.\d{1,3})?$/.test(text)) {
    return { value: null, numberValue: null };
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) {
    return { value: null, numberValue: null };
  }

  return { value: text, numberValue: parsed };
}

function normalizedComparable(value: string | null): string {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("id-ID");
}

function decimalDiffers(
  verified: number | null,
  legacy: string | null,
  tolerance: number,
): boolean {
  if (verified === null || legacy === null) return false;
  const legacyValue = Number(legacy);
  if (!Number.isFinite(legacyValue)) return false;
  return Math.abs(verified - legacyValue) > tolerance;
}

export function collectVerificationReviewFlags(input: {
  source: "legacy_match" | "physical_unmatched";
  legacyValidationStatus: "valid" | "warning" | "invalid" | null;
  mappedProductMasterId: string | null;
  selectedProductMasterId: string;
  legacyItemName: string | null;
  verifiedItemName: string;
  legacyWeightGram: string | null;
  verifiedWeightGram: number;
  legacyPurity: string | null;
  verifiedPurity: number;
  legacyExchangePurity: string | null;
  verifiedExchangePurity: number | null;
  legacyColor: string | null;
  verifiedColor: string | null;
  condition: "good" | "damaged";
  useLegacyImage: boolean;
  hasUploadedImage: boolean;
}): string[] {
  const flags: string[] = [];

  if (input.source === "physical_unmatched") {
    flags.push("BARCODE_NOT_FOUND_IN_LEGACY_EXPORT");
  }
  if (input.legacyValidationStatus === "warning") {
    flags.push("LEGACY_ROW_HAS_WARNING");
  }
  if (input.legacyValidationStatus === "invalid") {
    flags.push("LEGACY_ROW_INVALID");
  }
  if (
    input.mappedProductMasterId &&
    input.mappedProductMasterId !== input.selectedProductMasterId
  ) {
    flags.push("PRODUCT_MASTER_CHANGED");
  }
  if (!input.mappedProductMasterId && input.source === "legacy_match") {
    flags.push("LEGACY_MASTER_NOT_MAPPED");
  }
  if (
    input.legacyItemName &&
    normalizedComparable(input.legacyItemName) !==
      normalizedComparable(input.verifiedItemName)
  ) {
    flags.push("ITEM_NAME_CHANGED");
  }
  if (
    decimalDiffers(
      input.verifiedWeightGram,
      input.legacyWeightGram,
      0.01,
    )
  ) {
    flags.push("WEIGHT_CHANGED");
  }
  if (decimalDiffers(input.verifiedPurity, input.legacyPurity, 0.001)) {
    flags.push("PURITY_CHANGED");
  }
  if (
    input.verifiedExchangePurity !== null &&
    decimalDiffers(
      input.verifiedExchangePurity,
      input.legacyExchangePurity,
      0.001,
    )
  ) {
    flags.push("EXCHANGE_PURITY_CHANGED");
  }
  if (
    input.legacyColor &&
    normalizedComparable(input.legacyColor) !==
      normalizedComparable(input.verifiedColor)
  ) {
    flags.push("COLOR_CHANGED");
  }
  if (input.condition === "damaged") {
    flags.push("ITEM_DAMAGED");
  }
  if (!input.useLegacyImage && !input.hasUploadedImage) {
    flags.push("PHOTO_MISSING");
  }

  return Array.from(new Set(flags));
}

export function createVerificationFingerprint(input: {
  sessionId: string;
  barcode: string;
  legacyRowId: string | null;
  targetProductMasterId: string;
  verifiedItemName: string;
  verifiedWeightGram: string;
  verifiedPurity: string;
  verifiedExchangePurity: string | null;
  verifiedColor: string | null;
  condition: "good" | "damaged";
  useLegacyImage: boolean;
  staffNotes: string | null;
  imageSha256: string | null;
}): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}
