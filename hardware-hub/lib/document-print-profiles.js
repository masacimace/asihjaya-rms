
const RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1 = "receipt_a5_landscape_v1";
const RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1 = "receipt_a4_landscape_v1";
const LEGACY_RECEIPT_PRINT_PROFILE_A5_V1 = "receipt_a5_v1";
const TRANSITIONAL_RECEIPT_PRINT_PROFILE_A4_V1 = "receipt_a4_v1";
const EPSON_L3251_PRINT_PROFILE_A4_V1 = "epson_l3251_a4_v1";

const DOCUMENT_PRINT_PROFILES = Object.freeze({
  [LEGACY_RECEIPT_PRINT_PROFILE_A5_V1]: Object.freeze({
    id: LEGACY_RECEIPT_PRINT_PROFILE_A5_V1,
    label: "Legacy Receipt A5 Landscape",
    engine: "sumatrapdf",
    documentProfileId: RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
    paper: "A5",
    orientation: "landscape",
    colorMode: "color",
    duplex: "simplex",
    scaleMode: "fit",
    expectedPdfPoints: Object.freeze({ width: 595.28, height: 419.53 }),
    printSettings: Object.freeze([
      "paper=A5",
      "fit",
      "color",
      "simplex",
      "ignore-pdf-print-settings",
    ]),
  }),
  [TRANSITIONAL_RECEIPT_PRINT_PROFILE_A4_V1]: Object.freeze({
    id: TRANSITIONAL_RECEIPT_PRINT_PROFILE_A4_V1,
    label: "Receipt A4 Landscape",
    engine: "sumatrapdf",
    documentProfileId: RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
    paper: "A4",
    orientation: "landscape",
    colorMode: "color",
    duplex: "simplex",
    scaleMode: "fit",
    expectedPdfPoints: Object.freeze({ width: 841.89, height: 595.28 }),
    printSettings: Object.freeze([
      "paper=A4",
      "fit",
      "color",
      "simplex",
      "ignore-pdf-print-settings",
    ]),
  }),
  [EPSON_L3251_PRINT_PROFILE_A4_V1]: Object.freeze({
    id: EPSON_L3251_PRINT_PROFILE_A4_V1,
    label: "Epson EcoTank L3251 A4 Landscape",
    engine: "sumatrapdf",
    documentProfileId: RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
    paper: "A4",
    orientation: "landscape",
    colorMode: "color",
    duplex: "simplex",
    scaleMode: "fit",
    expectedPdfPoints: Object.freeze({ width: 841.89, height: 595.28 }),
    printSettings: Object.freeze([
      "paper=A4",
      "fit",
      "color",
      "simplex",
      "ignore-pdf-print-settings",
    ]),
  }),
});

function getDocumentPrintProfile(printProfileId) {
  const profile = DOCUMENT_PRINT_PROFILES[printProfileId];
  if (!profile) {
    const error = new Error(`Document print profile tidak didukung: ${printProfileId || "-"}.`);
    error.code = "UNKNOWN_PRINT_PROFILE";
    error.category = "validation";
    error.retrySafe = false;
    throw error;
  }
  return profile;
}

function resolveDocumentPrintProfile(payload = {}) {
  const printProfileId = payload.printProfileId || LEGACY_RECEIPT_PRINT_PROFILE_A5_V1;
  const profile = getDocumentPrintProfile(printProfileId);
  const documentProfileId = payload.documentProfileId || profile.documentProfileId;

  if (documentProfileId !== profile.documentProfileId) {
    const error = new Error(
      `Document profile ${documentProfileId} tidak cocok dengan print profile ${printProfileId}.`,
    );
    error.code = "PRINT_PROFILE_DOCUMENT_MISMATCH";
    error.category = "validation";
    error.retrySafe = false;
    throw error;
  }

  return { profile, documentProfileId };
}

function buildSumatraPdfCommand({ executable, printerName, filePath, payload = {} }) {
  if (!executable) {
    const error = new Error("PDF_PRINT_EXECUTABLE belum dikonfigurasi.");
    error.code = "PDF_PRINTER_NOT_CONFIGURED";
    error.category = "configuration";
    error.retrySafe = false;
    throw error;
  }
  const { profile, documentProfileId } = resolveDocumentPrintProfile(payload);
  const copies = Math.max(1, Math.min(Math.round(Number(payload.copies) || 1), 10));
  const printSettings = [...profile.printSettings];
  if (copies > 1) printSettings.unshift(`${copies}x`);

  return {
    executable,
    args: [
      "-print-to",
      printerName,
      "-print-settings",
      printSettings.join(","),
      "-silent",
      filePath,
    ],
    profile,
    documentProfileId,
    copies,
  };
}

module.exports = {
  DOCUMENT_PRINT_PROFILES,
  EPSON_L3251_PRINT_PROFILE_A4_V1,
  LEGACY_RECEIPT_PRINT_PROFILE_A5_V1,
  RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
  RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
  TRANSITIONAL_RECEIPT_PRINT_PROFILE_A4_V1,
  buildSumatraPdfCommand,
  getDocumentPrintProfile,
  resolveDocumentPrintProfile,
};
