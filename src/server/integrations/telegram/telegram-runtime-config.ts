const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);

export type TelegramRuntimeOutboxConfig = {
  enabled: boolean;
  maxAttempts: number;
};

function parseBoolean(value: string | undefined): boolean {
  return TRUE_VALUES.has(value?.trim().toLowerCase() ?? "");
}

function parseMaxAttempts(value: string | undefined): number {
  const normalized = value?.trim();
  if (!normalized) return 5;

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 10) {
    return 5;
  }

  return parsed;
}

export function getTelegramRuntimeOutboxConfig(
  source: Readonly<Record<string, string | undefined>> = process.env,
): TelegramRuntimeOutboxConfig {
  return {
    enabled: parseBoolean(source.TELEGRAM_INTEGRATION_ENABLED),
    maxAttempts: parseMaxAttempts(source.TELEGRAM_MAX_ATTEMPTS),
  };
}


export type TelegramDeliveryWorkerRuntimeConfig = {
  enabled: boolean;
  botToken: string;
  apiBaseUrl: string;
  requestTimeoutMs: number;
};

function parseRequestTimeoutMs(value: string | undefined): number {
  const normalized = value?.trim();
  if (!normalized) return 10_000;

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 250 || parsed > 60_000) {
    return 10_000;
  }
  return parsed;
}

function normalizeWorkerApiBaseUrl(value: string | undefined): string {
  const normalized = value?.trim() || "https://api.telegram.org";
  const parsed = new URL(normalized);

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("TELEGRAM_API_BASE_URL_INVALID");
  }

  if (parsed.protocol === "http:" && !["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
    throw new Error("TELEGRAM_API_BASE_URL_INSECURE");
  }

  if (process.env.NODE_ENV === "production" && parsed.origin !== "https://api.telegram.org") {
    throw new Error("TELEGRAM_API_BASE_URL_PRODUCTION_INVALID");
  }

  return parsed.origin;
}

export function getTelegramDeliveryWorkerRuntimeConfig(
  source: Readonly<Record<string, string | undefined>> = process.env,
): TelegramDeliveryWorkerRuntimeConfig {
  const enabled = parseBoolean(source.TELEGRAM_INTEGRATION_ENABLED);
  const botToken = source.TELEGRAM_BOT_TOKEN?.trim() ?? "";

  if (enabled && !botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN_REQUIRED");
  }

  return {
    enabled,
    botToken,
    apiBaseUrl: normalizeWorkerApiBaseUrl(source.TELEGRAM_API_BASE_URL),
    requestTimeoutMs: parseRequestTimeoutMs(source.TELEGRAM_REQUEST_TIMEOUT_MS),
  };
}
