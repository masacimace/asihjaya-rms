import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  CRITICAL_BACKUP_TABLES,
  buildBackupBaseName,
  expectedRestoreConfirmation,
  parseBackupKind,
  parseBackupMetadata,
  planBackupRetention,
  sha256File,
  type CriticalBackupTable,
  type DatabaseBackupArtifact,
  type DatabaseBackupMetadata,
} from "./database-backup-state";

const projectRoot = process.cwd();

function counts(value: number): Record<CriticalBackupTable, number> {
  return Object.fromEntries(CRITICAL_BACKUP_TABLES.map((table) => [table, value])) as Record<
    CriticalBackupTable,
    number
  >;
}

function metadata(input: {
  backupId: string;
  kind: DatabaseBackupMetadata["kind"];
  createdAt: string;
  protected?: boolean;
}): DatabaseBackupMetadata {
  return {
    version: 1,
    backupId: input.backupId,
    fileName: `${input.backupId}.dump`,
    createdAt: input.createdAt,
    completedAt: input.createdAt,
    verifiedAt: input.createdAt,
    environment: "production",
    kind: input.kind,
    protected: input.protected ?? false,
    source: {
      databaseName: "asihjaya_rms",
      serverVersion: "17.10",
      serverVersionNumber: 170010,
      pgDumpVersion: "pg_dump (PostgreSQL) 17.10",
      databaseBytes: 1024,
    },
    archive: {
      format: "custom",
      compressionLevel: 6,
      bytes: 128,
      sha256: "a".repeat(64),
      listEntryCount: 10,
    },
    verification: {
      status: "verified",
      migrationCount: 13,
      tableRowCounts: counts(1),
      tableConstraintCounts: counts(2),
    },
  };
}

function artifact(value: DatabaseBackupMetadata): DatabaseBackupArtifact {
  return {
    metadata: value,
    archivePath: `/backup/${value.fileName}`,
    checksumPath: `/backup/${value.fileName.replace(/\.dump$/, ".sha256")}`,
    metadataPath: `/backup/${value.fileName.replace(/\.dump$/, ".json")}`,
  };
}

assert.equal(parseBackupKind("daily"), "daily");
assert.throws(() => parseBackupKind("monthly"), /Jenis backup/);
const identity = buildBackupBaseName({
  environment: "Production Jakarta",
  kind: "pre-deployment",
  createdAt: new Date("2026-08-03T05:00:00.000Z"),
  label: "Release 1.2.3",
  backupId: "12345678-1234-4234-8234-123456789abc",
});
assert.equal(
  identity.baseName,
  "asihjaya-production-jakarta-pre-deployment-20260803T050000Z-release-1.2.3-12345678",
);

const parsed = parseBackupMetadata(
  JSON.stringify(
    metadata({
      backupId: "12345678-1234-4234-8234-123456789abc",
      kind: "daily",
      createdAt: "2026-08-03T05:00:00.000Z",
    }),
  ),
);
assert.equal(parsed.archive.compressionLevel, 6);
assert.equal(parsed.verification.tableRowCounts.sales, 1);
assert.throws(
  () =>
    parseBackupMetadata(
      JSON.stringify({
        ...parsed,
        source: { ...parsed.source, serverVersionNumber: 160010, serverVersion: "16.10" },
      }),
    ),
  /PostgreSQL 17/,
);
assert.throws(
  () =>
    parseBackupMetadata(
      JSON.stringify({
        ...parsed,
        completedAt: "2026-08-02T05:00:00.000Z",
      }),
    ),
  /completedAt/,
);
assert.equal(
  expectedRestoreConfirmation(parsed, "restore_test", false),
  `RESTORE:restore_test:${parsed.backupId}`,
);
assert.equal(
  expectedRestoreConfirmation(parsed, "asihjaya_rms", true),
  `RESTORE-PRODUCTION:asihjaya_rms:${parsed.backupId}`,
);

