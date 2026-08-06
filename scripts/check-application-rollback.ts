import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createPlannedRelease,
  promoteHealthyRelease,
  readCurrentRelease,
  readPreviousRelease,
  updateCurrentReleaseCompatibility,
  type ReleaseRecord,
} from "./deployment-state";
import {
  appendRollbackChecks,
  createRollbackPlan,
  evaluateRollbackGuard,
  parseRollbackRecord,
  promoteRollbackTarget,
  validateRollbackRecord,
} from "./rollback-state";

const projectRoot = process.cwd();
const firstRevision = "0123456789abcdef0123456789abcdef01234567";
const secondRevision = "abcdef0123456789abcdef0123456789abcdef01";
const firstDate = "2026-08-06T01:02:03.000Z";
const secondDate = "2026-08-06T02:03:04.000Z";

function source(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function withImageDigests(record: ReleaseRecord, seed: string): ReleaseRecord {
  return {
    ...record,
    status: "healthy",
    updatedAt: record.createdAt,
    deployment: { ...record.deployment, completedAt: record.createdAt },
    images: {
      app: { ...record.images.app, digest: `sha256:${seed.repeat(64).slice(0, 64)}` },
      migrator: { ...record.images.migrator, digest: `sha256:${seed.toUpperCase().toLowerCase().repeat(64).slice(0, 64)}` },
      operations: { ...record.images.operations, digest: `sha256:${seed.repeat(64).slice(0, 64)}` },
    },
  };
}

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "asihjaya-rollback-contract-"));
try {
  const first = withImageDigests(
    createPlannedRelease({ revision: firstRevision, sourceRef: "origin/main", createdAt: firstDate }),
    "a",
  );
  const firstHealthy: ReleaseRecord = {
    ...first,
    database: {
      migrationCountBefore: 12,
      migrationCountAfter: 12,
      schemaChanged: false,
      rollbackCompatibility: "compatible",
      compatibilityReference: "no-schema-change",
    },
  };
  promoteHealthyRelease(temporaryRoot, firstHealthy);

  const second = withImageDigests(
    createPlannedRelease({
      revision: secondRevision,
      sourceRef: "origin/main",
      createdAt: secondDate,
      previousReleaseId: firstHealthy.releaseId,
    }),
    "b",
  );
  const secondHealthy: ReleaseRecord = {
    ...second,
    database: {
      migrationCountBefore: 12,
      migrationCountAfter: 13,
      schemaChanged: true,
      rollbackCompatibility: "approval-required",
      compatibilityReference: null,
    },
  };
  promoteHealthyRelease(temporaryRoot, secondHealthy);

  assert.throws(
    () => evaluateRollbackGuard(temporaryRoot),
    /belum memiliki approval compatibility eksplisit/,
  );
  assert.throws(
    () => updateCurrentReleaseCompatibility(temporaryRoot, "compatible", "no-schema-change", "tester@host"),
    /hanya boleh dibuat otomatis/,
  );

  updateCurrentReleaseCompatibility(
    temporaryRoot,
    "incompatible",
    "MIGRATION-001-incompatible",
    "tester@host",
    "2026-08-06T02:10:00.000Z",
  );
  assert.throws(() => evaluateRollbackGuard(temporaryRoot), /dinyatakan tidak kompatibel/);

  const approved = updateCurrentReleaseCompatibility(
    temporaryRoot,
    "compatible",
    "CHANGE-1234-expand-contract",
    "tester@host",
    "2026-08-06T02:11:00.000Z",
  );
  assert.equal(approved.database.rollbackCompatibility, "compatible");
  const guard = evaluateRollbackGuard(temporaryRoot, firstHealthy.releaseId);
  assert.equal(guard.current.releaseId, secondHealthy.releaseId);
  assert.equal(guard.target.releaseId, firstHealthy.releaseId);
  assert.equal(guard.compatibilityReference, "CHANGE-1234-expand-contract");
  assert.throws(
    () => evaluateRollbackGuard(temporaryRoot, secondHealthy.releaseId),
    /tidak sama dengan target yang diminta/,
  );

  const rollback = createRollbackPlan({
    current: guard.current,
    target: guard.target,
    compatibilityReference: guard.compatibilityReference,
    compatibilityEvidence: guard.compatibilityEvidence,
    requestedAt: "2026-08-06T02:12:00.000Z",
    operator: "tester\nadmin",
    hostname: "test-host\r\nnode",
  });
  validateRollbackRecord(rollback);
  assert.deepEqual(parseRollbackRecord(`${JSON.stringify(rollback)}\n`), rollback);
  assert.equal(rollback.fromReleaseId, secondHealthy.releaseId);
  assert.equal(rollback.toReleaseId, firstHealthy.releaseId);
  assert.equal(rollback.images.fromMigrator.reference, secondHealthy.images.migrator.reference);
  assert.equal(rollback.images.fromOperations.reference, secondHealthy.images.operations.reference);
  assert.equal(rollback.operator, "tester admin");
  assert.equal(rollback.hostname, "test-host node");
  assert.throws(
    () => validateRollbackRecord({ ...rollback, rollbackId: rollback.rollbackId.replace("20260806T021200Z", "20260806T021201Z") }),
    /rollbackId tidak konsisten/,
  );
  assert.throws(
    () => validateRollbackRecord({
      ...rollback,
      images: {
        ...rollback.images,
        toApp: { ...rollback.images.toApp, tag: "wrong-release", reference: "asihjaya-rms:wrong-release" },
      },
    }),
    /tag harus sama dengan release ID/,
  );

  const completedChecks = [
    "rollback-images",
    "preflight-production-local-app",
    "preflight-production-local-database",
    "preflight-production-public-app",
    "preflight-production-public-database",
    "preflight-production-public-login",
    "candidate-local-app",
    "candidate-local-database",
    "production-local-app",
    "production-local-database",
    "production-public-app",
    "production-public-database",
    "production-public-login",
  ].map((name) => ({
    name,
    status: "passed" as const,
    checkedAt: "2026-08-06T02:13:00.000Z",
    detail: null,
  }));
  const withChecks = appendRollbackChecks(rollback, completedChecks);
  assert.equal(withChecks.checks.length, completedChecks.length);

  const snapshot = promoteRollbackTarget({
    stateRoot: temporaryRoot,
    current: guard.current,
    target: guard.target,
    rollbackId: rollback.rollbackId,
    completedAt: "2026-08-06T02:14:00.000Z",
  });
  assert.equal(snapshot.releaseId, firstHealthy.releaseId);
  assert.equal(snapshot.previousReleaseId, secondHealthy.releaseId);
  assert.equal(snapshot.database.schemaChanged, false);
  assert.equal(snapshot.database.compatibilityReference, "no-schema-change");
  assert.equal(readCurrentRelease(temporaryRoot)?.releaseId, firstHealthy.releaseId);
  assert.equal(readPreviousRelease(temporaryRoot)?.releaseId, secondHealthy.releaseId);
  const reverseGuard = evaluateRollbackGuard(temporaryRoot, secondHealthy.releaseId);
  assert.equal(reverseGuard.compatibilityReference, "no-schema-change");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

const rollbackScriptPath = path.join(projectRoot, "ops/scripts/ajsystem-rollback");
assert(existsSync(rollbackScriptPath), "ops/scripts/ajsystem-rollback wajib tersedia.");
if (process.platform !== "win32") {
  assert.equal(statSync(rollbackScriptPath).mode & 0o111, 0o111, "Rollback command wajib executable.");
  const shellCheck = spawnSync("bash", ["-n", rollbackScriptPath], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(shellCheck.status, 0, shellCheck.stderr || "Bash syntax rollback command gagal.");
}

const rollbackScript = source("ops/scripts/ajsystem-rollback");
for (const contract of [
  "ajsystem-deployment-lock",
  "rollback-$ACTION",
  "previous healthy release",
  "run_rollback_contract compatibility",
  '--operator "$ROLLBACK_OPERATOR"',
  '--hostname "$ROLLBACK_HOSTNAME"',
  "CURRENT_RELEASE_ID",
  "FROM_MIGRATOR_IMAGE",
  "--from-migrator-digest",
  "--from-operations-digest",
  "GUARD_ARGS=(guard",
  "PLAN_ARGS=(",
  "run_rollback_contract images",
  "--phase preflight",
  "--phase candidate",
  "--phase production",
  "candidate smoke",
  'EDGE_NETWORK="${COMPOSE_PROJECT_NAME_VALUE}_edge"',
  '--network "$EDGE_NETWORK"',
  '--network "$BACKEND_NETWORK"',
  'docker network inspect "$EDGE_NETWORK"',
  'docker network inspect "$BACKEND_NETWORK"',
  'docker volume inspect "$UPLOADS_VOLUME"',
  'docker port "$CANDIDATE_CONTAINER" 3000/tcp',
  "--no-deps --force-recreate app",
  "tanpa menjalankan migration",
  "Database tidak diubah",
  "restore_outgoing_application",
]) {
  assert(rollbackScript.includes(contract), `Rollback command wajib memuat ${contract}.`);
}
for (const forbidden of [
  "docker compose down",
  "db:restore",
  "pg_restore",
  "run-database-deployment",
  "docker compose run migrate",
  "git checkout",
  "git reset",
]) {
  assert(!rollbackScript.includes(forbidden), `Rollback command tidak boleh memuat ${forbidden}.`);
}
assert(
  rollbackScript.indexOf('CURRENT_STAGE="preflight-health"') < rollbackScript.indexOf('CURRENT_STAGE="candidate-smoke"'),
  "Preflight health wajib berjalan sebelum candidate smoke.",
);
assert(
  rollbackScript.indexOf('CURRENT_STAGE="candidate-smoke"') < rollbackScript.indexOf('CURRENT_STAGE="application-activation"'),
  "Candidate smoke wajib berjalan sebelum activation.",
);
assert(
  rollbackScript.indexOf('CURRENT_STAGE="production-health"') < rollbackScript.indexOf('CURRENT_STAGE="state-promotion"'),
  "Production health wajib berjalan sebelum state promotion.",
);

const rollbackCli = source("scripts/run-rollback-contract.ts");
for (const command of [
  'case "compatibility"',
  'case "guard"',
  'case "plan"',
  'case "images"',
  'case "health"',
  'case "complete"',
  'case "fail"',
]) {
  assert(rollbackCli.includes(command), `Rollback CLI wajib memuat ${command}.`);
}

const packageJson = JSON.parse(source("package.json")) as { scripts?: Record<string, string> };
for (const scriptName of ["check:application-rollback", "rollback:contract"]) {
  assert(packageJson.scripts?.[scriptName], `package.json wajib memiliki ${scriptName}.`);
}

const documentation = source("docs/development/deployment-rollback-automation.md");
for (const contract of [
  "1D.7E",
  "ajsystem-rollback check",
  "ajsystem-rollback approve",
  "ajsystem-rollback execute",
  "previous healthy release",
  "Database tidak di-rollback",
  "expand-and-contract",
]) {
  assert(documentation.includes(contract), `Dokumentasi rollback wajib memuat ${contract}.`);
}

console.log(
  "OK: application rollback hanya menuju previous healthy release, memakai compatibility guard eksplisit, candidate smoke, health verification, recovery, dan audit atomic tanpa database rollback.",
);
