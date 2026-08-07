export const TELEGRAM_REPORT_TYPES = [
  "opening",
  "closing_daily",
  "weekly",
  "monthly",
  "test",
] as const;

export type TelegramReportType = (typeof TELEGRAM_REPORT_TYPES)[number];

export const TELEGRAM_DELIVERY_STATUSES = [
  "pending",
  "processing",
  "retry",
  "sent",
  "failed",
  "cancelled",
] as const;

export type TelegramDeliveryStatus =
  (typeof TELEGRAM_DELIVERY_STATUSES)[number];

const allowedTransitions: Record<
  TelegramDeliveryStatus,
  readonly TelegramDeliveryStatus[]
> = {
  pending: ["processing", "cancelled"],
  processing: ["sent", "retry", "failed"],
  retry: ["processing", "cancelled"],
  sent: [],
  failed: ["retry", "cancelled"],
  cancelled: [],
};

export function canTransitionTelegramDelivery(
  from: TelegramDeliveryStatus,
  to: TelegramDeliveryStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTelegramDeliveryTransition(
  from: TelegramDeliveryStatus,
  to: TelegramDeliveryStatus,
): void {
  if (!canTransitionTelegramDelivery(from, to)) {
    throw new Error(`TELEGRAM_DELIVERY_INVALID_TRANSITION:${from}->${to}`);
  }
}

export function normalizeTelegramEventKey(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("TELEGRAM_EVENT_KEY_REQUIRED");
  }

  if (normalized.length > 200) {
    throw new Error("TELEGRAM_EVENT_KEY_TOO_LONG");
  }

  return normalized;
}

export function assertTelegramMessageText(value: string): void {
  if (value.length === 0) {
    throw new Error("TELEGRAM_MESSAGE_TEXT_REQUIRED");
  }

  if (value.length > 4096) {
    throw new Error("TELEGRAM_MESSAGE_TEXT_TOO_LONG");
  }
}

export function assertIsoBusinessDate(value: string | null | undefined): void {
  if (value == null) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("TELEGRAM_BUSINESS_DATE_INVALID");
  }
}

export function assertTelegramReportPeriod(input: {
  reportType: TelegramReportType;
  businessDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}): void {
  const { reportType, businessDate = null, periodStart = null, periodEnd = null } =
    input;

  assertIsoBusinessDate(businessDate);
  assertIsoBusinessDate(periodStart);
  assertIsoBusinessDate(periodEnd);

  if (reportType === "opening" || reportType === "closing_daily") {
    if (!businessDate) {
      throw new Error("TELEGRAM_DAILY_BUSINESS_DATE_REQUIRED");
    }

    if (periodStart || periodEnd) {
      throw new Error("TELEGRAM_DAILY_PERIOD_NOT_ALLOWED");
    }

    return;
  }

  if (reportType === "weekly" || reportType === "monthly") {
    if (!periodStart || !periodEnd) {
      throw new Error("TELEGRAM_REPORT_PERIOD_REQUIRED");
    }

    if (periodEnd < periodStart) {
      throw new Error("TELEGRAM_REPORT_PERIOD_INVALID");
    }

    return;
  }

  if (reportType === "test" && (businessDate || periodStart || periodEnd)) {
    throw new Error("TELEGRAM_TEST_PERIOD_NOT_ALLOWED");
  }
}

export function assertTelegramDeliveryAttemptNumber(input: {
  attemptNumber: number;
  maxAttempts: number;
}): void {
  const { attemptNumber, maxAttempts } = input;

  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error("TELEGRAM_MAX_ATTEMPTS_INVALID");
  }

  if (
    !Number.isInteger(attemptNumber) ||
    attemptNumber <= 0 ||
    attemptNumber > maxAttempts
  ) {
    throw new Error("TELEGRAM_ATTEMPT_NUMBER_INVALID");
  }
}
