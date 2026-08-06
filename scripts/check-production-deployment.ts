import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  parseDatabaseDeploymentResult,
  writeDatabaseDeploymentResult,
} from "./database-deployment-result";
import { parseProductionHealthResult, readProductionHealthResult } from "./production-health-state";
import { runProductionHealthCheck } from "./run-production-health-check";

const projectRoot = process.cwd();
const fixedReleaseId = "20260806T010203Z-0123456789ab";
const fixedRevision = "0123456789abcdef0123456789abcdef01234567";

function source(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function assertOrdered(content: string, markers: string[]): void {
  let previousIndex = -1;
  for (const marker of markers) {
    const index = content.indexOf(marker);
    assert(index >= 0, `Contract wajib memuat ${marker}.`);
    assert(index > previousIndex, `Contract ${marker} berada pada urutan yang salah.`);
    previousIndex = index;
  }
}

const deploymentScriptPath = path.join(projectRoot, "ops/scripts/ajsystem-deploy");
assert(existsSync(deploymentScriptPath), "ops/scripts/ajsystem-deploy wajib tersedia.");
const deploymentScript = source("ops/scripts/ajsystem-deploy");

for (const contract of [
  "ajsystem-deployment-lock",
  "git status --porcelain --untracked-files=all",
  "git fetch --prune origin",
  "git checkout --detach --force",
  "build --pull operations",
  "run_environment_validation",
  "build --pull app migrate",
  "pre-deployment",
  "DATABASE_DEPLOYMENT_RESULT_PATH",
  "candidate-smoke",
  "--publish \"127.0.0.1:$CANDIDATE_PORT:3000\"",
  "run_health_check production",
  '--public-origin "$PUBLIC_ORIGIN"',
  "schemaChanged\": false",
  "run_operations_state promote",
  "ASIHJAYA_RELEASE_ENV_FILE",
]) {
  assert(deploymentScript.includes(contract), `Deployment orchestrator wajib memuat ${contract}.`);
}

assertOrdered(deploymentScript, [
  'CURRENT_STAGE="operations-image-build"',
  'CURRENT_STAGE="environment-validation"',
  'CURRENT_STAGE="release-plan"',
  'CURRENT_STAGE="application-image-build"',
  'CURRENT_STAGE="database-start"',
  'CURRENT_STAGE="pre-deployment-backup"',
  'CURRENT_STAGE="database-migration"',
  'CURRENT_STAGE="candidate-smoke"',
  'CURRENT_STAGE="application-activation"',
  'CURRENT_STAGE="production-health"',
  'CURRENT_STAGE="release-promotion"',
]);

for (const forbidden of [
  "docker compose down",
  "git reset --hard",
  "db:restore",
  "--upload-latest",
  "DATABASE_URL=",
  "cat \"$ENV_FILE\"",
]) {
  assert(!deploymentScript.includes(forbidden), `Deployment orchestrator tidak boleh memuat ${forbidden}.`);
}
assert(
  deploymentScript.indexOf("run_operations_state promote") > deploymentScript.indexOf("run_health_check production"),
  "Release hanya boleh dipromosikan setelah production health check.",
);
assert(
  deploymentScript.includes("Candidate image gagal health check; application lama tetap aktif."),
  "Candidate failure wajib mempertahankan application lama.",
);
const healthFunctionStart = deploymentScript.indexOf("run_health_check() {");
const healthFunctionEnd = deploymentScript.indexOf("\ncontainer_environment_value()", healthFunctionStart);
assert(healthFunctionStart >= 0 && healthFunctionEnd > healthFunctionStart, "Function health check tidak dapat diperiksa.");
const healthFunction = deploymentScript.slice(healthFunctionStart, healthFunctionEnd);
assert(
  !healthFunction.includes('--env-file "$ENV_FILE"'),
  "Production environment lengkap tidak boleh diberikan ke health container yang memakai host network.",
);
assert(
  deploymentScript.includes("grep -Fq '\"schemaChanged\": false'"),
  "Automatic restore application lama hanya boleh dilakukan ketika schema tidak berubah.",
);
assert(
  deploymentScript.includes('BACKUP_EVIDENCE="$EVIDENCE_DIR/pre-deployment-backup.json"'),
  "Evidence backup pre-deployment wajib disimpan di deployment evidence directory yang di-mount ke operations container.",
);
assertOrdered(deploymentScript, [
  '"$BACKUP_WRAPPER" pre-deployment "$RELEASE_ID"',
  'install -m 0600 "$BACKUP_RESULT" "$BACKUP_EVIDENCE"',
  'sync -f "$BACKUP_EVIDENCE"',
  'run_operations_state backup --file "$CANDIDATE_FILE" --result-file "$BACKUP_EVIDENCE"',
]);
assert(
  !deploymentScript.includes('run_operations_state backup --file "$CANDIDATE_FILE" --result-file "$BACKUP_RESULT"'),
  "Operations container tidak boleh membaca host-only backup runner path secara langsung.",
);

if (process.platform !== "win32") {
  const shellCheck = spawnSync("bash", ["-n", deploymentScriptPath], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(shellCheck.status, 0, shellCheck.stderr || "Bash syntax deployment orchestrator gagal.");
}

const backupWrapper = source("ops/scripts/ajsystem-db-backup");
assert(backupWrapper.includes("ASIHJAYA_RELEASE_ENV_FILE"), "Backup wrapper wajib membaca generated release environment.");
assert(
  backupWrapper.indexOf('read_env_file_value "$RELEASE_ENV_FILE"') <
    backupWrapper.indexOf('read_env_file_value "$ENV_FILE"'),
  "Release environment wajib meng-override production environment untuk image identity.",
);

const dockerfile = source("Dockerfile");
for (const contract of [
  "scripts/database-deployment-result.ts",
  "scripts/deployment-state.ts",
  "COPY src/lib/env.ts ./src/lib/env.ts",
]) {
  assert(dockerfile.includes(contract), `Dockerfile wajib memuat ${contract}.`);
}

const migrationRunner = source("scripts/run-database-deployment.ts");
for (const contract of ["DATABASE_DEPLOYMENT_RESULT_PATH", "writeDatabaseDeploymentResult", "schemaChanged"]) {
  assert(migrationRunner.includes(contract), `Migration runner wajib memuat ${contract}.`);
}

const environmentContract = source("src/lib/env.ts");
for (const contract of ["ASIHJAYA_OPERATIONS_IMAGE", "releaseIdPattern", "asihjaya-rms-operations"]) {
  assert(environmentContract.includes(contract), `Production environment contract wajib memuat ${contract}.`);
}

const deploymentCli = source("scripts/run-deployment-contract.ts");
for (const commandName of ['case "images"', 'case "backup"', 'case "migration"', 'case "health"', 'case "healthy"', 'case "fail"']) {
  assert(deploymentCli.includes(commandName), `Deployment contract CLI wajib memuat ${commandName}.`);
}
assert(deploymentCli.includes("approval-required"), "Schema change wajib menghasilkan rollback compatibility approval-required.");
assert(deploymentCli.includes("no-schema-change"), "No-op migration wajib mencatat compatibility reference.");

const packageJson = JSON.parse(source("package.json")) as { scripts?: Record<string, string> };
for (const scriptName of ["check:deployment-orchestration", "deployment:health"]) {
  assert(packageJson.scripts?.[scriptName], `package.json wajib memiliki ${scriptName}.`);
}

const validMigrationResult = {
  version: 1 as const,
  operation: "database-deployment" as const,
  status: "completed" as const,
  releaseId: fixedReleaseId,
  startedAt: "2026-08-06T01:03:00.000Z",
  completedAt: "2026-08-06T01:04:00.000Z",
  migrationCountBefore: 12,
  migrationCountAfter: 13,
  pendingCountBefore: 1,
  schemaChanged: true,
  destructiveOperations: [],
};
assert.deepEqual(parseDatabaseDeploymentResult(JSON.stringify(validMigrationResult)), validMigrationResult);
assert.throws(
  () => parseDatabaseDeploymentResult(JSON.stringify({ ...validMigrationResult, schemaChanged: false })),
  /schemaChanged/,
);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "asihjaya-production-deployment-"));
const migrationResultPath = path.join(temporaryRoot, "migration.json");
const healthResultPath = path.join(temporaryRoot, "health.json");
const failedHealthResultPath = path.join(temporaryRoot, "health-failed.json");
try {
  writeDatabaseDeploymentResult(migrationResultPath, validMigrationResult);
  assert.deepEqual(parseDatabaseDeploymentResult(readFileSync(migrationResultPath, "utf8")), validMigrationResult);

  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.url === "/api/health") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({
        status: "ok",
        service: "asihjaya-rms",
        release: { releaseId: fixedReleaseId, revision: fixedRevision, buildDate: "2026-08-06T01:02:03.000Z" },
      }));
      return;
    }
    if (request.url === "/api/health/database") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({
        status: "healthy",
        database: "connected",
        release: { releaseId: fixedReleaseId, revision: fixedRevision, buildDate: "2026-08-06T01:02:03.000Z" },
      }));
      return;
    }
    if (request.url === "/login") {
      response.statusCode = 200;
      response.end("login");
      return;
    }
    response.statusCode = 404;
    response.end("not found");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  try {
    const address = server.address();
    assert(address && typeof address === "object", "Mock health server gagal mendapatkan port.");
    const origin = `http://127.0.0.1:${address.port}`;
    await runProductionHealthCheck({
      releaseId: fixedReleaseId,
      revision: fixedRevision,
      scope: "production",
      localOrigin: origin,
      publicOrigin: origin,
      resultFile: healthResultPath,
      attempts: 1,
      intervalMs: 1,
      timeoutMs: 2_000,
    });

    await assert.rejects(
      () =>
        runProductionHealthCheck({
          releaseId: fixedReleaseId,
          revision: "abcdef0123456789abcdef0123456789abcdef01",
          scope: "candidate",
          localOrigin: origin,
          resultFile: failedHealthResultPath,
          attempts: 1,
          intervalMs: 1,
          timeoutMs: 2_000,
        }),
      /candidate health check gagal/,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  const healthResult = readProductionHealthResult(healthResultPath);
  assert.equal(healthResult.checks.length, 5, "Production health wajib memeriksa lima endpoint.");
  assert(healthResult.checks.every((check) => check.status === "passed"), "Semua mock health check wajib passed.");
  assert.deepEqual(parseProductionHealthResult(JSON.stringify(healthResult)), healthResult);
  const failedHealthResult = readProductionHealthResult(failedHealthResultPath);
  assert(
    failedHealthResult.checks.every((check) => check.status === "failed"),
    "Release identity mismatch wajib menghasilkan failed health result.",
  );
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

const documentation = source("docs/development/deployment-rollback-automation.md");
for (const contract of [
  "1D.7D",
  "ajsystem-deploy",
  "candidate",
  "full off-site verification",
  "schema tidak berubah",
]) {
  assert(documentation.includes(contract), `Dokumentasi deployment orchestration wajib memuat ${contract}.`);
}

console.log(
  "OK: deployment orchestration memakai Git ref immutable, exact pre-deployment backup, guarded migration, candidate smoke, release-aware health check, dan atomic promotion.",
);
