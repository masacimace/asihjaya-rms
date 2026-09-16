/* eslint-disable */
const crypto = require("crypto");

const SATO_LAYOUT_FINGERPRINT_ALGORITHM = "canonical-layout-sha256-v1";

function pickTextLayer(item, { includeMaxChars = false, includeTruncation = false } = {}) {
  const layer = {
    x: item.x,
    y: item.y,
    widthDots: item.widthDots,
    heightDots: item.heightDots,
    canvasWidthDots: item.canvasWidthDots,
    canvasHeightDots: item.canvasHeightDots,
    fontPx: item.fontPx,
    minFontPx: item.minFontPx,
    textAlign: item.textAlign,
  };

  if (includeMaxChars) {
    layer.maxChars = item.maxChars;
  }
  if (includeTruncation) {
    layer.truncateWithEllipsis = item.truncateWithEllipsis;
    layer.maxLines = item.maxLines;
  }

  return Object.fromEntries(
    Object.entries(layer).filter(([, value]) => value !== undefined),
  );
}

function buildSatoLayoutFingerprintPayload(config) {
  return {
    version: config.version,
    id: config.id,
    font: {
      family: config.font?.family,
      style: config.font?.style,
      filePathEnv: config.font?.filePathEnv,
      inkSpreadPx: config.font?.inkSpreadPx,
    },
    front: {
      productMasterName: pickTextLayer(config.front?.productMasterName || {}, {
        includeMaxChars: true,
      }),
      barcode: {
        y: config.front?.barcode?.y,
        heightDots: config.front?.barcode?.heightDots,
        narrowBarDots: config.front?.barcode?.narrowBarDots,
        quietZoneModules: config.front?.barcode?.quietZoneModules,
        strategy: config.front?.barcode?.strategy,
        centerWithinFront: config.front?.barcode?.centerWithinFront,
      },
      barcodeText: pickTextLayer(config.front?.barcodeText || {}),
    },
    back: {
      x: config.back?.x,
      y: config.back?.y,
      canvasWidthDots: config.back?.canvasWidthDots,
      canvasHeightDots: config.back?.canvasHeightDots,
      rotation: config.back?.rotation,
      weight: pickTextLayer(config.back?.weight || {}),
      itemDisplayName: pickTextLayer(config.back?.itemDisplayName || {}, {
        includeMaxChars: true,
        includeTruncation: true,
      }),
    },
    physicalValidation: config.physicalValidation,
  };
}

function computeSatoLayoutSha256(config) {
  const canonicalLayout = JSON.stringify(buildSatoLayoutFingerprintPayload(config));
  return crypto.createHash("sha256").update(canonicalLayout, "utf8").digest("hex");
}

module.exports = {
  SATO_LAYOUT_FINGERPRINT_ALGORITHM,
  buildSatoLayoutFingerprintPayload,
  computeSatoLayoutSha256,
};
