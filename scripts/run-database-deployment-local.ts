import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

const projectRoot = process.cwd();
const composeFile = path.join(projectRoot, "compose.database-deployment-test.yaml");
const projectName = `asihjaya-rms-database-deployment-${process.pid}`;

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
      assert(
        address && typeof address === "object",
        "Port database deployment test tidak tersedia.",
      );
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function resolveNpmCommand(args: string[]) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (!npmExecPath) {
    throw new Error(
      "npm_execpath tidak tersedia. Jalankan melalui npm run test:database-deployment:local.",
    );
  }
  return { executable: process.execPath, args: [npmExecPath, ...args] };
}

function runDocker(
  args: string[],
  environment: NodeJS.ProcessEnv,
  allowFailure = false,
): boolean {
  const result = spawnSync("docker", args, {
    cwd: projectRoot,
    env: environment,
    stdio: allowFailure ? "ignore" : "inherit",
    shell: false,
  });
  if (result.error && !allowFailure) throw result.error;
  if ((result.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(
      `docker ${args.join(" ")} gagal dengan exit code ${result.status}.`,
    );
  }
  return result.status === 0;
}

async function runNpm(
  args: string[],
  environment: NodeJS.ProcessEnv,
  options: { allowFailure?: boolean; capture?: boolean } = {},
): Promise<{ success: boolean; output: string }> {
  const command = resolveNpmCommand(args);
  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: projectRoot,
      env: environment,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: false,
    });
    let output = "";
    if (options.capture) {
      child.stdout?.on("data", (chunk) => (output += String(chunk)));
      child.stderr?.on("data", (chunk) => (output += String(chunk)));
    }
    child.once("error", reject);
    child.once("exit", (code) => {
      const success = code === 0;
      if (!success && !options.allowFailure) {
        reject(
          new Error(
            `npm ${args.join(" ")} gagal dengan exit code ${code}.\n${output}`,
          ),
        );
      } else {
        resolve({ success, output });
      }
    });
  });
}

async function waitForPostgres(
  composeArgs: string[],
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const ready = runDocker(
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
    if (ready) return;
    await delay(1_000);
  }
  throw new Error(
    "PostgreSQL 17 database-deployment test belum siap setelah 60 detik.",
  );
}

const port = await findAvailablePort();
const databaseUrl = `postgresql://asihjaya_migration_test:asihjaya_migration_test_password@127.0.0.1:${port}/asihjaya_rms_migration_test`;
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  DATABASE_DEPLOYMENT_TEST_PORT: String(port),
  DATABASE_MIGRATION_READY_TIMEOUT_MS: "60000",
  DATABASE_MIGRATION_LOCK_TIMEOUT_MS: "30000",
  DATABASE_MIGRATION_DDL_LOCK_TIMEOUT_MS: "10000",
  DATABASE_MIGRATION_STATEMENT_TIMEOUT_MS: "300000",
  DEFAULT_ORGANIZATION_SLUG: "asihjaya",
  BOOTSTRAP_ORGANIZATION_NAME: "ASIHJAYA CI",
  BOOTSTRAP_ORGANIZATION_SLUG: "asihjaya",
  BOOTSTRAP_OUTLET_CODE: "CI-OUTLET",
  BOOTSTRAP_OUTLET_NAME: "CI Outlet",
  BOOTSTRAP_REGISTER_CODE: "CI-REG-01",
  BOOTSTRAP_REGISTER_NAME: "CI Register",
  BOOTSTRAP_ADMIN_NAME: "CI Administrator",
  BOOTSTRAP_ADMIN_USERNAME: "ci-admin",
  BOOTSTRAP_ADMIN_EMAIL: "ci-admin@asihjaya.test",
  BOOTSTRAP_ADMIN_PASSWORD: "ci-bootstrap-admin-password-2026",
};
const composeArgs = [
  "compose",
  "--project-name",
  projectName,
  "-f",
  composeFile,
];
const temporaryRoot = mkdtempSync(
  path.join(os.tmpdir(), "asihjaya-migration-deploy-"),
);

