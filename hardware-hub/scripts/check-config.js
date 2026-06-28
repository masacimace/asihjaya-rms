/* eslint-disable */
const fs = require("fs");
const path = require("path");

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

const errors = [];
const warnings = [];

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

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
  } catch {
    errors.push("ASIHJAYA_API_URL bukan URL yang valid.");
  }
}

if (!getEnv("HARDWARE_AGENT_ID")) {
  errors.push("HARDWARE_AGENT_ID wajib diisi dari output npm run hardware:agent:create.");
}

const secret = getEnv("HARDWARE_AGENT_SECRET");
if (!secret) {
  errors.push("HARDWARE_AGENT_SECRET wajib diisi.");
} else if (secret.length < 32) {
  errors.push("HARDWARE_AGENT_SECRET minimal 32 karakter.");
}

const pollInterval = getNumber("POLL_INTERVAL_MS", 2000);
if (pollInterval < 1000) {
  errors.push("POLL_INTERVAL_MS minimal 1000 ms.");
}

const heartbeatInterval = getNumber("HEARTBEAT_INTERVAL_MS", 30000);
if (heartbeatInterval < 5000) {
  warnings.push("HEARTBEAT_INTERVAL_MS disarankan minimal 5000 ms agar server tidak terlalu sering dipanggil.");
}

const requestTimeout = getNumber("REQUEST_TIMEOUT_MS", 15000);
if (requestTimeout < 3000) {
  errors.push("REQUEST_TIMEOUT_MS minimal 3000 ms.");
}

const printTimeout = getNumber("PRINT_COMMAND_TIMEOUT_MS", 60000);
if (printTimeout < 5000) {
  errors.push("PRINT_COMMAND_TIMEOUT_MS minimal 5000 ms.");
}

const labelProfile = getEnv("LABEL_PROFILE") || "jewelry_compact";
const allowedLabelProfiles = new Set(["jewelry_compact"]);
if (!allowedLabelProfiles.has(labelProfile)) {
  warnings.push(`LABEL_PROFILE ${labelProfile} belum dikenal. Agent akan tetap memakai layout jewelry_compact.`);
}

const labelCopies = getNumber("LABEL_COPIES", 1);
if (labelCopies < 1 || labelCopies > 20) {
  errors.push("LABEL_COPIES harus antara 1 sampai 20.");
}

const labelLeftOffset = getNumber("LABEL_LEFT_OFFSET_DOTS", 0);
const labelTopOffset = getNumber("LABEL_TOP_OFFSET_DOTS", 0);
if (Math.abs(labelLeftOffset) > 500 || Math.abs(labelTopOffset) > 500) {
  warnings.push("Offset label cukup besar. Pastikan LABEL_LEFT_OFFSET_DOTS / LABEL_TOP_OFFSET_DOTS sesuai hasil test print.");
}

const dryRun = getBoolean("HARDWARE_DRY_RUN", false);
const dryRunOutputDir = path.resolve(root, getEnv("DRY_RUN_OUTPUT_DIR") || "dry-run-output");

if (dryRun) {
  try {
    fs.mkdirSync(dryRunOutputDir, { recursive: true });
  } catch (error) {
    errors.push(`DRY_RUN_OUTPUT_DIR tidak bisa dibuat: ${error.message}`);
  }
} else {
  if (!getEnv("LABEL_PRINTER_NAME")) {
    warnings.push("LABEL_PRINTER_NAME kosong. Job label SATO akan gagal sampai printer dikonfigurasi.");
  }
  if (!getEnv("DOCUMENT_PRINTER_NAME")) {
    warnings.push("DOCUMENT_PRINTER_NAME kosong. Job nota/certificate PDF akan gagal sampai printer dikonfigurasi.");
  }
  if (getEnv("DOCUMENT_PRINTER_NAME") && !getEnv("PDF_PRINT_COMMAND")) {
    warnings.push("PDF_PRINT_COMMAND kosong. Silent print PDF butuh command seperti SumatraPDF.");
  }
  if (!getEnv("CASH_DRAWER_PRINTER_NAME")) {
    warnings.push("CASH_DRAWER_PRINTER_NAME kosong. Job buka cash drawer akan gagal sampai dikonfigurasi.");
  }
}

console.log("Asihjaya Hardware Hub config check");
console.log("===================================");
console.log(`Node.js               : ${process.version}`);
console.log(`Working directory     : ${root}`);
console.log(`ENV file              : ${envPath}`);
console.log(`API URL               : ${apiUrl || "-"}`);
console.log(`Dry run               : ${dryRun ? "enabled" : "disabled"}`);
console.log(`Dry-run output dir    : ${dryRun ? dryRunOutputDir : "-"}`);
console.log(`Label printer         : ${getEnv("LABEL_PRINTER_NAME") || "-"}`);
console.log(`Label profile         : ${labelProfile}`);
console.log(`Label copies          : ${labelCopies}`);
console.log(`Label offset          : left ${labelLeftOffset} dots, top ${labelTopOffset} dots`);
console.log(`Label include price   : ${getBoolean("LABEL_INCLUDE_PRICE", false) ? "yes" : "no"}`);
console.log(`Document printer      : ${getEnv("DOCUMENT_PRINTER_NAME") || "-"}`);
console.log(`Cash drawer printer   : ${getEnv("CASH_DRAWER_PRINTER_NAME") || "-"}`);
console.log("");

if (warnings.length) {
  console.warn("Warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
  console.log("");
}

if (errors.length) {
  console.error("Errors:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("OK: konfigurasi dasar Hardware Hub valid.");
