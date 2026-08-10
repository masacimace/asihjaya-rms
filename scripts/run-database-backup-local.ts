import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";

import {
  expectedRestoreConfirmation,
  readBackupArtifact,
  type DatabaseBackupMetadata,
} from "./database-backup-state";

const projectRoot = process.cwd();
const composeFile = path.join(projectRoot, "compose.database-backup-test.yaml");
const projectName = `asihjaya-rms-database-backup-${process.pid}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object", "Port backup rehearsal tidak tersedia.");
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function resolveNpmCommand(args: string[]) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (!npmExecPath) {
    throw new Error("npm_execpath tidak tersedia. Jalankan melalui npm run test:database-backup:local.");
  }
  return { executable: process.execPath, args: [npmExecPath, ...args] };
}

function runDocker(args: string[], environment: NodeJS.ProcessEnv, allowFailure = false): boolean {
  const result = spawnSync("docker", args, {
    cwd: projectRoot,
    env: environment,
    stdio: allowFailure ? "ignore" : "inherit",
    shell: false,
  });
  if (result.error && !allowFailure) throw result.error;
  if ((result.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(`docker ${args.join(" ")} gagal dengan exit code ${result.status}.`);
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
        reject(new Error(`npm ${args.join(" ")} gagal dengan exit code ${code}.\n${output}`));
      } else {
        resolve({ success, output });
      }
    });
  });
}

async function waitForPostgres(composeArgs: string[], environment: NodeJS.ProcessEnv): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const ready = runDocker(
      [
        ...composeArgs,
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "asihjaya_backup_test",
        "-d",
        "asihjaya_rms_backup_test",
      ],
      environment,
      true,
    );
    if (ready) return;
    await delay(1_000);
  }
  throw new Error("PostgreSQL 17 backup rehearsal belum siap setelah 90 detik.");
}

async function seedCriticalTransaction(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const ids = {
    organization: "10000000-0000-4000-8000-000000000001",
    outlet: "10000000-0000-4000-8000-000000000002",
    register: "10000000-0000-4000-8000-000000000003",
    user: "10000000-0000-4000-8000-000000000004",
    userOutlet: "10000000-0000-4000-8000-000000000005",
    shift: "10000000-0000-4000-8000-000000000006",
    customer: "10000000-0000-4000-8000-000000000007",
    category: "10000000-0000-4000-8000-000000000008",
    master: "10000000-0000-4000-8000-000000000009",
    item: "10000000-0000-4000-8000-000000000010",
    sale: "10000000-0000-4000-8000-000000000011",
    saleItem: "10000000-0000-4000-8000-000000000012",
    payment: "10000000-0000-4000-8000-000000000013",
  };
  try {
    await client.query("begin");
    await client.query(
      `insert into organizations (id, name, slug, timezone, currency)
       values ($1, 'Backup Rehearsal', 'backup-rehearsal', 'Asia/Jakarta', 'IDR')`,
      [ids.organization],
    );
    await client.query(
      `insert into outlets (id, organization_id, code, name)
       values ($1, $2, 'BACKUP-OUT', 'Backup Outlet')`,
      [ids.outlet, ids.organization],
    );
    await client.query(
      `insert into registers (id, outlet_id, code, name)
       values ($1, $2, 'BACKUP-REG', 'Backup Register')`,
      [ids.register, ids.outlet],
    );
    await client.query(
      `insert into users (id, organization_id, email, username, full_name, status)
       values ($1, $2, 'backup@test.local', 'backup-operator', 'Backup Operator', 'active')`,
      [ids.user, ids.organization],
    );
    await client.query(
      `insert into user_outlets (id, user_id, outlet_id, is_primary)
       values ($1, $2, $3, true)`,
      [ids.userOutlet, ids.user, ids.outlet],
    );
    await client.query(
      `insert into shifts (id, outlet_id, register_id, opened_by, status, opening_cash, opened_at)
       values ($1, $2, $3, $4, 'open', 100000, now())`,
      [ids.shift, ids.outlet, ids.register, ids.user],
    );
    await client.query(
      `insert into customers (id, organization_id, customer_code, full_name, is_active)
       values ($1, $2, 'BACKUP-CUST', 'Customer Backup', true)`,
      [ids.customer, ids.organization],
    );
    await client.query(
      `insert into product_categories (id, organization_id, code, name, is_active)
       values ($1, $2, 'BACKUP-CAT', 'Backup Category', true)`,
      [ids.category, ids.organization],
    );
    await client.query(
      `insert into product_masters (id, organization_id, category_id, code, name, status)
       values ($1, $2, $3, 'BACKUP-MASTER', 'Backup Product', 'active')`,
      [ids.master, ids.organization, ids.category],
    );
    await client.query(
      `insert into product_items (
         id, organization_id, product_master_id, current_outlet_id,
         sku, barcode, selling_amount, availability, condition, location_state, is_active
       ) values ($1, $2, $3, $4, 'BACKUP-SKU', 'BACKUP-BARCODE', 1250000,
         'sold', 'good', 'customer', true)`,
      [ids.item, ids.organization, ids.master, ids.outlet],
    );
    await client.query(
      `insert into sales (
         id, organization_id, outlet_id, register_id, shift_id, customer_id,
         cashier_id, invoice_number, idempotency_key, status,
         subtotal_amount, discount_amount, additional_fee_amount, total_amount, completed_at
       ) values ($1, $2, $3, $4, $5, $6, $7, 'RESTORE-REHEARSAL-001',
         'backup-rehearsal-idempotency', 'completed', 1250000, 0, 0, 1250000, now())`,
      [
        ids.sale,
        ids.organization,
        ids.outlet,
        ids.register,
        ids.shift,
        ids.customer,
        ids.user,
      ],
    );
    await client.query(
      `insert into sale_items (
         id, sale_id, product_item_id, line_number, list_price_amount,
         discount_amount, final_price_amount, snapshot
       ) values ($1, $2, $3, 1, 1250000, 0, 1250000, '{}'::jsonb)`,
      [ids.saleItem, ids.sale, ids.item],
    );
    await client.query(
      `insert into payments (
         id, sale_id, method, provider, amount, status,
         verified_by, verified_at, paid_at, metadata
       ) values ($1, $2, 'cash', 'cash', 1250000, 'paid', $3, now(), now(), '{}'::jsonb)`,
      [ids.payment, ids.sale, ids.user],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

function createRetentionFixture(
  outputDirectory: string,
  sourceArtifactPath: string,
  input: {
    suffix: string;
    kind: DatabaseBackupMetadata["kind"];
    ageDays: number;
    protected?: boolean;
  },
): string {
  const source = readBackupArtifact(sourceArtifactPath);
  const backupId = randomUUID();
  const baseName = `retention-${input.suffix}-${backupId.slice(0, 8)}`;
  const archivePath = path.join(outputDirectory, `${baseName}.dump`);
  const checksumPath = path.join(outputDirectory, `${baseName}.sha256`);
  const metadataPath = path.join(outputDirectory, `${baseName}.json`);
  writeFileSync(archivePath, "x");
  writeFileSync(checksumPath, `${"0".repeat(64)}  ${baseName}.dump\n`);
  const createdAt = new Date(Date.now() - input.ageDays * 86_400_000).toISOString();
  const metadata: DatabaseBackupMetadata = {
    ...source.metadata,
    backupId,
    fileName: `${baseName}.dump`,
    createdAt,
    completedAt: createdAt,
    verifiedAt: createdAt,
    kind: input.kind,
    protected: input.protected ?? false,
  };
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return metadataPath;
}

const port = await findAvailablePort();
const databaseUrl = `postgresql://asihjaya_backup_test:asihjaya_backup_test_password@127.0.0.1:${port}/asihjaya_rms_backup_test`;
const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "asihjaya-backup-restore-"));
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  DATABASE_BACKUP_TEST_PORT: String(port),
  DATABASE_BACKUP_ROOT: outputDirectory,
  DATABASE_BACKUP_ENVIRONMENT: "rehearsal",
  DATABASE_BACKUP_MIN_FREE_BYTES: "0",
  DATABASE_BACKUP_FREE_SPACE_FACTOR: "1",
  DATABASE_BACKUP_DAILY_RETENTION_DAYS: "7",
  DATABASE_BACKUP_WEEKLY_RETENTION_WEEKS: "4",
  DATABASE_BACKUP_PRE_DEPLOYMENT_RETENTION_COUNT: "2",
  DATABASE_RESTORE_ALLOW_PRODUCTION: "false",
  // Disposable fresh DB must replay all historical migrations, including
  // previously reviewed destructive DDL such as constraint replacement.
  DATABASE_MIGRATION_ALLOW_DESTRUCTIVE: "true",
  DATABASE_MIGRATION_APPROVAL_REFERENCE: "REHEARSAL-BACKUP-FRESH-DB",
};
const composeArgs = ["compose", "--project-name", projectName, "-f", composeFile];
const runnerTargetArgs = [
  "--compose-file",
  composeFile,
  "--project-name",
  projectName,
  "--service",
  "postgres",
  "--output-dir",
  outputDirectory,
];

