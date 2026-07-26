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

function assertNotContains(file: string, content: string, snippet: string) {
  if (content.includes(snippet)) {
    throw new Error(`${file} must not contain: ${snippet}`);
  }
}

const outletCopyPath =
  "src/features/sales/documents/receipt-outlet-copy.ts";
const outletCopy = read(outletCopyPath);

[
  "RECEIPT_OUTLET_INSTAGRAM",
  "RECEIPT_VENDOR_OUTLET_NAME",
  "RECEIPT_VENDOR_OUTLET_ADDRESS",
  "RECEIPT_VENDOR_OUTLET_PHONE",
  "RECEIPT_VENDOR_OUTLET_INSTAGRAM",
  "resolveReceiptRuntimeOutletCopy",
  "resolveReceiptVendorStaticOutletCopy",
  "formatReceiptWhatsapp",
  "formatReceiptInstagram",
].forEach((snippet) => assertContains(outletCopyPath, outletCopy, snippet));

const receiptHtmlPath =
  "src/features/sales/documents/receipt-certificate-html.tsx";
const receiptHtml = read(receiptHtmlPath);

[
  "resolveReceiptRuntimeOutletCopy",
  "resolveReceiptVendorStaticOutletCopy",
  "const receiptOutletCopy = isVendorStaticArtwork",
  "{receiptOutletCopy.address}",
  "formatReceiptWhatsapp(receiptOutletCopy.phone)",
  "formatReceiptInstagram(",
  "{receiptOutletCopy.name}",
].forEach((snippet) => assertContains(receiptHtmlPath, receiptHtml, snippet));

assertNotContains(
  receiptHtmlPath,
  receiptHtml,
  "Instagram: @asihjaya.bantargebang",
);

const envPath = ".env.example";
const envExample = read(envPath);

[
  "RECEIPT_OUTLET_INSTAGRAM=",
  "RECEIPT_VENDOR_OUTLET_NAME=",
  "RECEIPT_VENDOR_OUTLET_ADDRESS=",
  "RECEIPT_VENDOR_OUTLET_PHONE=",
  "RECEIPT_VENDOR_OUTLET_INSTAGRAM=",
].forEach((snippet) => assertContains(envPath, envExample, snippet));

const vendorHandoffPath =
  "src/app/(admin)/admin/penjualan/preview-nota/vendor-handoff/page.tsx";
const vendorHandoff = read(vendorHandoffPath);

[
  "resolveReceiptVendorStaticOutletCopy",
  "receiptCertificateSampleData",
  "Static outlet copy",
  "formatReceiptWhatsapp(vendorOutletCopy.phone)",
  "formatReceiptInstagram(vendorOutletCopy.instagramHandle)",
  "RECEIPT_VENDOR_OUTLET_*",
].forEach((snippet) => assertContains(vendorHandoffPath, vendorHandoff, snippet));

const docsPath = "docs/receipt-vendor-handoff.md";
const docs = read(docsPath);

[
  "Static outlet copy untuk vendor",
  "RECEIPT_VENDOR_OUTLET_NAME",
  "RECEIPT_VENDOR_OUTLET_ADDRESS",
  "RECEIPT_VENDOR_OUTLET_PHONE",
  "RECEIPT_VENDOR_OUTLET_INSTAGRAM",
  "RECEIPT_OUTLET_INSTAGRAM",
].forEach((snippet) => assertContains(docsPath, docs, snippet));

console.log("P6-F.1 vendor artwork outlet static copy checks passed.");
