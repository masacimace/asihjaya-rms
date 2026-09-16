/* eslint-disable */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { configureInstaller } = require("./installer-configure");
const { waitForReadiness } = require("./installer-readiness");
const { parseEnv } = require("../lib/outlet-operations");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(filePath), `${relativePath} wajib tersedia.`);
  return fs.readFileSync(filePath, "utf8");
}

async function main() {
  const iss = read("installer/AsihjayaHardwareHub.iss");
  const builder = read("installer/build-installer.ps1");
  const startup = read("scripts/install-startup-task.ps1");
  const secureStart = read("scripts/start-agent-secure.js");
  const testPrint = read("scripts/installer-test-print.js");

  assert.ok(iss.includes("SetupArchitecture=x64"), "Setup.exe wajib x64 native.");
  assert.ok(
    iss.includes("{commonappdata}\\ASIHJAYA\\Hardware Hub\\data") &&
      iss.includes("Permissions: users-modify"),
    "Writable installer state wajib berada di ProgramData, bukan Program Files.",
  );
  assert.ok(
    iss.includes("ExecAsOriginalUser") &&
      iss.includes("enroll-installer.js") &&
      iss.includes("install-startup-task.ps1"),
    "Enrollment DPAPI dan Scheduled Task wajib berjalan pada original Windows user.",
  );
  assert.ok(
    iss.includes("Get-Printer") &&
      iss.includes("SATO") &&
      iss.includes("EPSON") &&
      iss.includes("Test Print Label") &&
      iss.includes("Test Print Nota"),
    "Wizard wajib mendeteksi printer dan menyediakan test print SATO/EPSON.",
  );
  assert.ok(
    builder.includes('[string]$NodeVersion = "24.14.0"') &&
      builder.includes("node-v$NodeVersion-win-x64.zip") &&
      builder.includes("313fa40c0d7b18575821de8cb17483031fe07d95de5994f6f435f3b345f85c66") &&
      builder.includes('$SumatraVersion = "3.6.1"') &&
      builder.includes('"SumatraPDF-$SumatraVersion-64.zip"') &&
      builder.includes("98b33a518d42986856d225064b0cd2d3643ecf78cbf84ab873d26cc51877a544"),
    "Builder wajib pin + verify Node 24.14.0 dan SumatraPDF 3.6.1 artifacts.",
  );
  assert.ok(
    builder.includes('$InterVersion = "3.19"') &&
      builder.includes("a645f55492d1c8cdace43c72be8cbec08e680b5a86d8b4c2d1c50d6e41e9cc96") &&
      builder.includes("Inter-Medium.ttf"),
    "Builder wajib pin Inter Medium 3.19 yang sudah physical-approved untuk SATO V3.",
  );
  assert.ok(
    builder.includes("$IsLoopbackHttp") &&
      builder.includes('$Api.Host -eq "127.0.0.1"') &&
      builder.includes('$Api.Host -eq "localhost"') &&
      builder.includes("HTTP hanya diizinkan untuk localhost/127.0.0.1 pada local UAT"),
    "Builder wajib mempertahankan HTTPS production dan hanya mengizinkan HTTP pada loopback local UAT.",
  );
  assert.ok(
    startup.includes("-NodeExecutable") || startup.includes("[string]$NodeExecutable"),
    "Scheduled Task installer wajib menerima private Node executable.",
  );
  assert.ok(
    !read("scripts/start-agent.ps1").includes('Join-Path $HubRoot "logs"'),
    "Runtime packaged tidak boleh membuat writable logs di Program Files.",
  );
  assert.ok(
    secureStart.includes("HARDWARE_CREDENTIAL_STORE_PATH"),
    "Secure launcher wajib tetap membaca credential store Stage 4.",
  );
  assert.ok(
    testPrint.includes("createSatoProductionContractFixture") &&
      testPrint.includes("createEpsonFixturePdf") &&
      testPrint.includes("EPSON_L3251_PRINT_PROFILE_A4_V1"),
    "Installer test print wajib reuse production SATO renderer dan Epson A4 profile.",
  );

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "asihjaya-installer-check-"));
  try {
    const appRoot = path.join(tempRoot, "app");
    const stateDir = path.join(tempRoot, "program-data", "data");
    const logDir = path.join(tempRoot, "program-data", "logs");
    const supportDir = path.join(tempRoot, "program-data", "support-bundles");
    const toolsDir = path.join(tempRoot, "tools");
    const bundledFontPath = path.join(appRoot, "assets", "fonts", "Inter-Medium.ttf");
    fs.mkdirSync(appRoot, { recursive: true });
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.mkdirSync(path.dirname(bundledFontPath), { recursive: true });
    fs.copyFileSync(path.join(root, ".env.example"), path.join(appRoot, ".env.example"));
    const pdfExecutable = path.join(toolsDir, "SumatraPDF.exe");
    const powershellExecutable = path.join(toolsDir, "powershell.exe");
    fs.writeFileSync(pdfExecutable, "fixture");
    fs.writeFileSync(powershellExecutable, "fixture");
    fs.writeFileSync(bundledFontPath, "fixture-font");

    const configured = configureInstaller({
      appRoot,
      stateDir,
      logDir,
      supportDir,
      apiUrl: "https://ajsystem.id",
      labelPrinter: "SATO CG408",
      documentPrinter: "EPSON L3250 Series",
      pdfExecutable,
      powershellExecutable,
    });
    const env = parseEnv(fs.readFileSync(configured.envPath, "utf8"));
    assert.equal(env.HARDWARE_AGENT_ID, "");
    assert.equal(env.HARDWARE_AGENT_SECRET, "");
    assert.equal(env.HARDWARE_AGENT_REQUEST_AUTH_MODE, "signed");
    assert.equal(env.LABEL_PRINTER_ADAPTER, "real");
    assert.equal(env.DOCUMENT_PRINTER_ADAPTER, "real");
    assert.equal(env.CASH_DRAWER_ADAPTER, "fake");
    assert.equal(env.LABEL_PRINTER_NAME, "SATO CG408");
    assert.equal(env.DOCUMENT_PRINTER_NAME, "EPSON L3250 Series");
    assert.equal(path.normalize(env.HARDWARE_INSTALLER_STATE_DIR), path.normalize(stateDir));
    assert.equal(path.normalize(env.HARDWARE_LOG_DIR), path.normalize(logDir));
    assert.equal(path.normalize(env.PDF_PRINT_EXECUTABLE), path.normalize(pdfExecutable));
    assert.equal(path.normalize(env.SATO_LABEL_FONT_PATH), path.normalize(bundledFontPath));
    assert.equal(path.normalize(configured.satoLabelFontPath), path.normalize(bundledFontPath));

    const healthPath = path.join(stateDir, "health-state.json");
    fs.writeFileSync(
      healthPath,
      JSON.stringify({
        status: "healthy",
        ready: true,
        updatedAt: new Date().toISOString(),
        process: { pid: 1234 },
      }),
    );
    const readiness = await waitForReadiness({ statePath: healthPath, timeoutMs: 1000, pollMs: 10 });
    assert.equal(readiness.ready, true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log(
    "OK: Stage 5 native Setup.exe packaging, bundled SATO font, ProgramData state, printer wizard, private runtime, and readiness contracts valid.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});