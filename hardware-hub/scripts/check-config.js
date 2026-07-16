/* eslint-disable */
const fs = require("fs");
const path = require("path");
const { SUPPORTED_FAKE_SCENARIOS, normalizeScenario } = require("../lib/failure-injection");

try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch {
  // dotenv optional; production task may inject environment variables directly.
}

function getEnv(name) {
  return process.env[name]?.trim() || "";
}

function getBoolean(name, fallback = false) {
  const value = getEnv(name).toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(value);
}

function getNumber(name, fallback) {
  const value = Number(getEnv(name));
  return Number.isFinite(value) ? value : fallback;
}

function resolveLocalPath(name, fallback) {
  return path.resolve(root, getEnv(name) || fallback);
}

const errors = [];
const warnings = [];
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const nodeVersion = process.versions.node.split(".").map(Number);
const nodeSupportsSqlite =
  nodeVersion[0] > 22 || (nodeVersion[0] === 22 && nodeVersion[1] >= 5);

if (!nodeSupportsSqlite) {
  errors.push("Hardware Hub Protocol v2 membutuhkan Node.js >= 22.5 untuk built-in node:sqlite.");
} else {
  try {
    require("node:sqlite");
  } catch (error) {
    errors.push(`Built-in node:sqlite tidak tersedia: ${error.message}`);
  }
}

if (!fs.existsSync(envPath)) {
  errors.push("File hardware-hub/.env belum ada. Copy dari .env.example lalu isi konfigurasi agent.");
}

const apiUrl = getEnv("ASIHJAYA_API_URL");
if (!apiUrl) {
  errors.push("ASIHJAYA_API_URL wajib diisi.");
} else {
  try {
    const parsed = new URL(apiUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors.push("ASIHJAYA_API_URL harus memakai http:// atau https://.");
    }
    if (
      parsed.protocol === "http:" &&
      !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
    ) {
      errors.push("ASIHJAYA_API_URL production wajib memakai HTTPS.");
    }
  } catch {
    errors.push("ASIHJAYA_API_URL bukan URL yang valid.");
  }
}

if (!getEnv("HARDWARE_AGENT_ID")) {
  errors.push("HARDWARE_AGENT_ID wajib diisi dari output npm run hardware:agent:create.");
}
const secret = getEnv("HARDWARE_AGENT_SECRET");
if (!secret) errors.push("HARDWARE_AGENT_SECRET wajib diisi.");
else if (secret.length < 32) errors.push("HARDWARE_AGENT_SECRET minimal 32 karakter.");

const protocolMode = getEnv("HARDWARE_PROTOCOL_MODE") || "v2-preferred";
if (!["v2-preferred", "v2-only", "v1-only"].includes(protocolMode)) {
  errors.push("HARDWARE_PROTOCOL_MODE harus v2-preferred, v2-only, atau v1-only.");
}

const dryRun = getBoolean("HARDWARE_DRY_RUN", false);
const globalAdapterMode = (getEnv("HARDWARE_ADAPTER_MODE") || (dryRun ? "fake" : "real")).toLowerCase();
const adapterModes = {
  label_printer: (getEnv("LABEL_PRINTER_ADAPTER") || globalAdapterMode).toLowerCase(),
  document_printer: (getEnv("DOCUMENT_PRINTER_ADAPTER") || globalAdapterMode).toLowerCase(),
  cash_drawer: (getEnv("CASH_DRAWER_ADAPTER") || globalAdapterMode).toLowerCase(),
};
for (const [name, value] of Object.entries(adapterModes)) {
  if (!["real", "fake"].includes(value)) {
    errors.push(`${name} adapter harus real atau fake.`);
  }
}
const fakeEnabled = Object.values(adapterModes).includes("fake");
const fakeOutputDir = resolveLocalPath(
  "FAKE_HARDWARE_OUTPUT_DIR",
  getEnv("DRY_RUN_OUTPUT_DIR") || "data/fake-output",
);
const fakePlanPath = getEnv("FAKE_HARDWARE_PLAN_PATH")
  ? resolveLocalPath("FAKE_HARDWARE_PLAN_PATH", "data/fake-plan.json")
  : "";
