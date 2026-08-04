import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

import {
  CRITICAL_BACKUP_TABLES,
  expectedRestoreConfirmation,
  readBackupArtifact,
  sha256File,
  type CriticalBackupTable,
  type DatabaseBackupArtifact,
} from "./database-backup-state";
import {
  assertComposeServiceRunning,
  containerExecArgs,
  runDatabaseShell,
  runDockerCapture,
  type DatabaseComposeTarget,
} from "./database-backup-docker";

const projectRoot = process.cwd();

type CliOptions = {
  backupMetadataPath: string;
  targetDatabase: string;
  confirmation: string;
  environmentFile?: string;
  composeFile: string;
  projectName?: string;
  service: string;
  replaceExisting: boolean;
  allowProductionTarget: boolean;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} membutuhkan value.`);
  return value;
}

function parseOptions(args: string[]): CliOptions {
  const valueOptions = new Set([
    "--backup",
    "--target-database",
    "--confirm",
    "--env-file",
    "--compose-file",
    "--project-name",
    "--service",
  ]);
  const flags = new Set(["--replace-existing", "--allow-production-target"]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (valueOptions.has(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} membutuhkan value.`);
      index += 1;
      continue;
    }
    if (flags.has(argument)) continue;
    throw new Error(`Argument tidak dikenal: ${argument}.`);
  }
  const backupMetadataPath = optionValue(args, "--backup");
  const targetDatabase = optionValue(args, "--target-database");
  const confirmation = optionValue(args, "--confirm");
  assert(backupMetadataPath, "--backup wajib menunjuk file metadata .json.");
  assert(targetDatabase, "--target-database wajib diatur.");
  assert(confirmation, "--confirm wajib diatur dengan token restore yang tepat.");
  assert(/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(targetDatabase), "Nama target database tidak aman.");
  assert(!["postgres", "template0", "template1"].includes(targetDatabase.toLowerCase()), "Database sistem PostgreSQL tidak boleh menjadi target restore.");
  return {
    backupMetadataPath,
    targetDatabase,
    confirmation,
    environmentFile: optionValue(args, "--env-file"),
    composeFile: optionValue(args, "--compose-file") ?? "compose.production.yaml",
    projectName: optionValue(args, "--project-name"),
    service: optionValue(args, "--service") ?? "db",
    replaceExisting: args.includes("--replace-existing"),
    allowProductionTarget: args.includes("--allow-production-target"),
  };
}

function resolveComposeTarget(options: CliOptions): DatabaseComposeTarget {
  return {
    composeFile: path.resolve(projectRoot, options.composeFile),
    service: options.service,
    environmentFile: options.environmentFile ? path.resolve(projectRoot, options.environmentFile) : undefined,
    projectName: options.projectName,
  };
}

function parseBoolean(value: string | undefined): boolean {
  return ["true", "1", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function validApprovalReference(value: string | undefined): value is string {
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,127}$/.test(value)) return false;
  return !/(?:change|replace|generate)[-_ ]?me|example|sample|dummy|todo/i.test(value);
}

async function queryScalar(
  target: DatabaseComposeTarget,
  databaseName: string,
  sql: string,
): Promise<string> {
  return (
    await runDatabaseShell(
      target,
      'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -At -c "$2"',
      [databaseName, sql],
    )
  ).trim();
}

async function queryJson<T>(
  target: DatabaseComposeTarget,
  databaseName: string,
  sql: string,
): Promise<T> {
  const output = await queryScalar(target, databaseName, sql);
  const line = output.split(/\r?\n/).at(-1);
  assert(line, "Query verifikasi restore tidak menghasilkan output.");
  return JSON.parse(line) as T;
}

