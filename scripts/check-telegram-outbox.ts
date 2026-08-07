import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  assertTelegramDeliveryAttemptNumber,
  assertTelegramDeliveryTransition,
  assertTelegramMessageText,
  assertTelegramReportPeriod,
  canTransitionTelegramDelivery,
  normalizeTelegramEventKey,
} from "@/server/integrations/telegram/telegram-outbox-contract";

const projectRoot = process.cwd();
const migrationPath = path.join(
  projectRoot,
  "drizzle",
  "0013_telegram_reporting_foundation.sql",
);
const schemaPath = path.join(projectRoot, "src", "db", "schema", "index.ts");
const migrationSql = readFileSync(migrationPath, "utf8");
const schemaSource = readFileSync(schemaPath, "utf8");

function assertContains(source: string, value: string, label: string) {
  assert.ok(source.includes(value), `${label} belum ditemukan.`);
}

for (const tableName of [
  "finance_closing_snapshots",
  "telegram_destinations",
  "telegram_report_settings",
  "telegram_delivery_outbox",
  "telegram_delivery_attempts",
]) {
  assertContains(migrationSql, `CREATE TABLE "${tableName}"`, `Migration tabel ${tableName}`);
}

for (const value of [
  'ALTER TABLE "shifts" ADD COLUMN "business_date" date',
  'ALTER TABLE "sale_items" ADD COLUMN "cost_amount_snapshot" numeric(18, 0)',
  'telegram_delivery_outbox_event_destination_uq',
  'telegram_destinations_one_active_per_outlet_uq',
  'telegram_delivery_attempts_delivery_number_uq',
  'finance_closing_snapshots_outlet_business_date_uq',
]) {
  assertContains(migrationSql, value, `Contract migration ${value}`);
}

for (const value of [
  "businessDate: date(\"business_date\"",
  "costAmountSnapshot: numeric(\"cost_amount_snapshot\"",
  "export const financeClosingSnapshots",
  "export const telegramDestinations",
  "export const telegramReportSettings",
  "export const telegramDeliveryOutbox",
  "export const telegramDeliveryAttempts",
]) {
  assertContains(schemaSource, value, `Drizzle schema ${value}`);
}

assert.equal(normalizeTelegramEventKey("  opening:outlet:2026-08-07  "), "opening:outlet:2026-08-07");
assert.throws(() => normalizeTelegramEventKey("   "), /TELEGRAM_EVENT_KEY_REQUIRED/);
assert.throws(() => normalizeTelegramEventKey("x".repeat(201)), /TELEGRAM_EVENT_KEY_TOO_LONG/);

assert.doesNotThrow(() => assertTelegramMessageText("test"));
assert.throws(() => assertTelegramMessageText(""), /TELEGRAM_MESSAGE_TEXT_REQUIRED/);
assert.throws(
  () => assertTelegramMessageText("x".repeat(4097)),
  /TELEGRAM_MESSAGE_TEXT_TOO_LONG/,
);

assert.doesNotThrow(() =>
  assertTelegramReportPeriod({
    reportType: "closing_daily",
    businessDate: "2026-08-07",
  }),
);
assert.doesNotThrow(() =>
  assertTelegramReportPeriod({
    reportType: "weekly",
    periodStart: "2026-08-03",
    periodEnd: "2026-08-09",
  }),
);
assert.doesNotThrow(() => assertTelegramReportPeriod({ reportType: "test" }));
assert.throws(
  () => assertTelegramReportPeriod({ reportType: "opening" }),
  /TELEGRAM_DAILY_BUSINESS_DATE_REQUIRED/,
);
assert.throws(
  () =>
    assertTelegramReportPeriod({
      reportType: "monthly",
      periodStart: "2026-08-31",
      periodEnd: "2026-08-01",
    }),
  /TELEGRAM_REPORT_PERIOD_INVALID/,
);

for (const [from, to] of [
  ["pending", "processing"],
  ["pending", "cancelled"],
  ["processing", "sent"],
  ["processing", "retry"],
  ["processing", "failed"],
  ["retry", "processing"],
  ["retry", "cancelled"],
  ["failed", "retry"],
  ["failed", "cancelled"],
] as const) {
  assert.equal(canTransitionTelegramDelivery(from, to), true, `${from}->${to} harus valid.`);
  assert.doesNotThrow(() => assertTelegramDeliveryTransition(from, to));
}

for (const [from, to] of [
  ["pending", "sent"],
  ["retry", "sent"],
  ["sent", "retry"],
  ["cancelled", "pending"],
] as const) {
  assert.equal(canTransitionTelegramDelivery(from, to), false, `${from}->${to} harus ditolak.`);
  assert.throws(
    () => assertTelegramDeliveryTransition(from, to),
    /TELEGRAM_DELIVERY_INVALID_TRANSITION/,
  );
}

assert.doesNotThrow(() =>
  assertTelegramDeliveryAttemptNumber({ attemptNumber: 1, maxAttempts: 5 }),
);
assert.throws(
  () => assertTelegramDeliveryAttemptNumber({ attemptNumber: 6, maxAttempts: 5 }),
  /TELEGRAM_ATTEMPT_NUMBER_INVALID/,
);

