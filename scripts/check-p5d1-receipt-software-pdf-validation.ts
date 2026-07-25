import { readFileSync } from "node:fs";

const receiptSourcePath = "src/features/sales/documents/receipt-certificate-html.tsx";
const source = readFileSync(receiptSourcePath, "utf8");

function assertIncludes(snippet: string, description: string) {
  if (!source.includes(snippet)) {
    throw new Error(`Missing ${description}: ${snippet}`);
  }
}

const requiredPrintSafetySnippets = [
  ["@page", "PDF page rule"],
  ["size: ${profile.cssPageSize};", "document profile page size"],
  ["--receipt-page-width: ${profile.widthMm}mm;", "receipt width CSS variable"],
  ["--receipt-page-height: ${profile.heightMm}mm;", "receipt height CSS variable"],
  ["width: var(--receipt-page-width);", "receipt page width binding"],
  ["height: var(--receipt-page-height);", "receipt page height binding"],
  ["break-after: page;", "page break after each receipt page"],
  ["page-break-after: always;", "legacy page break after each receipt page"],
  ["break-inside: avoid;", "modern split guard"],
  ["page-break-inside: avoid;", "legacy split guard"],
  [".aj-receipt-page:last-child", "last page print override"],
  ["break-after: auto;", "last page modern break override"],
  ["page-break-after: auto;", "last page legacy break override"],
  ["@media print", "print media rules"],
  ["box-shadow: none;", "print shadow reset"],
] as const;

const requiredReceiptStructureSnippets = [
  ['className="aj-preview-shell"', "preview shell"],
  ['className="aj-receipt-stage" data-aj-receipt-stage="true"', "receipt stage marker"],
  ['data-aj-receipt-page="front"', "front page marker"],
  ['data-aj-receipt-page="back"', "back page marker"],
  ["data-aj-page-number={pageNumber}", "front page number marker"],
  ["data-aj-page-number={pageCount + 1}", "back page number marker"],
  ["data-aj-total-pages={pageCount + 1}", "total pages marker"],
  ['className="aj-document-content"', "front content wrapper"],
  ['className="aj-back-content"', "back content wrapper"],
  ['className="aj-products-card"', "product table card"],
  ['className="aj-footer"', "front footer"],
  ["createQrSvgDataUri(data.verification.url)", "QR generation"],
  ['<span>Outlet :</span>', "front outlet summary row"],
  ["Informasi & Ketentuan", "back page title"],
] as const;

for (const [snippet, description] of requiredPrintSafetySnippets) {
  assertIncludes(snippet, description);
}

for (const [snippet, description] of requiredReceiptStructureSnippets) {
  assertIncludes(snippet, description);
}

const frontMarkerIndex = source.indexOf('data-aj-receipt-page="front"');
const backMarkerIndex = source.indexOf('data-aj-receipt-page="back"');

if (frontMarkerIndex === -1 || backMarkerIndex === -1) {
  throw new Error("Front and back receipt page markers must both exist.");
}

if (backMarkerIndex < frontMarkerIndex) {
  throw new Error("Back page must be rendered after front page(s) for PDF order stability.");
}

const receiptPageClassCount = Array.from(
  source.matchAll(/className="aj-receipt-page"/g),
).length;

if (receiptPageClassCount < 2) {
  throw new Error("Receipt document must render at least one front page template and one back page template.");
}

const remoteImagePattern = /<img[^>]+src=[{\"]https?:\/\//;
if (remoteImagePattern.test(source)) {
  throw new Error("Receipt PDF should not depend on remote image URLs.");
}

const pdfCriticalLabels = [
  "No. Order :",
  "Item :",
  "Tanggal :",
  "Sales :",
  "Outlet :",
  "Konsumen",
  "Telepon",
  "KODE",
  "FOTO",
  "PRODUCT",
  "Total Item",
  "Riwayat Transaksi",
  "Ketentuan Transaksi",
  "Perawatan Perhiasan",
  "Layanan Asihjaya",
];

const missingLabels = pdfCriticalLabels.filter((label) => !source.includes(label));

if (missingLabels.length > 0) {
  throw new Error(`Missing PDF critical labels: ${missingLabels.join(", ")}`);
}

console.log("P5-D.1 receipt software PDF validation checks passed.");
