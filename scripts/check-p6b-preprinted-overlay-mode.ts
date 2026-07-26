import { readFileSync } from "node:fs";

const receiptSourcePath =
  "src/features/sales/documents/receipt-certificate-html.tsx";
const renderModesSourcePath =
  "src/features/sales/documents/receipt-certificate-render-modes.ts";
const previewApiRoutePath =
  "src/app/api/sales/receipt-certificate-preview/route.ts";
const adminPreviewPagePath =
  "src/app/(admin)/admin/penjualan/preview-nota/html/page.tsx";

const receiptSource = readFileSync(receiptSourcePath, "utf8");
const renderModesSource = readFileSync(renderModesSourcePath, "utf8");
const previewApiSource = readFileSync(previewApiRoutePath, "utf8");
const adminPreviewSource = readFileSync(adminPreviewPagePath, "utf8");

function assertIncludes(source: string, snippet: string, description: string) {
  if (!source.includes(snippet)) {
    throw new Error(`Missing ${description}: ${snippet}`);
  }
}

const renderModeSnippets = [
  [
    "RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY",
    "pre-printed overlay mode constant",
  ],
  ["preprinted_overlay", "pre-printed overlay mode value"],
  ["Pre-printed overlay", "pre-printed overlay mode label"],
] as const;

for (const [snippet, description] of renderModeSnippets) {
  assertIncludes(renderModesSource, snippet, description);
}

const receiptSnippets = [
  [
    '[data-aj-receipt-render-mode="preprinted_overlay"] .aj-static-artwork',
    "overlay static artwork hiding rule",
  ],
  [
    '[data-aj-receipt-render-mode="preprinted_overlay"] .aj-dynamic-print',
    "overlay dynamic value visibility rule",
  ],
  ["aj-static-artwork", "static artwork marker class"],
  ["isPreprintedOverlay", "pre-printed overlay branch"],
  ["shouldRenderBackPage", "back page suppression flag"],
  ["totalPdfPages", "overlay-aware total page count"],
  ["!isPreprintedOverlay", "no static back page in overlay mode"],
  ["aj-qr-box aj-dynamic-print", "dynamic QR marker"],
  ["aj-thumb aj-dynamic-print", "dynamic product image marker"],
  ['className="aj-logo aj-static-artwork"', "static logo marker"],
  ['className="aj-contact-lines aj-static-artwork"', "static outlet contact marker"],
  ['className="aj-product-row aj-product-head aj-static-artwork"', "static product header marker"],
] as const;

for (const [snippet, description] of receiptSnippets) {
  assertIncludes(receiptSource, snippet, description);
}

const previewApiSnippets = [
  ["RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY", "API overlay import"],
  ["preprinted-overlay", "overlay PDF filename marker"],
  ["X-Receipt-Render-Mode", "render mode response header preserved"],
] as const;

for (const [snippet, description] of previewApiSnippets) {
  assertIncludes(previewApiSource, snippet, description);
}

const adminPreviewSnippets = [
  ["RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY", "admin overlay mode import"],
  ["Overlay", "admin overlay mode button"],
  ["Overlay data transaksi", "admin overlay data description"],
  ["Mode Overlay hanya mencetak data transaksi dinamis", "admin overlay note"],
] as const;

for (const [snippet, description] of adminPreviewSnippets) {
  assertIncludes(adminPreviewSource, snippet, description);
}

const staticMarkerCount = Array.from(
  receiptSource.matchAll(/aj-static-artwork/g),
).length;

if (staticMarkerCount < 18) {
  throw new Error(
    `Expected at least 18 static artwork markers, found ${staticMarkerCount}.`,
  );
}

console.log("P6-B pre-printed overlay mode checks passed.");