async function verifyArtifact(
  target: DatabaseComposeTarget,
  artifact: DatabaseBackupArtifact,
): Promise<void> {
  assert(existsSync(artifact.archivePath), "Archive backup tidak tersedia.");
  assert(existsSync(artifact.checksumPath), "File checksum backup tidak tersedia.");
  assert(statSync(artifact.archivePath).size === artifact.metadata.archive.bytes, "Ukuran archive backup tidak sesuai metadata.");
  const checksum = await sha256File(artifact.archivePath);
  assert(checksum === artifact.metadata.archive.sha256, "Checksum backup tidak valid; restore ditolak.");
  assert(
    readFileSync(artifact.checksumPath, "utf8").trim() === `${checksum}  ${artifact.metadata.fileName}`,
    "File checksum tidak cocok dengan archive.",
  );
  const listOutput = await runDockerCapture(
    containerExecArgs(target, ["pg_restore", "--list"]),
    { inputFile: artifact.archivePath },
  );
  const listEntryCount = listOutput
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith(";")).length;
  assert(listEntryCount === artifact.metadata.archive.listEntryCount, "Daftar archive tidak cocok dengan metadata.");
}

async function databaseExists(
  target: DatabaseComposeTarget,
  administrationDatabase: string,
  databaseName: string,
): Promise<boolean> {
  const result = await queryScalar(
    target,
    administrationDatabase,
    `select count(*) from pg_database where datname = '${databaseName}'`,
  );
  return result === "1";
}

async function dropDatabase(
  target: DatabaseComposeTarget,
  administrationDatabase: string,
  databaseName: string,
): Promise<void> {
  await queryScalar(
    target,
    administrationDatabase,
    `select pg_terminate_backend(pid)
       from pg_stat_activity
      where datname = '${databaseName}' and pid <> pg_backend_pid()`,
  );
  await runDatabaseShell(
    target,
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -c "$2"',
    [administrationDatabase, `drop database "${databaseName}"`],
  );
}

async function createDatabase(
  target: DatabaseComposeTarget,
  administrationDatabase: string,
  databaseName: string,
): Promise<void> {
  await runDatabaseShell(
    target,
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -c "$2"',
    [administrationDatabase, `create database "${databaseName}" template template0 encoding 'UTF8'`],
  );
}

