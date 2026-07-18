/* eslint-disable */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DOCUMENT_PRINT_PROFILES } = require("../lib/document-print-profiles");
const {
  SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1,
  SATO_PRINTER_PROFILES,
  resolveSatoProfileConfiguration,
} = require("../lib/sato-label-profiles");

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
    labelPrinting: (() => {
      const configuredProfileId =
        process.env.SATO_PRINTER_PROFILE?.trim() ||
        SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1;
      let resolved = null;
      try {
        resolved = resolveSatoProfileConfiguration({
          printerProfileId: configuredProfileId,
          horizontalOffsetDots:
            process.env.SATO_HORIZONTAL_OFFSET_DOTS ??
            process.env.LABEL_LEFT_OFFSET_DOTS,
          verticalOffsetDots:
            process.env.SATO_VERTICAL_OFFSET_DOTS ??
            process.env.LABEL_TOP_OFFSET_DOTS,
          includePrice:
            process.env.SATO_INCLUDE_PRICE !== undefined
              ? /^(1|true|yes|on)$/i.test(process.env.SATO_INCLUDE_PRICE)
              : /^(1|true|yes|on)$/i.test(process.env.LABEL_INCLUDE_PRICE || ""),
          copies: process.env.SATO_COPIES ?? process.env.LABEL_COPIES,
          printSpeed: process.env.SATO_PRINT_SPEED,
          darkness: process.env.SATO_DARKNESS,
          mediaWidthDots: process.env.SATO_MEDIA_WIDTH_DOTS,
          mediaHeightDots: process.env.SATO_MEDIA_HEIGHT_DOTS,
        });
      } catch {}
      return {
        configuredPrinter: process.env.LABEL_PRINTER_NAME?.trim() || null,
        configuredTemplate:
          process.env.LABEL_TEMPLATE_ID?.trim() ||
          process.env.LABEL_PROFILE?.trim() ||
          "jewelry_compact_v1",
        configuredProfileId,
        active: resolved
          ? {
              id: resolved.profile.id,
              manufacturer: resolved.profile.manufacturer,
              model: resolved.profile.model,
              language: resolved.profile.language,
              dpi: resolved.profile.dpi,
              mediaWidthDots: resolved.mediaWidthDots,
              mediaHeightDots: resolved.mediaHeightDots,
              horizontalOffsetDots: resolved.horizontalOffsetDots,
              verticalOffsetDots: resolved.verticalOffsetDots,
              includePrice: resolved.includePrice,
              printSpeed: resolved.printSpeed,
              darkness: resolved.darkness,
              physicalValidation: resolved.profile.tuning.physicalValidation,
              deviceControlCommands: {
                speed: resolved.profile.tuning.speedCommandEmitted,
                darkness: resolved.profile.tuning.darknessCommandEmitted,
              },
            }
          : null,
        availableProfiles: Object.keys(SATO_PRINTER_PROFILES),
      };
    })(),
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
