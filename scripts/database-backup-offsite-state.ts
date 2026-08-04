import path from "node:path";

import {
  DATABASE_BACKUP_KINDS,
  type DatabaseBackupKind,
  type DatabaseBackupMetadata,
} from "./database-backup-state";

export const DATABASE_BACKUP_OFFSITE_RECEIPT_VERSION = 1 as const;
export const DATABASE_BACKUP_OFFSITE_PROVIDER = "backblaze-b2" as const;
export const DATABASE_BACKUP_OFFSITE_OBJECT_ROLES = [
  "archive",
  "checksum",
  "metadata",
] as const;

export type DatabaseBackupOffsiteObjectRole =
  (typeof DATABASE_BACKUP_OFFSITE_OBJECT_ROLES)[number];

export type DatabaseBackupOffsiteObject = {
  role: DatabaseBackupOffsiteObjectRole;
  key: string;
  bytes: number;
  sha256: string;
  etag?: string;
};

export type DatabaseBackupOffsiteReceipt = {
  version: typeof DATABASE_BACKUP_OFFSITE_RECEIPT_VERSION;
  provider: typeof DATABASE_BACKUP_OFFSITE_PROVIDER;
  bucket: string;
  endpoint: string;
  region: string;
  prefix: string;
  receiptKey: string;
  uploadedAt: string;
  verifiedAt: string;
  fullVerification: boolean;
  objectLock: {
    mode: "COMPLIANCE" | "GOVERNANCE";
    retainUntil: string;
  };
  backup: Pick<
    DatabaseBackupMetadata,
    | "backupId"
    | "fileName"
    | "createdAt"
    | "environment"
    | "kind"
    | "label"
    | "releaseId"
    | "protected"
  >;
  objects: DatabaseBackupOffsiteObject[];
};

export type DatabaseBackupOffsiteStatus = {
  version: 1;
  provider: typeof DATABASE_BACKUP_OFFSITE_PROVIDER;
  bucket: string;
  prefix: string;
  latestBackupId: string;
  latestReceiptKey: string;
  latestBackupCreatedAt: string;
  lastSuccessfulUploadAt: string;
  lastSuccessfulVerificationAt: string;
  fullVerification: boolean;
};

export type DatabaseBackupOffsiteRetentionPolicy = {
  dailyDays: number;
  weeklyWeeks: number;
  preDeploymentCount: number;
};

