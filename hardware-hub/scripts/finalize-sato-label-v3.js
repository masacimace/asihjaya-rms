/* eslint-disable */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

function readLocalEnvValue(name) {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return "";
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    if (line.slice(0, eq).trim() !== name) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return "";
}

const TEMPLATE_ID = "jewelry_barbell_inter_v3";
const PROFILE_ID = "sato_cg408_jewelry_barbell_inter_v3";
const RENDERER = "host_inter_bmp_v3";
const DEFAULT_CONFIG = path.join(root, "config", "sato-jewelry-barbell-host-bold.json");
const LOCK_FILENAME = "sato-jewelry-barbell-inter-v3.lock.json";
const allowRefreeze = process.argv.includes("--refreeze");

function fail(message) {
  throw new Error(message);
}

function resolveConfigPath() {
  const configured = String(process.env.SATO_LABEL_CONFIG_PATH || readLocalEnvValue("SATO_LABEL_CONFIG_PATH") || "").trim();
  if (!configured) return DEFAULT_CONFIG;
  return path.isAbsolute(configured) ? configured : path.resolve(root, configured);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertFinalStructure(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) fail("Config SATO wajib JSON object.");
  if (config.version !== 3) fail(`Config SATO final wajib version=3; aktual=${config.version ?? "-"}.`);
  if (config.id !== PROFILE_ID) fail(`Config SATO final wajib id=${PROFILE_ID}; aktual=${config.id ?? "-"}.`);
  if (config.font?.family !== "Inter") fail("Config SATO final wajib menggunakan family Inter.");
  if (!config.front?.productMasterName || !config.front?.barcode || !config.front?.barcodeText) {
    fail("Front final wajib memiliki productMasterName, barcode, dan barcodeText.");
  }
  if (config.front.barcode.strategy !== "CODE128_B") fail("Barcode final wajib CODE128_B.");
  if (!config.back?.weight || !config.back?.itemDisplayName) {
    fail("Back final wajib memiliki weight dan itemDisplayName.");
  }
  if (Object.hasOwn(config.back, "purity")) {
    fail("Config final tidak boleh memiliki layer purity pada back label.");
  }
}

const configPath = resolveConfigPath();
if (!fs.existsSync(configPath)) fail(`Config SATO tidak ditemukan: ${configPath}`);

const originalText = fs.readFileSync(configPath, "utf8");
let config;
try {
  config = JSON.parse(originalText);
} catch (error) {
  fail(`Config SATO bukan JSON valid: ${error.message}`);
}

assertFinalStructure(config);
const lockPath = path.join(path.dirname(configPath), LOCK_FILENAME);

if (config.physicalValidation === "accepted" && fs.existsSync(lockPath)) {
  let existingLock;
  try {
    existingLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (error) {
    fail(`Freeze lock existing tidak valid: ${error.message}`);
  }
  const currentHash = sha256(Buffer.from(originalText, "utf8"));
  if (existingLock.configSha256 === currentHash) {
    console.log("SATO Label V3 already frozen; config hash is unchanged.");
    console.log(`Config : ${configPath}`);
    console.log(`Lock   : ${lockPath}`);
    console.log(`SHA256 : ${currentHash}`);
    process.exit(0);
  }
  if (!allowRefreeze) {
    fail(
      "Config SATO sudah pernah di-freeze tetapi bytes/layout sekarang berubah. " +
        "Jangan mengubah lock secara tidak sengaja. Jika perubahan visual memang sudah di-approve ulang, jalankan label:freeze-v3 dengan -- --refreeze.",
    );
  }
}

config.physicalValidation = "accepted";

// Preserve every tuned layout value; only physicalValidation is finalized.
const finalText = `${JSON.stringify(config, null, 2)}\n`;
fs.writeFileSync(configPath, finalText, "utf8");

const finalBytes = fs.readFileSync(configPath);
const lock = {
  schemaVersion: 1,
  templateId: TEMPLATE_ID,
  templateVersion: 3,
  printerProfileId: PROFILE_ID,
  renderer: RENDERER,
  physicalValidation: "accepted",
  media: { widthMm: 80, heightMm: 24 },
  barcode: { symbology: "CODE128", strategy: "CODE128_B" },
  frontContent: ["productMasterName", "barcode", "barcodeNumber"],
  backContent: ["weight", "itemDisplayName"],
  configFile: path.basename(configPath),
  configSha256: sha256(finalBytes),
  frozenAt: new Date().toISOString(),
  note: "Client-approved physical SATO label v3. Any layout change requires an explicit new acceptance/freeze.",
};
fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");

console.log("SATO Label V3 finalized and frozen.");
console.log(`Config : ${configPath}`);
console.log(`Lock   : ${lockPath}`);
console.log(`SHA256 : ${lock.configSha256}`);
console.log("Visual/layout values were preserved; only physicalValidation was changed to accepted.");
console.log("Future layout changes require explicit: npm run label:freeze-v3 -- --refreeze");
