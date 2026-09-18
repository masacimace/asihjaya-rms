/* eslint-disable */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("node:child_process");

try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
} catch {}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${arg} membutuhkan nilai.`);
    result[key] = value;
    index += 1;
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readHealthState(statePath) {
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function resolvePowerShellExecutable() {
  const configured = String(process.env.HARDWARE_POWERSHELL_EXECUTABLE || "").trim();
  if (configured) return configured;
  const windir = String(process.env.WINDIR || process.env.SystemRoot || "C:\\Windows");
  return path.join(windir, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

function applyStagedStartupTask({ stateDir }) {
  const requestPath = path.join(stateDir, "startup-task-request.json");
  if (!fs.existsSync(requestPath)) {
    return { applied: false, requestPath };
  }

  const powershellExecutable = resolvePowerShellExecutable();
  const scriptPath = path.join(__dirname, "install-startup-task.ps1");
  if (!fs.existsSync(scriptPath)) {
    const error = new Error(`Startup task installer tidak ditemukan: ${scriptPath}`);
    error.code = "STARTUP_TASK_SCRIPT_MISSING";
    throw error;
  }

  const result = spawnSync(
    powershellExecutable,
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-ApplyStaged",
      "-StateDirectory",
      stateDir,
      "-NodeExecutable",
      process.execPath,
      "-RunNow",
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
    },
  );

  if (result.error) {
    const error = new Error(`Scheduled Task elevated apply gagal dijalankan: ${result.error.message}`);
    error.code = "STARTUP_TASK_APPLY_EXEC_FAILED";
    throw error;
  }
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    const error = new Error(
      `Scheduled Task elevated apply gagal (exit ${result.status ?? "unknown"})${
        detail ? `: ${detail}` : ""
      }`,
    );
    error.code = "STARTUP_TASK_APPLY_FAILED";
    throw error;
  }

  return {
    applied: true,
    requestPath,
    stdout: String(result.stdout || "").trim(),
  };
}

async function waitForReadiness({ statePath, timeoutMs = 30000, pollMs = 500 }) {
  const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 30000);
  let lastState = null;
  while (Date.now() <= deadline) {
    lastState = readHealthState(statePath);
    const updatedMs = Date.parse(lastState?.updatedAt || "");
    const fresh = Number.isFinite(updatedMs) && Date.now() - updatedMs <= 120000;
    if (lastState?.ready === true && lastState?.status === "healthy" && fresh) {
      return { ready: true, state: lastState };
    }
    await sleep(pollMs);
  }
  const detail = lastState?.lastError?.message || lastState?.status || "health state belum tersedia";
  const error = new Error(`Hardware Hub belum ready setelah ${timeoutMs} ms: ${detail}`);
  error.code = "INSTALLER_READINESS_TIMEOUT";
  error.state = lastState;
  throw error;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stateDir = path.resolve(
    args["state-dir"] || process.env.HARDWARE_INSTALLER_STATE_DIR || "data",
  );
  const statePath = path.resolve(
    args["health-state"] ||
      process.env.HARDWARE_HEALTH_STATE_PATH ||
      path.join(stateDir, "health-state.json"),
  );
  const timeoutMs = Number(args["timeout-ms"] || 30000);

  const startupTask = applyStagedStartupTask({ stateDir });
  const result = await waitForReadiness({ statePath, timeoutMs });
  process.stdout.write(
    `${JSON.stringify({
      success: true,
      ready: true,
      startupTaskApplied: startupTask.applied,
      statePath,
      pid: result.state?.process?.pid || null,
      status: result.state?.status || null,
      updatedAt: result.state?.updatedAt || null,
    })}\n`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({
        success: false,
        error: error?.code || "INSTALLER_READINESS_FAILED",
        message: error?.message || String(error),
      })}\n`,
    );
    process.exitCode = 1;
  });
}

module.exports = {
  applyStagedStartupTask,
  parseArgs,
  readHealthState,
  resolvePowerShellExecutable,
  waitForReadiness,
};
