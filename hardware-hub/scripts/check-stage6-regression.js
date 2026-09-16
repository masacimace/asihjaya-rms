/* eslint-disable */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { configureInstaller } = require("./installer-configure");
const { parseEnv } = require("../lib/outlet-operations");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(filePath), `${relativePath} wajib tersedia.`);
  return fs.readFileSync(filePath, "utf8");
}

function main() {
  const iss = read("installer/AsihjayaHardwareHub.iss");
  const uat = read("scripts/run-local-uat.ps1");
  const support = read("scripts/export-support-bundle.ps1");

  assert.ok(
    iss.includes("ExistingInstallation := FileExists(CredentialPath)") &&
      iss.includes("function ShouldSkipPage") &&
      iss.includes("PageID = InstallationPage.ID"),
    "Repair/upgrade wajib mendeteksi secure credential existing dan melewati Installation Code page.",
  );
  assert.ok(
    iss.includes("procedure ResumeExistingHub") &&
      /if\s+ExistingInstallation\s+then\s+ResumeExistingHub\s+else\s+EnrollInstalledHub;/i.test(iss),
    "Repair/upgrade wajib resume credential existing, bukan membuat agent/enrollment baru.",
  );
  assert.ok(
    iss.includes("function PrepareToInstall") &&
      iss.includes("StopExistingTask") &&
      iss.includes("Stop-ScheduledTask"),
    "Repair/upgrade wajib menghentikan Scheduled Task lama sebelum mengganti runtime/app.",
  );
  assert.ok(
    iss.includes("ExistingLabelPrinter") &&
      iss.includes("ExistingDocumentPrinter") &&
      iss.includes("SelectPrinterByExactName"),
    "Repair/upgrade wajib mempertahankan printer existing bila masih tersedia di Windows.",
  );
  assert.ok(
    iss.includes("{commonappdata}\\ASIHJAYA\\Hardware Hub\\uat-reports") &&
      iss.includes("Mode Perbaiki / Upgrade"),
    "Installer Stage 6 wajib memiliki ProgramData UAT path dan UX repair yang eksplisit.",
  );

  assert.ok(
    uat.includes("Secure credential store") &&
      uat.includes("Scheduled Task user context") &&
      uat.includes("Agent health readiness") &&
      uat.includes("Physical label test") &&
      uat.includes("Physical document test"),
    "Local UAT runner wajib memeriksa credential, task context, readiness, dan optional physical print.",
  );
  assert.ok(
    uat.includes("rawEnvironmentIncluded = $false") &&
      uat.includes("agentSecretIncluded = $false") &&
      uat.includes("credentialContentIncluded = $false"),
    "Local UAT report tidak boleh memuat secret atau raw credential/environment content.",
  );

  assert.ok(
    support.includes("$BundledNode") &&
      support.includes("HARDWARE_INSTALLER_STATE_DIR") &&
      support.includes("HARDWARE_LOG_DIR") &&
      support.includes("latest-uat-report.json"),
    "Support bundle wajib membaca installed private runtime + ProgramData state/log dan menyertakan UAT report aman.",
  );
  assert.ok(
    !support.includes("Copy-Item $EnvPath") &&
      support.includes("secure credential file content") &&
      support.includes("agent secret and lease tokens"),
    "Support bundle tidak boleh menyalin raw .env atau credential/secret content.",
  );

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-stage6-repair-"));
  try {
    const appRoot = path.join(tempRoot, "app");
    const stateDir = path.join(tempRoot, "program-data", "data");
    const logDir = path.join(tempRoot, "program-data", "logs");
    const supportDir = path.join(tempRoot, "program-data", "support-bundles");
    const toolsDir = path.join(tempRoot, "tools");
    fs.mkdirSync(appRoot, { recursive: true });
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.copyFileSync(path.join(root, ".env.example"), path.join(appRoot, ".env.example"));
    const pdfExecutable = path.join(toolsDir, "SumatraPDF.exe");
    const powershellExecutable = path.join(toolsDir, "powershell.exe");
    fs.writeFileSync(pdfExecutable, "fixture");
    fs.writeFileSync(powershellExecutable, "fixture");

    const first = configureInstaller({
      appRoot,
      stateDir,
      logDir,
      supportDir,
      apiUrl: "https://ajsystem.id",
      labelPrinter: "SATO CG408",
      documentPrinter: "EPSON L3251 Series",
      pdfExecutable,
      powershellExecutable,
    });
    fs.appendFileSync(first.envPath, "\nSTAGE6_PRESERVE_SENTINEL=keep-me\n", "utf8");

    const second = configureInstaller({
      appRoot,
      stateDir,
      logDir,
      supportDir,
      apiUrl: "https://ajsystem.id",
      labelPrinter: "SATO CG408",
      documentPrinter: "EPSON L3251 Series",
      pdfExecutable,
      powershellExecutable,
    });
    const env = parseEnv(fs.readFileSync(second.envPath, "utf8"));
    assert.equal(env.STAGE6_PRESERVE_SENTINEL, "keep-me");
    assert.equal(env.HARDWARE_AGENT_ID, "");
    assert.equal(env.HARDWARE_AGENT_SECRET, "");
    assert.ok(second.backupPath, "Repair configure wajib membuat backup config existing.");
    assert.ok(fs.existsSync(second.backupPath), "Backup config repair wajib benar-benar ada.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log(
    "OK: Stage 6 repair/upgrade, ProgramData preservation, local UAT, and support diagnostics contracts valid.",
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