async function verifyRestoredDatabase(
  target: DatabaseComposeTarget,
  targetDatabase: string,
  artifact: DatabaseBackupArtifact,
): Promise<void> {
  const versionNumber = Number(
    await queryScalar(target, targetDatabase, "select current_setting('server_version_num')"),
  );
  assert(Math.floor(versionNumber / 10_000) === 17, "Target restore wajib PostgreSQL 17.");
  const migrationCount = Number(
    await queryScalar(target, targetDatabase, "select count(*) from drizzle.__drizzle_migrations"),
  );
  assert(
    migrationCount === artifact.metadata.verification.migrationCount,
    "Jumlah migration hasil restore tidak cocok dengan metadata backup.",
  );

  const missingTables = await queryScalar(
    target,
    targetDatabase,
    `select string_agg(table_name, ',')
       from (values ${CRITICAL_BACKUP_TABLES.map((table) => `('${table}')`).join(",")}) expected(table_name)
      where to_regclass('public.' || table_name) is null`,
  );
  assert(!missingTables, `Tabel kritis hasil restore tidak tersedia: ${missingTables}.`);

  const restoredRowCounts = await queryJson<Record<CriticalBackupTable, number>>(
    target,
    targetDatabase,
    `select json_object_agg(table_name, row_count)::text
       from (
         ${CRITICAL_BACKUP_TABLES.map(
           (table) => `select '${table}'::text as table_name, count(*)::bigint as row_count from public.${table}`,
         ).join(" union all ")}
       ) counts`,
  );
  const tableList = CRITICAL_BACKUP_TABLES.map((table) => `'${table}'`).join(",");
  const restoredConstraintCounts = await queryJson<Record<CriticalBackupTable, number>>(
    target,
    targetDatabase,
    `with expected(table_name) as (values ${CRITICAL_BACKUP_TABLES.map((table) => `('${table}')`).join(",")}),
     counts as (
       select c.relname as table_name, count(con.oid)::bigint as constraint_count
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
       left join pg_constraint con on con.conrelid = c.oid
       where c.relname in (${tableList})
       group by c.relname
     )
     select json_object_agg(expected.table_name, coalesce(counts.constraint_count, 0))::text
     from expected left join counts using (table_name)`,
  );
  for (const table of CRITICAL_BACKUP_TABLES) {
    assert(
      Number.isSafeInteger(Number(restoredRowCounts[table])) && Number(restoredRowCounts[table]) >= 0,
      `Row count ${table} hasil restore tidak valid.`,
    );
    assert(
      Number(restoredConstraintCounts[table]) === artifact.metadata.verification.tableConstraintCounts[table],
      `Constraint count ${table} hasil restore tidak cocok dengan backup.`,
    );
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (options.environmentFile) {
    const result = loadDotenv({
      path: path.resolve(projectRoot, options.environmentFile),
      override: true,
      quiet: true,
    });
    if (result.error) throw new Error(`Gagal membaca environment file ${options.environmentFile}.`);
  }
  const target = resolveComposeTarget(options);
  await assertComposeServiceRunning(target);
  const artifact = readBackupArtifact(path.resolve(projectRoot, options.backupMetadataPath));
  await verifyArtifact(target, artifact);

  const configuredDatabase = (
    await runDatabaseShell(target, 'printf "%s" "$POSTGRES_DB"')
  ).trim();
  assert(configuredDatabase, "POSTGRES_DB pada service database tidak tersedia.");
  const productionTarget = options.targetDatabase === configuredDatabase;
  const administrationDatabase = "postgres";
  const expectedConfirmation = expectedRestoreConfirmation(
    artifact.metadata,
    options.targetDatabase,
    productionTarget,
  );
  assert(
    options.confirmation === expectedConfirmation,
    `Token konfirmasi restore tidak cocok. Gunakan: ${expectedConfirmation}`,
  );

  if (productionTarget) {
    assert(options.allowProductionTarget, "Target database aktif memerlukan --allow-production-target.");
    assert(
      parseBoolean(process.env.DATABASE_RESTORE_ALLOW_PRODUCTION),
      "DATABASE_RESTORE_ALLOW_PRODUCTION harus true untuk restore database aktif.",
    );
    assert(
      validApprovalReference(process.env.DATABASE_RESTORE_APPROVAL_REFERENCE),
      "DATABASE_RESTORE_APPROVAL_REFERENCE valid wajib tersedia untuk restore database aktif.",
    );
  }

  const exists = await databaseExists(target, administrationDatabase, options.targetDatabase);
  if (exists) {
    assert(options.replaceExisting, "Target database sudah ada; gunakan --replace-existing setelah verifikasi target.");
    console.log(`Menghapus target restore existing ${options.targetDatabase}...`);
    await dropDatabase(target, administrationDatabase, options.targetDatabase);
  }
  await createDatabase(target, administrationDatabase, options.targetDatabase);

  try {
    console.log(`Memulihkan ${artifact.metadata.fileName} ke ${options.targetDatabase}...`);
    await runDockerCapture(
      containerExecArgs(target, [
        "sh",
        "-eu",
        "-c",
        'exec pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" --dbname "$1"',
        "asihjaya-restore",
        options.targetDatabase,
      ]),
      { inputFile: artifact.archivePath },
    );
    await verifyRestoredDatabase(target, options.targetDatabase, artifact);
    console.log(`OK: restore ${artifact.metadata.backupId} ke ${options.targetDatabase} terverifikasi.`);
  } catch (error) {
    if (!productionTarget) {
      await dropDatabase(target, administrationDatabase, options.targetDatabase).catch(() => undefined);
    }
    throw error;
  }
}

await main();
