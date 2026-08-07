import { TelegramClientError } from "./telegram-errors";
import type {
  TelegramApiMethod,
  TelegramClientLogEntry,
} from "./telegram-types";

export function telegramSuccessLogEntry({
  method,
  httpStatus,
  durationMs,
}: {
  method: TelegramApiMethod;
  httpStatus: number;
  durationMs: number;
}): TelegramClientLogEntry {
  return {
    event: "telegram_request",
    method,
    outcome: "success",
    httpStatus,
    telegramErrorCode: null,
    retryable: false,
    retryAfterSeconds: null,
    durationMs,
    errorKind: null,
  };
}

export function telegramFailureLogEntry(
  error: TelegramClientError,
): TelegramClientLogEntry {
  return {
    event: "telegram_request",
    method: error.method,
    outcome: "failure",
    httpStatus: error.httpStatus,
    telegramErrorCode: error.telegramErrorCode,
    retryable: error.retryable,
    retryAfterSeconds: error.retryAfterSeconds,
    durationMs: error.durationMs,
    errorKind: error.kind,
  };
}
