/* eslint-disable */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SATO_JEWELRY_LABEL_TEMPLATE_ID = "jewelry_barbell_inter_v3";
const SATO_JEWELRY_RENDERER = "host_inter_bmp_v3";
const SATO_JEWELRY_LABEL_PROFILE_ID = "sato_cg408_jewelry_barbell_inter_v3";
const DEFAULT_SATO_LABEL_CONFIG_PATH = path.resolve(
  __dirname,
  "..",
  "config",
  "sato-jewelry-barbell-host-bold.json",
);
const SATO_JEWELRY_LABEL_LOCK_FILENAME = "sato-jewelry-barbell-inter-v3.lock.json";

class SatoJewelryLabelError extends Error {
  constructor(message, code = "SATO_JEWELRY_LABEL_INVALID", category = "validation") {
    super(message);
    this.name = "SatoJewelryLabelError";
    this.code = code;
    this.retrySafe = false;
    this.category = category;
  }
}

function sanitizeAscii(value, fallback = "", maxLength = 220) {
  const text = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/[\x1B]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (text || fallback).slice(0, maxLength);
}

function normalizeBarcode(value) {
  const barcode = sanitizeAscii(value, "", 40).toUpperCase();
  if (!/^[0-9A-Z .$/+%-]{1,40}$/.test(barcode)) {
    throw new SatoJewelryLabelError(
      "Barcode SATO wajib 1-40 karakter uppercase (0-9, A-Z, spasi, . $ / + % -).",
      "SATO_BARCODE_INVALID",
    );
  }
  return barcode;
}

function parseDecimal(value) {
  const normalized = String(value ?? "").trim().replace(/,/g, ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDecimal(value, maxFractionDigits = 3) {
  const number = parseDecimal(value);
  if (number === null) return null;
  return number.toFixed(maxFractionDigits).replace(/\.?0+$/, "");
}

function formatKaratFromPurityPercent(value) {
  const purity = parseDecimal(value);
  if (purity === null || purity <= 0 || purity > 100) return null;
  return `${Math.max(1, Math.min(24, Math.round((purity * 24) / 100)))}K`;
}

function validateInteger(value, name, min = 0, max = 9999) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new SatoJewelryLabelError(
      `${name} harus integer antara ${min} dan ${max}.`,
      "SATO_LABEL_CONFIG_INVALID",
      "configuration",
    );
  }
}

function validateTextLayer(item, name, { allowMaxChars = false } = {}) {
  if (!item) {
    throw new SatoJewelryLabelError(`${name} wajib tersedia.`, "SATO_LABEL_CONFIG_INVALID", "configuration");
  }
  for (const key of ["x", "y"]) validateInteger(item[key], `${name}.${key}`);
  const widthKey = "canvasWidthDots" in item ? "canvasWidthDots" : "widthDots";
  const heightKey = "canvasHeightDots" in item ? "canvasHeightDots" : "heightDots";
  validateInteger(item[widthKey], `${name}.${widthKey}`, 8, 9999);
  validateInteger(item[heightKey], `${name}.${heightKey}`, 8, 9999);
  validateInteger(item.fontPx, `${name}.fontPx`, 4, 200);
  validateInteger(item.minFontPx, `${name}.minFontPx`, 4, item.fontPx);
  if (!['left', 'center', 'right'].includes(item.textAlign)) {
    throw new SatoJewelryLabelError(`${name}.textAlign tidak valid.`, "SATO_LABEL_CONFIG_INVALID", "configuration");
  }
  if (allowMaxChars) validateInteger(item.maxChars, `${name}.maxChars`, 1, 220);
}

function validateHostBoldConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new SatoJewelryLabelError(
      "SATO label config wajib JSON object.",
      "SATO_LABEL_CONFIG_INVALID",
      "configuration",
    );
  }
  if (config.version !== 3) {
    throw new SatoJewelryLabelError(
      `SATO label config version harus 3; aktual=${config.version ?? "-"}.`,
      "SATO_LABEL_CONFIG_VERSION_UNSUPPORTED",
      "configuration",
    );
  }
  if (config.id !== SATO_JEWELRY_LABEL_PROFILE_ID) {
    throw new SatoJewelryLabelError(
      `SATO label config id tidak dikenal: ${config.id || "-"}.`,
      "SATO_LABEL_CONFIG_ID_UNSUPPORTED",
      "configuration",
    );
  }
  if (!sanitizeAscii(config.font?.family) || !["Regular", "Bold"].includes(config.font?.style)) {
    throw new SatoJewelryLabelError(
      "SATO Inter v3 membutuhkan font family dan style Regular/Bold.",
      "SATO_LABEL_FONT_CONFIG_INVALID",
      "configuration",
    );
  }
  if (typeof config.font.filePathEnv !== "string" || !config.font.filePathEnv.trim()) {
    throw new SatoJewelryLabelError(
      "SATO Inter v3 membutuhkan font.filePathEnv.",
      "SATO_LABEL_FONT_CONFIG_INVALID",
      "configuration",
    );
  }
  validateInteger(config.font.inkSpreadPx, "font.inkSpreadPx", 0, 2);
  if (config.physicalValidation !== "accepted") {
    throw new SatoJewelryLabelError(
      "SATO label v3 belum di-freeze sebagai client-approved (physicalValidation wajib accepted). Jalankan npm run label:freeze-v3.",
      "SATO_LABEL_NOT_FROZEN",
      "configuration",
    );
  }

  validateTextLayer(config.front?.productMasterName, "front.productMasterName", { allowMaxChars: true });
  validateTextLayer(config.front?.barcodeText, "front.barcodeText");

  const barcode = config.front?.barcode;
  if (!barcode || barcode.strategy !== "CODE128_B") {
    throw new SatoJewelryLabelError(
      "SATO barcode production wajib memakai CODE128_B.",
      "SATO_LABEL_BARCODE_CONFIG_INVALID",
      "configuration",
    );
  }
  validateInteger(barcode.y, "front.barcode.y");
  if (barcode.centerWithinFront !== true) {
    throw new SatoJewelryLabelError("front.barcode.centerWithinFront wajib true.", "SATO_LABEL_BARCODE_CONFIG_INVALID", "configuration");
  }
  validateInteger(barcode.heightDots, "front.barcode.heightDots", 1, 999);
  validateInteger(barcode.narrowBarDots, "front.barcode.narrowBarDots", 1, 12);
  validateInteger(barcode.quietZoneModules, "front.barcode.quietZoneModules", 0, 100);

  const back = config.back;
  if (!back || back.rotation !== 180) {
    throw new SatoJewelryLabelError(
      "SATO back panel production wajib rotation=180.",
      "SATO_LABEL_BACK_CONFIG_INVALID",
      "configuration",
    );
  }
  for (const key of ["x", "y", "canvasWidthDots", "canvasHeightDots", "rotation"]) {
    validateInteger(back[key], `back.${key}`, 0, key === "rotation" ? 359 : 9999);
  }
  validateTextLayer(back.weight, "back.weight");
  validateTextLayer(back.itemDisplayName, "back.itemDisplayName", { allowMaxChars: true });
  validateInteger(back.itemDisplayName.maxLines, "back.itemDisplayName.maxLines", 1, 3);
  if (typeof back.itemDisplayName.truncateWithEllipsis !== "boolean") {
    throw new SatoJewelryLabelError("back.itemDisplayName.truncateWithEllipsis wajib boolean.", "SATO_LABEL_CONFIG_INVALID", "configuration");
  }
  return config;
}

function loadSatoJewelryLabelConfig(configPath = DEFAULT_SATO_LABEL_CONFIG_PATH) {
  const resolved = path.resolve(configPath || DEFAULT_SATO_LABEL_CONFIG_PATH);
  let bytes;
  let parsed;
  try {
    bytes = fs.readFileSync(resolved);
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new SatoJewelryLabelError(
      `SATO label config tidak dapat dibaca (${resolved}): ${error.message}`,
      "SATO_LABEL_CONFIG_READ_FAILED",
      "configuration",
    );
  }
  validateHostBoldConfig(parsed);

  const lockPath = path.join(path.dirname(resolved), SATO_JEWELRY_LABEL_LOCK_FILENAME);
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (error) {
    throw new SatoJewelryLabelError(
      `SATO label v3 freeze lock tidak dapat dibaca (${lockPath}): ${error.message}. Jalankan npm run label:freeze-v3.`,
      "SATO_LABEL_FREEZE_LOCK_MISSING",
      "configuration",
    );
  }

  const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (lock.schemaVersion !== 1 ||
      lock.templateId !== SATO_JEWELRY_LABEL_TEMPLATE_ID ||
      lock.templateVersion !== 3 ||
      lock.printerProfileId !== SATO_JEWELRY_LABEL_PROFILE_ID ||
      lock.renderer !== SATO_JEWELRY_RENDERER ||
      lock.physicalValidation !== "accepted" ||
      lock.configFile !== path.basename(resolved) ||
      lock.configSha256 !== actualHash) {
    throw new SatoJewelryLabelError(
      "SATO Label V3 freeze lock tidak cocok dengan config aktif. Layout final tidak boleh berubah tanpa acceptance/freeze baru.",
      "SATO_LABEL_FREEZE_LOCK_MISMATCH",
      "configuration",
    );
  }

  return { path: resolved, config: parsed, lockPath, lock };
}

