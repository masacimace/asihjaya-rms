export type LegacyVerificationSource =
  | "legacy_match"
  | "physical_unmatched";

export type LegacyVerificationStatus =
  | "submitted"
  | "needs_review"
  | "returned"
  | "approved"
  | "rejected"
  | "sold_during_migration"
  | "activated";

export type LegacyVerificationCondition = "good" | "damaged";

export type LegacyMigrationLookupResult =
  | {
      ok: false;
      code:
        | "INVALID_BARCODE"
        | "SESSION_UNAVAILABLE"
        | "DUPLICATE_LEGACY_ROW"
        | "SOLD_DURING_MIGRATION"
        | "ALREADY_REGISTERED"
        | "ALREADY_VERIFIED"
        | "NOT_AUTHORIZED";
      message: string;
    }
  | {
      ok: true;
      barcode: string;
      source: LegacyVerificationSource;
      existingVerification: null | {
        id: string;
        targetProductMasterId: string;
        verifiedItemName: string;
        verifiedWeightGram: string;
        verifiedPurity: string;
        verifiedExchangePurity: string | null;
        verifiedColor: string | null;
        condition: LegacyVerificationCondition;
        useLegacyImage: boolean;
        hasActualImage: boolean;
        staffNotes: string | null;
        reviewNotes: string | null;
        revision: number;
      };
      legacy: null | {
        rowId: string;
        rowNumber: number;
        validationStatus: "valid" | "warning" | "invalid";
        validationIssues: Array<Record<string, unknown>>;
        category: string | null;
        masterCode: string | null;
        masterName: string | null;
        itemName: string | null;
        purity: string | null;
        exchangePurity: string | null;
        weightGram: string | null;
        color: string | null;
        imageUrl: string | null;
        mappedProductMasterId: string | null;
        mappedProductMasterName: string | null;
        mappingStatus: "pending" | "mapped" | "ignored" | null;
      };
      messages: string[];
    };

export type LegacyMigrationSubmissionResult =
  | {
      ok: true;
      verificationId: string;
      status: "submitted" | "needs_review";
      message: string;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type LegacyMigrationScannerProductMaster = {
  id: string;
  code: string;
  name: string;
  status: "draft" | "active" | "inactive";
  categoryName: string;
};

export type LegacyMigrationScannerSession = {
  id: string;
  batchId: string;
  name: string;
  locationCode: string | null;
  expectedItemCount: number | null;
  notes: string | null;
  status: "draft" | "active" | "locked" | "completed" | "cancelled";
  outletName: string;
  fileName: string;
  barcodeLength: number;
  assignmentRole: "operator" | "lead" | "manager_override";
};

export type LegacyMigrationRecentVerification = {
  id: string;
  barcodeValue: string;
  source: LegacyVerificationSource;
  status: LegacyVerificationStatus;
  verifiedItemName: string;
  submittedByName: string;
  submittedAt: string;
};
