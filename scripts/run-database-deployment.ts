import { spawn } from "node:child_process";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { Client } from "pg";

import {
  analyzeMigrationHistory,
  findDestructiveMigrationFindings,
  loadMigrationPlan,
  parseBoolean,
  parsePositiveInteger,
  type AppliedMigration,
} from "./database-deployment-state";

type CliOptions = {
  checkOnly: boolean;
  migrationsDirectory: string;
  environmentFile?: string;
};

const projectRoot = process.cwd();

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} membutuhkan value.`);
  return value;
}

function parseOptions(args: string[]): CliOptions {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--check-only") continue;
    if (argument === "--migrations-dir" || argument === "--env-file") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} membutuhkan value.`);
      index += 1;
      continue;
    }
    throw new Error(`Argument tidak dikenal: ${argument}.`);
  }

  const options = {
    checkOnly: args.includes("--check-only"),
    migrationsDirectory: optionValue(args, "--migrations-dir") ?? path.join(projectRoot, "drizzle"),
    environmentFile: optionValue(args, "--env-file"),
  };
  return options;
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function redactSensitiveText(value: string): string {
  let result = value;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) result = result.split(databaseUrl).join("[REDACTED_DATABASE_URL]");
  return result.replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgresql://[REDACTED]@");
}

function isValidApprovalReference(value: string | undefined): value is string {
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,127}$/.test(value)) return false;
  return !/(?:change|replace|generate)[-_ ]?me|example|sample|dummy|todo/i.test(value);
}

function safeDatabaseLabel(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    return `${parsed.hostname}/${decodeURIComponent(parsed.pathname.replace(/^\//, ""))}`;
  } catch {
    return "PostgreSQL target";
  }
}

async function connectWithRetry(databaseUrl: string, timeoutMs: number): Promise<Client> {
  const deadline = Date.now() + timeoutMs;
  let lastMessage = "belum dapat terhubung";

  while (Date.now() < deadline) {
    const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 });
    try {
      await client.connect();
      await client.query("select 1");
      return client;
    } catch (error) {
      lastMessage = redactSensitiveText(error instanceof Error ? error.message : String(error));
      await client.end().catch(() => undefined);
      await sleep(1_000);
    }
  }

  throw new Error(`Database belum siap setelah ${timeoutMs} ms. Detail terakhir: ${lastMessage}`);
}

async function acquireMigrationLock(
  client: Client,
  lockKey: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let announcedWait = false;

  while (Date.now() < deadline) {
    const result = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1::bigint) as locked",
      [lockKey],
    );
    if (result.rows[0]?.locked) return;
    if (!announcedWait) {
      console.log("Migration lock sedang dipakai deployment lain; menunggu...");
      announcedWait = true;
    }
    await sleep(1_000);
  }

  throw new Error(`Timeout ${timeoutMs} ms saat menunggu migration advisory lock.`);
}

async function readAppliedMigrations(client: Client): Promise<AppliedMigration[]> {
  const tableResult = await client.query<{ migration_table: string | null }>(
    "select to_regclass('drizzle.__drizzle_migrations')::text as migration_table",
  );
  if (tableResult.rows[0]?.migration_table !== "drizzle.__drizzle_migrations") return [];

  const result = await client.query<{ id: number; hash: string; created_at: string }>(
    `select id, hash, created_at::text
     from drizzle.__drizzle_migrations
     order by created_at asc, id asc`,
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    hash: row.hash,
    createdAt: row.created_at,
  }));
}

function resolveNpmCommand(args: string[]) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (npmExecPath) return { executable: process.execPath, args: [npmExecPath, ...args] };
  return { executable: process.platform === "win32" ? "npm.cmd" : "npm", args };
}

async function runDrizzleMigration(environment: NodeJS.ProcessEnv): Promise<void> {
  const command = resolveNpmCommand(["run", "db:migrate"]);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: projectRoot,
      env: environment,
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`drizzle-kit migrate gagal dengan exit code ${code ?? "null"}${signal ? ` (${signal})` : ""}.`));
    });
  });
}

