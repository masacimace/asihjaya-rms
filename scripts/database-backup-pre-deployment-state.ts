import { readFileSync } from "node:fs";

import { assertReleaseId, writeJsonAtomic } from "./deployment-state";

export const DATABASE_BACKUP_COMMAND_RESULT_VERSION = 1 as const;
export const DATABASE_BACKUP_OFFSITE_COMMAND_RESULT_VERSION = 1 as const;
export const DATABASE_PRE_DEPLOYMENT_BACKUP_RESULT_VERSION = 1 as const;

export type DatabaseBackupCommandResult =
  | {
      version: typeof DATABASE_BACKUP_COMMAND_RESULT_VERSION;
      operation: "database-backup";
      status: "created";
      completedAt: string;
      artifact: {
        backupId: string;
        metadataPath: string;
        archivePath: string;
        checksumPath: string;
        releaseId: string | null;
        verifiedAt: string;
      };
    }
  | {
      version: typeof DATABASE_BACKUP_COMMAND_RESULT_VERSION;
      operation: "database-backup";
      status: "skipped-uninitialized";
      completedAt: string;
      artifact: null;
    };

export type DatabaseBackupOffsiteCommandResult = {
  version: typeof DATABASE_BACKUP_OFFSITE_COMMAND_RESULT_VERSION;
  operation: "database-backup-offsite";
  status: "verified";
  completedAt: string;
  backupId: string;
  releaseId: string | null;
  receiptPath: string;
  receiptKey: string;
  verifiedAt: string;
  fullVerification: boolean;
};

export type DatabasePreDeploymentBackupResult =
  | {
      version: typeof DATABASE_PRE_DEPLOYMENT_BACKUP_RESULT_VERSION;
      operation: "database-backup-pre-deployment";
      status: "verified";
      releaseId: string;
      startedAt: string;
      completedAt: string;
      local: {
        backupId: string;
        metadataPath: string;
        archivePath: string;
        checksumPath: string;
        verifiedAt: string;
      };
      offsite: {
        receiptPath: string;
        receiptKey: string;
        verifiedAt: string;
        fullVerification: true;
      };
    }
  | {
      version: typeof DATABASE_PRE_DEPLOYMENT_BACKUP_RESULT_VERSION;
      operation: "database-backup-pre-deployment";
      status: "skipped-uninitialized";
      releaseId: string;
      startedAt: string;
      completedAt: string;
      local: null;
      offsite: null;
    };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  assert(Boolean(value) && typeof value === "object" && !Array.isArray(value), `${name} harus berupa object.`);
}

function assertIsoTimestamp(value: unknown, name: string): asserts value is string {
  assert(typeof value === "string", `${name} wajib berupa string.`);
  const parsed = new Date(value);
  assert(!Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value, `${name} harus timestamp ISO UTC canonical.`);
}

function assertBackupId(value: unknown, name: string): asserts value is string {
  assert(typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value), `${name} tidak valid.`);
}

function assertPath(value: unknown, name: string): asserts value is string {
  assert(typeof value === "string" && value.trim().length > 0, `${name} wajib diisi.`);
}

export function parseDatabaseBackupCommandResult(content: string): DatabaseBackupCommandResult {
  const value = JSON.parse(content) as unknown;
  assertObject(value, "Database backup command result");
  assert(value.version === DATABASE_BACKUP_COMMAND_RESULT_VERSION, "Versi database backup command result tidak didukung.");
  assert(value.operation === "database-backup", "Operation database backup result tidak valid.");
  assertIsoTimestamp(value.completedAt, "completedAt");
  assert(value.status === "created" || value.status === "skipped-uninitialized", "Status database backup result tidak valid.");

  if (value.status === "skipped-uninitialized") {
    assert(value.artifact === null, "Artifact harus null ketika backup dilewati.");
    return value as DatabaseBackupCommandResult;
  }

  assertObject(value.artifact, "artifact");
  assertBackupId(value.artifact.backupId, "artifact.backupId");
  for (const name of ["metadataPath", "archivePath", "checksumPath"] as const) {
    assertPath(value.artifact[name], `artifact.${name}`);
  }
  assert(value.artifact.releaseId === null || typeof value.artifact.releaseId === "string", "artifact.releaseId harus null atau string.");
  if (typeof value.artifact.releaseId === "string") assertReleaseId(value.artifact.releaseId);
  assertIsoTimestamp(value.artifact.verifiedAt, "artifact.verifiedAt");
  return value as DatabaseBackupCommandResult;
}

