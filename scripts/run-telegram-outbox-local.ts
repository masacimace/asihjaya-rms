import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";

const projectRoot = process.cwd();
const composeFile = path.join(projectRoot, "compose.database-deployment-test.yaml");
const projectName = `asihjaya-rms-telegram-outbox-${process.pid}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object", "Port test Telegram tidak tersedia.");
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function resolveNpm(args: string[]) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (!npmExecPath) {
    throw new Error("npm_execpath tidak tersedia. Jalankan melalui npm run test:telegram-outbox:local.");
  }
  return { executable: process.execPath, args: [npmExecPath, ...args] };
}

function run(
  executable: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  allowFailure = false,
) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    env: environment,
    stdio: allowFailure ? "ignore" : "inherit",
    shell: false,
  });
  if (result.error && !allowFailure) throw result.error;
  if ((result.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(`${executable} ${args.join(" ")} gagal dengan exit code ${result.status}.`);
  }
  return result.status === 0;
}

function runNpm(args: string[], environment: NodeJS.ProcessEnv) {
  const command = resolveNpm(args);
  run(command.executable, command.args, environment);
}

async function canConnectThroughPublishedPort(databaseUrl: string): Promise<boolean> {
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2_000,
  });
  let connected = false;

  try {
    await client.connect();
    connected = true;
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    if (connected) {
      await client.end().catch(() => undefined);
    }
  }
}

async function waitForPostgres(
  composeArgs: string[],
  environment: NodeJS.ProcessEnv,
  databaseUrl: string,
) {
  const deadline = Date.now() + 60_000;
  let consecutiveHostChecks = 0;

  while (Date.now() < deadline) {
    const containerReady = run(
      "docker",
      [
        ...composeArgs,
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "asihjaya_migration_test",
        "-d",
        "asihjaya_rms_migration_test",
      ],
      environment,
      true,
    );

    const hostReady = containerReady
      ? await canConnectThroughPublishedPort(databaseUrl)
      : false;

    if (hostReady) {
      consecutiveHostChecks += 1;
      if (consecutiveHostChecks >= 3) return;
      await delay(500);
      continue;
    }

    consecutiveHostChecks = 0;
    await delay(1_000);
  }

  throw new Error(
    "PostgreSQL 17 Telegram outbox test belum stabil melalui published port setelah 60 detik.",
  );
}

async function resetDatabase(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("drop schema if exists drizzle cascade");
    await client.query("drop schema if exists public cascade");
    await client.query("create schema public");
  } finally {
    await client.end();
  }
}

async function seedPreTelegramRows(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`
      insert into organizations (id, name, slug)
      values ('10000000-0000-0000-0000-000000000001', 'Upgrade Test', 'telegram-upgrade-test');

      insert into outlets (id, organization_id, code, name)
      values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'UPG', 'Upgrade Outlet');

      insert into registers (id, outlet_id, code, name, is_hardware_hub)
      values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'POS-1', 'POS 1', true);

      insert into users (id, organization_id, email, username, full_name)
      values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'upgrade@example.test', 'upgrade_test', 'Upgrade Tester');

      insert into product_categories (id, organization_id, code, name)
      values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'TEST', 'Test Category');

      insert into product_masters (id, organization_id, category_id, code, name, status)
      values ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'MASTER-1', 'Master Test', 'active');

      insert into product_items
        (id, organization_id, product_master_id, sku, barcode, cost_amount, selling_amount, availability)
      values
        ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'SKU-1', 'BARCODE-1', 700, 1000, 'sold');

      insert into shifts
        (id, outlet_id, register_id, opened_by, status, opening_cash, opened_at)
      values
        ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'open', 100000, '2026-08-07T01:00:00Z');

      insert into sales
        (id, organization_id, outlet_id, register_id, shift_id, cashier_id,
         invoice_number, idempotency_key, status, subtotal_amount, discount_amount,
         additional_fee_amount, total_amount, completed_at)
      values
        ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'INV-UPGRADE-1', 'checkout-upgrade-1', 'completed', 1000, 0, 0, 1000, '2026-08-07T02:00:00Z');

      insert into sale_items
        (id, sale_id, product_item_id, line_number, list_price_amount,
         discount_amount, final_price_amount, snapshot)
      values
        ('a0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 1, 1000, 0, 1000, '{"legacy":true}'::jsonb);
    `);
  } finally {
    await client.end();
  }
}

async function verifyUpgradeCompatibility(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const shift = await client.query<{ business_date: string | null }>(
      `select business_date::text as business_date
       from shifts where id = '80000000-0000-0000-0000-000000000001'`,
    );
    const item = await client.query<{ cost_amount_snapshot: string | null }>(
      `select cost_amount_snapshot::text as cost_amount_snapshot
       from sale_items where id = 'a0000000-0000-0000-0000-000000000001'`,
    );
    assert(
      shift.rows[0]?.business_date === null,
      "Existing shift harus tetap valid dengan business_date null.",
    );
    assert(
      item.rows[0]?.cost_amount_snapshot === null,
      "Existing sale item tidak boleh diberi historical cost palsu saat migration.",
    );
  } finally {
    await client.end();
  }
}

const port = await findAvailablePort();
const databaseUrl = `postgresql://asihjaya_migration_test:asihjaya_migration_test_password@127.0.0.1:${port}/asihjaya_rms_migration_test`;
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  DATABASE_DEPLOYMENT_TEST_PORT: String(port),
};
const composeArgs = ["compose", "--project-name", projectName, "-f", composeFile];
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "asihjaya-telegram-outbox-"));