console.log(
  "Menyalakan PostgreSQL 17 disposable untuk database deployment rehearsal...",
);
runDocker(
  [...composeArgs, "down", "--volumes", "--remove-orphans"],
  environment,
  true,
);

try {
  runDocker([...composeArgs, "up", "-d"], environment);
  await waitForPostgres(composeArgs, environment);

  console.log(
    "Menguji fresh DB auto-approval, commit boundary, dan advisory lock dengan dua migration runner concurrent...",
  );
  const first = runNpm(
    ["run", "db:deploy"],
    {
      ...environment,
      DATABASE_MIGRATION_TEST_HOLD_LOCK_MS: "6000",
    },
    { capture: true },
  );
  await delay(2_500);
  const second = runNpm(["run", "db:deploy"], environment, {
    capture: true,
  });
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert(
    firstResult.success && secondResult.success,
    "Kedua migration runner harus selesai sukses.",
  );
  const combinedFreshOutput = `${firstResult.output}\n${secondResult.output}`;
  assert(
    combinedFreshOutput.includes("Migration lock sedang dipakai"),
    "Runner kedua wajib menunggu advisory lock.",
  );
  assert(
    firstResult.output.includes("Fresh database terdeteksi"),
    "Fresh DB wajib mengizinkan historical destructive migration tanpa approval manual.",
  );
  for (const migrationTag of [
    "0007_legacy_manager_review_inventory_hold",
    "0008_legacy_sold_during_migration",
    "0009_legacy_transactional_cutover",
    "0011_legacy_cutover_hardening",
  ]) {
    assert(
      firstResult.output.includes(
        `Menerapkan migration ${migrationTag} dengan commit boundary terpisah`,
      ),
      `Fresh rehearsal wajib menjalankan ${migrationTag} dengan commit boundary terpisah.`,
    );
  }

  console.log("Memvalidasi idempotent no-op deployment...");
  const noOp = await runNpm(["run", "db:deploy"], environment, {
    capture: true,
  });
  assert(
    noOp.output.includes("no-op"),
    "Deployment kedua harus terdeteksi sebagai no-op.",
  );

  console.log("Menjalankan bootstrap seed fresh database dan menguji idempotency...");
  await runNpm(["run", "db:seed"], environment);
  await runNpm(["run", "db:seed"], environment);

  console.log("Memvalidasi schema PostgreSQL setelah migration + bootstrap seed...");
  await runNpm(["run", "check:database:live"], environment);

  console.log("Menguji deteksi migration history drift...");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const original = await client.query<{ id: number; hash: string }>(
    "select id, hash from drizzle.__drizzle_migrations order by created_at asc, id asc limit 1",
  );
  const firstMigration = original.rows[0];
  assert(
    firstMigration,
    "Migration history tidak tersedia setelah deployment.",
  );
  await client.query(
    "update drizzle.__drizzle_migrations set hash = $1 where id = $2",
    ["tampered-history", firstMigration.id],
  );
  const drift = await runNpm(
    ["run", "db:deploy", "--", "--check-only"],
    environment,
    {
      allowFailure: true,
      capture: true,
    },
  );
  assert(
    !drift.success && drift.output.includes("hash SQL tidak cocok"),
    "History drift wajib ditolak.",
  );
  assert(
    !drift.output.includes(databaseUrl),
    "Error migration tidak boleh membocorkan DATABASE_URL.",
  );
  await client.query(
    "update drizzle.__drizzle_migrations set hash = $1 where id = $2",
    [firstMigration.hash, firstMigration.id],
  );
  await client.end();

  console.log(
    "Menguji guard migration destruktif existing DB dengan one-shot CLI opt-in...",
  );
  const temporaryMigrations = path.join(temporaryRoot, "drizzle");
  cpSync(path.join(projectRoot, "drizzle"), temporaryMigrations, {
    recursive: true,
  });
  const journalPath = path.join(
    temporaryMigrations,
    "meta",
    "_journal.json",
  );
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    version: string;
    dialect: string;
    entries: Array<{
      idx: number;
      version: string;
      when: number;
      tag: string;
      breakpoints: boolean;
    }>;
  };
  const index = journal.entries.length;
  const tag = `${String(index).padStart(4, "0")}_destructive_guard_rehearsal`;
  journal.entries.push({
    idx: index,
    version: journal.version,
    when: Date.now() + 60_000,
    tag,
    breakpoints: true,
  });
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
  writeFileSync(
    path.join(temporaryMigrations, `${tag}.sql`),
    'DROP TABLE "organizations";\n',
  );

  const rejected = await runNpm(
    [
      "run",
      "db:deploy",
      "--",
      "--check-only",
      "--migrations-dir",
      temporaryMigrations,
    ],
    environment,
    { allowFailure: true, capture: true },
  );
  assert(
    !rejected.success &&
      rejected.output.includes("Migration destruktif terdeteksi") &&
      rejected.output.includes("--allow-destructive"),
    "Migration destruktif existing DB tanpa one-shot opt-in wajib ditolak dengan instruksi jelas.",
  );

  const approved = await runNpm(
    [
      "run",
      "db:deploy",
      "--",
      "--check-only",
      "--allow-destructive",
      "--migrations-dir",
      temporaryMigrations,
    ],
    environment,
    { capture: true },
  );
  assert(
    approved.success &&
      approved.output.includes(
        "Destructive migration existing database diizinkan untuk invocation ini",
      ),
    "Migration destruktif existing DB dengan --allow-destructive wajib diterima pada invocation tersebut.",
  );

  console.log(
    "Menguji migration failure menghentikan deployment tanpa merusak history...",
  );
  const failingMigrations = path.join(temporaryRoot, "failing-drizzle");
  cpSync(path.join(projectRoot, "drizzle"), failingMigrations, {
    recursive: true,
  });
  const failingJournalPath = path.join(
    failingMigrations,
    "meta",
    "_journal.json",
  );
  const failingJournal = JSON.parse(
    readFileSync(failingJournalPath, "utf8"),
  ) as {
    version: string;
    dialect: string;
    entries: Array<{
      idx: number;
      version: string;
      when: number;
      tag: string;
      breakpoints: boolean;
    }>;
  };
  const failingIndex = failingJournal.entries.length;
  const failingTag = `${String(failingIndex).padStart(4, "0")}_forced_failure_rehearsal`;
  failingJournal.entries.push({
    idx: failingIndex,
    version: failingJournal.version,
    when: Date.now() + 120_000,
    tag: failingTag,
    breakpoints: true,
  });
  writeFileSync(
    failingJournalPath,
    `${JSON.stringify(failingJournal, null, 2)}\n`,
  );
  writeFileSync(
    path.join(failingMigrations, `${failingTag}.sql`),
    "THIS IS INTENTIONALLY INVALID SQL FOR MIGRATION FAILURE REHEARSAL;\n",
  );

  const failedMigration = await runNpm(
    [
      "run",
      "db:deploy",
      "--",
      "--migrations-dir",
      failingMigrations,
    ],
    environment,
    { allowFailure: true, capture: true },
  );
  assert(
    !failedMigration.success,
    "Migration SQL invalid wajib menghentikan deployment.",
  );
  assert(
    failedMigration.output.includes("drizzle-kit migrate gagal"),
    "Failure runner wajib menjelaskan bahwa primitive migration gagal.",
  );
  assert(
    !failedMigration.output.includes(databaseUrl),
    "Migration failure tidak boleh membocorkan DATABASE_URL.",
  );
  const afterFailure = await runNpm(
    ["run", "db:deploy"],
    environment,
    { capture: true },
  );
  assert(
    afterFailure.success && afterFailure.output.includes("no-op"),
    "Migration failure per-step tidak boleh mengubah history release stabil.",
  );

  console.log(
    "OK: database deployment rehearsal lulus; fresh auto-approval, per-migration commit boundary, bootstrap seed idempotency, readiness, advisory lock, idempotency, history drift, one-shot destructive guard, dan failure stop terverifikasi.",
  );
} finally {
  console.log(
    "Menghapus PostgreSQL database-deployment test beserta volume sementara...",
  );
  runDocker(
    [...composeArgs, "down", "--volumes", "--remove-orphans"],
    environment,
    true,
  );
  rmSync(temporaryRoot, { recursive: true, force: true });
}