export function parseDatabaseBackupOffsiteCommandResult(
  content: string,
): DatabaseBackupOffsiteCommandResult {
  const value = JSON.parse(content) as unknown;
  assertObject(value, "Database backup off-site command result");
  assert(value.version === DATABASE_BACKUP_OFFSITE_COMMAND_RESULT_VERSION, "Versi off-site command result tidak didukung.");
  assert(value.operation === "database-backup-offsite", "Operation off-site result tidak valid.");
  assert(value.status === "verified", "Status off-site result wajib verified.");
  assertIsoTimestamp(value.completedAt, "completedAt");
  assertBackupId(value.backupId, "backupId");
  assert(value.releaseId === null || typeof value.releaseId === "string", "releaseId harus null atau string.");
  if (typeof value.releaseId === "string") assertReleaseId(value.releaseId);
  assertPath(value.receiptPath, "receiptPath");
  assertPath(value.receiptKey, "receiptKey");
  assertIsoTimestamp(value.verifiedAt, "verifiedAt");
  assert(typeof value.fullVerification === "boolean", "fullVerification harus boolean.");
  return value as DatabaseBackupOffsiteCommandResult;
}

export function parseDatabasePreDeploymentBackupResult(
  content: string,
): DatabasePreDeploymentBackupResult {
  const value = JSON.parse(content) as unknown;
  assertObject(value, "Pre-deployment backup result");
  assert(value.version === DATABASE_PRE_DEPLOYMENT_BACKUP_RESULT_VERSION, "Versi pre-deployment backup result tidak didukung.");
  assert(value.operation === "database-backup-pre-deployment", "Operation pre-deployment result tidak valid.");
  assert(value.status === "verified" || value.status === "skipped-uninitialized", "Status pre-deployment result tidak valid.");
  assert(typeof value.releaseId === "string", "releaseId wajib berupa string.");
  assertReleaseId(value.releaseId);
  assertIsoTimestamp(value.startedAt, "startedAt");
  assertIsoTimestamp(value.completedAt, "completedAt");
  assert(new Date(value.completedAt).valueOf() >= new Date(value.startedAt).valueOf(), "completedAt tidak boleh sebelum startedAt.");

  if (value.status === "skipped-uninitialized") {
    assert(value.local === null && value.offsite === null, "Result skipped tidak boleh memiliki artifact.");
    return value as DatabasePreDeploymentBackupResult;
  }

  assertObject(value.local, "local");
  assertBackupId(value.local.backupId, "local.backupId");
  for (const name of ["metadataPath", "archivePath", "checksumPath"] as const) {
    assertPath(value.local[name], `local.${name}`);
  }
  assertIsoTimestamp(value.local.verifiedAt, "local.verifiedAt");

  assertObject(value.offsite, "offsite");
  assertPath(value.offsite.receiptPath, "offsite.receiptPath");
  assertPath(value.offsite.receiptKey, "offsite.receiptKey");
  assertIsoTimestamp(value.offsite.verifiedAt, "offsite.verifiedAt");
  assert(value.offsite.fullVerification === true, "Pre-deployment wajib memakai full off-site verification.");
  return value as DatabasePreDeploymentBackupResult;
}

export function readDatabaseBackupCommandResult(filePath: string): DatabaseBackupCommandResult {
  return parseDatabaseBackupCommandResult(readFileSync(filePath, "utf8"));
}

export function readDatabaseBackupOffsiteCommandResult(
  filePath: string,
): DatabaseBackupOffsiteCommandResult {
  return parseDatabaseBackupOffsiteCommandResult(readFileSync(filePath, "utf8"));
}

export function readDatabasePreDeploymentBackupResult(
  filePath: string,
): DatabasePreDeploymentBackupResult {
  return parseDatabasePreDeploymentBackupResult(readFileSync(filePath, "utf8"));
}

export function writeDatabaseBackupResult(filePath: string, value: DatabaseBackupCommandResult): void {
  parseDatabaseBackupCommandResult(JSON.stringify(value));
  writeJsonAtomic(filePath, value);
}

export function writeDatabaseBackupOffsiteResult(
  filePath: string,
  value: DatabaseBackupOffsiteCommandResult,
): void {
  parseDatabaseBackupOffsiteCommandResult(JSON.stringify(value));
  writeJsonAtomic(filePath, value);
}

export function writeDatabasePreDeploymentBackupResult(
  filePath: string,
  value: DatabasePreDeploymentBackupResult,
): void {
  parseDatabasePreDeploymentBackupResult(JSON.stringify(value));
  writeJsonAtomic(filePath, value);
}