function buildPgOptions(existing: string | undefined, ddlLockTimeoutMs: number, statementTimeoutMs: number): string {
  const values = [existing?.trim(), `-c lock_timeout=${ddlLockTimeoutMs}`, `-c statement_timeout=${statementTimeoutMs}`]
    .filter(Boolean);
  return values.join(" ");
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (options.environmentFile) {
    const result = loadDotenv({ path: options.environmentFile, override: true, quiet: true });
    if (result.error) throw new Error(`Gagal membaca environment file ${options.environmentFile}.`);
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL wajib diatur untuk database deployment.");

  const usesDefaultMigrationsDirectory =
    path.resolve(options.migrationsDirectory) === path.resolve(projectRoot, "drizzle");
  if (!options.checkOnly && !usesDefaultMigrationsDirectory && process.env.NODE_ENV !== "test") {
    throw new Error("--migrations-dir non-default hanya boleh diterapkan pada NODE_ENV=test.");
  }

  const readyTimeoutMs = parsePositiveInteger(
    process.env.DATABASE_MIGRATION_READY_TIMEOUT_MS,
    120_000,
    "DATABASE_MIGRATION_READY_TIMEOUT_MS",
    900_000,
  );
  const lockTimeoutMs = parsePositiveInteger(
    process.env.DATABASE_MIGRATION_LOCK_TIMEOUT_MS,
    120_000,
    "DATABASE_MIGRATION_LOCK_TIMEOUT_MS",
    900_000,
  );
  const ddlLockTimeoutMs = parsePositiveInteger(
    process.env.DATABASE_MIGRATION_DDL_LOCK_TIMEOUT_MS,
    30_000,
    "DATABASE_MIGRATION_DDL_LOCK_TIMEOUT_MS",
    900_000,
  );
  const statementTimeoutMs = parsePositiveInteger(
    process.env.DATABASE_MIGRATION_STATEMENT_TIMEOUT_MS,
    900_000,
    "DATABASE_MIGRATION_STATEMENT_TIMEOUT_MS",
    3_600_000,
  );
  const lockKey = process.env.DATABASE_MIGRATION_LOCK_KEY?.trim() || "718143293674";
  if (!/^-?\d{1,19}$/.test(lockKey)) throw new Error("DATABASE_MIGRATION_LOCK_KEY harus berupa bigint PostgreSQL.");
  const parsedLockKey = BigInt(lockKey);
  if (
    parsedLockKey < BigInt("-9223372036854775808") ||
    parsedLockKey > BigInt("9223372036854775807")
  ) {
    throw new Error("DATABASE_MIGRATION_LOCK_KEY berada di luar rentang bigint PostgreSQL.");
  }

  const localMigrations = loadMigrationPlan(options.migrationsDirectory);
  const client = await connectWithRetry(databaseUrl, readyTimeoutMs);
  let lockAcquired = false;

  try {
    const versionResult = await client.query<{ server_version_num: string }>(
      "select current_setting('server_version_num') as server_version_num",
    );
    const majorVersion = Number(versionResult.rows[0]?.server_version_num.slice(0, 2));
    if (majorVersion !== 17) throw new Error(`Database deployment membutuhkan PostgreSQL 17, ditemukan versi ${majorVersion}.`);

    await acquireMigrationLock(client, lockKey, lockTimeoutMs);
    lockAcquired = true;

    const testHoldMs = process.env.NODE_ENV === "test"
      ? Number(process.env.DATABASE_MIGRATION_TEST_HOLD_LOCK_MS || 0)
      : 0;
    if (Number.isFinite(testHoldMs) && testHoldMs > 0) await sleep(Math.min(testHoldMs, 10_000));

    const before = analyzeMigrationHistory(localMigrations, await readAppliedMigrations(client));
    const destructiveFindings = findDestructiveMigrationFindings(before.pending);
    if (destructiveFindings.length > 0) {
      const allowDestructive = parseBoolean(process.env.DATABASE_MIGRATION_ALLOW_DESTRUCTIVE, false);
      const approvalReference = process.env.DATABASE_MIGRATION_APPROVAL_REFERENCE?.trim();
      if (!allowDestructive || !isValidApprovalReference(approvalReference)) {
        const detail = destructiveFindings
          .map((finding) => `${finding.migrationTag}: ${finding.operation}`)
          .join(", ");
        throw new Error(
          `Migration destruktif terdeteksi (${detail}). Set DATABASE_MIGRATION_ALLOW_DESTRUCTIVE=true dan approval reference minimal 8 karakter setelah backup serta review eksplisit.`,
        );
      }
      console.log(`Approval migration destruktif diterima dengan reference ${approvalReference}.`);
    }

    console.log(
      `Database ${safeDatabaseLabel(databaseUrl)}: ${before.appliedCount}/${localMigrations.length} migration sudah diterapkan; ${before.pending.length} pending.`,
    );

    if (options.checkOnly) {
      console.log("OK: database deployment preflight lulus tanpa menerapkan migration.");
      return;
    }

    if (before.pending.length === 0) {
      console.log("OK: tidak ada migration pending; deployment database merupakan no-op.");
      return;
    }

    const childEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DRIZZLE_MIGRATIONS_DIR: path.resolve(options.migrationsDirectory),
      PGOPTIONS: buildPgOptions(process.env.PGOPTIONS, ddlLockTimeoutMs, statementTimeoutMs),
    };
    await runDrizzleMigration(childEnvironment);

    const after = analyzeMigrationHistory(localMigrations, await readAppliedMigrations(client));
    if (after.pending.length !== 0) {
      throw new Error(`Migration selesai tetapi masih tersisa ${after.pending.length} migration pending.`);
    }

    console.log(`OK: ${localMigrations.length} migration tervalidasi dan database deployment selesai.`);
  } finally {
    if (lockAcquired) {
      await client.query("select pg_advisory_unlock($1::bigint)", [lockKey]).catch(() => undefined);
    }
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = redactSensitiveText(error instanceof Error ? error.message : String(error));
  console.error(`Database deployment gagal: ${message}`);
  process.exitCode = 1;
});
