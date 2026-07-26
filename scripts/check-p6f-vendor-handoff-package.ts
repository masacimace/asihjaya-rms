import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(file: string, content: string, snippet: string) {
  if (!content.includes(snippet)) {
    throw new Error(`${file} must contain: ${snippet}`);
  }
}

const docsPath = "docs/receipt-vendor-handoff.md";
const docs = read(docsPath);

[
  "Static artwork PDF",
  "Full design preview PDF",
  "Overlay proof PDF",
  "RECEIPT_DOCUMENT_PROFILE_ID",
  "receipt_a4_landscape_v1",
  "receipt_a5_landscape_v1",
  "RECEIPT_OVERLAY_OFFSET_X_MM",
  "RECEIPT_OVERLAY_OFFSET_Y_MM",
  "RECEIPT_OVERLAY_SCALE",
  "Proof print wajib sebelum produksi massal",
].forEach((snippet) => assertContains(docsPath, docs, snippet));

const pagePath =
  "src/app/(admin)/admin/penjualan/preview-nota/vendor-handoff/page.tsx";
const page = read(pagePath);

[
  "P6-F Vendor Handoff Package",
  "Download static artwork",
  "Preview full design",
  "Preview overlay proof",
  "receiptDocumentProfiles",
  "getConfiguredReceiptDocumentProfile",
  "getConfiguredReceiptOverlayCalibration",
  "RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK",
  "RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY",
  "RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN",
  "docs/receipt-vendor-handoff.md",
].forEach((snippet) => assertContains(pagePath, page, snippet));

const previewPagePath = "src/app/(admin)/admin/penjualan/preview-nota/page.tsx";
const previewPage = read(previewPagePath);

[
  "/admin/penjualan/preview-nota/vendor-handoff",
  "Vendor Handoff",
  "Paket Vendor Handoff",
].forEach((snippet) => assertContains(previewPagePath, previewPage, snippet));

const renderModesPath =
  "src/features/sales/documents/receipt-certificate-render-modes.ts";
const renderModes = read(renderModesPath);

[
  "vendor_static_artwork",
  "preprinted_overlay",
  "full_design",
].forEach((snippet) => assertContains(renderModesPath, renderModes, snippet));

console.log("P6-F vendor handoff package checks passed.");
