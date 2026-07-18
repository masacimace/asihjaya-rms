/* eslint-disable */
const assert = require("assert");
const {
  DOCUMENT_PRINT_PROFILES,
  EPSON_L3251_PRINT_PROFILE_A4_V1,
  LEGACY_RECEIPT_PRINT_PROFILE_A5_V1,
  buildSumatraPdfCommand,
  resolveDocumentPrintProfile,
} = require("../lib/document-print-profiles");
const { validatePdfBuffer } = require("../lib/pdf-validation");

function createSyntheticPdf(width, height) {
  return Buffer.from(
    "%PDF-1.4\n" +
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n" +
      `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${width} ${height}]>>endobj\n` +
      "trailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8",
  );
}

const a4 = DOCUMENT_PRINT_PROFILES[EPSON_L3251_PRINT_PROFILE_A4_V1];
const a5 = DOCUMENT_PRINT_PROFILES[LEGACY_RECEIPT_PRINT_PROFILE_A5_V1];
assert.equal(a4.paper, "A4");
assert.equal(a4.orientation, "landscape");
assert.deepEqual(a4.printSettings, [
  "paper=A4",
  "fit",
  "color",
  "simplex",
  "ignore-pdf-print-settings",
]);

const command = buildSumatraPdfCommand({
  executable: "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
  printerName: "EPSON L3250 Series",
  filePath: "C:\\HardwareHub\\receipt.pdf",
  payload: {
    documentProfileId: "receipt_a4_landscape_v1",
    printProfileId: EPSON_L3251_PRINT_PROFILE_A4_V1,
    copies: 1,
  },
});
assert.deepEqual(command.args, [
  "-print-to",
  "EPSON L3250 Series",
  "-print-settings",
  "paper=A4,fit,color,simplex,ignore-pdf-print-settings",
  "-silent",
  "C:\\HardwareHub\\receipt.pdf",
]);
assert.equal(command.profile.id, EPSON_L3251_PRINT_PROFILE_A4_V1);

assert.equal(
  resolveDocumentPrintProfile({}).profile.id,
  LEGACY_RECEIPT_PRINT_PROFILE_A5_V1,
);
assert.throws(
  () =>
    resolveDocumentPrintProfile({
      documentProfileId: "receipt_a5_landscape_v1",
      printProfileId: EPSON_L3251_PRINT_PROFILE_A4_V1,
    }),
  (error) => error.code === "PRINT_PROFILE_DOCUMENT_MISMATCH",
);

const a4Contract = validatePdfBuffer(createSyntheticPdf(841.89, 595.28), a4);
assert.equal(a4Contract.pageCount, 1);
assert.equal(a4Contract.pageSize, "A4 landscape");
validatePdfBuffer(createSyntheticPdf(595.28, 419.53), a5);
assert.throws(
  () => validatePdfBuffer(createSyntheticPdf(595.28, 419.53), a4),
  (error) => error.code === "PDF_PAGE_SIZE_MISMATCH",
);
assert.throws(
  () => validatePdfBuffer(Buffer.from("not-a-pdf"), a4),
  (error) => error.code === "PDF_INVALID_HEADER",
);

console.log("OK: deterministic SumatraPDF profiles dan PDF validation valid.");