console.log("Menyalakan PostgreSQL 17 disposable untuk Telegram 2C.3...");
run("docker", [...composeArgs, "down", "--volumes", "--remove-orphans"], environment, true);

try {
  run("docker", [...composeArgs, "up", "-d"], environment);
  await waitForPostgres(composeArgs, environment, databaseUrl);

  console.log("[fresh] Menjalankan seluruh migration dari baseline sampai 0013...");
  await resetDatabase(databaseUrl);
  runNpm(["run", "db:migrate"], environment);
  runNpm(["run", "check:telegram-outbox", "--", "--database"], environment);

  console.log("[upgrade] Menyiapkan database existing hanya sampai migration 0012...");
  await resetDatabase(databaseUrl);
  const oldMigrations = path.join(temporaryRoot, "drizzle-through-0012");
  cpSync(path.join(projectRoot, "drizzle"), oldMigrations, { recursive: true });
  const journalPath = path.join(oldMigrations, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: Array<{ idx: number }>;
  };
  journal.entries = journal.entries.filter((entry) => entry.idx <= 12);
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
  unlinkSync(path.join(oldMigrations, "0013_telegram_reporting_foundation.sql"));
  unlinkSync(path.join(oldMigrations, "meta", "0013_snapshot.json"));

  runNpm(["run", "db:migrate"], {
    ...environment,
    DRIZZLE_MIGRATIONS_DIR: oldMigrations,
  });
  await seedPreTelegramRows(databaseUrl);

  console.log("[upgrade] Mengaplikasikan migration 0013 ke data existing...");
  runNpm(["run", "db:migrate"], environment);
  await verifyUpgradeCompatibility(databaseUrl);
  runNpm(["run", "check:telegram-outbox", "--", "--database"], environment);

  console.log(
    "Telegram 2C.3 local database rehearsal passed: fresh DB, upgraded DB, compatibility nulls, constraints, idempotency, dan attempt audit.",
  );
} finally {
  console.log("Menghapus PostgreSQL Telegram 2C.3 beserta volume sementara...");
  run("docker", [...composeArgs, "down", "--volumes", "--remove-orphans"], environment, true);
  rmSync(temporaryRoot, { recursive: true, force: true });
}
