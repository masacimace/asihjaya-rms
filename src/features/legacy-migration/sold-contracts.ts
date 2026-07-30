import type { LegacyVerificationStatus } from "@/features/legacy-migration/verification-contracts";

export type LegacySoldRecordItem = {
  id: string;
  barcodeValue: string;
  soldAt: Date;
  reportedAt: Date;
  legacyReference: string | null;
  notes: string | null;
  reportedByName: string;
  verificationId: string | null;
  previousVerificationStatus: LegacyVerificationStatus | null;
  productItemId: string | null;
  itemSku: string | null;
  itemName: string | null;
};

export type LegacySoldSummary = {
  totalActive: number;
  beforeScan: number;
  verificationExcluded: number;
  holdMarkedSold: number;
};
