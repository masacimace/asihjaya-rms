import { createHash, randomUUID } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import path from "node:path";

export const DATABASE_BACKUP_METADATA_VERSION = 1 as const;
export const DATABASE_BACKUP_KINDS = [
  "daily",
  "weekly",
  "pre-deployment",
  "manual",
] as const;
export const CRITICAL_BACKUP_TABLES = [
  "organizations",
  "outlets",
  "registers",
  "users",
  "customers",
  "sales",
  "sale_items",
  "payments",
] as const;

export type DatabaseBackupKind = (typeof DATABASE_BACKUP_KINDS)[number];
export type CriticalBackupTable = (typeof CRITICAL_BACKUP_TABLES)[number];

export type DatabaseBackupMetadata = {
  version: typeof DATABASE_BACKUP_METADATA_VERSION;
  backupId: string;
  fileName: string;
  createdAt: string;
  completedAt: string;
  verifiedAt: string;
  environment: string;
  kind: DatabaseBackupKind;
  label?: string;
  releaseId?: string;
  protected: boolean;
  source: {
    databaseName: string;
    serverVersion: string;
    serverVersionNumber: number;
    pgDumpVersion: string;
    databaseBytes: number;
  };
  archive: {
    format: "custom";
    compressionLevel: number;
    bytes: number;
    sha256: string;
    listEntryCount: number;
  };
  verification: {
    status: "verified";
    migrationCount: number;
    tableRowCounts: Record<CriticalBackupTable, number>;
    tableConstraintCounts: Record<CriticalBackupTable, number>;
  };
};

export type DatabaseBackupArtifact = {
  metadataPath: string;
  checksumPath: string;
  archivePath: string;
  metadata: DatabaseBackupMetadata;
};

export type RetentionPolicy = {
  dailyDays: number;
  weeklyWeeks: number;
  preDeploymentCount: number;
};

