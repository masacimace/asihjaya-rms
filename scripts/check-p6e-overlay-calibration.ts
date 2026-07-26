import { readFileSync } from "node:fs";

function assertContains(filePath: string, expected: string) {
  const content = readFileSync(filePath, "utf8");

  if (!content.includes(expected)) {
    throw new Error(`${filePath} tidak memuat snippet wajib: ${expected}`);
  }
}

function assertNotContains(filePath: string, unexpected: string) {
  const content = readFileSync(filePath, "utf8");

  if (content.includes(unexpected)) {
    throw new Error(`${filePath} masih memuat snippet yang tidak boleh ada: ${unexpected}`);
  }
}

const calibrationModule =
  "src/features/sales/documents/receipt-overlay-calibration.ts";
const receiptHtml =
  "src/features/sales/documents/receipt-certificate-html.tsx";
const saleHtmlPage =
  "src/app/documents/sales/[saleId]/receipt-certificate-html/page.tsx";
const previewHtmlPage =
  "src/app/documents/sales/receipt-certificate-preview-html/page.tsx";
const adminPreviewHtmlPage =
  "src/app/(admin)/admin/penjualan/preview-nota/html/page.tsx";
const salePdfRoute =
  "src/app/api/sales/[saleId]/receipt-certificate/route.ts";
const previewPdfRoute =
  "src/app/api/sales/receipt-certificate-preview/route.ts";
const saleDetailPage =
  "src/app/(admin)/admin/penjualan/[transactionId]/page.tsx";

assertContains(
  ".env.example",
  "RECEIPT_OVERLAY_OFFSET_X_MM=0",
);
assertContains(
  ".env.example",
  "RECEIPT_OVERLAY_OFFSET_Y_MM=0",
);
assertContains(".env.example", "RECEIPT_OVERLAY_SCALE=1");

assertContains(calibrationModule, "ReceiptOverlayCalibration");
assertContains(calibrationModule, "getConfiguredReceiptOverlayCalibration");
assertContains(calibrationModule, "RECEIPT_OVERLAY_OFFSET_X_MM");
assertContains(calibrationModule, "RECEIPT_OVERLAY_OFFSET_Y_MM");
assertContains(calibrationModule, "RECEIPT_OVERLAY_SCALE");
assertContains(calibrationModule, "OVERLAY_OFFSET_MIN_MM = -30");
assertContains(calibrationModule, "OVERLAY_SCALE_MAX = 1.1");

assertContains(receiptHtml, "overlayCalibration = DEFAULT_RECEIPT_OVERLAY_CALIBRATION");
assertContains(receiptHtml, "--receipt-overlay-offset-x");
assertContains(receiptHtml, "--receipt-overlay-offset-y");
assertContains(receiptHtml, "--receipt-overlay-design-scale");
assertContains(receiptHtml, "data-aj-overlay-offset-x-mm");
assertContains(receiptHtml, "data-aj-overlay-offset-y-mm");
assertContains(receiptHtml, "data-aj-overlay-scale");
assertContains(
  receiptHtml,
  '[data-aj-receipt-render-mode="preprinted_overlay"] .aj-receipt-front-design',
);
assertContains(receiptHtml, "var(--receipt-overlay-design-scale)");
assertNotContains(receiptHtml, "RECEIPT_OVERLAY_OFFSET_X_MM=0");

for (const page of [saleHtmlPage, previewHtmlPage, adminPreviewHtmlPage]) {
  assertContains(page, "getConfiguredReceiptOverlayCalibration");
  assertContains(page, "overlayCalibration={overlayCalibration}");
}

for (const route of [salePdfRoute, previewPdfRoute]) {
  assertContains(route, "getConfiguredReceiptOverlayCalibration");
  assertContains(route, "X-Receipt-Overlay-Offset-X-MM");
  assertContains(route, "X-Receipt-Overlay-Offset-Y-MM");
  assertContains(route, "X-Receipt-Overlay-Scale");
}

assertContains(saleDetailPage, "Overlay calibration");
assertContains(saleDetailPage, "receiptOverlayCalibration.offsetXmm");
assertContains(saleDetailPage, "ubah nilai overlay calibration di environment");

console.log("P6-E overlay calibration checks passed.");
