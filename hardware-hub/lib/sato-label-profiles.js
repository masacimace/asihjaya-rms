
const SATO_LABEL_TEMPLATE_JEWELRY_COMPACT_V1 = "jewelry_compact_v1";
const SATO_LABEL_TEMPLATE_LEGACY_JEWELRY_COMPACT = "jewelry_compact";
const SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1 = "sato_cg408tt_jewelry_v1";

const SATO_LABEL_TEMPLATES = Object.freeze({
  [SATO_LABEL_TEMPLATE_JEWELRY_COMPACT_V1]: Object.freeze({
    id: SATO_LABEL_TEMPLATE_JEWELRY_COMPACT_V1,
    version: 1,
    legacyAliases: Object.freeze([SATO_LABEL_TEMPLATE_LEGACY_JEWELRY_COMPACT]),
    compatiblePrinterProfiles: Object.freeze([
      SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1,
    ]),
    productName: Object.freeze({ maxChars: 26, maxLines: 2 }),
    layout: Object.freeze({
      productLine1: Object.freeze({ x: 30, y: 18, size: "XM" }),
      productLine2: Object.freeze({ x: 30, y: 50, size: "XS" }),
      specs: Object.freeze({ x: 30, y: 82, size: "XS" }),
      attributes: Object.freeze({ x: 30, y: 112, size: "XS" }),
      price: Object.freeze({ x: 30, y: 142, size: "XS" }),
      barcodeWithoutPrice: Object.freeze({ x: 30, y: 150 }),
      barcodeWithPrice: Object.freeze({ x: 30, y: 174 }),
      skuWithoutPrice: Object.freeze({ x: 30, y: 228, size: "XS" }),
      skuWithPrice: Object.freeze({ x: 30, y: 252, size: "XS" }),
    }),
  }),
});

const SATO_PRINTER_PROFILES = Object.freeze({
  [SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1]: Object.freeze({
    id: SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1,
    manufacturer: "SATO",
    model: "CG408TT",
    language: "SBPL",
    dpi: 203,
    media: Object.freeze({
      widthDots: 400,
      heightDots: 300,
      widthMm: 50,
      heightMm: 37.5,
      sensor: "gap",
      physicalValidation: "pending",
    }),
    barcode: Object.freeze({
      symbology: "CODE39",
      command: "B102060",
      allowedPattern: "^[0-9A-Z .$/+%-]{1,40}$",
      maxLength: 40,
    }),
    defaults: Object.freeze({
      horizontalOffsetDots: 0,
      verticalOffsetDots: 0,
      includePrice: false,
      copies: 1,
      printSpeed: null,
      darkness: null,
    }),
    tuning: Object.freeze({
      horizontalOffsetRange: Object.freeze([-200, 200]),
      verticalOffsetRange: Object.freeze([-200, 200]),
      printSpeedRange: Object.freeze([1, 5]),
      darknessRange: Object.freeze([1, 5]),
      speedCommandEmitted: false,
      darknessCommandEmitted: false,
      physicalValidation: "pending",
    }),
  }),
});

function normalizeTemplateId(value) {
  const templateId = String(value || "").trim();
  if (!templateId || templateId === SATO_LABEL_TEMPLATE_LEGACY_JEWELRY_COMPACT) {
    return SATO_LABEL_TEMPLATE_JEWELRY_COMPACT_V1;
  }
  return templateId;
}

function resolveSatoLabelTemplate(value) {
  const id = normalizeTemplateId(value);
  const template = SATO_LABEL_TEMPLATES[id];
  if (!template) {
    const error = new Error(`Template label SATO tidak dikenal: ${id || "-"}.`);
    error.code = "UNKNOWN_LABEL_TEMPLATE";
    error.retrySafe = false;
    error.category = "validation";
    throw error;
  }
  return template;
}

function resolveSatoPrinterProfile(value) {
  const id = String(value || SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1).trim();
  const profile = SATO_PRINTER_PROFILES[id];
  if (!profile) {
    const error = new Error(`Printer profile SATO tidak dikenal: ${id || "-"}.`);
    error.code = "UNKNOWN_SATO_PRINTER_PROFILE";
    error.retrySafe = false;
    error.category = "configuration";
    throw error;
  }
  return profile;
}

function validateIntegerRange(value, [minimum, maximum], fieldName) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    const error = new Error(`${fieldName} harus integer antara ${minimum} dan ${maximum}.`);
    error.code = "INVALID_SATO_PROFILE_OVERRIDE";
    error.retrySafe = false;
    error.category = "configuration";
    throw error;
  }
  return value;
}

function hasNumericValue(value) {
  return value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value));
}

function resolveSatoProfileConfiguration({
  printerProfileId,
  horizontalOffsetDots,
  verticalOffsetDots,
  includePrice,
  copies,
  printSpeed,
  darkness,
  mediaWidthDots,
  mediaHeightDots,
} = {}) {
  const profile = resolveSatoPrinterProfile(printerProfileId);
  const resolved = {
    profile,
    horizontalOffsetDots: validateIntegerRange(
      hasNumericValue(horizontalOffsetDots)
        ? Math.round(Number(horizontalOffsetDots))
        : profile.defaults.horizontalOffsetDots,
      profile.tuning.horizontalOffsetRange,
      "SATO horizontal offset",
    ),
    verticalOffsetDots: validateIntegerRange(
      hasNumericValue(verticalOffsetDots)
        ? Math.round(Number(verticalOffsetDots))
        : profile.defaults.verticalOffsetDots,
      profile.tuning.verticalOffsetRange,
      "SATO vertical offset",
    ),
    includePrice:
      includePrice === undefined ? profile.defaults.includePrice : Boolean(includePrice),
    copies: validateIntegerRange(
      hasNumericValue(copies) ? Math.round(Number(copies)) : profile.defaults.copies,
      [1, 20],
      "SATO copies",
    ),
    printSpeed:
      printSpeed === undefined || printSpeed === null || printSpeed === ""
        ? profile.defaults.printSpeed
        : validateIntegerRange(
            Math.round(Number(printSpeed)),
            profile.tuning.printSpeedRange,
            "SATO print speed",
          ),
    darkness:
      darkness === undefined || darkness === null || darkness === ""
        ? profile.defaults.darkness
        : validateIntegerRange(
            Math.round(Number(darkness)),
            profile.tuning.darknessRange,
            "SATO darkness",
          ),
    mediaWidthDots: validateIntegerRange(
      hasNumericValue(mediaWidthDots)
        ? Math.round(Number(mediaWidthDots))
        : profile.media.widthDots,
      [200, 832],
      "SATO media width dots",
    ),
    mediaHeightDots: validateIntegerRange(
      hasNumericValue(mediaHeightDots)
        ? Math.round(Number(mediaHeightDots))
        : profile.media.heightDots,
      [120, 2400],
      "SATO media height dots",
    ),
  };
  return Object.freeze(resolved);
}

module.exports = {
  SATO_LABEL_TEMPLATE_JEWELRY_COMPACT_V1,
  SATO_LABEL_TEMPLATE_LEGACY_JEWELRY_COMPACT,
  SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1,
  SATO_LABEL_TEMPLATES,
  SATO_PRINTER_PROFILES,
  normalizeTemplateId,
  resolveSatoLabelTemplate,
  resolveSatoPrinterProfile,
  resolveSatoProfileConfiguration,
};
