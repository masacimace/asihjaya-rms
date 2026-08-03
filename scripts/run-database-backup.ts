import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  statfsSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

import {
  CRITICAL_BACKUP_TABLES,
  artifactPaths,
  buildBackupBaseName,
  parseBackupKind,
  planBackupRetention,
  readBackupArtifact,
  sha256File,
  type CriticalBackupTable,
  type DatabaseBackupArtifact,
  type DatabaseBackupMetadata,
  type RetentionPolicy,
} from "./database-backup-state";
import {
  assertComposeServiceRunning,
  containerExecArgs,
  runDatabaseShell,
  runDockerBinaryToFile,
  runDockerCapture,
  type DatabaseComposeTarget,
} from "./database-backup-docker";

const projectRoot = process.cwd();

type CliOptions = {
  environmentFile?: string;
  composeFile: string;
  projectName?: string;
  service: string;
  outputDirectory?: string;
  kind?: string;
  label?: string;
  releaseId?: string;
  protect: boolean;
  prune: boolean;
  pruneOnly: boolean;
  skipIfUninitialized: boolean;
  verifyMetadataPath?: string;
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
    "--env-file",
    "--compose-file",
    "--project-name",
    "--service",
    "--output-dir",
    "--kind",
    "--label",
    "--release-id",
    "--verify",
  ]);
  const flagOptions = new Set([
    "--protect",
    "--prune",
    "--prune-only",
    "--skip-if-uninitialized",
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (valueOptions.has(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} membutuhkan value.`);
      index += 1;
      continue;
    }
    if (flagOptions.has(argument)) continue;
    throw new Error(`Argument tidak dikenal: ${argument}.`);
  }

  const pruneOnly = args.includes("--prune-only");
  const verifyMetadataPath = optionValue(args, "--verify");
  assert(!(pruneOnly && verifyMetadataPath), "--prune-only tidak dapat digabung dengan --verify.");
  return {
    environmentFile: optionValue(args, "--env-file"),
    composeFile: optionValue(args, "--compose-file") ?? "compose.production.yaml",
    projectName: optionValue(args, "--project-name"),
    service: optionValue(args, "--service") ?? "db",
    outputDirectory: optionValue(args, "--output-dir"),
    kind: optionValue(args, "--kind"),
    label: optionValue(args, "--label"),
    releaseId: optionValue(args, "--release-id"),
    protect: args.includes("--protect"),
    prune: args.includes("--prune"),
    pruneOnly,
    skipIfUninitialized: args.includes("--skip-if-uninitialized"),
    verifyMetadataPath,
  };
}

function parseIntegerEnvironment(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  assert(Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum, `${name} harus integer ${minimum}-${maximum}.`);
  return parsed;
}

function parseNumberEnvironment(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  assert(Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum, `${name} harus angka ${minimum}-${maximum}.`);
  return parsed;
}

function resolveOutputDirectory(options: CliOptions): string {
  const configured = options.outputDirectory ?? process.env.DATABASE_BACKUP_ROOT?.trim() ?? ".data/backups/postgres";
  const resolved = path.resolve(projectRoot, configured);
  assert(resolved !== projectRoot, "Direktori backup tidak boleh menggunakan project root.");
  assert(resolved !== path.parse(resolved).root, "Direktori backup tidak boleh menggunakan filesystem root.");
  return resolved;
}

function resolveComposeTarget(options: CliOptions): DatabaseComposeTarget {
  return {
    composeFile: path.resolve(projectRoot, options.composeFile),
    service: options.service,
    environmentFile: options.environmentFile ? path.resolve(projectRoot, options.environmentFile) : undefined,
    projectName: options.projectName,
  };
}

async function queryJson<T>(target: DatabaseComposeTarget, sql: string): Promise<T> {
  const output = await runDatabaseShell(
    target,
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$1"',
    [sql],
  );
  const line = output.trim().split(/\r?\n/).at(-1);
  assert(line, "Query metadata backup tidak menghasilkan output.");
  return JSON.parse(line) as T;
}

async function inspectApplicationSchema(
  target: DatabaseComposeTarget,
): Promise<{ initialized: boolean; publicTableCount: number }> {
  const output = await runDatabaseShell(
    target,
    'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F "|" -c "$1"',
    [
      `select (to_regclass('drizzle.__drizzle_migrations') is not null)::text,
              (select count(*)::text from pg_tables where schemaname = 'public')`,
    ],
  );
  const line = output.trim().split(/\r?\n/).at(-1);
  assert(line, "Pemeriksaan schema backup tidak menghasilkan output.");
  const [initializedText, tableCountText] = line.split("|");
  const publicTableCount = Number(tableCountText);
  assert(Number.isSafeInteger(publicTableCount) && publicTableCount >= 0, "Jumlah tabel public tidak valid.");
  return { initialized: initializedText === "true", publicTableCount };
}

async function readSourceState(target: DatabaseComposeTarget) {
  const source = await queryJson<{
    databaseName: string;
    serverVersion: string;
    serverVersionNumber: number;
    databaseBytes: number;
  }>(
    target,
    `select json_build_object(
       'databaseName', current_database(),
       'serverVersion', current_setting('server_version'),
       'serverVersionNumber', current_setting('server_version_num')::integer,
       'databaseBytes', pg_database_size(current_database())
     )::text`,
  );
  assert(
    Number.isSafeInteger(source.serverVersionNumber) &&
      Math.floor(source.serverVersionNumber / 10_000) === 17,
    "Backup production hanya didukung untuk PostgreSQL 17.",
  );
  assert(
    Number.isSafeInteger(source.databaseBytes) && source.databaseBytes > 0,
    "Ukuran database sumber tidak valid.",
  );

  const pgDumpVersion = (
    await runDatabaseShell(target, "exec pg_dump --version")
  ).trim();
  assert(/pg_dump \(PostgreSQL\) 17\./.test(pgDumpVersion), "pg_dump PostgreSQL 17 wajib tersedia.");

  const migrationCount = Number(
    (
      await runDatabaseShell(
        target,
        `exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c \
         "select count(*) from drizzle.__drizzle_migrations"`,
      )
    ).trim(),
  );
  assert(Number.isSafeInteger(migrationCount) && migrationCount > 0, "Migration history belum tersedia; backup production ditolak.");

  const tableList = CRITICAL_BACKUP_TABLES.map((table) => `'${table}'`).join(",");
  const tableRowCounts = await queryJson<Record<CriticalBackupTable, number>>(
    target,
    `select json_object_agg(table_name, row_count)::text
       from (
         ${CRITICAL_BACKUP_TABLES.map(
           (table) => `select '${table}'::text as table_name, count(*)::bigint as row_count from public.${table}`,
         ).join(" union all ")}
       ) counts`,
  );
  const tableConstraintCounts = await queryJson<Record<CriticalBackupTable, number>>(
    target,
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
    assert(Number.isSafeInteger(Number(tableRowCounts[table])), `Row count ${table} tidak valid.`);
    assert(Number.isSafeInteger(Number(tableConstraintCounts[table])), `Constraint count ${table} tidak valid.`);
  }

  return {
    source,
    pgDumpVersion,
    migrationCount,
    tableRowCounts: Object.fromEntries(
      CRITICAL_BACKUP_TABLES.map((table) => [table, Number(tableRowCounts[table])]),
    ) as Record<CriticalBackupTable, number>,
    tableConstraintCounts: Object.fromEntries(
      CRITICAL_BACKUP_TABLES.map((table) => [table, Number(tableConstraintCounts[table])]),
    ) as Record<CriticalBackupTable, number>,
  };
}

function assertDiskCapacity(outputDirectory: string, databaseBytes: number): void {
  const minimumFreeBytes = parseIntegerEnvironment(
    "DATABASE_BACKUP_MIN_FREE_BYTES",
    1_073_741_824,
    0,
    Number.MAX_SAFE_INTEGER,
  );
  const freeSpaceFactor = parseNumberEnvironment("DATABASE_BACKUP_FREE_SPACE_FACTOR", 2, 1, 10);
  const stats = statfsSync(outputDirectory);
  const availableBytes = Number(stats.bavail) * Number(stats.bsize);
  const requiredBytes = minimumFreeBytes + Math.ceil(databaseBytes * freeSpaceFactor);
  assert(
    availableBytes >= requiredBytes,
    `Kapasitas backup tidak cukup. Tersedia ${availableBytes} byte, minimal ${requiredBytes} byte diperlukan.`,
  );
}

async function verifyArchive(
  target: DatabaseComposeTarget,
  artifact: DatabaseBackupArtifact,
): Promise<{ sha256: string; bytes: number; listEntryCount: number }> {
  assert(existsSync(artifact.archivePath), `Archive backup tidak tersedia: ${artifact.archivePath}`);
  assert(existsSync(artifact.checksumPath), `Checksum backup tidak tersedia: ${artifact.checksumPath}`);
  const bytes = statSync(artifact.archivePath).size;
  assert(bytes > 0, "Archive backup kosong.");
  assert(bytes === artifact.metadata.archive.bytes, "Ukuran archive tidak cocok dengan metadata.");
  const sha256 = await sha256File(artifact.archivePath);
  assert(sha256 === artifact.metadata.archive.sha256, "Checksum archive tidak cocok dengan metadata; backup ditolak.");
  const checksumContent = readFileSync(artifact.checksumPath, "utf8").trim();
  assert(
    checksumContent === `${sha256}  ${artifact.metadata.fileName}`,
    "File checksum backup tidak cocok dengan metadata.",
  );
  const listOutput = await runDockerCapture(
    containerExecArgs(target, ["pg_restore", "--list"]),
    { inputFile: artifact.archivePath },
  );
  const listEntryCount = listOutput
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith(";")).length;
  assert(listEntryCount > 0, "pg_restore tidak menemukan entry pada archive.");
  assert(
    listEntryCount === artifact.metadata.archive.listEntryCount,
    "Jumlah entry archive berubah dari metadata backup.",
  );
  return { sha256, bytes, listEntryCount };
}

function readArtifacts(outputDirectory: string): DatabaseBackupArtifact[] {
  if (!existsSync(outputDirectory)) return [];
  const artifacts: DatabaseBackupArtifact[] = [];
  for (const fileName of readdirSync(outputDirectory).filter((name) => name.endsWith(".json")).sort()) {
    const metadataPath = path.join(outputDirectory, fileName);
    try {
      const artifact = readBackupArtifact(metadataPath);
      if (!existsSync(artifact.archivePath) || !existsSync(artifact.checksumPath)) {
        console.warn(`SKIP retention: pasangan artifact tidak lengkap untuk ${fileName}.`);
        continue;
      }
      artifacts.push(artifact);
    } catch (error) {
      console.warn(`SKIP retention: metadata ${fileName} tidak valid (${error instanceof Error ? error.message : String(error)}).`);
    }
  }
  return artifacts;
}

function retentionPolicy(): RetentionPolicy {
  return {
    dailyDays: parseIntegerEnvironment("DATABASE_BACKUP_DAILY_RETENTION_DAYS", 7, 1, 3650),
    weeklyWeeks: parseIntegerEnvironment("DATABASE_BACKUP_WEEKLY_RETENTION_WEEKS", 4, 1, 520),
    preDeploymentCount: parseIntegerEnvironment("DATABASE_BACKUP_PRE_DEPLOYMENT_RETENTION_COUNT", 5, 1, 100),
  };
}

function pruneBackups(outputDirectory: string): number {
  const decisions = planBackupRetention(readArtifacts(outputDirectory), retentionPolicy());
  let deleted = 0;
  for (const decision of decisions) {
    if (decision.action === "keep") continue;
    for (const filePath of [
      decision.artifact.archivePath,
      decision.artifact.checksumPath,
      decision.artifact.metadataPath,
    ]) {
      unlinkSync(filePath);
    }
    deleted += 1;
    console.log(`Retention menghapus ${decision.artifact.metadata.fileName}: ${decision.reason}.`);
  }
  console.log(`Retention selesai: ${deleted} backup dihapus, ${decisions.length - deleted} backup dipertahankan.`);
  return deleted;
}

async function createBackup(
  options: CliOptions,
  target: DatabaseComposeTarget,
  outputDirectory: string,
): Promise<DatabaseBackupArtifact> {
  const kind = parseBackupKind(options.kind ?? process.env.DATABASE_BACKUP_KIND ?? "manual");
  const environment = process.env.DATABASE_BACKUP_ENVIRONMENT?.trim() || "production";
  const compressionLevel = parseIntegerEnvironment("DATABASE_BACKUP_COMPRESSION_LEVEL", 6, 0, 9);
  mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  await assertComposeServiceRunning(target);
  const state = await readSourceState(target);
  assertDiskCapacity(outputDirectory, state.source.databaseBytes);

  const identity = buildBackupBaseName({
    environment,
    kind,
    label: options.label,
    backupId: randomUUID(),
  });
  const paths = artifactPaths(outputDirectory, identity.baseName);
  const partialArchivePath = `${paths.archivePath}.partial`;
  const partialChecksumPath = `${paths.checksumPath}.partial`;
  const partialMetadataPath = `${paths.metadataPath}.partial`;
  for (const filePath of [partialArchivePath, partialChecksumPath, partialMetadataPath]) {
    rmSync(filePath, { force: true });
  }

  console.log(`Membuat backup ${kind} dari ${state.source.databaseName}...`);
  try {
    await runDockerBinaryToFile(
      containerExecArgs(target, [
        "sh",
        "-eu",
        "-c",
        'exec pg_dump --format=custom --compress="$1" --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
        "asihjaya-backup",
        String(compressionLevel),
      ]),
      partialArchivePath,
    );
    const bytes = statSync(partialArchivePath).size;
    assert(bytes > 0, "pg_dump menghasilkan archive kosong.");
    const sha256 = await sha256File(partialArchivePath);
    const listOutput = await runDockerCapture(
      containerExecArgs(target, ["pg_restore", "--list"]),
      { inputFile: partialArchivePath },
    );
    const listEntryCount = listOutput
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith(";")).length;
    assert(listEntryCount > 0, "Archive hasil pg_dump tidak dapat dibaca pg_restore.");

    const completedAt = new Date().toISOString();
    const releaseId = (options.releaseId ?? process.env.APP_REVISION)?.trim();
    const metadata: DatabaseBackupMetadata = {
      version: 1,
      backupId: identity.backupId,
      fileName: path.basename(paths.archivePath),
      createdAt: identity.createdAt.toISOString(),
      completedAt,
      verifiedAt: completedAt,
      environment,
      kind,
      ...(options.label ? { label: options.label.trim() } : {}),
      ...(releaseId ? { releaseId } : {}),
      protected: options.protect,
      source: {
        ...state.source,
        pgDumpVersion: state.pgDumpVersion,
      },
      archive: {
        format: "custom",
        compressionLevel,
        bytes,
        sha256,
        listEntryCount,
      },
      verification: {
        status: "verified",
        migrationCount: state.migrationCount,
        tableRowCounts: state.tableRowCounts,
        tableConstraintCounts: state.tableConstraintCounts,
      },
    };
    writeFileSync(partialChecksumPath, `${sha256}  ${metadata.fileName}\n`, { mode: 0o600 });
    writeFileSync(partialMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
    renameSync(partialArchivePath, paths.archivePath);
    renameSync(partialChecksumPath, paths.checksumPath);
    renameSync(partialMetadataPath, paths.metadataPath);

    const artifact = readBackupArtifact(paths.metadataPath);
    await verifyArchive(target, artifact);
    console.log(`OK: backup verified ${artifact.metadata.fileName} (${artifact.metadata.archive.bytes} byte).`);
    return artifact;
  } catch (error) {
    for (const filePath of [
      partialArchivePath,
      partialChecksumPath,
      partialMetadataPath,
      paths.archivePath,
      paths.checksumPath,
      paths.metadataPath,
    ]) {
      rmSync(filePath, { force: true });
    }
    throw error;
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
  const outputDirectory = resolveOutputDirectory(options);
  const target = resolveComposeTarget(options);

  if (options.pruneOnly) {
    pruneBackups(outputDirectory);
    return;
  }
  await assertComposeServiceRunning(target);
  if (options.verifyMetadataPath) {
    const artifact = readBackupArtifact(path.resolve(projectRoot, options.verifyMetadataPath));
    await verifyArchive(target, artifact);
    console.log(`OK: checksum dan archive ${artifact.metadata.fileName} terverifikasi.`);
    return;
  }

  const schema = await inspectApplicationSchema(target);
  if (!schema.initialized) {
    assert(
      schema.publicTableCount === 0,
      "Database memiliki tabel public tetapi migration history tidak tersedia; backup otomatis ditolak.",
    );
    if (options.skipIfUninitialized) {
      console.log("SKIP: database bootstrap masih kosong; tidak ada data aplikasi untuk dibackup.");
      if (options.prune) pruneBackups(outputDirectory);
      return;
    }
    throw new Error("Schema aplikasi belum diinisialisasi; backup production belum dapat dibuat.");
  }

  await createBackup(options, target, outputDirectory);
  if (options.prune) pruneBackups(outputDirectory);
}

await main();
