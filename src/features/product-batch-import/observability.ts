type ProductBatchImportLogLevel = "info" | "warning" | "error";

type ProductBatchImportLogEntry = {
  event: string;
  level?: ProductBatchImportLogLevel;
  sessionId?: string | null;
  organizationId?: string | null;
  durationMs?: number | null;
  [key: string]: unknown;
};

function boundedMessage(error: unknown) {
  const value =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  return value.replace(/[\r\n]+/g, " ").slice(0, 1_000);
}

export function getProductBatchImportErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  const code = candidate.code ?? candidate.cause?.code;
  return typeof code === "string" ? code.slice(0, 120) : null;
}

export function logProductBatchImportEvent(entry: ProductBatchImportLogEntry) {
  const payload = {
    scope: "product_batch_import",
    timestamp: new Date().toISOString(),
    level: entry.level ?? "info",
    ...entry,
  };
  const serialized = JSON.stringify(payload);
  if (payload.level === "error") {
    console.error(serialized);
    return;
  }
  if (payload.level === "warning") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

export function logProductBatchImportError({
  error,
  ...entry
}: ProductBatchImportLogEntry & { error: unknown }) {
  logProductBatchImportEvent({
    ...entry,
    level: "error",
    errorCode: getProductBatchImportErrorCode(error),
    message: boundedMessage(error),
  });
}
