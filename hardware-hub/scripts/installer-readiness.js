/* eslint-disable */
const fs = require("fs");
const path = require("path");

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
  const result = await waitForReadiness({ statePath, timeoutMs });
  process.stdout.write(
    `${JSON.stringify({
      success: true,
      ready: true,
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
  parseArgs,
  readHealthState,
  waitForReadiness,
};
