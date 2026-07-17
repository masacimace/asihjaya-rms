/* eslint-disable */
const fs = require("fs");
const path = require("path");
try { require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true }); } catch {}

const root = path.resolve(__dirname, "..");
const statePath = path.resolve(root, process.env.HARDWARE_HEALTH_STATE_PATH?.trim() || "data/health-state.json");
const staleSeconds = Math.max(10, Number(process.env.HARDWARE_HEALTH_STALE_SECONDS || 120));
const jsonOnly = process.argv.includes("--json");

if (!fs.existsSync(statePath)) {
  console.error(`Health state belum tersedia: ${statePath}`);
  process.exit(2);
}

let state;
try { state = JSON.parse(fs.readFileSync(statePath, "utf8")); }
catch (error) {
  console.error(`Health state tidak valid: ${error.message}`);
  process.exit(2);
}

const updatedMs = Date.parse(state.updatedAt || "");
const ageSeconds = Number.isFinite(updatedMs) ? Math.max(0, Math.floor((Date.now() - updatedMs) / 1000)) : null;
const stale = ageSeconds === null || ageSeconds > staleSeconds;
const healthy = state.ready === true && state.status === "healthy" && !stale;
const result = { healthy, stale, ageSeconds, staleSeconds, statePath, state };

if (jsonOnly) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Status       : ${state.status || "unknown"}`);
  console.log(`Ready        : ${state.ready === true ? "yes" : "no"}`);
  console.log(`Updated age  : ${ageSeconds === null ? "unknown" : `${ageSeconds}s`}`);
  console.log(`PID          : ${state.process?.pid || "unknown"}`);
  console.log(`Current job  : ${state.currentJob?.id || "none"}`);
  console.log(`Last error   : ${state.lastError?.message || "none"}`);
  console.log(`Health file  : ${statePath}`);
}
process.exit(healthy ? 0 : stale ? 2 : 1);
