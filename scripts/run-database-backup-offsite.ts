import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

import {
  readBackupArtifact,
  type DatabaseBackupArtifact,
} from "./database-backup-state";
import {
  assertSafeDownloadDirectory,
  parseOffsiteReceipt,
  sanitizeOffsitePrefix,
  type DatabaseBackupOffsiteReceipt,
} from "./database-backup-offsite-state";
import {
  downloadOffsiteBackup,
  listOffsiteReceipts,
  pruneOffsiteBackups,
  uploadBackupOffsite,
  verifyOffsiteReceipt,
  writeOffsiteStatus,
  type DatabaseBackupOffsiteConfig,
} from "./database-backup-offsite-service";
import { S3DatabaseBackupOffsiteStore } from "./database-backup-offsite-store";

const projectRoot = process.cwd();
const MAX_SINGLE_OBJECT_BYTES = 5 * 1024 * 1024 * 1024;

type CliOptions = {
  environmentFile?: string;
  metadataPath?: string;
  receiptPath?: string;
  backupId?: string;
  downloadDirectory?: string;
  uploadLatest: boolean;
  verifyLatest: boolean;
  prune: boolean;
  download: boolean;
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
    "--metadata",
    "--receipt",
    "--backup-id",
    "--download-dir",
  ]);
  const flagOptions = new Set(["--upload-latest", "--verify-latest", "--prune", "--download"]);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (valueOptions.has(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} membutuhkan value.`);
      index += 1;
      continue;
    }
    if (!flagOptions.has(argument)) throw new Error(`Argument tidak dikenal: ${argument}.`);
  }
  const options = {
    environmentFile: optionValue(args, "--env-file"),
    metadataPath: optionValue(args, "--metadata"),
    receiptPath: optionValue(args, "--receipt"),
    backupId: optionValue(args, "--backup-id"),
    downloadDirectory: optionValue(args, "--download-dir"),
    uploadLatest: args.includes("--upload-latest"),
    verifyLatest: args.includes("--verify-latest"),
    prune: args.includes("--prune"),
    download: args.includes("--download"),
  };
  assert(
    options.uploadLatest || options.metadataPath || options.verifyLatest || options.receiptPath || options.prune || options.download,
    "Pilih --upload-latest, --metadata, --verify-latest, --receipt, --prune, atau --download.",
  );
  if (options.download) {
    assert(options.backupId, "--download membutuhkan --backup-id.");
    assert(options.downloadDirectory, "--download membutuhkan --download-dir.");
  }
  return options;
}

function parseBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  throw new Error(`${name} harus boolean.`);
}

function parseInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  assert(Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum, `${name} harus integer ${minimum}-${maximum}.`);
  return parsed;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  assert(value && !/^CHANGE_ME$/i.test(value), `${name} wajib diatur dan bukan placeholder.`);
  return value;
}

function loadEnvironment(options: CliOptions): void {
  if (!options.environmentFile) return;
  const environmentPath = path.resolve(projectRoot, options.environmentFile);
  assert(existsSync(environmentPath), `Environment file tidak tersedia: ${environmentPath}`);
  const result = loadDotenv({ path: environmentPath, override: true, quiet: true });
  if (result.error) throw result.error;
}

function resolveConfig(): {
  config: DatabaseBackupOffsiteConfig;
  credentials: { accessKeyId: string; secretAccessKey: string };
  backupRoot: string;
  environment: string;
} {
  assert(parseBoolean("DATABASE_BACKUP_OFFSITE_ENABLED", false), "DATABASE_BACKUP_OFFSITE_ENABLED harus true untuk operasi off-site.");
  assert(required("DATABASE_BACKUP_OFFSITE_PROVIDER") === "backblaze-b2", "Provider off-site harus backblaze-b2.");
  const endpoint = required("DATABASE_BACKUP_OFFSITE_ENDPOINT");
  const region = required("DATABASE_BACKUP_OFFSITE_REGION");
  const endpointUrl = new URL(endpoint);
  assert(endpointUrl.protocol === "https:", "Endpoint Backblaze B2 wajib HTTPS.");
  assert(endpointUrl.hostname === `s3.${region}.backblazeb2.com`, "Endpoint Backblaze B2 harus cocok dengan region.");
  const bucket = required("DATABASE_BACKUP_OFFSITE_BUCKET");
  assert(/^[a-z0-9][a-z0-9.-]{4,61}[a-z0-9]$/.test(bucket), "Nama bucket Backblaze B2 tidak valid.");
  const objectLockMode = required("DATABASE_BACKUP_OFFSITE_OBJECT_LOCK_MODE");
  assert(objectLockMode === "COMPLIANCE" || objectLockMode === "GOVERNANCE", "Object Lock mode harus COMPLIANCE atau GOVERNANCE.");
  const backupRoot = path.resolve(projectRoot, process.env.DATABASE_BACKUP_ROOT?.trim() || ".data/backups/postgres");
  const statusPath = path.resolve(
    projectRoot,
    process.env.DATABASE_BACKUP_OFFSITE_STATUS_PATH?.trim() || ".data/backups/offsite-status/latest.json",
  );
  const maxArchiveBytes = parseInteger(
    "DATABASE_BACKUP_OFFSITE_MAX_ARCHIVE_BYTES",
    MAX_SINGLE_OBJECT_BYTES,
    1,
    MAX_SINGLE_OBJECT_BYTES,
  );
  return {
    backupRoot,
    environment: process.env.DATABASE_BACKUP_ENVIRONMENT?.trim() || "production",
    credentials: {
      accessKeyId: required("DATABASE_BACKUP_OFFSITE_ACCESS_KEY_ID"),
      secretAccessKey: required("DATABASE_BACKUP_OFFSITE_SECRET_ACCESS_KEY"),
    },
    config: {
      provider: "backblaze-b2",
      endpoint,
      region,
      bucket,
      prefix: sanitizeOffsitePrefix(
        process.env.DATABASE_BACKUP_OFFSITE_PREFIX?.trim() || "asihjaya-rms/postgres",
      ),
      objectLockMode,
      objectLockDays: parseInteger("DATABASE_BACKUP_OFFSITE_OBJECT_LOCK_DAYS", 14, 1, 3000),
      fullVerification: parseBoolean("DATABASE_BACKUP_OFFSITE_FULL_VERIFY", true),
      maxArchiveBytes,
      statusPath,
      retention: {
        dailyDays: parseInteger("DATABASE_BACKUP_OFFSITE_DAILY_RETENTION_DAYS", 14, 1, 3650),
        weeklyWeeks: parseInteger("DATABASE_BACKUP_OFFSITE_WEEKLY_RETENTION_WEEKS", 4, 1, 520),
        preDeploymentCount: parseInteger(
          "DATABASE_BACKUP_OFFSITE_PRE_DEPLOYMENT_RETENTION_COUNT",
          5,
          1,
          100,
        ),
      },
    },
  };
}

function localArtifacts(backupRoot: string): DatabaseBackupArtifact[] {
  if (!existsSync(backupRoot)) return [];
  const artifacts: DatabaseBackupArtifact[] = [];
  for (const fileName of readdirSync(backupRoot).filter(
    (name) => name.endsWith(".json") && !name.endsWith(".offsite.json"),
  )) {
    try {
      artifacts.push(readBackupArtifact(path.join(backupRoot, fileName)));
    } catch {
      // Metadata invalid tidak boleh menggagalkan pemilihan artifact valid lain.
    }
  }
  return artifacts.sort(
    (left, right) => Date.parse(right.metadata.completedAt) - Date.parse(left.metadata.completedAt),
  );
}

function resolveLocalArtifact(options: CliOptions, backupRoot: string): DatabaseBackupArtifact {
  if (options.metadataPath) {
    return readBackupArtifact(path.resolve(projectRoot, options.metadataPath));
  }
  const artifact = localArtifacts(backupRoot)[0];
  assert(artifact, `Tidak ada backup verified pada ${backupRoot}.`);
  return artifact;
}

function localReceipt(options: CliOptions): DatabaseBackupOffsiteReceipt | undefined {
  if (!options.receiptPath) return undefined;
  return parseOffsiteReceipt(readFileSync(path.resolve(projectRoot, options.receiptPath), "utf8"));
}

const options = parseOptions(process.argv.slice(2));
loadEnvironment(options);
const resolved = resolveConfig();
const store = new S3DatabaseBackupOffsiteStore({
  endpoint: resolved.config.endpoint,
  region: resolved.config.region,
  bucket: resolved.config.bucket,
  ...resolved.credentials,
});

let latestReceipt: DatabaseBackupOffsiteReceipt | undefined;
if (options.uploadLatest || options.metadataPath) {
  const artifact = resolveLocalArtifact(options, resolved.backupRoot);
  console.log(`Mengunggah backup verified ${artifact.metadata.fileName} ke Backblaze B2...`);
  latestReceipt = await uploadBackupOffsite({ store, artifact, config: resolved.config });
  writeOffsiteStatus({ statusPath: resolved.config.statusPath, receipt: latestReceipt });
  console.log(`OK: backup ${latestReceipt.backup.backupId} terunggah dan terverifikasi off-site.`);
}

if (options.receiptPath) {
  const receipt = localReceipt(options)!;
  latestReceipt = await verifyOffsiteReceipt({
    store,
    receiptKey: receipt.receiptKey,
    requireFullVerification: resolved.config.fullVerification,
  });
  writeOffsiteStatus({ statusPath: resolved.config.statusPath, receipt: latestReceipt });
  console.log(`OK: receipt off-site ${latestReceipt.backup.backupId} terverifikasi.`);
}

if (options.verifyLatest) {
  const receipts = await listOffsiteReceipts({
    store,
    prefix: resolved.config.prefix,
    environment: resolved.environment,
  });
  const receipt = receipts.sort(
    (left, right) => Date.parse(right.backup.createdAt) - Date.parse(left.backup.createdAt),
  )[0];
  assert(receipt, "Belum ada receipt backup off-site yang lengkap.");
  latestReceipt = await verifyOffsiteReceipt({
    store,
    receiptKey: receipt.receiptKey,
    requireFullVerification: resolved.config.fullVerification,
  });
  writeOffsiteStatus({ statusPath: resolved.config.statusPath, receipt: latestReceipt });
  console.log(`OK: backup off-site terbaru ${latestReceipt.backup.backupId} terverifikasi.`);
}

if (options.download) {
  const receipts = await listOffsiteReceipts({
    store,
    prefix: resolved.config.prefix,
    environment: resolved.environment,
  });
  const receipt = receipts.find((candidate) => candidate.backup.backupId === options.backupId);
  assert(receipt, `Backup off-site ${options.backupId} tidak ditemukan.`);
  await verifyOffsiteReceipt({
    store,
    receiptKey: receipt.receiptKey,
    requireFullVerification: resolved.config.fullVerification,
  });
  const outputDirectory = assertSafeDownloadDirectory(
    projectRoot,
    options.downloadDirectory!,
  );
  const artifact = await downloadOffsiteBackup({ store, receipt, outputDirectory });
  console.log(`OK: backup off-site diunduh dan diverifikasi ke ${artifact.metadataPath}.`);
}

if (options.prune) {
  const result = await pruneOffsiteBackups({
    store,
    prefix: resolved.config.prefix,
    environment: resolved.environment,
    policy: resolved.config.retention,
  });
  console.log(`Retention off-site selesai: ${result.deleted} backup dihapus, ${result.kept} dipertahankan.`);
}
