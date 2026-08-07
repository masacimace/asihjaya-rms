import type { TelegramApiMethod } from "./telegram-types";

export type TelegramErrorKind =
  | "timeout"
  | "network"
  | "api"
  | "invalid_response";

export type TelegramClientErrorOptions = {
  kind: TelegramErrorKind;
  method: TelegramApiMethod;
  message: string;
  httpStatus?: number | null;
  telegramErrorCode?: number | null;
  retryAfterSeconds?: number | null;
  retryable: boolean;
  durationMs: number;
};

export class TelegramClientError extends Error {
  readonly kind: TelegramErrorKind;
  readonly method: TelegramApiMethod;
  readonly httpStatus: number | null;
  readonly telegramErrorCode: number | null;
  readonly retryAfterSeconds: number | null;
  readonly retryable: boolean;
  readonly durationMs: number;

  constructor(options: TelegramClientErrorOptions) {
    super(options.message);
    this.name = "TelegramClientError";
    this.kind = options.kind;
    this.method = options.method;
    this.httpStatus = options.httpStatus ?? null;
    this.telegramErrorCode = options.telegramErrorCode ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.retryable = options.retryable;
    this.durationMs = options.durationMs;
  }
}

export function isTelegramClientError(
  error: unknown,
): error is TelegramClientError {
  return error instanceof TelegramClientError;
}

export function isTelegramRetryableStatus(
  httpStatus: number | null,
  telegramErrorCode: number | null,
): boolean {
  const effectiveCode = telegramErrorCode ?? httpStatus;

  if (httpStatus === 429 || telegramErrorCode === 429) return true;
  if (httpStatus === 408 || telegramErrorCode === 408) return true;
  if (httpStatus !== null && httpStatus >= 500 && httpStatus <= 599) return true;
  if (
    effectiveCode !== null &&
    effectiveCode >= 500 &&
    effectiveCode <= 599
  ) {
    return true;
  }

  return false;
}
