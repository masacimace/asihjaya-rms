const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLegacyMigrationUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function parseLegacyMigrationUuid(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return isLegacyMigrationUuid(normalized) ? normalized : null;
}

export function getLegacyMigrationSessionLockKey(input: {
  organizationId: string;
  sessionId: string;
}) {
  return `legacy-session:${input.organizationId}:${input.sessionId}`;
}
