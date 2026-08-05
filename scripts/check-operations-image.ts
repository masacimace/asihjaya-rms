import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  parseDatabaseBackupCommandResult,
  parseDatabaseBackupOffsiteCommandResult,
  parseDatabasePreDeploymentBackupResult,
  readDatabasePreDeploymentBackupResult,
  writeDatabasePreDeploymentBackupResult,
  type DatabasePreDeploymentBackupResult,
} from "./database-backup-pre-deployment-state";

const projectRoot = process.cwd();
const releaseId = "20260806T010203Z-0123456789ab";
const backupId = "11111111-1111-4111-8111-111111111111";
const verifiedAt = "2026-08-06T01:04:00.000Z";

const backupCommand = parseDatabaseBackupCommandResult(
  JSON.stringify({
    version: 1,
    operation: "database-backup",
    status: "created",
    completedAt: verifiedAt,
    artifact: {
      backupId,
      metadataPath: "/backup/release.json",
      archivePath: "/backup/release.dump",
      checksumPath: "/backup/release.sha256",
      releaseId,
      verifiedAt,
    },
  }),
);
assert.equal(backupCommand.status, "created");

const offsiteCommand = parseDatabaseBackupOffsiteCommandResult(
  JSON.stringify({
    version: 1,
    operation: "database-backup-offsite",
    status: "verified",
    completedAt: verifiedAt,
    backupId,
    releaseId,
    receiptPath: "/backup/release.offsite.json",
    receiptKey: `asihjaya-rms/postgres/production/backups/${backupId}/release.offsite.json`,
    verifiedAt,
    fullVerification: true,
  }),
);
assert.equal(offsiteCommand.backupId, backupId);

const finalResult: DatabasePreDeploymentBackupResult = {
  version: 1,
  operation: "database-backup-pre-deployment",
  status: "verified",
  releaseId,
  startedAt: "2026-08-06T01:03:00.000Z",
  completedAt: verifiedAt,
  local: {
    backupId,
    metadataPath: "/backup/release.json",
    archivePath: "/backup/release.dump",
    checksumPath: "/backup/release.sha256",
    verifiedAt,
  },
  offsite: {
    receiptPath: "/backup/release.offsite.json",
    receiptKey: `asihjaya-rms/postgres/production/backups/${backupId}/release.offsite.json`,
    verifiedAt,
    fullVerification: true,
  },
};
assert.equal(parseDatabasePreDeploymentBackupResult(JSON.stringify(finalResult)).status, "verified");
assert.throws(
  () =>
    parseDatabasePreDeploymentBackupResult(
      JSON.stringify({
        ...finalResult,
        offsite: { ...finalResult.offsite, fullVerification: false },
      }),
    ),
  /full off-site verification/,
);
assert.throws(
  () =>
    parseDatabaseBackupOffsiteCommandResult(
      JSON.stringify({ ...offsiteCommand, releaseId: "production" }),
    ),
  /Release ID/,
);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "asihjaya-operations-contract-"));
try {
  const resultPath = path.join(temporaryRoot, "pre-deployment.json");
  writeDatabasePreDeploymentBackupResult(resultPath, finalResult);
  assert.deepEqual(readDatabasePreDeploymentBackupResult(resultPath), finalResult);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

const dockerfile = readFileSync(path.join(projectRoot, "Dockerfile"), "utf8");
for (const contract of [
  "FROM toolchain AS operations",
  'org.opencontainers.image.title="Asihjaya RMS Operations"',
  'org.opencontainers.image.version="${APP_RELEASE_ID}"',
  "COPY --from=deps /app/node_modules ./node_modules",
  "COPY scripts ./scripts",
  "--uid 10003",
  "USER operations",
  'CMD ["npm", "run", "db:backup:pre-deployment:verified"]',
]) {
  assert(dockerfile.includes(contract), `Dockerfile operations target wajib memuat ${contract}.`);
}
assert(!/COPY\s+.*\.env/i.test(dockerfile), "Operations image tidak boleh menyalin environment file.");

const dockerignoreLines = readFileSync(path.join(projectRoot, ".dockerignore"), "utf8")
  .replace(/\r\n/g, "\n")
  .split("\n");
const composeIgnoreIndex = dockerignoreLines.indexOf("compose*.yaml");
const productionComposeIncludeIndex = dockerignoreLines.indexOf("!compose.production.yaml");
assert(
  composeIgnoreIndex >= 0,
  ".dockerignore wajib mengabaikan file Compose umum melalui compose*.yaml.",
);
assert(
  productionComposeIncludeIndex > composeIgnoreIndex,
  ".dockerignore wajib memasukkan kembali compose.production.yaml setelah pola compose*.yaml agar operations image dapat dibangun.",
);

const compose = readFileSync(path.join(projectRoot, "compose.production.yaml"), "utf8");
for (const contract of [
  "  operations:",
  "ASIHJAYA_OPERATIONS_IMAGE",
  "target: operations",
  "- operations",
  "network_mode: none",
]) {
  assert(compose.includes(contract), `Compose operations service wajib memuat ${contract}.`);
}

const wrapper = readFileSync(path.join(projectRoot, "ops/scripts/ajsystem-db-backup"), "utf8");
for (const contract of [
  "ASIHJAYA_OPERATIONS_IMAGE",
  "pre-deployment",
  "org.opencontainers.image.version",
  "org.opencontainers.image.revision",
  "db:backup:pre-deployment:verified",
  "pre-deployment-${JOB_RELEASE_ID}.json",
  "tag latest/production ditolak",
]) {
  assert(wrapper.includes(contract), `Wrapper backup wajib memuat ${contract}.`);
}
assert(!wrapper.includes('IMAGE="asihjaya-rms-tools:backup"'), "Wrapper tidak boleh memakai tools image hard-coded lama.");

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
for (const scriptName of [
  "check:operations-image",
  "db:backup:pre-deployment:verified",
  "container:production:build",
]) {
  assert(packageJson.scripts?.[scriptName], `package.json wajib memiliki ${scriptName}.`);
}
assert.match(packageJson.scripts?.["container:production:build"] ?? "", /operations/);
assert.match(packageJson.scripts?.["db:deploy:production"] ?? "", /db:backup:pre-deployment:verified/);


const workflow = readFileSync(path.join(projectRoot, ".github/workflows/ci.yml"), "utf8");
assert.match(workflow, /--target operations --tag asihjaya-rms-operations:ci/);
assert.match(workflow, /npm run check:operations-image/);

const environmentTemplate = readFileSync(
  path.join(projectRoot, ".env.production.example"),
  "utf8",
);
assert.match(environmentTemplate, /^ASIHJAYA_OPERATIONS_IMAGE=/m);
assert.match(environmentTemplate, /^DATABASE_PRE_DEPLOYMENT_BACKUP_RESULT_PATH=/m);

const orchestrator = readFileSync(
  path.join(projectRoot, "scripts/run-database-backup-pre-deployment.ts"),
  "utf8",
);
for (const contract of [
  '"--metadata"',
  "backupResult.artifact.metadataPath",
  "offsiteResult.backupId === backupResult.artifact.backupId",
  "offsiteResult.fullVerification",
  "writeDatabasePreDeploymentBackupResult",
]) {
  assert(orchestrator.includes(contract), `Pre-deployment orchestrator wajib memuat ${contract}.`);
}
assert(!orchestrator.includes("--upload-latest"), "Pre-deployment tidak boleh memilih backup melalui --upload-latest.");

console.log(
  "OK: operations image reproducible, immutable, non-root, dan pre-deployment backup memakai exact artifact dengan full off-site verification.",
);
