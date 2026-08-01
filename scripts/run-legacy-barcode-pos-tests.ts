import { URL } from "node:url";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} wajib diatur. Gunakan database PostgreSQL 17 disposable khusus test.`,
    );
  }
  return value;
}

function assertSafeTestDatabase(databaseUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL bukan URL PostgreSQL yang valid.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("TEST_DATABASE_URL wajib memakai protocol PostgreSQL.");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/(?:^|[_-])(test|ci)(?:$|[_-])/i.test(databaseName)) {
    throw new Error(
      `Database ${databaseName || "(kosong)"} ditolak. Nama database test wajib mengandung token test atau ci.`,
    );
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "postgres"]);
  if (
    !localHosts.has(parsed.hostname) &&
    process.env.ALLOW_REMOTE_TEST_DATABASE !== "true"
  ) {
    throw new Error(
      `Host ${parsed.hostname} ditolak. Set ALLOW_REMOTE_TEST_DATABASE=true hanya untuk database CI disposable yang terpercaya.`,
    );
  }

  const forbiddenNames = new Set([
    "asihjaya",
    "asihjaya_rms",
    "postgres",
    "production",
    "prod",
  ]);
  if (forbiddenNames.has(databaseName.toLowerCase())) {
    throw new Error(`Database ${databaseName} bukan database test disposable.`);
  }
}

const testDatabaseUrl = required("TEST_DATABASE_URL");
assertSafeTestDatabase(testDatabaseUrl);

process.env.DATABASE_URL = testDatabaseUrl;
Object.assign(process.env, { NODE_ENV: "test" });
process.env.APP_URL ??= "http://127.0.0.1:3000";
process.env.INTERNAL_RENDER_ORIGIN ??= "http://127.0.0.1:3000";
process.env.DEFAULT_ORGANIZATION_SLUG ??= "asihjaya-test";
process.env.SESSION_SECRET ??=
  "test-session-secret-000000000000000000000000000000000000000";
process.env.RECEIPT_VERIFICATION_SECRET ??=
  "test-receipt-secret-00000000000000000000000000000000000000";
process.env.CUSTOMER_HISTORY_SESSION_SECRET ??=
  "test-history-session-secret-000000000000000000000000000000000";
process.env.CUSTOMER_HISTORY_PIN_PEPPER ??=
  "test-history-pin-pepper-00000000000000000000000000000000000";
process.env.SECURITY_RATE_LIMIT_SECRET ??=
  "test-rate-limit-secret-000000000000000000000000000000000000";
process.env.PDF_RENDER_TOKEN_SECRET ??=
  "test-pdf-render-secret-000000000000000000000000000000000000";
process.env.HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY ??=
  "test-agent-encryption-key-000000000000000000000000000000000";

const { runLegacyBarcodePosSuite } = await import(
  "../tests/integration/legacy-barcode-pos-suite"
);

await runLegacyBarcodePosSuite();
