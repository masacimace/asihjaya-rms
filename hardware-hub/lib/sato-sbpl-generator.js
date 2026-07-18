/* eslint-disable */
const crypto = require("crypto");
const {
  SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1,
  resolveSatoLabelTemplate,
  resolveSatoProfileConfiguration,
} = require("./sato-label-profiles");

const ESC = "\x1B";
const BARCODE_PATTERN = /^[0-9A-Z .$/+%-]{1,40}$/;

function createSatoError(message, code, category = "validation") {
  const error = new Error(message);
  error.name = "SatoLabelError";
  error.code = code;
  error.retrySafe = false;
  error.category = category;
  return error;
}

function normalizeForPrinter(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeText(value, fallback = "-", maxLength = 64) {
  const text = normalizeForPrinter(value)
    .replace(/[\x1B]/g, "")
    .replace(/[<>]/g, "");
  return (text || fallback).slice(0, maxLength);
}

function sanitizeSku(value, fallback = "-") {
  const text = normalizeForPrinter(value)
    .replace(/[^a-zA-Z0-9._/-]/g, "")
    .trim();
  return (text || fallback).slice(0, 80);
}

function normalizeBarcode(value) {
  const barcode = normalizeForPrinter(value);
  if (!BARCODE_PATTERN.test(barcode)) {
    throw createSatoError(
      "Barcode label wajib 1-40 karakter CODE39 uppercase (0-9, A-Z, spasi, . $ / + % -).",
      "SATO_BARCODE_INVALID",
    );
  }
  return barcode;
}

function sanitizeNumericText(value, fallback = "-") {
  const text = normalizeForPrinter(value)
    .replace(/[^0-9.,-]/g, "")
    .replace(/,/g, ".")
    .trim();
  if (!text) return fallback;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return text.slice(0, 16);
  return parsed.toFixed(3).replace(/\.?0+$/, "").slice(0, 16);
}

function groupThousands(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatMoneyForLabel(value) {
  const normalized = String(value ?? "").replace(/[^0-9-]/g, "");
  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return `Rp${groupThousands(amount)}`;
}

function wrapLabelText(value, maxChars, maxLines) {
  const words = sanitizeText(value, "Produk", 220).split(" ").filter(Boolean);
  const lines = [];
  for (const word of words) {
    const chunks = [];
    for (let index = 0; index < word.length; index += maxChars) {
      chunks.push(word.slice(index, index + maxChars));
    }
    for (const chunk of chunks) {
      const current = lines[lines.length - 1];
      if (!current) {
        lines.push(chunk);
      } else if (`${current} ${chunk}`.length <= maxChars) {
        lines[lines.length - 1] = `${current} ${chunk}`;
      } else if (lines.length < maxLines) {
        lines.push(chunk);
      }
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
  }
  return lines.slice(0, maxLines);
}

function formatDots(value, maximum, fieldName) {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded) || rounded < 0 || rounded > maximum || rounded > 9999) {
    throw createSatoError(
      `${fieldName} berada di luar area media (${rounded}; maksimum ${maximum}).`,
      "SATO_LAYOUT_OUT_OF_BOUNDS",
      "configuration",
    );
  }
  return String(rounded).padStart(4, "0");
}

function resolveCoordinate(base, offset, maximum, fieldName) {
  return formatDots(Number(base) + Number(offset || 0), maximum, fieldName);
}

function textCommand(configuration, { x, y, size = "XS", text }) {
  return (
    `${ESC}H${resolveCoordinate(x, configuration.horizontalOffsetDots, configuration.mediaWidthDots, "SATO X")}` +
    `${ESC}V${resolveCoordinate(y, configuration.verticalOffsetDots, configuration.mediaHeightDots, "SATO Y")}` +
    `${ESC}L0101${ESC}${size}${sanitizeText(text, "-")}`
  );
}

function barcodeCommand(configuration, { x, y, barcode }) {
  return (
    `${ESC}H${resolveCoordinate(x, configuration.horizontalOffsetDots, configuration.mediaWidthDots, "SATO barcode X")}` +
    `${ESC}V${resolveCoordinate(y, configuration.verticalOffsetDots, configuration.mediaHeightDots, "SATO barcode Y")}` +
    `${ESC}${configuration.profile.barcode.command}*${barcode}*`
  );
}

function normalizeLabelPayload(payload) {
  const fields = payload?.fields && typeof payload.fields === "object" ? payload.fields : {};
  const merged = { ...payload, ...fields };
  const barcode = normalizeBarcode(merged.barcode);
  const sku = sanitizeSku(merged.sku, barcode);
  return {
    barcode,
    sku,
    weightGram: sanitizeNumericText(merged.weightGram, "-"),
    exchangePurity: sanitizeNumericText(merged.exchangePurityPercent, "-"),
    purity: sanitizeNumericText(merged.purityPercent ?? merged.purity, "-"),
    productName: sanitizeText(merged.productName ?? merged.name, "Produk", 220),
    size: sanitizeText(merged.size, "", 24),
    gemstone: sanitizeText(merged.gemstone, "", 32),
    color: sanitizeText(merged.color, "", 24),
    price: formatMoneyForLabel(merged.sellingAmount ?? merged.price),
  };
}

function generateSatoSbpl(payload, options = {}) {
  const template = resolveSatoLabelTemplate(payload?.templateId);
  if (options.templateId) {
    const configuredTemplate = resolveSatoLabelTemplate(options.templateId);
    if (configuredTemplate.id !== template.id) {
      throw createSatoError(
        `Job meminta template ${template.id}, tetapi agent dikonfigurasi untuk ${configuredTemplate.id}.`,
        "SATO_TEMPLATE_NOT_CONFIGURED",
        "configuration",
      );
    }
  }
  if (payload?.templateVersion !== undefined && payload.templateVersion !== template.version) {
    throw createSatoError(
      `Template version ${payload.templateVersion} tidak cocok dengan ${template.id} v${template.version}.`,
      "SATO_TEMPLATE_VERSION_MISMATCH",
    );
  }

  const requestedPrinterProfileId =
    payload?.printerProfileId || options.printerProfileId || SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1;
  if (
    payload?.printerProfileId &&
    options.printerProfileId &&
    payload.printerProfileId !== options.printerProfileId
  ) {
    throw createSatoError(
      `Job meminta ${payload.printerProfileId}, tetapi agent dikonfigurasi untuk ${options.printerProfileId}.`,
      "SATO_PRINTER_PROFILE_MISMATCH",
      "configuration",
    );
  }
  if (!template.compatiblePrinterProfiles.includes(requestedPrinterProfileId)) {
    throw createSatoError(
      `Template ${template.id} tidak kompatibel dengan printer profile ${requestedPrinterProfileId}.`,
      "SATO_TEMPLATE_PROFILE_MISMATCH",
    );
  }

  const payloadCopies = payload?.copies;
  const configuration = resolveSatoProfileConfiguration({
    printerProfileId: requestedPrinterProfileId,
    horizontalOffsetDots: options.horizontalOffsetDots,
    verticalOffsetDots: options.verticalOffsetDots,
    includePrice: options.includePrice,
    copies: Number.isFinite(Number(payloadCopies)) ? Number(payloadCopies) : options.copies,
    printSpeed: options.printSpeed,
    darkness: options.darkness,
    mediaWidthDots: options.mediaWidthDots,
    mediaHeightDots: options.mediaHeightDots,
  });
  const label = normalizeLabelPayload(payload || {});
  const productLines = wrapLabelText(
    label.productName,
    template.productName.maxChars,
    template.productName.maxLines,
  );
  const specs = [
    label.weightGram !== "-" ? `BRT ${label.weightGram}g` : null,
    label.exchangePurity !== "-" ? `TUKAR ${label.exchangePurity}%` : null,
  ].filter(Boolean);
  const attributes = [
    label.size ? `UK ${label.size}` : null,
    label.color || null,
    label.gemstone || null,
  ]
    .filter(Boolean)
    .join(" · ");
  const layout = template.layout;
  const lines = [
    `${ESC}A`,
    textCommand(configuration, {
      ...layout.productLine1,
      text: productLines[0] || label.productName,
    }),
  ];
  if (productLines[1]) {
    lines.push(textCommand(configuration, { ...layout.productLine2, text: productLines[1] }));
  }
  lines.push(
    textCommand(configuration, {
      ...layout.specs,
      text: specs.join("  ") || label.sku,
    }),
  );
  if (attributes) {
    lines.push(textCommand(configuration, { ...layout.attributes, text: attributes }));
  }
  if (configuration.includePrice && label.price) {
    lines.push(textCommand(configuration, { ...layout.price, text: label.price }));
  }
  lines.push(
    barcodeCommand(configuration, {
      ...(configuration.includePrice && label.price
        ? layout.barcodeWithPrice
        : layout.barcodeWithoutPrice),
      barcode: label.barcode,
    }),
    textCommand(configuration, {
      ...(configuration.includePrice && label.price ? layout.skuWithPrice : layout.skuWithoutPrice),
      text: label.sku,
    }),
    `${ESC}Q${configuration.copies}`,
    `${ESC}Z`,
  );

  const command = lines.join("");
  const commandBuffer = Buffer.from(command, "latin1");
  return {
    command,
    commandBuffer,
    commandSha256: crypto.createHash("sha256").update(commandBuffer).digest("hex"),
    bytes: commandBuffer.length,
    copies: configuration.copies,
    label,
    template: {
      id: template.id,
      version: template.version,
    },
    printerProfile: {
      id: configuration.profile.id,
      manufacturer: configuration.profile.manufacturer,
      model: configuration.profile.model,
      language: configuration.profile.language,
      dpi: configuration.profile.dpi,
      media: {
        ...configuration.profile.media,
        widthDots: configuration.mediaWidthDots,
        heightDots: configuration.mediaHeightDots,
      },
      barcode: configuration.profile.barcode,
      horizontalOffsetDots: configuration.horizontalOffsetDots,
      verticalOffsetDots: configuration.verticalOffsetDots,
      includePrice: configuration.includePrice,
      printSpeed: configuration.printSpeed,
      darkness: configuration.darkness,
      speedCommandEmitted: configuration.profile.tuning.speedCommandEmitted,
      darknessCommandEmitted: configuration.profile.tuning.darknessCommandEmitted,
      physicalValidation: configuration.profile.tuning.physicalValidation,
    },
  };
}

module.exports = {
  BARCODE_PATTERN,
  createSatoError,
  normalizeForPrinter,
  normalizeBarcode,
  generateSatoSbpl,
};
