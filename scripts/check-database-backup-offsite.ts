import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildOffsiteObjectKeys,
  parseOffsiteReceipt,
  planOffsiteRetention,
  sanitizeOffsitePrefix,
  type DatabaseBackupOffsiteReceipt,
} from "./database-backup-offsite-state";
import type { DatabaseBackupMetadata } from "./database-backup-state";

const projectRoot = process.cwd();

const metadata: DatabaseBackupMetadata = {
  version: 1,
  backupId: "11111111-1111-4111-8111-111111111111",
  fileName: "asihjaya-production-daily-20260803T090000Z-11111111.dump",
  createdAt: "2026-08-03T09:00:00.000Z",
  completedAt: "2026-08-03T09:01:00.000Z",
  verifiedAt: "2026-08-03T09:02:00.000Z",
  environment: "production",
  kind: "daily",
  protected: false,
  source: {
    databaseName: "asihjaya_rms",
    serverVersion: "17.10",
    serverVersionNumber: 170010,
    pgDumpVersion: "pg_dump (PostgreSQL) 17.10",
    databaseBytes: 1000,
  },
  archive: {
    format: "custom",
    compressionLevel: 6,
    bytes: 500,
    sha256: "a".repeat(64),
    listEntryCount: 10,
  },
  verification: {
    status: "verified",
    migrationCount: 13,
    tableRowCounts: {
      organizations: 1,
      outlets: 1,
      registers: 1,
      users: 1,
      customers: 1,
      sales: 1,
      sale_items: 1,
      payments: 1,
    },
    tableConstraintCounts: {
      organizations: 1,
      outlets: 1,
      registers: 1,
      users: 1,
      customers: 1,
      sales: 1,
      sale_items: 1,
      payments: 1,
    },
  },
};

assert.equal(sanitizeOffsitePrefix("/asihjaya-rms//postgres/"), "asihjaya-rms/postgres");
assert.throws(() => sanitizeOffsitePrefix("../backup"));
const keys = buildOffsiteObjectKeys({ prefix: "asihjaya-rms/postgres", metadata });
assert.equal(
  keys.archiveKey,
  `asihjaya-rms/postgres/production/backups/${metadata.backupId}/${metadata.fileName}`,
);
assert(keys.receiptKey.endsWith(".offsite.json"));

function receipt(input: {
  backupId: string;
  kind: "daily" | "weekly" | "pre-deployment" | "manual";
  createdAt: string;
  retainUntil: string;
  protected?: boolean;
}): DatabaseBackupOffsiteReceipt {
  const fileName = `asihjaya-production-${input.kind}-${input.backupId.slice(0, 8)}.dump`;
  const base = `asihjaya-rms/postgres/production/backups/${input.backupId}`;
  return {
    version: 1,
    provider: "backblaze-b2",
    bucket: "asihjaya-rms-backups",
    endpoint: "https://s3.us-east-005.backblazeb2.com",
    region: "us-east-005",
    prefix: "asihjaya-rms/postgres",
    receiptKey: `${base}/${fileName.replace(/\.dump$/, ".offsite.json")}`,
    uploadedAt: input.createdAt,
    verifiedAt: input.createdAt,
    fullVerification: true,
    objectLock: { mode: "COMPLIANCE", retainUntil: input.retainUntil },
    backup: {
      backupId: input.backupId,
      fileName,
      createdAt: input.createdAt,
      environment: "production",
      kind: input.kind,
      protected: input.protected ?? false,
    },
    objects: [
      { role: "archive", key: `${base}/${fileName}`, bytes: 1, sha256: "a".repeat(64) },
      { role: "checksum", key: `${base}/${fileName}.sha256`, bytes: 1, sha256: "b".repeat(64) },
      { role: "metadata", key: `${base}/${fileName}.json`, bytes: 1, sha256: "c".repeat(64) },
    ],
  };
}

const parsed = parseOffsiteReceipt(
  JSON.stringify(
    receipt({
      backupId: metadata.backupId,
      kind: "daily",
      createdAt: metadata.createdAt,
      retainUntil: "2026-08-17T09:00:00.000Z",
    }),
  ),
);
assert.equal(parsed.backup.backupId, metadata.backupId);

