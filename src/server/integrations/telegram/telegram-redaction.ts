const TELEGRAM_TOKEN_PATTERN = /\b\d{5,20}:[A-Za-z0-9_-]{20,}\b/g;
const TELEGRAM_BOT_PATH_TOKEN_PATTERN = /(\/bot)([^/\s?]+)/gi;

const REDACTED_TELEGRAM_TOKEN = "[REDACTED_TELEGRAM_BOT_TOKEN]";

export function redactTelegramSecrets(
  value: string,
  explicitToken?: string | null,
): string {
  let redacted = value;
  const token = explicitToken?.trim();

  if (token) {
    redacted = redacted.replaceAll(token, REDACTED_TELEGRAM_TOKEN);
  }

  return redacted
    .replace(TELEGRAM_TOKEN_PATTERN, REDACTED_TELEGRAM_TOKEN)
    .replace(
      TELEGRAM_BOT_PATH_TOKEN_PATTERN,
      `$1${REDACTED_TELEGRAM_TOKEN}`,
    );
}