export type RetentionDecision = {
  artifact: DatabaseBackupArtifact;
  action: "keep" | "delete";
  reason: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function parseBackupKind(value: string | undefined): DatabaseBackupKind {
  const normalized = value?.trim().toLowerCase();
  assert(
    DATABASE_BACKUP_KINDS.includes(normalized as DatabaseBackupKind),
    `Jenis backup harus salah satu: ${DATABASE_BACKUP_KINDS.join(", ")}.`,
  );
  return normalized as DatabaseBackupKind;
}

export function sanitizeBackupLabel(value: string, name: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  assert(normalized.length > 0, `${name} harus memiliki karakter yang aman untuk nama file.`);
  return normalized;
}

export function buildBackupBaseName(input: {
  environment: string;
  kind: DatabaseBackupKind;
  createdAt?: Date;
  label?: string;
  backupId?: string;
}): { backupId: string; baseName: string; createdAt: Date } {
  const createdAt = input.createdAt ?? new Date();
  assert(!Number.isNaN(createdAt.getTime()), "Timestamp backup tidak valid.");
  const backupId = input.backupId ?? randomUUID();
  const timestamp = createdAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const environment = sanitizeBackupLabel(input.environment, "DATABASE_BACKUP_ENVIRONMENT");
  const label = input.label ? `-${sanitizeBackupLabel(input.label, "label backup")}` : "";
  return {
    backupId,
    createdAt,
    baseName: `asihjaya-${environment}-${input.kind}-${timestamp}${label}-${backupId.slice(0, 8)}`,
  };
}

export function artifactPaths(outputDirectory: string, baseName: string) {
  return {
    archivePath: path.join(outputDirectory, `${baseName}.dump`),
    checksumPath: path.join(outputDirectory, `${baseName}.sha256`),
    metadataPath: path.join(outputDirectory, `${baseName}.json`),
  };
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

function parseSafeCount(value: unknown, name: string): number {
  const parsed = Number(value);
  assert(Number.isSafeInteger(parsed) && parsed >= 0, `${name} harus berupa integer non-negatif.`);
  return parsed;
}

function parseCountRecord(value: unknown, name: string): Record<CriticalBackupTable, number> {
  assert(value && typeof value === "object" && !Array.isArray(value), `${name} tidak valid.`);
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    CRITICAL_BACKUP_TABLES.map((table) => [table, parseSafeCount(source[table], `${name}.${table}`)]),
  ) as Record<CriticalBackupTable, number>;
}

export function parseBackupMetadata(content: string): DatabaseBackupMetadata {
  const value = JSON.parse(content) as Partial<DatabaseBackupMetadata>;
  assert(value.version === DATABASE_BACKUP_METADATA_VERSION, "Versi metadata backup tidak didukung.");
  assert(typeof value.backupId === "string" && /^[0-9a-f-]{36}$/i.test(value.backupId), "backupId tidak valid.");
  assert(typeof value.fileName === "string" && /^[A-Za-z0-9._-]+\.dump$/.test(value.fileName), "fileName backup tidak valid.");
  assert(typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt)), "createdAt backup tidak valid.");
  assert(typeof value.completedAt === "string" && !Number.isNaN(Date.parse(value.completedAt)), "completedAt backup tidak valid.");
  assert(typeof value.verifiedAt === "string" && !Number.isNaN(Date.parse(value.verifiedAt)), "verifiedAt backup tidak valid.");
  assert(Date.parse(value.completedAt) >= Date.parse(value.createdAt), "completedAt tidak boleh sebelum createdAt.");
  assert(Date.parse(value.verifiedAt) >= Date.parse(value.completedAt), "verifiedAt tidak boleh sebelum completedAt.");
  assert(typeof value.environment === "string" && value.environment.length > 0, "Environment backup tidak valid.");
  assert(DATABASE_BACKUP_KINDS.includes(value.kind as DatabaseBackupKind), "Jenis backup metadata tidak valid.");
  assert(typeof value.protected === "boolean", "Flag protected backup tidak valid.");
  assert(value.source && typeof value.source === "object", "Metadata source backup tidak valid.");
  assert(typeof value.source.databaseName === "string" && value.source.databaseName.length > 0, "Nama database backup tidak valid.");
  assert(typeof value.source.serverVersion === "string" && value.source.serverVersion.length > 0, "Versi PostgreSQL backup tidak valid.");
  assert(
    Number.isSafeInteger(value.source.serverVersionNumber) &&
      Math.floor(Number(value.source.serverVersionNumber) / 10_000) === 17,
    "Metadata backup wajib berasal dari PostgreSQL 17.",
  );
  assert(
    typeof value.source.pgDumpVersion === "string" &&
      /^pg_dump \(PostgreSQL\) 17\./.test(value.source.pgDumpVersion),
    "Metadata backup wajib dibuat oleh pg_dump PostgreSQL 17.",
  );
  assert(
    parseSafeCount(value.source.databaseBytes, "source.databaseBytes") > 0,
    "source.databaseBytes harus lebih dari nol.",
  );
  assert(value.archive?.format === "custom", "Format archive backup harus custom.");
  assert(Number.isInteger(value.archive.compressionLevel) && Number(value.archive.compressionLevel) >= 0 && Number(value.archive.compressionLevel) <= 9, "Compression level backup tidak valid.");
  assert(parseSafeCount(value.archive.bytes, "archive.bytes") > 0, "Archive backup tidak boleh kosong.");
  assert(typeof value.archive.sha256 === "string" && /^[a-f0-9]{64}$/.test(value.archive.sha256), "Checksum SHA-256 backup tidak valid.");
  assert(parseSafeCount(value.archive.listEntryCount, "archive.listEntryCount") > 0, "Daftar archive backup tidak boleh kosong.");
  assert(value.verification?.status === "verified", "Backup belum berstatus verified.");
  assert(
    parseSafeCount(value.verification.migrationCount, "verification.migrationCount") > 0,
    "verification.migrationCount harus lebih dari nol.",
  );
  const tableRowCounts = parseCountRecord(value.verification.tableRowCounts, "verification.tableRowCounts");
  const tableConstraintCounts = parseCountRecord(value.verification.tableConstraintCounts, "verification.tableConstraintCounts");
  return {
    ...(value as DatabaseBackupMetadata),
    verification: {
      status: "verified",
      migrationCount: Number(value.verification.migrationCount),
      tableRowCounts,
      tableConstraintCounts,
    },
  };
}