function prepareSatoJewelryLabel(payload, { copies = 1, configPath } = {}) {
  const loaded = loadSatoJewelryLabelConfig(configPath);
  const fields = payload?.fields && typeof payload.fields === "object" ? payload.fields : {};
  const merged = { ...(payload || {}), ...fields };
  const requestedTemplateId = sanitizeAscii(payload?.templateId, "", 80);
  const requestedProfileId = sanitizeAscii(payload?.printerProfileId, "", 120);
  if (payload?.schemaVersion !== 1) {
    throw new SatoJewelryLabelError("Label ingress schemaVersion harus 1.", "SATO_INGRESS_SCHEMA_UNSUPPORTED");
  }
  if (requestedTemplateId !== SATO_JEWELRY_LABEL_TEMPLATE_ID || payload?.templateVersion !== 3) {
    throw new SatoJewelryLabelError(
      `Template label ingress wajib ${SATO_JEWELRY_LABEL_TEMPLATE_ID} v3.`,
      "SATO_INGRESS_TEMPLATE_UNSUPPORTED",
    );
  }
  if (requestedProfileId !== SATO_JEWELRY_LABEL_PROFILE_ID) {
    throw new SatoJewelryLabelError(
      `Printer profile ingress wajib ${SATO_JEWELRY_LABEL_PROFILE_ID}.`,
      "SATO_INGRESS_PROFILE_UNSUPPORTED",
    );
  }

  const barcode = normalizeBarcode(merged.barcode);
  const masterProductName = sanitizeAscii(merged.masterProductName, "PRODUK", 220).toUpperCase();
  const itemDisplayName = sanitizeAscii(merged.itemDisplayName, masterProductName, 220).toUpperCase();
  const weight = formatDecimal(merged.weightGram);
  if (!weight || Number(weight) <= 0) {
    throw new SatoJewelryLabelError("Label jewelry membutuhkan weightGram positif.", "SATO_LABEL_WEIGHT_REQUIRED");
  }
  const resolvedCopies = Math.max(1, Math.min(20, Math.round(Number(payload?.copies ?? copies) || 1)));
  const renderInput = {
    masterProductName,
    itemDisplayName,
    barcode,
    weight: `${weight} Gr`,
    copies: resolvedCopies,
  };
  const profile = {
    id: loaded.config.id,
    manufacturer: "SATO",
    model: "CG408",
    dpi: 203,
    language: "SBPL",
    renderer: SATO_JEWELRY_RENDERER,
    configVersion: loaded.config.version,
    configPath: loaded.path,
    font: {
      family: loaded.config.font.family,
      style: loaded.config.font.style,
      filePathEnv: loaded.config.font.filePathEnv,
    },
    barcode: {
      symbology: "CODE128",
      strategy: loaded.config.front.barcode.strategy,
      narrowBarDots: loaded.config.front.barcode.narrowBarDots,
      heightDots: loaded.config.front.barcode.heightDots,
    },
    physicalValidation: loaded.config.physicalValidation,
  };
  const template = { id: SATO_JEWELRY_LABEL_TEMPLATE_ID, version: 3, renderer: SATO_JEWELRY_RENDERER };
  const fakeCommand = Buffer.from(
    `FAKE ${template.id}\n${JSON.stringify({ renderInput, profileId: profile.id })}\n`,
    "utf8",
  );
  return {
    config: loaded.config,
    configPath: loaded.path,
    renderInput,
    label: {
      masterProductNamePrinted: masterProductName,
      itemDisplayNamePrinted: itemDisplayName,
      barcode,
      weightPrinted: renderInput.weight,
      templateId: requestedTemplateId,
      printerProfileId: requestedProfileId,
    },
    copies: resolvedCopies,
    profile,
    template,
    fakeCommand,
    fakeCommandSha256: crypto.createHash("sha256").update(fakeCommand).digest("hex"),
  };
}

module.exports = {
  SATO_JEWELRY_LABEL_TEMPLATE_ID,
  SATO_JEWELRY_RENDERER,
  SATO_JEWELRY_LABEL_PROFILE_ID,
  DEFAULT_SATO_LABEL_CONFIG_PATH,
  SATO_JEWELRY_LABEL_LOCK_FILENAME,
  SatoJewelryLabelError,
  validateHostBoldConfig,
  loadSatoJewelryLabelConfig,
  prepareSatoJewelryLabel,
  formatKaratFromPurityPercent,
};
