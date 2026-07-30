export function getLegacyBarcodeAliasSource(
  source: "legacy_match" | "physical_unmatched",
): "legacy_import" | "legacy_physical_label" {
  return source === "legacy_match"
    ? "legacy_import"
    : "legacy_physical_label";
}

export function buildMigrationItemAttributes(input: {
  verificationId: string;
  batchId: string;
  sessionId: string;
  source: "legacy_match" | "physical_unmatched";
  legacyRowId: string | null;
  reviewFlags: string[];
  approvedBy: string;
}) {
  return {
    migration: {
      verificationId: input.verificationId,
      batchId: input.batchId,
      sessionId: input.sessionId,
      source: input.source,
      legacyRowId: input.legacyRowId,
      reviewFlags: input.reviewFlags,
      approvedBy: input.approvedBy,
      inventoryHold: true,
    },
  } satisfies Record<string, unknown>;
}

export function canBulkApproveLegacyVerification(input: {
  status: string;
  reviewFlags: string[];
  condition: string;
}) {
  return (
    input.status === "submitted" &&
    input.reviewFlags.length === 0 &&
    input.condition === "good"
  );
}
