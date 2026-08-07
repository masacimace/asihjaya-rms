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