const fakeScenarioEntries = [
  ["FAKE_HARDWARE_SCENARIO", getEnv("FAKE_HARDWARE_SCENARIO") || "success"],
  ["FAKE_LABEL_SCENARIO", getEnv("FAKE_LABEL_SCENARIO")],
  ["FAKE_DOCUMENT_SCENARIO", getEnv("FAKE_DOCUMENT_SCENARIO")],
  ["FAKE_CASH_DRAWER_SCENARIO", getEnv("FAKE_CASH_DRAWER_SCENARIO")],
].filter(([, value]) => value);
for (const [name, value] of fakeScenarioEntries) {
  try {
    normalizeScenario(value);
  } catch (error) {
    errors.push(`${name}: ${error.message}`);
  }
}
const fakeDelayMs = getNumber("FAKE_HARDWARE_DELAY_MS", 250);
if (fakeDelayMs < 0 || fakeDelayMs > 120000) {
  errors.push("FAKE_HARDWARE_DELAY_MS harus antara 0 dan 120000 ms.");
}
if (dryRun) {
  warnings.push("HARDWARE_DRY_RUN adalah compatibility mode; gunakan HARDWARE_ADAPTER_MODE=fake.");
}
if (fakeEnabled) {
  try {
    fs.mkdirSync(fakeOutputDir, { recursive: true });
    fs.accessSync(fakeOutputDir, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    errors.push(`FAKE_HARDWARE_OUTPUT_DIR tidak writable (${fakeOutputDir}): ${error.message}`);
  }
  if (fakePlanPath && fs.existsSync(fakePlanPath)) {
    try {
      const plan = JSON.parse(fs.readFileSync(fakePlanPath, "utf8"));
      if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
        errors.push("FAKE_HARDWARE_PLAN_PATH wajib berisi JSON object.");
      }
    } catch (error) {
      errors.push(`FAKE_HARDWARE_PLAN_PATH tidak valid: ${error.message}`);
    }
  } else if (fakePlanPath) {
    warnings.push(`FAKE_HARDWARE_PLAN_PATH belum ditemukan: ${fakePlanPath}`);
  }
}

const pollInterval = getNumber("POLL_INTERVAL_MS", 2000);
if (pollInterval < 1000) errors.push("POLL_INTERVAL_MS minimal 1000 ms.");
const heartbeatInterval = getNumber("HEARTBEAT_INTERVAL_MS", 30000);
if (heartbeatInterval < 5000) {
  warnings.push("HEARTBEAT_INTERVAL_MS disarankan minimal 5000 ms.");
}
const requestTimeout = getNumber("REQUEST_TIMEOUT_MS", 15000);
if (requestTimeout < 3000) errors.push("REQUEST_TIMEOUT_MS minimal 3000 ms.");
const printTimeout = getNumber("PRINT_COMMAND_TIMEOUT_MS", 60000);
if (printTimeout < 5000) errors.push("PRINT_COMMAND_TIMEOUT_MS minimal 5000 ms.");
const leaseRenewInterval = getNumber("LEASE_RENEW_INTERVAL_MS", 20000);
if (leaseRenewInterval < 5000 || leaseRenewInterval > 45000) {
  errors.push("LEASE_RENEW_INTERVAL_MS harus antara 5000 dan 45000 ms.");
}

const journalPath = resolveLocalPath("HARDWARE_JOURNAL_PATH", "data/hardware-executions.sqlite");
const journalKeyPath = resolveLocalPath("HARDWARE_JOURNAL_KEY_PATH", "data/hardware-journal.key");
const tempDir = resolveLocalPath("HARDWARE_TEMP_DIR", "data/temp");
if (protocolMode !== "v1-only") {
  for (const directory of [path.dirname(journalPath), path.dirname(journalKeyPath), tempDir]) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
    } catch (error) {
      errors.push(`Directory Hardware Hub tidak writable (${directory}): ${error.message}`);
    }
  }
}

const labelProfile = getEnv("LABEL_PROFILE") || "jewelry_compact";
if (labelProfile !== "jewelry_compact") {
  warnings.push(`LABEL_PROFILE ${labelProfile} belum dikenal; layout jewelry_compact tetap digunakan.`);
}
const labelCopies = getNumber("LABEL_COPIES", 1);
if (!Number.isInteger(labelCopies) || labelCopies < 1 || labelCopies > 20) {
  errors.push("LABEL_COPIES harus integer antara 1 sampai 20.");
}
const labelLeftOffset = getNumber("LABEL_LEFT_OFFSET_DOTS", 0);
const labelTopOffset = getNumber("LABEL_TOP_OFFSET_DOTS", 0);
if (Math.abs(labelLeftOffset) > 500 || Math.abs(labelTopOffset) > 500) {
  warnings.push("Offset label cukup besar; pastikan sesuai hasil physical test.");
}

