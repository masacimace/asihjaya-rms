import { createHash } from "crypto";

type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

export function canonicalizeHardwareJobPayload(value: unknown): CanonicalJson {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON tidak menerima NaN atau Infinity.");
    }
    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeHardwareJobPayload(entry));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, CanonicalJson> = {};

    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (
        entry === undefined ||
        typeof entry === "function" ||
        typeof entry === "symbol"
      ) {
        continue;
      }
      normalized[key] = canonicalizeHardwareJobPayload(entry);
    }

    return normalized;
  }

  throw new TypeError(
    `Canonical JSON tidak mendukung value bertipe ${typeof value}.`,
  );
}

export function stringifyHardwareJobPayload(value: unknown): string {
  return JSON.stringify(canonicalizeHardwareJobPayload(value));
}

export function hashHardwareJobPayloadV2(value: unknown): string {
  return createHash("sha256")
    .update(stringifyHardwareJobPayload(value), "utf8")
    .digest("hex");
}
