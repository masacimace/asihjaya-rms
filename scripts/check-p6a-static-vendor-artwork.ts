import { readFileSync } from "node:fs";

const receiptSourcePath =
  "src/features/sales/documents/receipt-certificate-html.tsx";
const renderModesSourcePath =
  "src/features/sales/documents/receipt-certificate-render-modes.ts";
const previewHtmlPagePath =
  "src/app/documents/sales/receipt-certificate-preview-html/page.tsx";
const previewApiRoutePath =
  "src/app/api/sales/receipt-certificate-preview/route.ts";
const adminPreviewPagePath =
  "src/app/(admin)/admin/penjualan/preview-nota/html/page.tsx";

const receiptSource = readFileSync(receiptSourcePath, "utf8");
const renderModesSource = readFileSync(renderModesSourcePath, "utf8");
const previewHtmlSource = readFileSync(previewHtmlPagePath, "utf8");
const previewApiSource = readFileSync(previewApiRoutePath, "utf8");
const adminPreviewSource = readFileSync(adminPreviewPagePath, "utf8");

function assertIncludes(source: string, snippet: string, description: string) {
  if (!source.includes(snippet)) {
    throw new Error(`Missing ${description}: ${snippet}`);
  }
}

const renderModeSnippets = [
  ["RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN", "full design mode"],
  [
    "RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK",
    "vendor static artwork mode",
  ],
  ["vendor_static_artwork", "vendor static artwork mode value"],
  ["isReceiptCertificateRenderMode", "render mode validator"],
  ["resolveReceiptCertificateRenderMode", "render mode resolver"],
] as const;

for (const [snippet, description] of renderModeSnippets) {
  assertIncludes(renderModesSource, snippet, description);
}

const receiptSnippets = [
  ["renderMode?: ReceiptCertificateRenderMode", "receipt render mode prop"],
  ["data-aj-receipt-render-mode={renderMode}", "render mode DOM marker"],
  [
    '[data-aj-receipt-render-mode="vendor_static_artwork"] .aj-dynamic-print',
    "vendor static dynamic value hiding rule",
  ],
  ["aj-vendor-photo-frame", "vendor photo placeholder frame"],
  ["aj-vendor-qr-frame", "vendor QR placeholder frame"],
  ["data.items.slice(0, 1)", "single front page for vendor static artwork"],
  ["RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK", "receipt vendor mode check"],
  ['className="aj-summary-value aj-dynamic-print"', "summary dynamic value marker"],
  ['className="aj-info-value aj-dynamic-print"', "customer dynamic value marker"],
  ['className="aj-total-amount aj-dynamic-print"', "total dynamic value marker"],
  ['data-aj-receipt-page="front"', "front page marker preserved"],
  ['data-aj-receipt-page="back"', "back page marker preserved"],
] as const;

for (const [snippet, description] of receiptSnippets) {
  assertIncludes(receiptSource, snippet, description);
}

const previewHtmlSnippets = [
  ["mode?: string", "preview HTML mode query"],
  ["isReceiptCertificateRenderMode(query.mode)", "preview HTML mode validation"],
  ["renderMode={renderMode}", "preview HTML render mode forwarding"],
] as const;

for (const [snippet, description] of previewHtmlSnippets) {
  assertIncludes(previewHtmlSource, snippet, description);
}

const previewApiSnippets = [
  ['requestUrl.searchParams.get("mode")', "preview API mode query"],
  ["Mode render nota tidak didukung", "preview API mode validation message"],
  ["resolveReceiptCertificateRenderMode(requestedRenderMode)", "preview API mode resolver"],
  ['htmlUrl.searchParams.set("mode", renderMode)', "preview API mode forwarding"],
  ["vendor-static-artwork", "vendor static PDF filename marker"],
  ["X-Receipt-Render-Mode", "preview API render mode response header"],
] as const;

for (const [snippet, description] of previewApiSnippets) {
  assertIncludes(previewApiSource, snippet, description);
}

const adminPreviewSnippets = [
  ["Vendor Static", "admin preview vendor mode button"],
  ["Full Design", "admin preview full design button"],
  ["getReceiptCertificateRenderModeLabel(renderMode)", "admin preview mode label"],
  ["renderMode={renderMode}", "admin preview render mode forwarding"],
  ["mode=${renderMode}", "admin preview preserves mode in links"],
] as const;

for (const [snippet, description] of adminPreviewSnippets) {
  assertIncludes(adminPreviewSource, snippet, description);
}

const dynamicValueCount = Array.from(
  receiptSource.matchAll(/aj-dynamic-print/g),
).length;

if (dynamicValueCount < 12) {
  throw new Error(
    `Expected at least 12 dynamic print markers, found ${dynamicValueCount}.`,
  );
}

console.log("P6-A static vendor artwork checks passed.");
