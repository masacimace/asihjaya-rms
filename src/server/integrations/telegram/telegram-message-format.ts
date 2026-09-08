export const TELEGRAM_MESSAGE_FORMAT_HTML = "html" as const;

export type TelegramMessageFormat = typeof TELEGRAM_MESSAGE_FORMAT_HTML;

const BIGINT_ZERO = BigInt(0);

export function escapeTelegramHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function telegramBold(value: string): string {
  return `<b>${escapeTelegramHtml(value)}</b>`;
}

export function formatTelegramRupiah(value: string): string {
  const amount = BigInt(value);
  const absolute = amount < BIGINT_ZERO ? -amount : amount;
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(absolute);
  return amount < BIGINT_ZERO ? `-Rp${formatted}` : `Rp${formatted}`;
}

export function formatTelegramRate(value: string): string {
  return `${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))}%`;
}

export function isTelegramHtmlPayload(payload: unknown): boolean {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      (payload as Record<string, unknown>).messageFormat ===
        TELEGRAM_MESSAGE_FORMAT_HTML,
  );
}