const now = new Date("2026-08-31T00:00:00.000Z");
const retentionArtifacts = [
  artifact(
    metadata({
      backupId: "00000000-0000-4000-8000-000000000001",
      kind: "daily",
      createdAt: "2026-08-30T00:00:00.000Z",
    }),
  ),
  artifact(
    metadata({
      backupId: "00000000-0000-4000-8000-000000000002",
      kind: "daily",
      createdAt: "2026-08-01T00:00:00.000Z",
    }),
  ),
  artifact(
    metadata({
      backupId: "00000000-0000-4000-8000-000000000003",
      kind: "daily",
      createdAt: "2026-07-01T00:00:00.000Z",
      protected: true,
    }),
  ),
  artifact(
    metadata({
      backupId: "00000000-0000-4000-8000-000000000004",
      kind: "manual",
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
  ),
  artifact(
    metadata({
      backupId: "00000000-0000-4000-8000-000000000005",
      kind: "pre-deployment",
      createdAt: "2026-08-29T00:00:00.000Z",
    }),
  ),
  artifact(
    metadata({
      backupId: "00000000-0000-4000-8000-000000000006",
      kind: "pre-deployment",
      createdAt: "2026-08-28T00:00:00.000Z",
    }),
  ),
  artifact(
    metadata({
      backupId: "00000000-0000-4000-8000-000000000007",
      kind: "pre-deployment",
      createdAt: "2026-08-27T00:00:00.000Z",
    }),
  ),
];
const decisions = planBackupRetention(
  retentionArtifacts,
  { dailyDays: 7, weeklyWeeks: 4, preDeploymentCount: 2 },
  now,
);
const decisionById = new Map(decisions.map((decision) => [decision.artifact.metadata.backupId, decision]));
assert.equal(decisionById.get("00000000-0000-4000-8000-000000000001")?.action, "keep");
assert.equal(decisionById.get("00000000-0000-4000-8000-000000000002")?.action, "delete");
assert.equal(decisionById.get("00000000-0000-4000-8000-000000000003")?.action, "keep");
assert.equal(decisionById.get("00000000-0000-4000-8000-000000000004")?.action, "keep");
assert.equal(decisionById.get("00000000-0000-4000-8000-000000000007")?.action, "delete");

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "asihjaya-backup-contract-"));
try {
  const checksumTarget = path.join(temporaryRoot, "sample.dump");
  writeFileSync(checksumTarget, "asihjaya-backup");
  assert.equal(
    await sha256File(checksumTarget),
    "99d093ded65e8c1da87089a0f5682ebd96b18bb1f332ee1c383a0d6127efdc41",
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
for (const scriptName of [
  "check:database-backup",
  "test:database-backup:local",
  "db:backup",
  "db:backup:production",
  "db:backup:pre-deployment",
  "db:backup:pre-deployment:verified",
  "db:backup:prune",
  "db:restore",
  "db:restore:production",
]) {
  assert(packageJson.scripts?.[scriptName], `package.json wajib memiliki ${scriptName}.`);
}
assert.match(
  packageJson.scripts?.["db:deploy:production"] ?? "",
  /db:backup:pre-deployment:verified/,
  "Production migration wajib didahului backup lokal dan off-site yang terverifikasi.",
);

const environmentTemplate = readFileSync(path.join(projectRoot, ".env.production.example"), "utf8");
for (const name of [
  "DATABASE_BACKUP_ROOT",
  "DATABASE_BACKUP_ENVIRONMENT",
  "DATABASE_BACKUP_COMPRESSION_LEVEL",
  "DATABASE_BACKUP_MIN_FREE_BYTES",
  "DATABASE_BACKUP_FREE_SPACE_FACTOR",
  "DATABASE_BACKUP_DAILY_RETENTION_DAYS",
  "DATABASE_BACKUP_WEEKLY_RETENTION_WEEKS",
  "DATABASE_BACKUP_PRE_DEPLOYMENT_RETENTION_COUNT",
  "DATABASE_RESTORE_ALLOW_PRODUCTION",
  "DATABASE_RESTORE_APPROVAL_REFERENCE",
]) {
  assert.match(environmentTemplate, new RegExp(`^${name}=`, "m"), `${name} wajib didokumentasikan.`);
}
assert.match(environmentTemplate, /^DATABASE_RESTORE_ALLOW_PRODUCTION=false$/m);
assert.match(environmentTemplate, /^DATABASE_BACKUP_DAILY_RETENTION_DAYS=7$/m);
assert.match(environmentTemplate, /^DATABASE_BACKUP_WEEKLY_RETENTION_WEEKS=4$/m);

const backupDockerHelper = readFileSync(
  path.join(projectRoot, "scripts/database-backup-docker.ts"),
  "utf8",
);
assert.match(
  backupDockerHelper,
  /pipeError\.code === "EPIPE"/,
  "Backup Docker helper wajib menangani EPIPE ketika consumer stdin selesai lebih awal.",
);
assert.match(
  backupDockerHelper,
  /childStdin\.on\("error"/,
  "Backup Docker helper wajib memasang error handler pada stdin child process.",
);

const backupLocalRehearsal = readFileSync(
  path.join(projectRoot, "scripts/run-database-backup-local.ts"),
  "utf8",
);
assert.match(
  backupLocalRehearsal,
  /DATABASE_MIGRATION_ALLOW_DESTRUCTIVE:\s*"true"/,
  "Backup rehearsal fresh DB wajib mengizinkan replay historical destructive migration pada database disposable.",
);
assert.match(
  backupLocalRehearsal,
  /DATABASE_MIGRATION_APPROVAL_REFERENCE:\s*"REHEARSAL-BACKUP-FRESH-DB"/,
  "Backup rehearsal fresh DB wajib memakai approval reference test-only.",
);

const backupRunner = readFileSync(path.join(projectRoot, "scripts/run-database-backup.ts"), "utf8");
assert.match(backupRunner, /pg_dump --format=custom/);
assert.match(backupRunner, /pg_restore", "--list/);
assert.match(backupRunner, /DATABASE_BACKUP_MIN_FREE_BYTES/);
assert.match(backupRunner, /Direktori backup tidak boleh menggunakan project root/);
assert.match(backupRunner, /Direktori backup tidak boleh menggunakan filesystem root/);
assert.match(backupRunner, /planBackupRetention/);
assert.match(backupRunner, /--result-file/);
assert.match(backupRunner, /writeDatabaseBackupResult/);
assert.doesNotMatch(backupRunner, /console\.(?:log|error)\([^\n]*(?:POSTGRES_PASSWORD|DATABASE_URL)/);

const restoreRunner = readFileSync(path.join(projectRoot, "scripts/run-database-restore.ts"), "utf8");
assert.match(restoreRunner, /--allow-production-target/);
assert.match(restoreRunner, /DATABASE_RESTORE_ALLOW_PRODUCTION/);
assert.match(restoreRunner, /DATABASE_RESTORE_APPROVAL_REFERENCE/);
assert.match(restoreRunner, /Checksum backup tidak valid/);
assert.match(restoreRunner, /verifyRestoredDatabase/);
assert.match(restoreRunner, /const administrationDatabase = "postgres"/);
assert.doesNotMatch(restoreRunner, /console\.(?:log|error)\([^\n]*(?:POSTGRES_PASSWORD|DATABASE_URL)/);

const rehearsalCompose = readFileSync(
  path.join(projectRoot, "compose.database-backup-test.yaml"),
  "utf8",
);
assert.match(rehearsalCompose, /postgres:17-bookworm/);
assert.match(rehearsalCompose, /database_backup_test_data/);

for (const documentationPath of [
  "docs/development/database-backup-restore.md",
  "docs/development/database-deployment.md",
  "docs/development/quality-gates.md",
]) {
  assert.doesNotThrow(() => readFileSync(path.join(projectRoot, documentationPath), "utf8"));
}

console.log(
  "OK: backup custom-format, SHA-256, metadata, disk guard, retention, guarded restore, dan disposable rehearsal terkontrak.",
);
