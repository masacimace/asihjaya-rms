export const LEGACY_PRODUCT_BARCODE_LENGTH = 6;
export const LEGACY_PRODUCT_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const LEGACY_PRODUCT_IMPORT_MAX_ROWS = 50_000;

export type LegacyProductValidationSeverity = "warning" | "error";

export type LegacyProductValidationIssue = {
  severity: LegacyProductValidationSeverity;
  code: string;
  field: string | null;
  message: string;
};

export type LegacyProductRowValidationStatus =
  | "valid"
  | "warning"
  | "invalid";

export type ParsedLegacyProductRow = {
  rowNumber: number;
  sourceSequence: number | null;
  legacyBarcode: string | null;
  normalizedBarcode: string | null;
  legacyCategory: string | null;
  legacyMasterCode: string | null;
  legacyMasterName: string | null;
  legacyItemName: string | null;
  legacyPurity: number | null;
  legacyExchangePurity: number | null;
  legacyPricePerGram: number | null;
  legacyDeductionPerGram: number | null;
  legacyWeightGram: number | null;
  legacyColor: string | null;
  legacyImageUrl: string | null;
  validationStatus: LegacyProductRowValidationStatus;
  validationIssues: LegacyProductValidationIssue[];
  rowFingerprint: string;
  rawData: Record<string, unknown>;
};

export type LegacyProductWorkbookSummary = {
  totalRows: number;
  validRows: number;
  warningRows: number;
  invalidRows: number;
  uniqueMasterCount: number;
  uniqueCategoryCount: number;
  uniqueColorCount: number;
  duplicateBarcodeCount: number;
  leadingZeroBarcodeCount: number;
  imageUrlCount: number;
  validationCodeCounts: Record<string, number>;
  sourceWarnings: string[];
};

export type ParsedLegacyProductWorkbook = {
  worksheetName: string;
  headers: string[];
  barcodeLength: number;
  rows: ParsedLegacyProductRow[];
  summary: LegacyProductWorkbookSummary;
};
