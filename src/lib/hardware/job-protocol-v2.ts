import { hardwareJobTypeEnum } from "@/db/schema";

export const HARDWARE_JOB_PROTOCOL_V2 = 2 as const;

export const hardwareCapabilities = [
  "print_label_sato",
  "print_document_pdf",
  "open_cash_drawer",
] as const;

export type HardwareCapability = (typeof hardwareCapabilities)[number];
export type HardwareJobType = (typeof hardwareJobTypeEnum.enumValues)[number];

export const hardwareJobV2Statuses = [
  "pending",
  "claimed",
  "processing",
  "submitted",
  "completed",
  "failed",
  "unknown_outcome",
  "expired",
  "cancelled",
] as const;

export type HardwareJobV2Status = (typeof hardwareJobV2Statuses)[number];

export const hardwareJobAttemptStatuses = [
  "claimed",
  "processing",
  "dispatching",
  "submitted",
  "acknowledged",
  "failed_before_dispatch",
  "unknown_after_dispatch",
  "lease_expired",
  "cancelled",
] as const;

export type HardwareJobAttemptStatus =
  (typeof hardwareJobAttemptStatuses)[number];

export type HardwareJobCreationMode = "automatic" | "manual" | "test";

export type HardwareJobTransitionContext = {
  dispatchStarted?: boolean;
  retrySafe?: boolean;
  manualRetry?: boolean;
  manualResolution?: boolean;
};

const JOB_EXPIRY_SECONDS = {
  cashDrawer: 30,
  hardwareTest: 2 * 60,
  receiptAutomatic: 10 * 60,
  receiptManual: 15 * 60,
  inventoryLabel: 4 * 60 * 60,
} as const;

const hardwareJobTransitions: Record<
  HardwareJobV2Status,
  readonly HardwareJobV2Status[]
> = {
  pending: ["claimed", "expired", "cancelled"],
  claimed: ["processing", "pending", "failed", "cancelled"],
  processing: [
    "submitted",
    "pending",
    "failed",
    "unknown_outcome",
    "cancelled",
  ],
  submitted: ["completed", "unknown_outcome"],
  completed: [],
  failed: ["pending"],
  unknown_outcome: ["pending", "completed", "cancelled"],
  expired: [],
  cancelled: [],
};

const hardwareJobAttemptTransitions: Record<
  HardwareJobAttemptStatus,
  readonly HardwareJobAttemptStatus[]
> = {
  claimed: [
    "processing",
    "failed_before_dispatch",
    "lease_expired",
    "cancelled",
  ],
  processing: [
    "dispatching",
    "failed_before_dispatch",
    "lease_expired",
    "cancelled",
  ],
  dispatching: ["submitted", "unknown_after_dispatch"],
  submitted: ["acknowledged", "unknown_after_dispatch"],
  acknowledged: [],
  failed_before_dispatch: [],
  unknown_after_dispatch: [],
  lease_expired: [],
  cancelled: [],
};

export function getRequiredHardwareCapability(
  jobType: HardwareJobType,
): HardwareCapability {
  switch (jobType) {
    case "print_label_sato":
    case "test_label_printer":
      return "print_label_sato";
    case "print_receipt_certificate":
    case "test_document_printer":
      return "print_document_pdf";
    case "open_cash_drawer":
    case "test_cash_drawer":
      return "open_cash_drawer";
  }
}

export function getHardwareJobExpirySeconds(
  jobType: HardwareJobType,
  mode: HardwareJobCreationMode,
): number {
  if (mode === "test" || jobType.startsWith("test_")) {
    return JOB_EXPIRY_SECONDS.hardwareTest;
  }

  switch (jobType) {
    case "open_cash_drawer":
      return JOB_EXPIRY_SECONDS.cashDrawer;
    case "print_receipt_certificate":
      return mode === "manual"
        ? JOB_EXPIRY_SECONDS.receiptManual
        : JOB_EXPIRY_SECONDS.receiptAutomatic;
    case "print_label_sato":
      return JOB_EXPIRY_SECONDS.inventoryLabel;
    case "test_label_printer":
    case "test_document_printer":
    case "test_cash_drawer":
      return JOB_EXPIRY_SECONDS.hardwareTest;
  }
}

export function getHardwareJobExpiresAt({
  jobType,
  mode,
  now = new Date(),
}: {
  jobType: HardwareJobType;
  mode: HardwareJobCreationMode;
  now?: Date;
}): Date {
  return new Date(
    now.getTime() + getHardwareJobExpirySeconds(jobType, mode) * 1000,
  );
}

export function isHardwareJobV2TransitionAllowed(
  from: HardwareJobV2Status,
  to: HardwareJobV2Status,
  context: HardwareJobTransitionContext = {},
): boolean {
  if (from === to) {
    return true;
  }

  if (!hardwareJobTransitions[from].includes(to)) {
    return false;
  }

  if (from === "processing") {
    if (to === "pending") {
      return !context.dispatchStarted && context.retrySafe === true;
    }

    if (to === "failed" || to === "cancelled") {
      return !context.dispatchStarted;
    }

    if (to === "unknown_outcome") {
      return context.dispatchStarted === true;
    }
  }

  if (from === "failed" && to === "pending") {
    return context.retrySafe === true || context.manualRetry === true;
  }

  if (from === "unknown_outcome") {
    if (to === "pending") {
      return context.manualRetry === true;
    }

    return context.manualResolution === true;
  }

  return true;
}

export function isHardwareJobAttemptTransitionAllowed(
  from: HardwareJobAttemptStatus,
  to: HardwareJobAttemptStatus,
): boolean {
  return from === to || hardwareJobAttemptTransitions[from].includes(to);
}

export function isHardwareJobV2TerminalStatus(
  status: HardwareJobV2Status,
): boolean {
  return status === "completed" || status === "expired" || status === "cancelled";
}

export function isHardwareJobAttemptTerminalStatus(
  status: HardwareJobAttemptStatus,
): boolean {
  return [
    "acknowledged",
    "failed_before_dispatch",
    "unknown_after_dispatch",
    "lease_expired",
    "cancelled",
  ].includes(status);
}