const retention = planOffsiteRetention(
  [
    receipt({
      backupId: "22222222-2222-4222-8222-222222222222",
      kind: "daily",
      createdAt: "2026-07-01T00:00:00.000Z",
      retainUntil: "2026-07-15T00:00:00.000Z",
    }),
    receipt({
      backupId: "33333333-3333-4333-8333-333333333333",
      kind: "daily",
      createdAt: "2026-08-02T00:00:00.000Z",
      retainUntil: "2026-08-16T00:00:00.000Z",
    }),
    receipt({
      backupId: "44444444-4444-4444-8444-444444444444",
      kind: "manual",
      createdAt: "2026-01-01T00:00:00.000Z",
      retainUntil: "2026-01-15T00:00:00.000Z",
    }),
  ],
  { dailyDays: 14, weeklyWeeks: 4, preDeploymentCount: 5 },
  new Date("2026-08-03T00:00:00.000Z"),
);
assert.equal(retention.find((item) => item.receipt.backup.backupId.startsWith("2222"))?.action, "delete");
assert.equal(retention.find((item) => item.receipt.backup.backupId.startsWith("3333"))?.action, "keep");
assert.equal(retention.find((item) => item.receipt.backup.backupId.startsWith("4444"))?.action, "keep");

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
for (const scriptName of [
  "check:database-backup-offsite",
  "test:database-backup-offsite:local",
  "db:backup:offsite",
  "db:backup:offsite:verify",
  "db:backup:offsite:prune",
  "db:backup:offsite:download",
  "db:backup:production:offsite",
  "db:backup:weekly:offsite",
  "db:backup:pre-deployment:offsite",
]) {
  assert(packageJson.scripts?.[scriptName], `package.json wajib memiliki ${scriptName}.`);
}

const environmentTemplate = readFileSync(path.join(projectRoot, ".env.production.example"), "utf8");
for (const name of [
  "DATABASE_BACKUP_OFFSITE_ENABLED",
  "DATABASE_BACKUP_OFFSITE_PROVIDER",
  "DATABASE_BACKUP_OFFSITE_ENDPOINT",
  "DATABASE_BACKUP_OFFSITE_REGION",
  "DATABASE_BACKUP_OFFSITE_BUCKET",
  "DATABASE_BACKUP_OFFSITE_PREFIX",
  "DATABASE_BACKUP_OFFSITE_ACCESS_KEY_ID",
  "DATABASE_BACKUP_OFFSITE_SECRET_ACCESS_KEY",
  "DATABASE_BACKUP_OFFSITE_OBJECT_LOCK_MODE",
  "DATABASE_BACKUP_OFFSITE_OBJECT_LOCK_DAYS",
  "DATABASE_BACKUP_OFFSITE_FULL_VERIFY",
  "DATABASE_BACKUP_OFFSITE_MAX_ARCHIVE_BYTES",
  "DATABASE_BACKUP_OFFSITE_STATUS_PATH",
  "DATABASE_BACKUP_OFFSITE_DAILY_RETENTION_DAYS",
  "DATABASE_BACKUP_OFFSITE_WEEKLY_RETENTION_WEEKS",
  "DATABASE_BACKUP_OFFSITE_PRE_DEPLOYMENT_RETENTION_COUNT",
]) {
  assert.match(environmentTemplate, new RegExp(`^${name}=`, "m"), `${name} wajib didokumentasikan.`);
}
assert.match(environmentTemplate, /^DATABASE_BACKUP_OFFSITE_ENABLED=false$/m);
assert.match(environmentTemplate, /^DATABASE_BACKUP_OFFSITE_PROVIDER=backblaze-b2$/m);
assert.match(environmentTemplate, /^DATABASE_BACKUP_OFFSITE_OBJECT_LOCK_MODE=COMPLIANCE$/m);
assert.match(environmentTemplate, /^DATABASE_BACKUP_OFFSITE_FULL_VERIFY=true$/m);

const generator = readFileSync(
  path.join(projectRoot, "scripts/generate-environment-secrets.mjs"),
  "utf8",
);
assert.match(generator, /appendMissingTemplateVariables/);
assert.match(generator, /Variable template baru ditambahkan/);

const runner = readFileSync(path.join(projectRoot, "scripts/run-database-backup-offsite.ts"), "utf8");
assert.match(runner, /s3\.\$\{region\}\.backblazeb2\.com/);
assert.match(runner, /DATABASE_BACKUP_OFFSITE_ENABLED harus true/);
assert.match(runner, /DATABASE_BACKUP_OFFSITE_MAX_ARCHIVE_BYTES/);
assert.doesNotMatch(runner, /console\.(?:log|error)\([^\n]*(?:SECRET_ACCESS_KEY|ACCESS_KEY_ID)/);

const service = readFileSync(path.join(projectRoot, "scripts/database-backup-offsite-service.ts"), "utf8");
assert.match(service, /Full SHA-256 verification/);
assert.match(service, /Object Lock/);
assert.match(service, /receiptKey/);
assert.match(service, /planOffsiteRetention/);

const store = readFileSync(path.join(projectRoot, "scripts/database-backup-offsite-store.ts"), "utf8");
assert.match(store, /ObjectLockRetainUntilDate/);
assert.match(store, /forcePathStyle: true/);
assert.match(store, /DeleteObjectsCommand/);
assert.match(store, /ListObjectsV2Command/);
assert.match(store, /ListObjectVersionsCommand/);
assert.match(store, /ContentMD5/);

const docs = readFileSync(path.join(projectRoot, "docs/development/database-backup-offsite.md"), "utf8");
assert.match(docs, /Backblaze B2/);
assert.match(docs, /Object Lock/);
assert.match(docs, /COMPLIANCE/);
assert.match(docs, /application key/i);
assert.match(docs, /restore rehearsal/i);

console.log("OK: kontrak automated off-site backup Backblaze B2 konsisten.");
