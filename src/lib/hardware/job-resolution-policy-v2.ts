import type { HardwareJobV2Status } from "@/lib/hardware/job-protocol-v2";

export const HARDWARE_UNKNOWN_RESOLUTION_TYPES = [
  "confirmed_completed",
  "retry_authorized",
  "cancelled",
] as const;

export type HardwareUnknownResolutionType =
  (typeof HARDWARE_UNKNOWN_RESOLUTION_TYPES)[number];

export type HardwareUnknownResolutionInput = {
  resolutionType: HardwareUnknownResolutionType;
  reason: string;
  duplicateRiskAcknowledged: boolean;
};

export type HardwareUnknownResolutionDecision = {
  nextStatus: Extract<HardwareJobV2Status, "completed" | "pending" | "cancelled">;
  requiresDuplicateRiskAcknowledgement: boolean;
  shouldCreateNewAttempt: boolean;
};

const MIN_REASON_LENGTH = 12;
const MAX_REASON_LENGTH = 500;

export function isHardwareUnknownResolutionType(
  value: unknown,
): value is HardwareUnknownResolutionType {
  return (
    typeof value === "string" &&
    HARDWARE_UNKNOWN_RESOLUTION_TYPES.includes(
      value as HardwareUnknownResolutionType,
    )
  );
}

export function normalizeHardwareResolutionReason(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Alasan resolusi wajib diisi.");
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length < MIN_REASON_LENGTH) {
    throw new Error(
      `Alasan resolusi minimal ${MIN_REASON_LENGTH} karakter agar audit trail jelas.`,
    );
  }

  if (normalized.length > MAX_REASON_LENGTH) {
    throw new Error(
      `Alasan resolusi maksimal ${MAX_REASON_LENGTH} karakter.`,
    );
  }

  return normalized;
}

export function getHardwareUnknownResolutionDecision(
  resolutionType: HardwareUnknownResolutionType,
): HardwareUnknownResolutionDecision {
  if (resolutionType === "confirmed_completed") {
    return {
      nextStatus: "completed",
      requiresDuplicateRiskAcknowledgement: false,
      shouldCreateNewAttempt: false,
    };
  }

  if (resolutionType === "retry_authorized") {
    return {
      nextStatus: "pending",
      requiresDuplicateRiskAcknowledgement: true,
      shouldCreateNewAttempt: true,
    };
  }

  return {
    nextStatus: "cancelled",
    requiresDuplicateRiskAcknowledgement: false,
    shouldCreateNewAttempt: false,
  };
}

export function parseHardwareUnknownResolutionInput({
  resolutionType,
  reason,
  duplicateRiskAcknowledged,
}: {
  resolutionType: unknown;
  reason: unknown;
  duplicateRiskAcknowledged: unknown;
}): HardwareUnknownResolutionInput {
  if (!isHardwareUnknownResolutionType(resolutionType)) {
    throw new Error("Tipe resolusi hardware tidak valid.");
  }

  const decision = getHardwareUnknownResolutionDecision(resolutionType);
  const riskAcknowledged =
    duplicateRiskAcknowledged === true ||
    duplicateRiskAcknowledged === "true" ||
    duplicateRiskAcknowledged === "on" ||
    duplicateRiskAcknowledged === "yes";

  if (decision.requiresDuplicateRiskAcknowledgement && !riskAcknowledged) {
    throw new Error(
      "Retry membutuhkan konfirmasi bahwa operator memahami risiko cetak ganda.",
    );
  }

  return {
    resolutionType,
    reason: normalizeHardwareResolutionReason(reason),
    duplicateRiskAcknowledged: riskAcknowledged,
  };
}
