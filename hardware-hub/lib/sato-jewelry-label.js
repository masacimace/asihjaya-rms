/* eslint-disable */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SATO_JEWELRY_LABEL_TEMPLATE_ID = "jewelry_barbell_host_bold_v2";
const SATO_JEWELRY_RENDERER = "host_bold_bmp_v2";
const SATO_JEWELRY_LABEL_PROFILE_ID = "sato_cg408_jewelry_barbell_host_bold_v2";
const DEFAULT_SATO_LABEL_CONFIG_PATH = path.resolve(
  __dirname,
  "..",
  "config",
  "sato-jewelry-barbell-host-bold.json",
);

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

function validateHostBoldConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new SatoJewelryLabelError(
      "SATO label config wajib JSON object.",
      "SATO_LABEL_CONFIG_INVALID",
      "configuration",
    );
  }
  if (config.version !== 2) {
    throw new SatoJewelryLabelError(
      `SATO label config version harus 2; aktual=${config.version ?? "-"}.`,
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
  if (config.font?.style !== "Bold" || !sanitizeAscii(config.font?.family)) {
    throw new SatoJewelryLabelError(
      "SATO host-bold config membutuhkan font family dan style Bold.",
      "SATO_LABEL_FONT_CONFIG_INVALID",
      "configuration",
    );
  }
  validateInteger(config.font.inkSpreadPx, "font.inkSpreadPx", 0, 2);

  for (const [name, item] of [
    ["front.productName", config.front?.productName],
    ["front.barcodeText", config.front?.barcodeText],
  ]) {
    if (!item) throw new SatoJewelryLabelError(`${name} wajib tersedia.`, "SATO_LABEL_CONFIG_INVALID", "configuration");
    validateInteger(item.x, `${name}.x`);
    validateInteger(item.y, `${name}.y`);
    validateInteger(item.canvasWidthDots, `${name}.canvasWidthDots`, 8, 999);
    validateInteger(item.canvasHeightDots, `${name}.canvasHeightDots`, 8, 999);
    validateInteger(item.fontPx, `${name}.fontPx`, 4, 200);
  }
  validateInteger(config.front.productName.maxChars, "front.productName.maxChars", 1, 200);

  const barcode = config.front?.barcode;
  if (!barcode || barcode.strategy !== "CODE128_B") {
    throw new SatoJewelryLabelError(
      "SATO barcode production wajib memakai CODE128_B.",
      "SATO_LABEL_BARCODE_CONFIG_INVALID",
      "configuration",
    );
  }
  validateInteger(barcode.x, "front.barcode.x");
  validateInteger(barcode.y, "front.barcode.y");
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
  for (const [name, item] of [["weight", back.weight], ["purity", back.purity]]) {
    if (!item) throw new SatoJewelryLabelError(`back.${name} wajib tersedia.`, "SATO_LABEL_CONFIG_INVALID", "configuration");
    for (const key of ["x", "y", "widthDots", "heightDots", "fontPx"]) {
      validateInteger(item[key], `back.${name}.${key}`, key === "fontPx" ? 4 : 0, key === "fontPx" ? 200 : 9999);
    }
    if (item.textAlign !== "center") {
      throw new SatoJewelryLabelError(`back.${name}.textAlign wajib center.`, "SATO_LABEL_CONFIG_INVALID", "configuration");
    }
  }
  if (typeof back.purity.prefix !== "string") {
    throw new SatoJewelryLabelError("back.purity.prefix wajib string.", "SATO_LABEL_CONFIG_INVALID", "configuration");
  }
  return config;
}

function loadSatoJewelryLabelConfig(configPath = DEFAULT_SATO_LABEL_CONFIG_PATH) {
  const resolved = path.resolve(configPath || DEFAULT_SATO_LABEL_CONFIG_PATH);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
  } catch (error) {
    throw new SatoJewelryLabelError(
      `SATO label config tidak dapat dibaca (${resolved}): ${error.message}`,
      "SATO_LABEL_CONFIG_READ_FAILED",
      "configuration",
    );
  }
  validateHostBoldConfig(parsed);
  return { path: resolved, config: parsed };
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
  if (requestedTemplateId !== SATO_JEWELRY_LABEL_TEMPLATE_ID || payload?.templateVersion !== 2) {
    throw new SatoJewelryLabelError(
      `Template label ingress wajib ${SATO_JEWELRY_LABEL_TEMPLATE_ID} v2.`,
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
  const productName = sanitizeAscii(merged.productName ?? merged.name, "PRODUK", 220).toUpperCase();
  const weight = formatDecimal(merged.weightGram);
  if (!weight || Number(weight) <= 0) {
    throw new SatoJewelryLabelError("Label jewelry membutuhkan weightGram positif.", "SATO_LABEL_WEIGHT_REQUIRED");
  }
  const karat = formatKaratFromPurityPercent(merged.purityPercent ?? merged.purity);
  const exchangePurity = formatDecimal(merged.exchangePurityPercent, 2);
  if (!karat || !exchangePurity) {
    throw new SatoJewelryLabelError(
      "Label jewelry membutuhkan purityPercent dan exchangePurityPercent yang valid.",
      "SATO_LABEL_PURITY_REQUIRED",
    );
  }
  const resolvedCopies = Math.max(1, Math.min(20, Math.round(Number(payload?.copies ?? copies) || 1)));
  const renderInput = {
    productName,
    barcode,
    weight: `${weight}Gr`,
    purity: `${karat}-${exchangePurity}%`,
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
    barcode: {
      symbology: "CODE128",
      strategy: loaded.config.front.barcode.strategy,
      narrowBarDots: loaded.config.front.barcode.narrowBarDots,
      heightDots: loaded.config.front.barcode.heightDots,
    },
    physicalValidation: "accepted",
  };
  const template = { id: SATO_JEWELRY_LABEL_TEMPLATE_ID, version: 2, renderer: SATO_JEWELRY_RENDERER };
  const fakeCommand = Buffer.from(
    `FAKE ${template.id}\n${JSON.stringify({ renderInput, profileId: profile.id })}\n`,
    "utf8",
  );
  return {
    config: loaded.config,
    configPath: loaded.path,
    renderInput,
    label: {
      productNamePrinted: productName.slice(0, loaded.config.front.productName.maxChars),
      barcode,
      weightPrinted: renderInput.weight,
      purityPrinted: renderInput.purity,
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
  SatoJewelryLabelError,
  validateHostBoldConfig,
  loadSatoJewelryLabelConfig,
  prepareSatoJewelryLabel,
  formatKaratFromPurityPercent,
};
