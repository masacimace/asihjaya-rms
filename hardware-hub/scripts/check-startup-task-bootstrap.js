/* eslint-disable */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(filePath), `${relativePath} wajib tersedia.`);
  return fs.readFileSync(filePath, "utf8");
}

function main() {
  const startup = read("scripts/install-startup-task.ps1");
  const readiness = read("scripts/installer-readiness.js");

  assert.ok(
    startup.includes("startup-task-request.json") &&
      startup.includes("[System.Security.Principal.WindowsIdentity]::GetCurrent()") &&
      startup.includes("targetUserId") &&
      startup.includes("targetUserSid") &&
      startup.includes("SetAccessRuleProtection($true, $false)"),
    "Original-user phase wajib men-stage request Scheduled Task dengan identity + ACL yang dibatasi.",
  );

  assert.ok(
    startup.includes("[switch]$ApplyStaged") &&
      startup.includes("Test-IsAdministrator") &&
      startup.includes("Register-ScheduledTask") &&
      startup.includes("-WindowStyle Hidden") &&
      startup.includes("-RestartCount 999") &&
      startup.includes("-RestartInterval (New-TimeSpan -Minutes 1)"),
    "Elevated apply wajib membuat hidden Scheduled Task dengan restart policy 1 menit / 999 attempts.",
  );

  assert.ok(
    startup.includes("Owner request Scheduled Task tidak cocok") &&
      startup.includes("Target user dan SID pada request Scheduled Task tidak cocok") &&
      startup.includes("startup-task-install.log"),
    "Elevated apply wajib memverifikasi owner/SID request dan menyimpan diagnostic log aman.",
  );

  const applyIndex = readiness.indexOf("applyStagedStartupTask({ stateDir })");
  const waitIndex = readiness.indexOf("waitForReadiness({ statePath, timeoutMs })");
  assert.ok(
    readiness.includes('require("node:child_process")') &&
      readiness.includes("install-startup-task.ps1") &&
      readiness.includes('"-ApplyStaged"') &&
      readiness.includes("windowsHide: true") &&
      applyIndex >= 0 &&
      waitIndex >= 0 &&
      applyIndex < waitIndex,
    "Installer readiness wajib menerapkan request Scheduled Task dari elevated phase sebelum menunggu health readiness.",
  );

  console.log(
    "OK: original-user task staging, elevated hidden registration, diagnostics, and restart recovery bootstrap contracts valid.",
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
