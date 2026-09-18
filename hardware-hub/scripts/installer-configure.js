/* eslint-disable */
const fs = require("fs");
const path = require("path");

const { updateEnvContent } = require("../lib/outlet-operations");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Argumen ${arg} membutuhkan nilai.`);
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

function required(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} wajib diisi.`);
  return normalized;
}

function normalizeApiUrl(value) {
  const url = new URL(required(value, "ASIHJAYA API URL"));
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Production Hardware Hub API URL wajib HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function backupConfig(envPath, backupDir) {
  if (!fs.existsSync(envPath)) return null;
  ensureDirectory(backupDir);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const backupPath = path.join(backupDir, `.env.${stamp}.bak`);
  fs.copyFileSync(envPath, backupPath, fs.constants.COPYFILE_EXCL);
  return backupPath;
}

function configureInstaller(input) {
  const appRoot = path.resolve(required(input.appRoot, "App root"));
  const stateDir = path.resolve(required(input.stateDir, "State directory"));
  const logDir = path.resolve(required(input.logDir, "Log directory"));
  const supportDir = path.resolve(required(input.supportDir, "Support directory"));
  const apiUrl = normalizeApiUrl(input.apiUrl);
  const labelPrinter = required(input.labelPrinter, "Label printer");
  const documentPrinter = required(input.documentPrinter, "Document printer");
  const pdfExecutable = path.resolve(required(input.pdfExecutable, "PDF executable"));
  const powershellExecutable = path.resolve(
    required(input.powershellExecutable, "PowerShell executable"),
  );

  const templatePath = path.join(appRoot, ".env.example");
  const envPath = path.join(appRoot, ".env");
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template .env tidak ditemukan: ${templatePath}`);
  }
  if (!fs.existsSync(pdfExecutable)) {
    throw new Error(`SumatraPDF tidak ditemukan: ${pdfExecutable}`);
  }
  if (!fs.existsSync(powershellExecutable)) {
    throw new Error(`PowerShell tidak ditemukan: ${powershellExecutable}`);
  }

  for (const directory of [
    stateDir,
    logDir,
    supportDir,
    path.join(stateDir, "temp"),
    path.join(stateDir, "fake-output"),
    path.join(stateDir, "dry-run-output"),
  ]) {
    ensureDirectory(directory);
  }

  const original = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : fs.readFileSync(templatePath, "utf8");
  const backupPath = backupConfig(envPath, path.join(stateDir, "config-backups"));

  const updates = {
    ASIHJAYA_API_URL: apiUrl,
    HARDWARE_INSTALLER_STATE_DIR: stateDir,
    HARDWARE_CREDENTIAL_STORE_PATH: path.join(stateDir, "agent-credential.json"),
    HARDWARE_CREDENTIAL_KEY_PATH: path.join(stateDir, "credential-store.key"),
    HARDWARE_AGENT_ID: "",
    HARDWARE_AGENT_SECRET: "",
    HARDWARE_AGENT_REQUEST_AUTH_MODE: "signed",
    HARDWARE_PROTOCOL_MODE: "v2-preferred",
    HARDWARE_JOURNAL_PATH: path.join(stateDir, "hardware-executions.sqlite"),
    HARDWARE_JOURNAL_KEY_PATH: path.join(stateDir, "hardware-journal.key"),
    HARDWARE_POWERSHELL_EXECUTABLE: powershellExecutable,
    HARDWARE_TEMP_DIR: path.join(stateDir, "temp"),
    HARDWARE_ADAPTER_MODE: "fake",
    LABEL_PRINTER_ADAPTER: "real",
    DOCUMENT_PRINTER_ADAPTER: "real",
    CASH_DRAWER_ADAPTER: "fake",
    HARDWARE_DRY_RUN: "false",
    DRY_RUN_OUTPUT_DIR: path.join(stateDir, "dry-run-output"),
    FAKE_HARDWARE_OUTPUT_DIR: path.join(stateDir, "fake-output"),
    LABEL_PRINTER_NAME: labelPrinter,
    DOCUMENT_PRINTER_NAME: documentPrinter,
    CASH_DRAWER_PRINTER_NAME: "",
    PDF_PRINT_EXECUTABLE: pdfExecutable,
    HARDWARE_LOG_DIR: logDir,
    HARDWARE_LOCK_PATH: path.join(stateDir, "agent.lock"),
    HARDWARE_HEALTH_STATE_PATH: path.join(stateDir, "health-state.json"),
    HARDWARE_HEALTH_SERVER_ENABLED: "true",
    HARDWARE_HEALTH_SERVER_HOST: "127.0.0.1",
    HARDWARE_HEALTH_SERVER_PORT: "3210",
  };

  const updated = updateEnvContent(original, updates);
  const tempPath = `${envPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, updated, "utf8");
  fs.renameSync(tempPath, envPath);

  return {
    appRoot,
    envPath,
    backupPath,
    apiUrl,
    stateDir,
    logDir,
    supportDir,
    labelPrinter,
    documentPrinter,
    pdfExecutable,
  };
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = configureInstaller({
      appRoot: args["app-root"],
      stateDir: args["state-dir"],
      logDir: args["log-dir"],
      supportDir: args["support-dir"],
      apiUrl: args["api-url"],
      labelPrinter: args["label-printer"],
      documentPrinter: args["document-printer"],
      pdfExecutable: args["pdf-executable"],
      powershellExecutable: args["powershell-executable"],
    });
    process.stdout.write(`${JSON.stringify({ success: true, ...result })}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ success: false, message: error?.message || String(error) })}\n`,
    );
    process.exitCode = 1;
  }
}

module.exports = {
  backupConfig,
  configureInstaller,
  normalizeApiUrl,
  parseArgs,
};
