export const SETTLEMENT_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const SETTLEMENT_IMPORT_MAX_ROWS = 1_000;
export const SETTLEMENT_IMPORT_PAGE_SIZE = 50;

export const settlementImportStatuses = [
  "uploaded",
  "ready",
  "processing",
  "completed",
  "completed_with_issues",
  "failed",
  "cancelled",
] as const;

export const settlementImportRowStatuses = [
  "pending",
  "matched",
  "ambiguous",
  "mismatch",
  "not_found",
  "duplicate",
  "ignored",
  "applied",
  "failed",
] as const;

export const settlementImportColumnKeys = [
  "transactionDate",
  "paymentReference",
  "grossAmount",
  "feeAmount",
  "taxAmount",
  "netAmount",
  "settlementReference",
  "providerStatus",
] as const;

export type SettlementImportStatus =
  (typeof settlementImportStatuses)[number];
export type SettlementImportRowStatus =
  (typeof settlementImportRowStatuses)[number];
export type SettlementImportColumnKey =
  (typeof settlementImportColumnKeys)[number];

export type SettlementImportColumnMapping = Record<
  SettlementImportColumnKey,
  string | null
>;

export type ParsedCsv = {
  delimiter: string;
  headers: string[];
  rows: Array<Record<string, string>>;
};

export type NormalizedSettlementRow = {
  transactionDate: Date;
  paymentReference: string;
  normalizedReference: string;
  grossAmount: number;
  feeAmount: number;
  taxAmount: number;
  netAmount: number;
  settlementReference: string | null;
  providerStatus: string | null;
};

export type SettlementImportBatchListRow = {
  id: string;
  fileName: string;
  status: SettlementImportStatus;
  outletName: string;
  profileName: string;
  uploadedByName: string;
  rowCount: number;
  matchedCount: number;
  appliedCount: number;
  issueCount: number;
  createdAt: Date;
  completedAt: Date | null;
};

export type SettlementImportCandidate = {
  paymentId: string;
  invoiceNumber: string;
  providerReference: string | null;
  amount: string;
  paidAt: Date | null;
  settlementStatus: string;
};

export type SettlementImportDetailRow = {
  id: string;
  rowNumber: number;
  rawData: Record<string, string>;
  transactionDate: Date | null;
  paymentReference: string | null;
  normalizedReference: string | null;
  grossAmount: string | null;
  feeAmount: string;
  taxAmount: string;
  netAmount: string | null;
  settlementReference: string | null;
  providerStatus: string | null;
  status: SettlementImportRowStatus;
  matchedPaymentId: string | null;
  candidatePaymentIds: string[];
  matchReason: string | null;
  errorMessage: string | null;
  reviewNotes: string | null;
  appliedAt: Date | null;
  candidates: SettlementImportCandidate[];
};

export type SettlementImportDetailData = {
  batch: {
    id: string;
    fileName: string;
    fileKey: string;
    fileHash: string;
    fileSizeBytes: number;
    status: SettlementImportStatus;
    delimiter: string;
    headers: string[];
    columnMapping: SettlementImportColumnMapping;
    rowCount: number;
    validRowCount: number;
    matchedCount: number;
    appliedCount: number;
    ambiguousCount: number;
    mismatchCount: number;
    notFoundCount: number;
    duplicateCount: number;
    ignoredCount: number;
    failedCount: number;
    errorMessage: string | null;
    createdAt: Date;
    completedAt: Date | null;
    outletId: string;
    outletCode: string;
    outletName: string;
    profileId: string;
    profileCode: string;
    profileName: string;
    provider: string;
    uploadedByName: string;
  };
  rows: SettlementImportDetailRow[];
  page: number;
  pageCount: number;
  total: number;
};

export function createEmptySettlementImportMapping(): SettlementImportColumnMapping {
  return {
    transactionDate: null,
    paymentReference: null,
    grossAmount: null,
    feeAmount: null,
    taxAmount: null,
    netAmount: null,
    settlementReference: null,
    providerStatus: null,
  };
}
