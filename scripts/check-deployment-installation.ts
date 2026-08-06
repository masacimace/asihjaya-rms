import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();

function source(relativePath: string): string {
  const absolutePath = path.join(projectRoot, relativePath);
  assert(existsSync(absolutePath), `${relativePath} wajib tersedia.`);
  return readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n");
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

const installerPath = "ops/scripts/ajsystem-install-deployment-automation";
const preflightPath = "ops/scripts/ajsystem-deployment-preflight";
const installer = source(installerPath);
const preflight = source(preflightPath);
const deploy = source("ops/scripts/ajsystem-deploy");
const rollback = source("ops/scripts/ajsystem-rollback");
const backup = source("ops/scripts/ajsystem-db-backup");
const backupService = source("ops/systemd/ajsystem-db-backup@.service");
const tmpfilesConfig = source("ops/tmpfiles.d/asihjaya-rms-deployment.conf");
const lockHelper = source("ops/scripts/ajsystem-deployment-lock");
const runbook = source("docs/development/deployment-rollback-vps-rehearsal.md");

for (const scriptPath of [installerPath, preflightPath]) {
  assert(statSync(path.join(projectRoot, scriptPath)).isFile(), `${scriptPath} wajib regular file.`);
}

for (const marker of [
  "install|verify",
  "restore)",
  "INSTALL_BACKUP_ROOT",
  "sha256sum",
  'install -m 0750 -o root -g "$DEPLOYMENT_GROUP"',
  'install -d -m 0750 -o "$DEPLOYMENT_USER"',
  "runuser -u \"$DEPLOYMENT_USER\" -- docker info",
  "root:$DEPLOYMENT_GROUP dan mode 0640",
  "install-history",
  "systemd-tmpfiles --create",
  "TMPFILES_CONFIG",
  "/run/lock/asihjaya-rms/deployment.lock",
]) {
  assert(installer.includes(marker), `Installer wajib memuat ${marker}.`);
}
assertOrdered(installer, ["verify_source", "verify_installation", "install_commands"]);
for (const forbidden of ["chmod 777", "chmod -R", "source \"$ENV_FILE\"", "cat \"$ENV_FILE\""]) {
  assert(!installer.includes(forbidden), `Installer tidak boleh memuat ${forbidden}.`);
}

for (const marker of [
  "check|status|snapshot|lock-test",
  "assert_runtime_user",
  "git status --porcelain --untracked-files=all",
  "docker compose --env-file",
  "candidate port",
  "sha256sum",
  "current.env sudah tersedia",
  "asihjaya-rms-bootstrap:",
  "contender_status",
  '[[ "$contender_status" -eq 75 ]]',
]) {
  assert(preflight.includes(marker), `Preflight wajib memuat ${marker}.`);
}
for (const forbidden of ["docker compose down", "db:restore", "POSTGRES_PASSWORD", "DATABASE_URL="]) {
  assert(!preflight.includes(forbidden), `Preflight tidak boleh memuat ${forbidden}.`);
}

for (const [name, content] of [
  ["deploy", deploy],
  ["rollback", rollback],
  ["backup", backup],
] as const) {
  assert(content.includes("ASIHJAYA_DEPLOYMENT_USER"), `${name} wajib memakai deployment user contract.`);
  assert(content.includes("tanpa sudo"), `${name} wajib menolak runtime root/sudo.`);
}

assert(
  backupService.includes("ConditionPathExists=/var/lib/asihjaya-rms/deployments/current.env"),
  "Backup systemd service wajib menunggu immutable current.env.",
);
assert(
  tmpfilesConfig.includes("d /run/lock/asihjaya-rms") && tmpfilesConfig.includes("0750 ubuntu ubuntu"),
  "Tmpfiles config wajib membuat dedicated lock directory untuk user ubuntu.",
);
assert(
  lockHelper.includes("/run/lock/asihjaya-rms/deployment.lock"),
  "Deployment lock wajib memakai dedicated runtime directory.",
);
assert(
  !lockHelper.includes('install -d -m 0755 "$(dirname "$LOCK_PATH")"'),
  "Runtime lock helper tidak boleh mengubah permission shared /run/lock parent.",
);

for (const marker of [
  "1D.7F",
  "git checkout --detach --force",
  "systemctl stop",
  "chown root:ubuntu /etc/asihjaya-rms/production.env",
  "ajsystem-install-deployment-automation install",
  "ajsystem-deployment-preflight snapshot",
  "ajsystem-deployment-preflight lock-test",
  "ajsystem-deploy",
  "dua healthy release",
  "ajsystem-rollback execute",
  "reverse rollback",
  "systemctl enable --now",
  "ajsystem-install-deployment-automation restore",
  "tanpa sudo",
]) {
  assert(runbook.includes(marker), `Runbook 1D.7F wajib memuat ${marker}.`);
}

if (process.platform !== "win32") {
  for (const scriptPath of [
    installerPath,
    preflightPath,
    "ops/scripts/ajsystem-deploy",
    "ops/scripts/ajsystem-rollback",
    "ops/scripts/ajsystem-db-backup",
  ]) {
    const result = spawnSync("bash", ["-n", path.join(projectRoot, scriptPath)], {
      cwd: projectRoot,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || `Bash syntax gagal: ${scriptPath}`);
  }
}

const packageJson = JSON.parse(source("package.json")) as { scripts?: Record<string, string> };
assert(
  packageJson.scripts?.["check:deployment-installation"] ===
    "tsx scripts/check-deployment-installation.ts",
  "package.json wajib memiliki check:deployment-installation.",
);

const workflow = source(".github/workflows/ci.yml");
assert(
  workflow.includes("npm run check:deployment-installation"),
  "CI wajib menjalankan deployment installation contract.",
);

console.log(
  "OK: instalasi deployment automation memiliki atomic command backup/restore, deployment-user guard, immutable bootstrap preflight, lock rehearsal, dan VPS runbook yang dapat diaudit.",
);
