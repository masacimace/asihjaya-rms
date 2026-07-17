import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "hardware-hub/lib/operational-logger.js",
  "hardware-hub/lib/operational-health.js",
  "hardware-hub/lib/process-lock.js",
  "hardware-hub/scripts/check-health.js",
  "hardware-hub/scripts/collect-diagnostics.js",
  "hardware-hub/scripts/export-support-bundle.ps1",
  "hardware-hub/scripts/show-status.ps1",
  "hardware-hub/scripts/install-production.ps1",
  "hardware-hub/scripts/check-production-operations.js",
  "docs/hardware-hub/windows-production-operations.md",
];
for (const file of requiredFiles) assert.equal(existsSync(path.join(root, file)), true, `${file} missing`);

const agent = readFileSync(path.join(root, "hardware-hub/agent.js"), "utf8");
for (const marker of ["OperationalHealth", "acquireProcessLock", "createOperationalLogger", "HARDWARE_HEALTH_SERVER_PORT"]) {
  assert(agent.includes(marker), `agent.js missing ${marker}`);
}

const result = spawnSync(process.execPath, ["scripts/check-production-operations.js"], {
  cwd: path.join(root, "hardware-hub"),
  encoding: "utf8",
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
assert.equal(result.status, 0, "hardware-hub operations check failed");
console.log("OK: Hardware Protocol v2 Windows operations foundation valid.");