console.log("Menyalakan PostgreSQL 17 disposable untuk backup/restore rehearsal...");
runDocker([...composeArgs, "down", "--volumes", "--remove-orphans"], environment, true);

try {
  runDocker([...composeArgs, "up", "-d"], environment);
  await waitForPostgres(composeArgs, environment);

  console.log("Menjalankan migration dan menyiapkan transaksi dummy kritis...");
  await runNpm(["run", "db:deploy"], environment);
  await seedCriticalTransaction(databaseUrl);

  console.log("Membuat backup custom-format dengan checksum dan metadata...");
  await runNpm(
    ["run", "db:backup", "--", ...runnerTargetArgs, "--kind", "daily", "--label", "restore-rehearsal"],
    environment,
  );
  const metadataFiles = readdirSync(outputDirectory).filter((fileName) => fileName.endsWith(".json"));
  assert(metadataFiles.length === 1, "Rehearsal harus menghasilkan tepat satu metadata backup awal.");
  const metadataPath = path.join(outputDirectory, metadataFiles[0]!);
  const artifact = readBackupArtifact(metadataPath);
  assert(artifact.metadata.verification.tableRowCounts.sales === 1, "Metadata backup wajib merekam satu transaksi dummy.");
  assert(artifact.metadata.verification.tableRowCounts.payments === 1, "Metadata backup wajib merekam satu pembayaran dummy.");

  await runNpm(
    ["run", "db:backup", "--", ...runnerTargetArgs, "--verify", metadataPath],
    environment,
  );

  console.log("Menguji backup rusak ditolak sebelum restore...");
  const safeArchivePath = `${artifact.archivePath}.safe`;
  copyFileSync(artifact.archivePath, safeArchivePath);
  const corrupted = Buffer.from(readFileSync(artifact.archivePath));
  const corruptionIndex = Math.max(0, Math.floor(corrupted.length / 2));
  const originalByte = corrupted[corruptionIndex];
  assert(originalByte !== undefined, "Archive backup kosong dan tidak dapat diuji korupsinya.");
  corrupted[corruptionIndex] = originalByte ^ 0xff;
  writeFileSync(artifact.archivePath, corrupted);
  const corruptResult = await runNpm(
    ["run", "db:backup", "--", ...runnerTargetArgs, "--verify", metadataPath],
    environment,
    { allowFailure: true, capture: true },
  );
  assert(!corruptResult.success && corruptResult.output.includes("Checksum"), "Backup rusak wajib ditolak oleh checksum verification.");
  copyFileSync(safeArchivePath, artifact.archivePath);
  rmSync(safeArchivePath, { force: true });

  console.log("Memulihkan backup ke database kosong disposable...");
  const restoreTarget = "asihjaya_rms_restore_rehearsal";
  await runNpm(
    [
      "run",
      "db:restore",
      "--",
      "--backup",
      metadataPath,
      "--target-database",
      restoreTarget,
      "--confirm",
      expectedRestoreConfirmation(artifact.metadata, restoreTarget, false),
      "--compose-file",
      composeFile,
      "--project-name",
      projectName,
      "--service",
      "postgres",
    ],
    environment,
  );
  const restoredUrl = new URL(databaseUrl);
  restoredUrl.pathname = `/${restoreTarget}`;
  const restoredClient = new Client({ connectionString: restoredUrl.toString() });
  await restoredClient.connect();
  const restoredSale = await restoredClient.query<{ invoice_number: string; amount: string }>(
    `select s.invoice_number, p.amount::text
       from sales s join payments p on p.sale_id = s.id
      where s.invoice_number = 'RESTORE-REHEARSAL-001'`,
  );
  await restoredClient.end();
  assert(restoredSale.rows[0]?.invoice_number === "RESTORE-REHEARSAL-001", "Transaksi dummy tidak ditemukan setelah restore.");
  assert(restoredSale.rows[0]?.amount === "1250000", "Nominal pembayaran berubah setelah restore.");

  console.log("Menguji proteksi target database aktif...");
  const productionGuard = await runNpm(
    [
      "run",
      "db:restore",
      "--",
      "--backup",
      metadataPath,
      "--target-database",
      "asihjaya_rms_backup_test",
      "--confirm",
      expectedRestoreConfirmation(artifact.metadata, "asihjaya_rms_backup_test", true),
      "--compose-file",
      composeFile,
      "--project-name",
      projectName,
      "--service",
      "postgres",
    ],
    environment,
    { allowFailure: true, capture: true },
  );
  assert(
    !productionGuard.success && productionGuard.output.includes("--allow-production-target"),
    "Restore ke database aktif wajib ditolak tanpa guard eksplisit.",
  );

  console.log("Menguji retention tidak menghapus backup terbaru, manual, atau protected...");
  const oldDaily = createRetentionFixture(outputDirectory, metadataPath, {
    suffix: "old-daily",
    kind: "daily",
    ageDays: 20,
  });
  const protectedDaily = createRetentionFixture(outputDirectory, metadataPath, {
    suffix: "protected-daily",
    kind: "daily",
    ageDays: 30,
    protected: true,
  });
  const manual = createRetentionFixture(outputDirectory, metadataPath, {
    suffix: "manual",
    kind: "manual",
    ageDays: 40,
  });
  const preDeploymentNew = createRetentionFixture(outputDirectory, metadataPath, {
    suffix: "predeploy-new",
    kind: "pre-deployment",
    ageDays: 2,
  });
  const preDeploymentMiddle = createRetentionFixture(outputDirectory, metadataPath, {
    suffix: "predeploy-middle",
    kind: "pre-deployment",
    ageDays: 3,
  });
  const preDeploymentOld = createRetentionFixture(outputDirectory, metadataPath, {
    suffix: "predeploy-old",
    kind: "pre-deployment",
    ageDays: 4,
  });
  await runNpm(
    ["run", "db:backup", "--", ...runnerTargetArgs, "--prune-only"],
    environment,
  );
  assert(existsSync(metadataPath), "Backup terbaru harus tetap tersedia.");
  assert(!readdirSync(outputDirectory).includes(path.basename(oldDaily)), "Daily backup lama harus dipangkas.");
  assert(readdirSync(outputDirectory).includes(path.basename(protectedDaily)), "Backup protected tidak boleh dihapus.");
  assert(readdirSync(outputDirectory).includes(path.basename(manual)), "Backup manual tidak boleh dihapus otomatis.");
  assert(readdirSync(outputDirectory).includes(path.basename(preDeploymentNew)), "Pre-deployment backup terbaru wajib dipertahankan.");
  assert(readdirSync(outputDirectory).includes(path.basename(preDeploymentMiddle)), "Pre-deployment backup kedua wajib dipertahankan.");
  assert(!readdirSync(outputDirectory).includes(path.basename(preDeploymentOld)), "Pre-deployment backup di luar retention harus dihapus.");

  console.log("OK: backup, checksum, corruption guard, restore, transaction verification, target guard, dan retention rehearsal lulus.");
} finally {
  runDocker([...composeArgs, "down", "--volumes", "--remove-orphans"], environment, true);
  rmSync(outputDirectory, { recursive: true, force: true });
}
