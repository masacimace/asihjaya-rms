/* eslint-disable */
const fs = require("fs");

const POINT_TOLERANCE = 3;
const MAX_PAGE_COUNT = 100;

function createValidationError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  error.retrySafe = false;
  return error;
}

function parseMediaBoxes(text) {
  const boxes = [];
  const pattern = /\/MediaBox\s*\[\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\]/g;
  for (const match of text.matchAll(pattern)) {
    const values = match.slice(1).map(Number);
    if (values.every(Number.isFinite)) {
      boxes.push({
        width: Math.abs(values[2] - values[0]),
        height: Math.abs(values[3] - values[1]),
      });
    }
  }
  return boxes;
}

function validatePdfBuffer(buffer, profile) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    throw createValidationError("Document PDF kosong atau terlalu kecil.", "PDF_INVALID_HEADER");
  }
  if (!buffer.subarray(0, 8).toString("ascii").startsWith("%PDF-")) {
    throw createValidationError("Document tidak memiliki header %PDF yang valid.", "PDF_INVALID_HEADER");
  }

  const text = buffer.toString("latin1");
  const pageCount = (text.match(/\/Type\s*\/Page\b/g) || []).length;
  if (pageCount < 1 || pageCount > MAX_PAGE_COUNT) {
    throw createValidationError(
      `Jumlah halaman PDF tidak valid: ${pageCount || 0}.`,
      "PDF_PAGE_COUNT_EXCEEDED",
    );
  }

  const mediaBoxes = parseMediaBoxes(text);
  if (mediaBoxes.length === 0) {
    throw createValidationError("MediaBox PDF tidak ditemukan.", "PDF_PAGE_SIZE_UNKNOWN");
  }

  const expected = profile.expectedPdfPoints;
  const mismatch = mediaBoxes.find(
    (box) =>
      Math.abs(box.width - expected.width) > POINT_TOLERANCE ||
      Math.abs(box.height - expected.height) > POINT_TOLERANCE,
  );
  if (mismatch) {
    throw createValidationError(
      `Ukuran PDF ${mismatch.width.toFixed(2)}x${mismatch.height.toFixed(2)} pt tidak sesuai ${profile.paper} ${profile.orientation}.`,
      "PDF_PAGE_SIZE_MISMATCH",
    );
  }

  return {
    pageCount,
    pageSize: `${profile.paper} ${profile.orientation}`,
    mediaBoxes,
  };
}

function validatePdfFile(filePath, profile) {
  return validatePdfBuffer(fs.readFileSync(filePath), profile);
}

module.exports = {
  validatePdfBuffer,
  validatePdfFile,
};