export function readBackupArtifact(metadataPath: string): DatabaseBackupArtifact {
  const metadata = parseBackupMetadata(readFileSync(metadataPath, "utf8"));
  const directory = path.dirname(metadataPath);
  const baseName = metadata.fileName.replace(/\.dump$/, "");
  return {
    metadata,
    metadataPath,
    archivePath: path.join(directory, metadata.fileName),
    checksumPath: path.join(directory, `${baseName}.sha256`),
  };
}

export function expectedRestoreConfirmation(
  metadata: DatabaseBackupMetadata,
  targetDatabase: string,
  productionTarget: boolean,
): string {
  return `${productionTarget ? "RESTORE-PRODUCTION" : "RESTORE"}:${targetDatabase}:${metadata.backupId}`;
}

export function planBackupRetention(
  artifacts: readonly DatabaseBackupArtifact[],
  policy: RetentionPolicy,
  now = new Date(),
): RetentionDecision[] {
  assert(Number.isFinite(now.getTime()), "Waktu evaluasi retention tidak valid.");
  assert(Number.isInteger(policy.dailyDays) && policy.dailyDays >= 1, "Daily retention minimal 1 hari.");
  assert(Number.isInteger(policy.weeklyWeeks) && policy.weeklyWeeks >= 1, "Weekly retention minimal 1 minggu.");
  assert(Number.isInteger(policy.preDeploymentCount) && policy.preDeploymentCount >= 1, "Pre-deployment retention minimal 1 backup.");

  const sorted = [...artifacts].sort(
    (left, right) => Date.parse(right.metadata.createdAt) - Date.parse(left.metadata.createdAt),
  );
  const newestByKind = new Map<DatabaseBackupKind, string>();
  for (const artifact of sorted) {
    if (!newestByKind.has(artifact.metadata.kind)) {
      newestByKind.set(artifact.metadata.kind, artifact.metadata.backupId);
    }
  }
  const preDeploymentIds = new Set(
    sorted
      .filter((artifact) => artifact.metadata.kind === "pre-deployment")
      .slice(0, policy.preDeploymentCount)
      .map((artifact) => artifact.metadata.backupId),
  );

  return sorted.map((artifact) => {
    const metadata = artifact.metadata;
    if (metadata.protected) return { artifact, action: "keep", reason: "backup dilindungi" };
    if (metadata.kind === "manual") return { artifact, action: "keep", reason: "backup manual tidak dipangkas otomatis" };
    if (newestByKind.get(metadata.kind) === metadata.backupId) {
      return { artifact, action: "keep", reason: "backup terbaru untuk jenisnya" };
    }

    const ageMs = now.getTime() - Date.parse(metadata.createdAt);
    if (ageMs < 0) return { artifact, action: "keep", reason: "timestamp backup berada di masa depan" };
    if (metadata.kind === "daily" && ageMs <= policy.dailyDays * 86_400_000) {
      return { artifact, action: "keep", reason: `masih dalam retention ${policy.dailyDays} hari` };
    }
    if (metadata.kind === "weekly" && ageMs <= policy.weeklyWeeks * 7 * 86_400_000) {
      return { artifact, action: "keep", reason: `masih dalam retention ${policy.weeklyWeeks} minggu` };
    }
    if (metadata.kind === "pre-deployment" && preDeploymentIds.has(metadata.backupId)) {
      return { artifact, action: "keep", reason: `termasuk ${policy.preDeploymentCount} pre-deployment backup terbaru` };
    }
    return { artifact, action: "delete", reason: "melewati retention policy" };
  });
}