export type DatabaseBackupOffsiteRetentionDecision = {
  receipt: DatabaseBackupOffsiteReceipt;
  action: "keep" | "delete";
  reason: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseSafeInteger(value: unknown, name: string): number {
  const parsed = Number(value);
  assert(Number.isSafeInteger(parsed) && parsed >= 0, `${name} harus integer non-negatif.`);
  return parsed;
}

function parseDate(value: unknown, name: string): string {
  assert(typeof value === "string" && !Number.isNaN(Date.parse(value)), `${name} tidak valid.`);
  return value;
}

function parseSafeKey(value: unknown, name: string): string {
  assert(typeof value === "string" && value.length > 0 && !value.startsWith("/"), `${name} tidak valid.`);
  assert(!value.split("/").includes(".."), `${name} tidak boleh mengandung traversal path.`);
  return value;
}

export function sanitizeOffsitePrefix(value: string): string {
  const normalized = value
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
  assert(normalized.length > 0 && normalized.length <= 512, "Prefix off-site tidak valid.");
  assert(
    normalized.split("/").every((segment) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(segment)),
    "Prefix off-site hanya boleh berisi segmen alfanumerik, titik, underscore, dan dash.",
  );
  return normalized;
}

export function buildOffsiteObjectKeys(input: {
  prefix: string;
  metadata: DatabaseBackupMetadata;
}): {
  backupPrefix: string;
  archiveKey: string;
  checksumKey: string;
  metadataKey: string;
  receiptKey: string;
} {
  const prefix = sanitizeOffsitePrefix(input.prefix);
  const environment = input.metadata.environment;
  assert(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(environment), "Environment backup tidak aman untuk object key.");
  const backupPrefix = `${prefix}/${environment}/backups/${input.metadata.backupId}`;
  const baseName = input.metadata.fileName.replace(/\.dump$/, "");
  return {
    backupPrefix,
    archiveKey: `${backupPrefix}/${input.metadata.fileName}`,
    checksumKey: `${backupPrefix}/${baseName}.sha256`,
    metadataKey: `${backupPrefix}/${baseName}.json`,
    receiptKey: `${backupPrefix}/${baseName}.offsite.json`,
  };
}

export function localOffsiteReceiptPath(metadataPath: string): string {
  return metadataPath.replace(/\.json$/, ".offsite.json");
}

export function parseOffsiteReceipt(content: string): DatabaseBackupOffsiteReceipt {
  const value = JSON.parse(content) as Partial<DatabaseBackupOffsiteReceipt>;
  assert(value.version === DATABASE_BACKUP_OFFSITE_RECEIPT_VERSION, "Versi receipt off-site tidak didukung.");
  assert(value.provider === DATABASE_BACKUP_OFFSITE_PROVIDER, "Provider receipt off-site tidak didukung.");
  assert(typeof value.bucket === "string" && /^[a-z0-9][a-z0-9.-]{4,61}[a-z0-9]$/.test(value.bucket), "Bucket receipt tidak valid.");
  assert(typeof value.endpoint === "string" && value.endpoint.startsWith("https://"), "Endpoint receipt tidak valid.");
  assert(typeof value.region === "string" && /^[a-z0-9-]{3,40}$/.test(value.region), "Region receipt tidak valid.");
  assert(typeof value.prefix === "string" && sanitizeOffsitePrefix(value.prefix) === value.prefix, "Prefix receipt tidak valid.");
  assert(parseSafeKey(value.receiptKey, "receiptKey").endsWith(".offsite.json"), "receiptKey harus berakhiran .offsite.json.");
  parseDate(value.uploadedAt, "uploadedAt");
  parseDate(value.verifiedAt, "verifiedAt");
  assert(typeof value.fullVerification === "boolean", "Flag fullVerification tidak valid.");
  assert(value.objectLock?.mode === "COMPLIANCE" || value.objectLock?.mode === "GOVERNANCE", "Object Lock mode tidak valid.");
  parseDate(value.objectLock.retainUntil, "objectLock.retainUntil");
  assert(value.backup && typeof value.backup === "object", "Ringkasan backup receipt tidak valid.");
  assert(typeof value.backup.backupId === "string" && /^[0-9a-f-]{36}$/i.test(value.backup.backupId), "backupId receipt tidak valid.");
  assert(typeof value.backup.fileName === "string" && /^[A-Za-z0-9._-]+\.dump$/.test(value.backup.fileName), "fileName receipt tidak valid.");
  parseDate(value.backup.createdAt, "backup.createdAt");
  assert(typeof value.backup.environment === "string" && value.backup.environment.length > 0, "backup.environment tidak valid.");
  assert(DATABASE_BACKUP_KINDS.includes(value.backup.kind as DatabaseBackupKind), "backup.kind tidak valid.");
  assert(typeof value.backup.protected === "boolean", "backup.protected tidak valid.");
  assert(Array.isArray(value.objects) && value.objects.length === 3, "Receipt wajib memiliki tiga object backup.");
  const roles = new Set<DatabaseBackupOffsiteObjectRole>();
  const objects = value.objects.map((object) => {
    assert(object && typeof object === "object", "Object receipt tidak valid.");
    assert(
      DATABASE_BACKUP_OFFSITE_OBJECT_ROLES.includes(object.role as DatabaseBackupOffsiteObjectRole),
      "Role object receipt tidak valid.",
    );
    const role = object.role as DatabaseBackupOffsiteObjectRole;
    assert(!roles.has(role), `Role object ${role} tidak boleh duplikat.`);
    roles.add(role);
    const key = parseSafeKey(object.key, `objects.${role}.key`);
    const bytes = parseSafeInteger(object.bytes, `objects.${role}.bytes`);
    assert(bytes > 0, `Object ${role} tidak boleh kosong.`);
    assert(typeof object.sha256 === "string" && /^[a-f0-9]{64}$/.test(object.sha256), `SHA-256 object ${role} tidak valid.`);
    return { role, key, bytes, sha256: object.sha256, etag: object.etag };
  });
  return {
    ...(value as DatabaseBackupOffsiteReceipt),
    objects,
  };
}

export function planOffsiteRetention(
  receipts: DatabaseBackupOffsiteReceipt[],
  policy: DatabaseBackupOffsiteRetentionPolicy,
  now = new Date(),
): DatabaseBackupOffsiteRetentionDecision[] {
  assert(!Number.isNaN(now.getTime()), "Timestamp retention off-site tidak valid.");
  assert(Number.isInteger(policy.dailyDays) && policy.dailyDays >= 1, "Retention daily off-site minimal 1 hari.");
  assert(Number.isInteger(policy.weeklyWeeks) && policy.weeklyWeeks >= 1, "Retention weekly off-site minimal 1 minggu.");
  assert(Number.isInteger(policy.preDeploymentCount) && policy.preDeploymentCount >= 1, "Retention pre-deployment off-site minimal 1 backup.");

  const sorted = [...receipts].sort(
    (left, right) => Date.parse(right.backup.createdAt) - Date.parse(left.backup.createdAt),
  );
  const newestByKind = new Map<DatabaseBackupKind, string>();
  for (const receipt of sorted) {
    if (!newestByKind.has(receipt.backup.kind)) {
      newestByKind.set(receipt.backup.kind, receipt.backup.backupId);
    }
  }
  const preDeploymentIds = new Set(
    sorted
      .filter((receipt) => receipt.backup.kind === "pre-deployment")
      .slice(0, policy.preDeploymentCount)
      .map((receipt) => receipt.backup.backupId),
  );

  return sorted.map((receipt) => {
    if (Date.parse(receipt.objectLock.retainUntil) > now.getTime()) {
      return { receipt, action: "keep", reason: "Object Lock masih aktif" };
    }
    if (receipt.backup.protected) {
      return { receipt, action: "keep", reason: "backup dilindungi" };
    }
    if (receipt.backup.kind === "manual") {
      return { receipt, action: "keep", reason: "backup manual tidak dipangkas otomatis" };
    }
    if (newestByKind.get(receipt.backup.kind) === receipt.backup.backupId) {
      return { receipt, action: "keep", reason: "backup terbaru untuk jenisnya" };
    }
    const ageMs = now.getTime() - Date.parse(receipt.backup.createdAt);
    if (ageMs < 0) return { receipt, action: "keep", reason: "timestamp backup berada di masa depan" };
    if (receipt.backup.kind === "daily" && ageMs <= policy.dailyDays * 86_400_000) {
      return { receipt, action: "keep", reason: `masih dalam retention ${policy.dailyDays} hari` };
    }
    if (receipt.backup.kind === "weekly" && ageMs <= policy.weeklyWeeks * 7 * 86_400_000) {
      return { receipt, action: "keep", reason: `masih dalam retention ${policy.weeklyWeeks} minggu` };
    }
    if (receipt.backup.kind === "pre-deployment" && preDeploymentIds.has(receipt.backup.backupId)) {
      return { receipt, action: "keep", reason: `termasuk ${policy.preDeploymentCount} pre-deployment backup terbaru` };
    }
    return { receipt, action: "delete", reason: "melewati retention policy off-site" };
  });
}

export function assertSafeDownloadDirectory(projectRoot: string, directory: string): string {
  const resolved = path.resolve(projectRoot, directory);
  assert(resolved !== projectRoot, "Direktori download off-site tidak boleh project root.");
  assert(resolved !== path.parse(resolved).root, "Direktori download off-site tidak boleh filesystem root.");
  return resolved;
}
