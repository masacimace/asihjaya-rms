import {
  isTelegramRetryableStatus,
  TelegramClientError,
} from "./telegram-errors";
import {
  telegramFailureLogEntry,
  telegramSuccessLogEntry,
} from "./telegram-logging";
import { redactTelegramSecrets } from "./telegram-redaction";
import type {
  TelegramApiEnvelope,
  TelegramApiMethod,
  TelegramBotIdentity,
  TelegramClientLogEntry,
  TelegramClientLogger,
  TelegramSendMessageInput,
  TelegramSentMessage,
} from "./telegram-types";

const TELEGRAM_TEXT_MAX_LENGTH = 4096;

export type TelegramClientConfig = {
  apiBaseUrl: string;
  botToken: string;
  timeoutMs: number;
  logger?: TelegramClientLogger;
};

type TelegramWireBotIdentity = {
  id?: unknown;
  is_bot?: unknown;
  first_name?: unknown;
  username?: unknown;
};

type TelegramWireSentMessage = {
  message_id?: unknown;
  chat?: {
    id?: unknown;
  };
};

function normalizeApiBaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Telegram apiBaseUrl harus berupa URL HTTP(S) yang valid.");
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "Telegram apiBaseUrl harus berupa origin HTTP(S) tanpa credential, path, query, atau hash.",
    );
  }

  return parsed.origin;
}

function requirePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} harus berupa bilangan bulat positif.`);
  }
  return value;
}

function retryAfterSeconds(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
    ? value
    : null;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function safeDescription(value: unknown, botToken: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return redactTelegramSecrets(value.trim(), botToken);
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function chatIdString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export class TelegramClient {
  private readonly apiBaseUrl: string;
  private readonly botToken: string;
  private readonly timeoutMs: number;
  private readonly logger?: TelegramClientLogger;

  constructor(config: TelegramClientConfig) {
    this.apiBaseUrl = normalizeApiBaseUrl(config.apiBaseUrl);
    this.botToken = config.botToken.trim();
    this.timeoutMs = requirePositiveInteger(config.timeoutMs, "Telegram timeoutMs");
    this.logger = config.logger;

    if (!this.botToken) {
      throw new Error("Telegram botToken wajib diatur.");
    }
  }

  async getMe(): Promise<TelegramBotIdentity> {
    return this.request<TelegramWireBotIdentity, TelegramBotIdentity>({
      method: "getMe",
      parseResult: (result, errorContext) => {
        if (
          typeof result.id !== "number" ||
          !Number.isFinite(result.id) ||
          typeof result.is_bot !== "boolean" ||
          typeof result.first_name !== "string" ||
          !result.first_name.trim() ||
          (result.username !== undefined && typeof result.username !== "string")
        ) {
          throw errorContext("Telegram getMe result tidak valid.");
        }

        return {
          id: result.id,
          isBot: result.is_bot,
          firstName: result.first_name,
          username:
            typeof result.username === "string" && result.username.trim()
              ? result.username.trim()
              : null,
        };
      },
    });
  }

  async sendMessage(
    input: TelegramSendMessageInput,
  ): Promise<TelegramSentMessage> {
    const chatId = input.chatId.trim();
    const text = input.text;

    if (!chatId) {
      throw new Error("Telegram sendMessage chatId wajib diisi.");
    }
    if (!text.trim()) {
      throw new Error("Telegram sendMessage text tidak boleh kosong.");
    }
    if (text.length > TELEGRAM_TEXT_MAX_LENGTH) {
      throw new Error(
        `Telegram sendMessage text maksimal ${TELEGRAM_TEXT_MAX_LENGTH} karakter.`,
      );
    }

    return this.request<TelegramWireSentMessage, TelegramSentMessage>({
      method: "sendMessage",
      payload: {
        chat_id: chatId,
        text,
      },
      parseResult: (result, errorContext) => {
        const resultChatId = chatIdString(result.chat?.id);
        if (
          typeof result.message_id !== "number" ||
          !Number.isFinite(result.message_id) ||
          !resultChatId
        ) {
          throw errorContext("Telegram sendMessage result tidak valid.");
        }

        return {
          messageId: result.message_id,
          chatId: resultChatId,
        };
      },
    });
  }

  private async request<TWireResult extends object, TResult>({
    method,
    payload,
    parseResult,
  }: {
    method: TelegramApiMethod;
    payload?: Record<string, unknown>;
    parseResult: (
      result: TWireResult,
      errorContext: (message: string) => TelegramClientError,
    ) => TResult;
  }): Promise<TResult> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let httpStatus: number | null = null;

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/bot${this.botToken}/${method}`,
        {
          method: payload ? "POST" : "GET",
          headers: payload ? { "content-type": "application/json" } : undefined,
          body: payload ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        },
      );
      httpStatus = response.status;
      const rawBody = await response.text();
      const durationMs = elapsedMs(startedAt);

      let envelope: TelegramApiEnvelope<TWireResult>;
      try {
        envelope = JSON.parse(rawBody) as TelegramApiEnvelope<TWireResult>;
      } catch {
        throw new TelegramClientError({
          kind: "invalid_response",
          method,
          message: `Telegram ${method} mengembalikan JSON yang tidak valid (HTTP ${response.status}).`,
          httpStatus: response.status,
          retryable:
            response.status >= 500 ||
            response.status === 408 ||
            response.status === 429 ||
            response.ok,
          durationMs,
        });
      }

      if (!envelope || typeof envelope !== "object" || typeof envelope.ok !== "boolean") {
        throw new TelegramClientError({
          kind: "invalid_response",
          method,
          message: `Telegram ${method} mengembalikan envelope yang tidak valid (HTTP ${response.status}).`,
          httpStatus: response.status,
          retryable: response.status >= 500 || response.ok,
          durationMs,
        });
      }

      if (!response.ok || envelope.ok !== true) {
        const telegramErrorCode =
          typeof envelope.error_code === "number" &&
          Number.isFinite(envelope.error_code)
            ? envelope.error_code
            : null;
        const retryAfter = retryAfterSeconds(envelope.parameters?.retry_after);
        const description = safeDescription(envelope.description, this.botToken);
        const suffix = description ? ` ${description}` : "";

        throw new TelegramClientError({
          kind: "api",
          method,
          message: `Telegram ${method} gagal (HTTP ${response.status}${telegramErrorCode !== null ? `, code ${telegramErrorCode}` : ""}).${suffix}`,
          httpStatus: response.status,
          telegramErrorCode,
          retryAfterSeconds: retryAfter,
          retryable: isTelegramRetryableStatus(
            response.status,
            telegramErrorCode,
          ),
          durationMs,
        });
      }

      if (!envelope.result || typeof envelope.result !== "object") {
        throw new TelegramClientError({
          kind: "invalid_response",
          method,
          message: `Telegram ${method} tidak mengembalikan result yang valid.`,
          httpStatus: response.status,
          retryable: true,
          durationMs,
        });
      }

      const result = parseResult(envelope.result, (message) =>
        new TelegramClientError({
          kind: "invalid_response",
          method,
          message,
          httpStatus: response.status,
          retryable: true,
          durationMs,
        }),
      );

      this.emitLog(
        telegramSuccessLogEntry({
          method,
          httpStatus: response.status,
          durationMs,
        }),
      );
      return result;
    } catch (error) {
      const durationMs = elapsedMs(startedAt);
      const telegramError =
        error instanceof TelegramClientError
          ? error
          : isAbortError(error)
            ? new TelegramClientError({
                kind: "timeout",
                method,
                message: `Telegram ${method} timeout setelah ${this.timeoutMs} ms.`,
                httpStatus,
                retryable: true,
                durationMs,
              })
            : new TelegramClientError({
                kind: "network",
                method,
                message: `Telegram ${method} gagal karena network error.`,
                httpStatus,
                retryable: true,
                durationMs,
              });

      this.emitLog(telegramFailureLogEntry(telegramError));
      throw telegramError;
    } finally {
      clearTimeout(timeout);
    }
  }

  private emitLog(entry: TelegramClientLogEntry) {
    if (!this.logger) return;
    try {
      this.logger(entry);
    } catch {
      // Logging tidak boleh mengubah hasil request Telegram.
    }
  }
}