if (adapterModes.label_printer === "real" && !getEnv("LABEL_PRINTER_NAME")) {
  warnings.push("LABEL_PRINTER_NAME kosong; job label real akan gagal sampai dikonfigurasi.");
}
if (adapterModes.document_printer === "real") {
  if (!getEnv("DOCUMENT_PRINTER_NAME")) {
    warnings.push("DOCUMENT_PRINTER_NAME kosong; job document real akan gagal sampai dikonfigurasi.");
  }
  const pdfExecutable = getEnv("PDF_PRINT_EXECUTABLE");
  const pdfArgsJson = getEnv("PDF_PRINT_ARGS_JSON");
  const legacyPdfCommand = getEnv("PDF_PRINT_COMMAND");
  if (getEnv("DOCUMENT_PRINTER_NAME") && !pdfExecutable && !legacyPdfCommand) {
    warnings.push("PDF_PRINT_EXECUTABLE atau PDF_PRINT_COMMAND belum dikonfigurasi.");
  }
  if (pdfExecutable) {
    if (!fs.existsSync(pdfExecutable)) {
      warnings.push(`PDF_PRINT_EXECUTABLE belum ditemukan: ${pdfExecutable}`);
    }
    try {
      const args = JSON.parse(pdfArgsJson || "[]");
      if (!Array.isArray(args) || !args.every((entry) => typeof entry === "string")) {
        errors.push("PDF_PRINT_ARGS_JSON wajib berupa JSON array string.");
      }
    } catch {
      errors.push("PDF_PRINT_ARGS_JSON bukan JSON yang valid.");
    }
  }
  if (legacyPdfCommand) {
    warnings.push("PDF_PRINT_COMMAND adalah compatibility mode; migrasikan ke executable + args JSON.");
  }
}
if (adapterModes.cash_drawer === "real" && !getEnv("CASH_DRAWER_PRINTER_NAME")) {
  warnings.push("CASH_DRAWER_PRINTER_NAME kosong; job cash drawer real akan gagal.");
}

console.log("Asihjaya Hardware Hub config check");
console.log("===================================");
console.log(`Node.js               : ${process.version}`);
console.log(`Working directory     : ${root}`);
console.log(`ENV file              : ${envPath}`);
console.log(`API URL               : ${apiUrl || "-"}`);
console.log(`Protocol mode         : ${protocolMode}`);
console.log(`Journal path          : ${protocolMode === "v1-only" ? "disabled" : journalPath}`);
console.log(`Journal key           : ${protocolMode === "v1-only" ? "disabled" : process.platform === "win32" ? "Windows DPAPI" : journalKeyPath}`);
console.log(`Temporary directory   : ${tempDir}`);
console.log(`Adapter mode (global) : ${globalAdapterMode}`);
console.log(`Label adapter         : ${adapterModes.label_printer}`);
console.log(`Document adapter      : ${adapterModes.document_printer}`);
console.log(`Cash drawer adapter   : ${adapterModes.cash_drawer}`);
console.log(`Fake scenario         : ${fakeEnabled ? getEnv("FAKE_HARDWARE_SCENARIO") || "success" : "-"}`);
console.log(`Fake output dir       : ${fakeEnabled ? fakeOutputDir : "-"}`);
console.log(`Fake plan             : ${fakePlanPath || "-"}`);
console.log(`Fake scenarios        : ${Array.from(SUPPORTED_FAKE_SCENARIOS).join(", ")}`);
console.log(`Label printer         : ${getEnv("LABEL_PRINTER_NAME") || "-"}`);
console.log(`Label profile         : ${labelProfile}`);
console.log(`Label copies          : ${labelCopies}`);
console.log(`Label offset          : left ${labelLeftOffset}, top ${labelTopOffset}`);
console.log(`Document printer      : ${getEnv("DOCUMENT_PRINTER_NAME") || "-"}`);
console.log(`PDF executable        : ${getEnv("PDF_PRINT_EXECUTABLE") || "-"}`);
console.log(`Cash drawer printer   : ${getEnv("CASH_DRAWER_PRINTER_NAME") || "-"}`);
console.log(`Lease renewal         : ${leaseRenewInterval} ms`);
console.log("");

if (warnings.length) {
  console.warn("Warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
  console.log("");
}
if (errors.length) {
  console.error("Errors:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("OK: konfigurasi Hardware Hub valid untuk Protocol v2 crash-safe agent.");
