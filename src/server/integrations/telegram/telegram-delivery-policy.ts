export const TELEGRAM_DELIVERY_BATCH_SIZE = 20;
export const TELEGRAM_STALE_PROCESSING_MS = 30 * 60 * 1000;

const RETRY_DELAYS_MS = [
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
] as const;

export function telegramRetryDelayMs(
  completedAttemptNumber: number,
  retryAfterSeconds: number | null = null,
): number {
  if (!Number.isSafeInteger(completedAttemptNumber) || completedAttemptNumber <= 0) {
    throw new Error("TELEGRAM_RETRY_ATTEMPT_INVALID");
  }

  const policyIndex = Math.min(
    completedAttemptNumber - 1,
    RETRY_DELAYS_MS.length - 1,
  );
  const policyDelay = RETRY_DELAYS_MS[policyIndex] ?? 60 * 60 * 1000;
  const telegramDelay =
    retryAfterSeconds !== null &&
    Number.isSafeInteger(retryAfterSeconds) &&
    retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : 0;

  return Math.max(policyDelay, telegramDelay);
}