async function checkDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  assert.ok(databaseUrl, "DATABASE_URL wajib untuk --database.");

  const { Client } = await import("pg");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  async function expectSqlState(sql: string, params: unknown[], sqlState: string) {
    const savepoint = `sp_${randomUUID().replaceAll("-", "")}`;
    await client.query(`SAVEPOINT ${savepoint}`);
    try {
      await client.query(sql, params);
      assert.fail(`Query seharusnya gagal dengan SQLSTATE ${sqlState}.`);
    } catch (error) {
      const code = (error as { code?: string }).code;
      assert.equal(code, sqlState, `Expected SQLSTATE ${sqlState}, ditemukan ${code ?? "unknown"}.`);
    } finally {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    }
  }

  try {
    const tables = await client.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_name = any($1::text[])`,
      [[
        "finance_closing_snapshots",
        "telegram_destinations",
        "telegram_report_settings",
        "telegram_delivery_outbox",
        "telegram_delivery_attempts",
      ]],
    );
    assert.equal(tables.rowCount, 5, "Seluruh tabel Telegram/finance snapshot harus tersedia.");

    await client.query("BEGIN");

    const organizationId = randomUUID();
    const outletId = randomUUID();
    const secondOutletId = randomUUID();
    const userId = randomUUID();
    const destinationId = randomUUID();
    const deliveryId = randomUUID();

    await client.query(
      `insert into organizations (id, name, slug)
       values ($1, 'Telegram Test Org', $2)`,
      [organizationId, `telegram-test-${organizationId.slice(0, 8)}`],
    );
    await client.query(
      `insert into outlets (id, organization_id, code, name)
       values ($1, $2, 'TGA', 'Telegram Outlet A'),
              ($3, $2, 'TGB', 'Telegram Outlet B')`,
      [outletId, organizationId, secondOutletId],
    );
    await client.query(
      `insert into users (id, organization_id, email, username, full_name)
       values ($1, $2, $3, $4, 'Telegram Tester')`,
      [
        userId,
        organizationId,
        `telegram-${userId.slice(0, 8)}@example.test`,
        `telegram_${userId.slice(0, 8)}`,
      ],
    );
    await client.query(
      `insert into telegram_destinations
        (id, organization_id, outlet_id, name, chat_id, created_by, updated_by)
       values ($1, $2, $3, 'Development Group', '-1001234567890', $4, $4)`,
      [destinationId, organizationId, outletId, userId],
    );
    await client.query(
      `insert into telegram_report_settings
        (destination_id, opening_enabled, closing_daily_enabled, weekly_enabled, monthly_enabled)
       values ($1, true, true, true, true)`,
      [destinationId],
    );

    await expectSqlState(
      `insert into telegram_destinations
        (organization_id, outlet_id, name, chat_id, created_by, updated_by)
       values ($1, $2, 'Duplicate Active', '-1001234567891', $3, $3)`,
      [organizationId, outletId, userId],
      "23505",
    );
    await expectSqlState(
      `insert into telegram_destinations
        (organization_id, outlet_id, name, chat_id, created_by, updated_by)
       values ($1, $2, 'Duplicate Chat', '-1001234567890', $3, $3)`,
      [organizationId, secondOutletId, userId],
      "23505",
    );

    await client.query(
      `insert into telegram_delivery_outbox
        (id, organization_id, event_key, destination_id, outlet_id, report_type,
         business_date, payload_snapshot_json, message_text)
       values ($1, $2, 'daily-finance:test:2026-08-07', $3, $4, 'closing_daily',
         '2026-08-07', '{"snapshot":true}'::jsonb, 'Daily test')`,
      [deliveryId, organizationId, destinationId, outletId],
    );

    await expectSqlState(
      `insert into telegram_delivery_outbox
        (organization_id, event_key, destination_id, outlet_id, report_type,
         business_date, payload_snapshot_json, message_text)
       values ($1, 'daily-finance:test:2026-08-07', $2, $3, 'closing_daily',
         '2026-08-07', '{}'::jsonb, 'Duplicate')`,
      [organizationId, destinationId, outletId],
      "23505",
    );

    await expectSqlState(
      `update telegram_delivery_outbox
       set status = 'processing', locked_at = null, locked_by = null
       where id = $1`,
      [deliveryId],
      "23514",
    );
    await expectSqlState(
      `update telegram_delivery_outbox
       set status = 'sent', sent_at = null, telegram_message_id = null
       where id = $1`,
      [deliveryId],
      "23514",
    );

    await client.query(
      `insert into telegram_delivery_attempts
        (delivery_id, attempt_number, requested_at, completed_at, http_status,
         telegram_ok, telegram_message_id, duration_ms)
       values ($1, 1, now(), now(), 200, true, '1001', 12)`,
      [deliveryId],
    );
    await expectSqlState(
      `insert into telegram_delivery_attempts
        (delivery_id, attempt_number)
       values ($1, 1)`,
      [deliveryId],
      "23505",
    );

    await client.query("ROLLBACK");
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Connection may already be outside a transaction after a successful rollback.
    }
    await client.end();
  }
}

if (process.argv.includes("--database")) {
  await checkDatabase();
}

console.log(
  process.argv.includes("--database")
    ? "Telegram 2C.3 outbox checks passed: schema, constraints, idempotency, audit attempts, dan state contract."
    : "Telegram 2C.3 outbox contract checks passed: migration/schema presence, report periods, idempotency inputs, dan state transitions.",
);
