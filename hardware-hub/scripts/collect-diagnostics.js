/* eslint-disable */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DOCUMENT_PRINT_PROFILES } = require("../lib/document-print-profiles");

const root = path.resolve(__dirname, "..");
try { require("dotenv").config({ path: path.join(root, ".env"), quiet: true }); } catch {}

function parseEnv(text) {
  const result = {};
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}

function redactConfig(config) {
  return Object.fromEntries(
    Object.entries(config).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [
      key,
      /secret|token|password|credential|private|journal_key/i.test(key) ? "[REDACTED]" : value,
    ]),
  );
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

function statSafe(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return { exists: true, sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
  } catch { return { exists: false }; }
}

function collectDiagnostics() {
  const packageJson = readJson(path.join(root, "package.json")) || {};
  const envPath = path.join(root, ".env");
  const config = fs.existsSync(envPath) ? redactConfig(parseEnv(fs.readFileSync(envPath, "utf8"))) : {};
  const healthPath = path.resolve(root, process.env.HARDWARE_HEALTH_STATE_PATH?.trim() || "data/health-state.json");
  const journalPath = path.resolve(root, process.env.HARDWARE_JOURNAL_PATH?.trim() || "data/hardware-executions.sqlite");
  const lockPath = path.resolve(root, process.env.HARDWARE_LOCK_PATH?.trim() || "data/agent.lock");
  const logDir = path.resolve(root, process.env.HARDWARE_LOG_DIR?.trim() || "logs");
  let disk = null;
  try {
    const info = fs.statfsSync(root);
    disk = { blockSize: info.bsize, totalBytes: info.blocks * info.bsize, freeBytes: info.bavail * info.bsize };
  } catch {}
  return {
    generatedAt: new Date().toISOString(),
    package: { name: packageJson.name, version: packageJson.version, nodeRequirement: packageJson.engines?.node },
    runtime: { node: process.version, platform: process.platform, arch: process.arch, hostname: os.hostname(), username: os.userInfo().username, release: os.release(), uptimeSeconds: os.uptime() },
    health: readJson(healthPath),
    files: { health: statSafe(healthPath), journal: statSafe(journalPath), lock: statSafe(lockPath), logDirectory: logDir },
    disk,
    documentPrinting: {
      executable: statSafe(
        process.env.PDF_PRINT_EXECUTABLE?.trim() ||
          "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
      ),
      configuredPrinter: process.env.DOCUMENT_PRINTER_NAME?.trim() || null,
      profiles: Object.values(DOCUMENT_PRINT_PROFILES).map((profile) => ({
        id: profile.id,
        documentProfileId: profile.documentProfileId,
        paper: profile.paper,
        orientation: profile.orientation,
        engine: profile.engine,
        printSettings: profile.printSettings,
      })),
    },
    config,
    exclusions: [".env raw file", "agent secret", "lease tokens", "SQLite journal content", "journal encryption key", "print artifacts"],
  };
}

function writeOutputDirectory(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const diagnostics = collectDiagnostics();
  fs.writeFileSync(path.join(outputDir, "diagnostics.json"), `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
  const configLines = Object.entries(diagnostics.config).map(([key, value]) => `${key}=${value}`);
  fs.writeFileSync(path.join(outputDir, "config-redacted.txt"), `${configLines.join("\n")}\n`, "utf8");
  return diagnostics;
}

if (require.main === module) {
  const outputIndex = process.argv.indexOf("--output-dir");
  if (outputIndex >= 0 && process.argv[outputIndex + 1]) {
    const outputDir = path.resolve(process.argv[outputIndex + 1]);
    writeOutputDirectory(outputDir);
    console.log(outputDir);
  } else {
    console.log(JSON.stringify(collectDiagnostics(), null, 2));
  }
}

module.exports = { collectDiagnostics, parseEnv, redactConfig, writeOutputDirectory };
