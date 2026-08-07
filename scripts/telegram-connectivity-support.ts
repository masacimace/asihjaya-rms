import { config as loadDotenv } from "dotenv";

import { redactTelegramSecrets } from "../src/server/integrations/telegram/telegram-redaction";

const DEFAULT_MOCK_API_BASE_URL = "http://127.0.0.1:8787";
const DEFAULT_MOCK_BOT_TOKEN = "local-mock-token";
const OFFICIAL_TELEGRAM_API_ORIGIN = "https://api.telegram.org";

export type TelegramDevelopmentConnectivityConfig = {
  apiBaseUrl: string;
  botToken: string;
  timeoutMs: number;
  chatId: string | null;
};

export type TelegramApiEnvelope<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
};

function parseBoolean(value: string | undefined): boolean {
  return ["true", "1", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} harus berupa bilangan bulat positif.`);
  }
  return parsed;
}

function parseApiOrigin(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("TELEGRAM_API_BASE_URL harus berupa URL HTTP(S) yang valid.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "TELEGRAM_API_BASE_URL harus berupa origin HTTP(S) tanpa credential, path, query, atau hash.",
    );
  }

  return url;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
}

export function assertDevelopmentTelegramApiAllowed(
  apiBaseUrl: string,
  allowRealApi: boolean,
): void {
  const url = parseApiOrigin(apiBaseUrl);

  if (isLoopbackHostname(url.hostname)) {
    return;
  }

  if (url.origin !== OFFICIAL_TELEGRAM_API_ORIGIN) {
    throw new Error(
      "Connectivity test non-loopback hanya boleh memakai API resmi https://api.telegram.org.",
    );
  }

  if (!allowRealApi) {
    throw new Error(
      "API Telegram nyata diblokir untuk connectivity test. Set TELEGRAM_DEV_REAL_API_ALLOWED=true hanya saat memakai bot + private group development.",
    );
  }
}

export function loadTelegramDevelopmentConnectivityConfig({
  requireChatId = false,
}: {
  requireChatId?: boolean;
} = {}): TelegramDevelopmentConnectivityConfig {
  loadDotenv({ path: ".env", quiet: true });

  const apiUrl = parseApiOrigin(
    process.env.TELEGRAM_API_BASE_URL?.trim() || DEFAULT_MOCK_API_BASE_URL,
  );
  const allowRealApi = parseBoolean(process.env.TELEGRAM_DEV_REAL_API_ALLOWED);

  assertDevelopmentTelegramApiAllowed(apiUrl.origin, allowRealApi);

  const configuredToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const botToken =
    configuredToken ||
    (isLoopbackHostname(apiUrl.hostname) ? DEFAULT_MOCK_BOT_TOKEN : "");

  if (!botToken) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN wajib diatur untuk connectivity test ke API Telegram nyata.",
    );
  }

  const chatId = process.env.TELEGRAM_DEV_CHAT_ID?.trim() || null;
  if (requireChatId && !chatId) {
    throw new Error(
      "TELEGRAM_DEV_CHAT_ID wajib diatur untuk mengirim test message development.",
    );
  }

  return {
    apiBaseUrl: apiUrl.origin,
    botToken,
    timeoutMs: parsePositiveInteger(
      process.env.TELEGRAM_REQUEST_TIMEOUT_MS,
      1_000,
      "TELEGRAM_REQUEST_TIMEOUT_MS",
    ),
    chatId,
  };
}

export async function requestTelegramDevelopmentApi<T>({
  config,
  method,
  payload,
}: {
  config: TelegramDevelopmentConnectivityConfig;
  method: "getMe" | "getUpdates" | "sendMessage";
  payload?: Record<string, unknown>;
}): Promise<TelegramApiEnvelope<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const requestUrl = `${config.apiBaseUrl}/bot${config.botToken}/${method}`;
    const response = await fetch(requestUrl, {
      method: payload ? "POST" : "GET",
      headers: payload ? { "content-type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new Error(
        `Telegram ${method} mengembalikan response JSON yang tidak valid (HTTP ${response.status}).`,
      );
    }

    if (!responseBody || typeof responseBody !== "object") {
      throw new Error(`Telegram ${method} mengembalikan response yang tidak valid.`);
    }

    return responseBody as TelegramApiEnvelope<T>;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Telegram connectivity request gagal.";
    throw new Error(redactTelegramSecrets(message, config.botToken), {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function formatTelegramDevelopmentFailure<T>(
  method: "getMe" | "getUpdates" | "sendMessage",
  response: TelegramApiEnvelope<T>,
): string {
  const code = response.error_code ? ` code=${response.error_code}` : "";
  const description = response.description
    ? ` description=${response.description}`
    : "";
  return `Telegram ${method} gagal.${code}${description}`;
}
