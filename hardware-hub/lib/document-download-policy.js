const MAX_RETRY_AFTER_MS = 15 * 60_000;
const DEFAULT_DOCUMENT_DOWNLOAD_TIMEOUT_MS = 90_000;

function parseRetryAfterMs(value, serverDate, now = Date.now()) {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) ? Math.min(seconds * 1000, MAX_RETRY_AFTER_MS) : null;
  }
  // Reject malformed numeric delays instead of interpreting them as calendar dates.
  if (!/^[A-Za-z]{3},/.test(text)) return null;
  const retryAt = Date.parse(text);
  const reference = Date.parse(serverDate);
  if (!Number.isFinite(retryAt)) return null;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, retryAt - (Number.isFinite(reference) ? reference : now)));
}

function resolveDocumentDownloadTimeoutMs(config) {
  const value = Number(config.documentDownloadTimeoutMs);
  return Number.isSafeInteger(value) && value > 0
    ? value : DEFAULT_DOCUMENT_DOWNLOAD_TIMEOUT_MS;
}

module.exports = { MAX_RETRY_AFTER_MS, DEFAULT_DOCUMENT_DOWNLOAD_TIMEOUT_MS, parseRetryAfterMs, resolveDocumentDownloadTimeoutMs };
