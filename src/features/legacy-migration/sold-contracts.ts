import type { LegacyVerificationStatus } from "@/features/legacy-migration/verification-contracts";

export type LegacySoldRecordItem = {
  id: string;
  sessionId: string | null;
  sessionName: string | null;
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
  unassignedSession: number;
  verificationExcluded: number;
  holdMarkedSold: number;
};
