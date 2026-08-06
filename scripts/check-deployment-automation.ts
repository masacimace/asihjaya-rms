import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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
  assertImmutableImageReference,
  createPlannedRelease,
  createReleaseId,
  parseReleaseRecord,
  promoteHealthyRelease,
  readCurrentRelease,
  readReleaseFile,
  resolveDeploymentStatePaths,
  validateReleaseRecord,
  writeReleaseHistory,
} from "./deployment-state";

const projectRoot = process.cwd();
const fixedRevision = "0123456789abcdef0123456789abcdef01234567";
const fixedDate = "2026-08-06T01:02:03.000Z";
const expectedReleaseId = "20260806T010203Z-0123456789ab";

assert.equal(createReleaseId(fixedDate, fixedRevision), expectedReleaseId);
assert.throws(() => createReleaseId("invalid", fixedRevision), /timestamp ISO/);
assert.throws(() => createReleaseId(fixedDate, "not-a-sha"), /Git revision/);
assert.doesNotThrow(() => assertImmutableImageReference(`asihjaya-rms:${expectedReleaseId}`, expectedReleaseId));
assert.doesNotThrow(() =>
  assertImmutableImageReference(
    "registry.example.com/asihjaya-rms@sha256:" + "a".repeat(64),
  ),
);
assert.throws(() => assertImmutableImageReference("asihjaya-rms:production"), /mutable/);
assert.throws(() => assertImmutableImageReference("asihjaya-rms:latest"), /latest/);
assert.throws(() => assertImmutableImageReference("asihjaya-rms:dev"), /Release ID/);

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "asihjaya-deployment-state-"));
try {
  const first = createPlannedRelease({
    revision: fixedRevision,
    sourceRef: "origin/main",
    createdAt: fixedDate,
    operator: "test-operator",
    hostname: "test-host",
  });
  assert.equal(first.releaseId, expectedReleaseId);
  assert.equal(first.images.app.reference, `asihjaya-rms:${expectedReleaseId}`);
  assert.equal(first.images.migrator.reference, `asihjaya-rms-migrator:${expectedReleaseId}`);
  assert.equal(first.images.operations.reference, `asihjaya-rms-operations:${expectedReleaseId}`);
  validateReleaseRecord(first);
  assert.deepEqual(parseReleaseRecord(`${JSON.stringify(first)}\n`), first);

  const plannedPath = writeReleaseHistory(temporaryRoot, first);
  assert(existsSync(plannedPath), "Planned release wajib ditulis ke history.");
  if (process.platform !== "win32") {
    assert.equal(statSync(plannedPath).mode & 0o777, 0o640, "Release metadata wajib mode 0640.");
  }
  assert.deepEqual(readReleaseFile(plannedPath), first);

  const firstHealthy = {
    ...first,
    status: "healthy" as const,
    updatedAt: "2026-08-06T01:05:00.000Z",
    deployment: {
      ...first.deployment,
      completedAt: "2026-08-06T01:05:00.000Z",
    },
  };
  promoteHealthyRelease(temporaryRoot, firstHealthy);
  assert.equal(readCurrentRelease(temporaryRoot)?.releaseId, first.releaseId);

  const second = createPlannedRelease({
    revision: "abcdef0123456789abcdef0123456789abcdef01",
    sourceRef: "origin/main",
    createdAt: "2026-08-06T02:03:04.000Z",
    previousReleaseId: first.releaseId,
    operator: "test-operator",
    hostname: "test-host",
  });
  const secondHealthy = {
    ...second,
    status: "healthy" as const,
    updatedAt: "2026-08-06T02:07:00.000Z",
    deployment: {
      ...second.deployment,
      completedAt: "2026-08-06T02:07:00.000Z",
    },
  };
  promoteHealthyRelease(temporaryRoot, secondHealthy);
  const paths = resolveDeploymentStatePaths(temporaryRoot);
  assert.equal(readCurrentRelease(temporaryRoot)?.releaseId, second.releaseId);
  assert.equal(readReleaseFile(paths.previous).releaseId, first.releaseId);

  const corrupted = structuredClone(secondHealthy) as Record<string, unknown>;
  corrupted.releaseId = "20260806T020304Z-deadbeef";
  assert.throws(() => validateReleaseRecord(corrupted), /tidak konsisten/);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

const lockScript = path.join(projectRoot, "ops/scripts/ajsystem-deployment-lock");
assert(existsSync(lockScript), "ops/scripts/ajsystem-deployment-lock wajib tersedia.");
if (process.platform !== "win32") {
  assert.equal(statSync(lockScript).mode & 0o111, 0o111, "Deployment lock helper wajib executable.");
}
const lockSource = readFileSync(lockScript, "utf8");
for (const contract of [
  "flock -n 9",
  "exit 75",
  "ASIHJAYA_DEPLOYMENT_LOCK_PATH",
  "ASIHJAYA_DEPLOYMENT_LOCK_OWNER_PATH",
  "trap cleanup",
]) {
  assert(lockSource.includes(contract), `Deployment lock helper wajib memuat ${contract}.`);
}
assert(!lockSource.includes("command_args="), "Deployment lock owner metadata tidak boleh menyalin seluruh argumen command.");

const flockAvailable =
  process.platform !== "win32" &&
  spawnSync("bash", ["-lc", "command -v flock >/dev/null 2>&1"], {
    cwd: projectRoot,
  }).status === 0;

if (flockAvailable) {
  const lockRoot = mkdtempSync(path.join(os.tmpdir(), "asihjaya-deployment-lock-"));
  try {
    const lockPath = path.join(lockRoot, "deployment.lock");
    const ownerPath = path.join(lockRoot, "deployment.lock.owner");
    const readyPath = path.join(lockRoot, "ready");
    const environment = {
      ...process.env,
      ASIHJAYA_DEPLOYMENT_LOCK_PATH: lockPath,
      ASIHJAYA_DEPLOYMENT_LOCK_OWNER_PATH: ownerPath,
      ASIHJAYA_DEPLOYMENT_OPERATION: "contract-test",
      APP_RELEASE_ID: expectedReleaseId,
    };

    const holder = spawn(
      "bash",
      [lockScript, "--", "bash", "-c", `printf ready > ${JSON.stringify(readyPath)}; sleep 2`],
      { cwd: projectRoot, env: environment, stdio: "pipe" },
    );

    const deadline = Date.now() + 5_000;
    while (!existsSync(readyPath) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert(existsSync(readyPath), "Process pertama gagal memperoleh deployment lock.");
    assert(existsSync(ownerPath), "Owner metadata wajib tersedia selama lock aktif.");
    const owner = readFileSync(ownerPath, "utf8");
    assert.match(owner, /operation=contract-test/);
    assert.match(owner, new RegExp(`release_id=${expectedReleaseId}`));
    assert.doesNotMatch(owner, /sleep 2/);

    const contender = spawnSync("bash", [lockScript, "--", "true"], {
      cwd: projectRoot,
      env: environment,
      encoding: "utf8",
    });
    assert.equal(contender.status, 75, "Concurrent deployment wajib ditolak dengan exit code 75.");
    assert.match(contender.stderr, /sedang berjalan/);

    const holderStatus = await new Promise<number | null>((resolve, reject) => {
      holder.once("error", reject);
      holder.once("exit", (code) => resolve(code));
    });
    assert.equal(holderStatus, 0, "Lock holder contract test wajib selesai sukses.");
    assert(!existsSync(ownerPath), "Owner metadata wajib dibersihkan setelah command selesai.");

    const afterRelease = spawnSync("bash", [lockScript, "--", "true"], {
      cwd: projectRoot,
      env: environment,
      encoding: "utf8",
    });
    assert.equal(afterRelease.status, 0, "Lock wajib dapat diperoleh kembali setelah process selesai.");
  } finally {
    rmSync(lockRoot, { recursive: true, force: true });
  }
} else {
  console.log("SKIP: runtime flock contention test hanya dijalankan pada Linux dengan util-linux flock.");
}

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
for (const scriptName of ["check:deployment", "deployment:contract"]) {
  assert(packageJson.scripts?.[scriptName], `package.json wajib memiliki ${scriptName}.`);
}

const compose = readFileSync(path.join(projectRoot, "compose.production.yaml"), "utf8");
for (const variableName of ["APP_RELEASE_ID", "APP_REVISION", "APP_BUILD_DATE"]) {
  assert(compose.includes(`${variableName}:`), `Compose wajib meneruskan ${variableName} ke runtime.`);
}
assert(compose.includes("ASIHJAYA_OPERATIONS_IMAGE"), "Compose wajib mendefinisikan immutable operations image.");
const dockerfile = readFileSync(path.join(projectRoot, "Dockerfile"), "utf8");
assert.match(dockerfile, /org\.opencontainers\.image\.version="\$\{APP_RELEASE_ID\}"/);
assert.match(dockerfile, /ENV APP_RELEASE_ID="\$\{APP_RELEASE_ID\}"/);

const healthRoute = readFileSync(path.join(projectRoot, "src/app/api/health/route.ts"), "utf8");
assert.match(healthRoute, /getReleaseInfo/);
assert.match(healthRoute, /release:/);

const documentationPath = path.join(projectRoot, "docs/development/deployment-rollback-automation.md");
assert(existsSync(documentationPath), "Dokumentasi deployment automation wajib tersedia.");
const documentation = readFileSync(documentationPath, "utf8");
for (const contract of [
  "manual approval, automated execution",
  "APP_RELEASE_ID",
  "flock",
  "current.json",
  "Database tidak di-rollback otomatis",
]) {
  assert(documentation.includes(contract), `Dokumentasi deployment wajib memuat ${contract}.`);
}

console.log(
  "OK: deployment contract memiliki release ID immutable, atomic release metadata, runtime identity, dan process-wide flock.",
);
