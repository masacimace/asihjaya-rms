/**
 * Receipt PDF regression test (A4 / A5 and pre-printed A5 vendor paper).
 *
 * Run: npm run check:receipt-pdf
 *      npm run check:receipt-pdf -- --keep-output
 *
 * The production receipt renderer uses `next/font/local`, which Next.js
 * rewrites during compilation. It cannot be executed directly under `tsx`.
 * Register a test-only module hook BEFORE dynamically importing the renderer.
 * The stub affects only the brand font class in this test, never production.
 *
 * This test DOES render real HTML/CSS with Chromium and checks PDF geometry.
 * Its brand font is substituted, so physical-print/font visual QA is still
 * required before releasing a new vendor-paper template.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";

import { chromium, type Browser, type Page } from "playwright";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
  RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
  receiptDocumentProfiles,
  type ReceiptDocumentProfileId,
} from "@/features/sales/documents/receipt-document-profiles";
import {
  RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN,
  RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
  RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN_FRONT_ONLY,
  RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
  type ReceiptCertificateRenderMode,
} from "@/features/sales/documents/receipt-certificate-render-modes";
import { receiptCertificateSampleData } from "@/features/sales/documents/receipt-certificate-sample-data";
import { validateReceiptPdfBuffer } from "@/features/sales/documents/receipt-pdf-contract";
import {
  EPSON_L3251_PRINT_PROFILE_A4_V1,
  RECEIPT_PRINT_PROFILE_A5_V1,
  buildReceiptDocumentPayloadV2,
} from "@/lib/hardware/job-payload-contracts-v2";
import type { ReceiptCertificateData } from "@/features/sales/documents/receipt-certificate";

const KEEP_OUTPUT = process.argv.includes("--keep-output");
const FRONT_CSS = "src/features/sales/documents/receipt-certificate-front-client.css";
const BACK_CSS = "src/features/sales/documents/receipt-certificate-back-client.css";
const OVERLAY_CSS = "src/features/sales/documents/receipt-certificate-overlay-client.css";
const FRONT_SELECTOR = 'article[data-aj-receipt-page="front"]';
const VENDOR_PAYMENT_LABELS = [
  "Dana Titip",
  "Gunakan Saldo",
  "Harga Item",
  "Total Pembayaran",
];
const MM_TO_PX = 96 / 25.4;
const POSITION_TOLERANCE_PX = 0.6 * MM_TO_PX;

function getExecutablePath() {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (configured) return configured;
  if (process.platform === "linux" && fs.existsSync("/usr/bin/chromium")) {
    return "/usr/bin/chromium";
  }
  return undefined;
}

function readCss(relativePath: string) {
  const filePath = path.resolve(relativePath);
  assert.ok(fs.existsSync(filePath), `CSS receipt tidak ditemukan: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

// App layout imports client CSS globally. Include it here in exactly the same
// cascade order, otherwise rendering the component alone misses vendor layout.
const clientCss = [FRONT_CSS, BACK_CSS, OVERLAY_CSS].map(readCss).join("\n");

function installNextFontTestStub() {
  const source =
    'export default function localFont() { return { className: "aj-test-brand-font" }; }';
  const stubUrl = `data:text/javascript,${encodeURIComponent(source)}`;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "next/font/local") {
        return { url: stubUrl, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
}

type RenderComponent =
  typeof import("@/features/sales/documents/receipt-certificate-html")["ReceiptCertificateHtmlDocument"];

function buildHtml(
  Component: RenderComponent,
  input: {
    data: ReceiptCertificateData;
    documentProfileId: ReceiptDocumentProfileId;
    renderMode: ReceiptCertificateRenderMode;
  },
) {
  const markup = renderToStaticMarkup(createElement(Component, input));
  return [
    "<!doctype html>",
    '<html lang="id"><head><meta charset="utf-8">',
    '<title>Receipt PDF Contract</title>',
    `<style id="aj-client-receipt-css">${clientCss}</style>`,
    `</head><body>${markup}</body></html>`,
  ].join("");
}

function buildSingleItemFixture(): ReceiptCertificateData {
  const data = structuredClone(receiptCertificateSampleData);
  data.items = data.items.slice(0, 1);
  assert.ok(data.items[0]);
  data.sale.subtotalAmount = data.items[0].listPriceAmount;
  data.sale.discountAmount = "0";
  data.sale.totalAmount = data.items[0].finalPriceAmount;
  data.customerDeposit.usedAmount = "0";
  data.customerDeposit.inAmount = "0";
  data.customerDeposit.externalPaymentDueAmount = data.items[0].finalPriceAmount;
  return data;
}

function buildDiscountedMultiItemFixture(): ReceiptCertificateData {
  const data = structuredClone(receiptCertificateSampleData);
  assert.ok(data.items.length > 1, "Fixture perlu lebih dari satu item.");
  // Consistent financial example: 7,185,000 subtotal - 500 discount =
  // 7,184,500 total, then deposit used 500,000 and deposit in 250,000.
  data.items[0]!.discountAmount = "500";
  data.items[0]!.finalPriceAmount = "3684500";
  data.sale.discountAmount = "500";
  data.sale.totalAmount = "7184500";
  data.customerDeposit.externalPaymentDueAmount = "6934500";
  return data;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function formatRupiah(value: string | number) {
  return normalizeText(new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value)));
}

type PaymentRow = { label: string; amount: string };

type PaymentGeometry = {
  card: { x: number; y: number; width: number; height: number };
  rows: Array<{ label: string; labelY: number; valueY: number }>;
  label: { top: number; bottom: number };
  amount: { top: number; bottom: number };
};

type MediaGeometry = { x: number; y: number; width: number; height: number };

/**
 * Read DOM values using Playwright's locator APIs instead of evaluate/evaluateAll.
 *
 * In a tsx runtime, serializing inline callbacks can leak `__name` into the
 * browser; serialized arrow-function strings can also return `undefined`
 * instead of the expected data. Both failure modes are avoided here.
 *
 * Fail explicitly on missing DOM nodes/rectangles. Never replace unexpected
 * values with empty arrays, because that would hide actual layout regressions.
 */
async function requireBoundingBox(
  locator: ReturnType<Page["locator"]>,
  description: string,
): Promise<MediaGeometry> {
  assert.equal(await locator.count(), 1,
    `${description}: expected exactly one element.`);
  const rectangle = await locator.boundingBox();
  assert.ok(rectangle, `${description}: element has no measurable rectangle.`);
  for (const coordinate of [rectangle.x, rectangle.y, rectangle.width, rectangle.height]) {
    assert.ok(Number.isFinite(coordinate),
      `${description}: non-finite bounding-box coordinate.`);
  }
  return rectangle;
}

function firstFrontPage(page: Page) {
  return page.locator(FRONT_SELECTOR).first();
}

function paymentRowLocator(page: Page) {
  return firstFrontPage(page).locator(".aj-total-card .aj-total-detail-row");
}

async function readPaymentRows(page: Page): Promise<PaymentRow[]> {
  const locator = paymentRowLocator(page);
  const count = await locator.count();
  assert.ok(count > 0,
    "Payment rows were not rendered. Inspect the receipt HTML/CSS before checking amounts.");

  const rows: PaymentRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const row = locator.nth(index);
    const labelLocator = row.locator("span");
    const amountLocator = row.locator("strong");
    assert.equal(await labelLocator.count(), 1,
      `Payment row ${index + 1}: label is missing or duplicated.`);
    assert.equal(await amountLocator.count(), 1,
      `Payment row ${index + 1}: amount is missing or duplicated.`);
    const [label, amount] = await Promise.all([
      labelLocator.textContent(),
      amountLocator.textContent(),
    ]);
    rows.push({ label: normalizeText(label), amount: normalizeText(amount) });
  }
  return rows;
}

async function readPaymentGeometry(page: Page): Promise<PaymentGeometry> {
  const card = firstFrontPage(page).locator(".aj-total-card");
  const cardBox = await requireBoundingBox(card, "Payment card");
  const rowLocator = paymentRowLocator(page);
  const count = await rowLocator.count();
  assert.ok(count > 0, "Payment geometry: no rows found.");
  const rows: PaymentGeometry["rows"] = [];

  for (let index = 0; index < count; index += 1) {
    const row = rowLocator.nth(index);
    const [labelBox, valueBox, label] = await Promise.all([
      requireBoundingBox(row.locator("span"), `Payment row ${index + 1} label`),
      requireBoundingBox(row.locator("strong"), `Payment row ${index + 1} amount`),
      row.locator("span").textContent(),
    ]);
    rows.push({
      label: normalizeText(label),
      labelY: labelBox.y + labelBox.height / 2,
      valueY: valueBox.y + valueBox.height / 2,
    });
  }

  const [totalLabel, totalAmount] = await Promise.all([
    requireBoundingBox(card.locator(".aj-total-label"), "TOTAL ITEM label"),
    requireBoundingBox(card.locator(".aj-total-amount"), "TOTAL ITEM amount"),
  ]);
  return {
    card: cardBox,
    rows,
    label: { top: totalLabel.y, bottom: totalLabel.y + totalLabel.height },
    amount: { top: totalAmount.y, bottom: totalAmount.y + totalAmount.height },
  };
}

type HeaderMetadataRow = {
  label: string;
  value: string;
  labelBox: MediaGeometry;
  valueBox: MediaGeometry;
};

const VENDOR_HEADER_LABELS = [
  "No. Order :",
  "Item :",
  "Tanggal :",
  "Sales :",
  "Outlet :",
] as const;

async function readHeaderMetadata(page: Page): Promise<HeaderMetadataRow[]> {
  const rows = firstFrontPage(page).locator(".aj-certificate-card .aj-summary-row");
  assert.equal(await rows.count(), VENDOR_HEADER_LABELS.length,
    "Vendor header must contain exactly five fixed metadata rows.");
  const result: HeaderMetadataRow[] = [];
  for (let index = 0; index < VENDOR_HEADER_LABELS.length; index += 1) {
    const row = rows.nth(index);
    const label = row.locator(".aj-static-artwork");
    const value = row.locator(".aj-dynamic-print");
    const [labelText, valueText, labelBox, valueBox] = await Promise.all([
      label.textContent(),
      value.textContent(),
      requireBoundingBox(label, `Header row ${index + 1} label`),
      requireBoundingBox(value, `Header row ${index + 1} value`),
    ]);
    assert.equal(normalizeText(labelText), VENDOR_HEADER_LABELS[index],
      `Header label ${index + 1} differs from physical vendor-paper wording.`);
    result.push({
      label: normalizeText(labelText),
      value: normalizeText(valueText),
      labelBox,
      valueBox,
    });
  }
  return result;
}

function verticalCenter(box: MediaGeometry) {
  return box.y + box.height / 2;
}

async function checkHeaderMetadataOverlay(
  browser: Browser,
  Component: RenderComponent,
) {
  const profile = RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1;
  const longInvoice = buildSingleItemFixture();
  longInvoice.sale.invoiceNumber = "AJ-TOKO-BG-20261006-D91E4AA6";
  longInvoice.outlet.name = "Pasar Bantar Gebang";
  const shortInvoice = structuredClone(longInvoice);
  shortInvoice.sale.invoiceNumber = "AJ-BG-1";

  const vendor = await withRenderPage(browser, Component, profile,
    RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK, longInvoice,
    readHeaderMetadata);
  const overlay = await withRenderPage(browser, Component, profile,
    RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY, longInvoice,
    readHeaderMetadata);
  const short = await withRenderPage(browser, Component, profile,
    RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY, shortInvoice,
    readHeaderMetadata);

  assert.equal(overlay[0]?.value, longInvoice.sale.invoiceNumber,
    "Invoice number was truncated/changed in overlay data.");
  assert.equal(short[0]?.value, shortInvoice.sale.invoiceNumber,
    "Short invoice number changed in overlay data.");
  for (let index = 0; index < overlay.length; index += 1) {
    const vendorRow = vendor[index]!;
    const actualRow = overlay[index]!;
    const shortRow = short[index]!;
    // Exact same five tracks, despite invoice/brand/date differences.
    approx(actualRow.labelBox.x, vendorRow.labelBox.x,
      `Header ${actualRow.label}: vendor/overlay X`);
    approx(verticalCenter(actualRow.labelBox), verticalCenter(vendorRow.labelBox),
      `Header ${actualRow.label}: vendor/overlay label Y`);
    approx(actualRow.valueBox.x, vendorRow.valueBox.x,
      `Header ${actualRow.label}: vendor/overlay value X`);
    if (index > 0) {
      // Values use a 2.65mm line box; labels use an approximately 4.12mm
      // line box. Compare the FIRST value line to the vendor label, not the
      // entire span center (Outlet wraps to two lines in this fixture).
      const firstValueLineCenter = actualRow.valueBox.y +
        Math.min(actualRow.valueBox.height, 2.65 * MM_TO_PX) / 2;
      approx(firstValueLineCenter, verticalCenter(vendorRow.labelBox),
        `Header ${actualRow.label}: first value line against preprinted label`);
      if (index === 4) {
        approx(actualRow.valueBox.height, 5.3 * MM_TO_PX,
          "Header Outlet: expected exactly two 2.65mm lines");
      }
      approx(actualRow.valueBox.y, shortRow.valueBox.y,
        `Header ${actualRow.label}: shorter invoice must not shift row`);
    }
  }
  // A three-line normal POS invoice may begin above the No. Order label,
  // but must finish before the independently anchored Item value.
  const first = overlay[0]!.valueBox;
  const second = overlay[1]!.valueBox;
  assert.ok(first.y < overlay[0]!.labelBox.y,
    "No. Order should use the reserved three-line space above its label.");
  const invoiceHeightMm = first.height / MM_TO_PX;
  assert.ok(invoiceHeightMm >= 7.75 && invoiceHeightMm <= 8.2,
    `Normal POS invoice must wrap into exactly three lines; got ${invoiceHeightMm.toFixed(2)}mm.`);
  assert.ok(first.y + first.height <= second.y + 0.3 * MM_TO_PX,
    "No. Order text collides with the fixed Item amount; inspect invoice wrap/font sizing.");

  const labelPitchMm = (verticalCenter(vendor[4]!.labelBox) -
    verticalCenter(vendor[0]!.labelBox)) / (4 * MM_TO_PX);
  assert.ok(Math.abs(labelPitchMm - 5.55) <= 0.2,
    `Header vendor-paper pitch should be 5.55mm, got ${labelPitchMm.toFixed(2)}mm.`);

  await withRenderPage(browser, Component, profile,
    RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN, longInvoice,
    async (page) => {
      const digital = await readHeaderMetadata(page);
      assert.equal(digital[0]?.value, longInvoice.sale.invoiceNumber,
        "Full-design receipt must preserve complete invoice data.");
    });
}

async function readMediaSlotGeometry(page: Page, selector: string): Promise<MediaGeometry> {
  return requireBoundingBox(firstFrontPage(page).locator(selector),
    `Vendor media slot (${selector})`);
}

async function withRenderPage<T>(
  browser: Browser,
  Component: RenderComponent,
  documentProfileId: ReceiptDocumentProfileId,
  renderMode: ReceiptCertificateRenderMode,
  data: ReceiptCertificateData,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const page = await browser.newPage({
    viewport: receiptDocumentProfiles[documentProfileId].viewport,
    deviceScaleFactor: 1,
  });
  try {
    await page.emulateMedia({ media: "print" });
    await page.setContent(buildHtml(Component, { data, documentProfileId, renderMode }), {
      waitUntil: "load",
    });
    return await fn(page);
  } finally {
    await page.close();
  }
}

async function renderPdfAndCheck(
  browser: Browser,
  Component: RenderComponent,
  documentProfileId: ReceiptDocumentProfileId,
  renderMode: ReceiptCertificateRenderMode,
  data: ReceiptCertificateData,
  expectedPageCount: number,
  outputDir: string,
) {
  return withRenderPage(browser, Component, documentProfileId, renderMode, data,
    async (page) => {
      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      });
      const contract = validateReceiptPdfBuffer(pdf, receiptDocumentProfiles[documentProfileId]);
      assert.equal(contract.pageCount, expectedPageCount,
        `${documentProfileId}/${renderMode}: jumlah halaman tidak sesuai.`);
      assert.ok(pdf.length > 10_000, `${documentProfileId}/${renderMode}: PDF terlalu kecil.`);
      if (KEEP_OUTPUT) {
        const filename = `${documentProfileId}-${renderMode}.pdf`;
        fs.writeFileSync(path.join(outputDir, filename), pdf);
      }
      return contract;
    });
}

function approx(actual: number, expected: number, description: string) {
  assert.ok(Math.abs(actual - expected) <= POSITION_TOLERANCE_PX,
    `${description}: berbeda ${(Math.abs(actual - expected) / MM_TO_PX).toFixed(2)} mm`);
}

async function checkPaymentOverlay(
  browser: Browser,
  Component: RenderComponent,
  data: ReceiptCertificateData,
) {
  const profile = RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1;
  const artwork = await withRenderPage(browser, Component, profile,
    RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK, data,
    async (page) => {
      const rows = await readPaymentRows(page);
      assert.deepEqual(rows.map((row) => row.label), VENDOR_PAYMENT_LABELS);
      return {
        payment: await readPaymentGeometry(page),
        qr: await readMediaSlotGeometry(page, ".aj-qr-box"),
        photo: await readMediaSlotGeometry(page, ".aj-thumb"),
      };
    });

  await withRenderPage(browser, Component, profile,
    RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY, data,
    async (page) => {
      const rows = await readPaymentRows(page);
      assert.deepEqual(rows.map((row) => row.label), VENDOR_PAYMENT_LABELS,
        "Overlay harus mempunyai tepat empat baris tanpa Diskon Item/Total Order.");
      assert.equal(normalizeText(rows[2]?.amount), formatRupiah(data.items[0]!.finalPriceAmount),
        "Harga Item overlay harus finalPriceAmount setelah diskon.");
      assert.equal(normalizeText(rows[3]?.amount),
        formatRupiah(data.customerDeposit.externalPaymentDueAmount),
        "Total Pembayaran harus mengambil nilai backend.");
      assert.equal(await page.locator(FRONT_SELECTOR).count(), data.items.length,
        "Overlay perlu satu halaman per item.");

      const overlay = await readPaymentGeometry(page);
      approx(overlay.card.x, artwork.payment.card.x, "Posisi X card vendor/overlay");
      approx(overlay.card.y, artwork.payment.card.y, "Posisi Y card vendor/overlay");
      assert.equal(overlay.rows.length, 4);
      assert.equal(artwork.payment.rows.length, 4);
      for (let index = 0; index < 4; index += 1) {
        const row = overlay.rows[index]!;
        const vendorRow = artwork.payment.rows[index]!;
        assert.equal(row.label, vendorRow.label);
        approx(row.valueY, vendorRow.labelY,
          `Posisi nominal ${row.label} terhadap label vendor`);
      }

      assert.ok(overlay.amount.top >= artwork.payment.label.bottom - POSITION_TOLERANCE_PX,
        "Nominal besar menimpa label TOTAL ITEM pada kertas vendor.");
      assert.ok(overlay.amount.bottom <= overlay.card.y + overlay.card.height + POSITION_TOLERANCE_PX,
        "Nominal besar keluar dari card pembayaran.");

      const qrSlot = await readMediaSlotGeometry(page, ".aj-qr-box");
      approx(qrSlot.x, artwork.qr.x, "Posisi X QR vendor/overlay");
      approx(qrSlot.y, artwork.qr.y, "Posisi Y QR vendor/overlay");
      approx(qrSlot.width, artwork.qr.width, "Lebar QR vendor/overlay");
      approx(qrSlot.height, artwork.qr.height, "Tinggi QR vendor/overlay");
      const photoSlot = await readMediaSlotGeometry(page, ".aj-thumb");
      approx(photoSlot.x, artwork.photo.x, "Posisi X foto vendor/overlay");
      approx(photoSlot.y, artwork.photo.y, "Posisi Y foto vendor/overlay");
      approx(photoSlot.width, artwork.photo.width, "Lebar foto vendor/overlay");
      approx(photoSlot.height, artwork.photo.height, "Tinggi foto vendor/overlay");
      const photo = firstFrontPage(page).locator(".aj-thumb");
      assert.equal(await photo.count(), 1, "Photo slot is missing or duplicated.");
      // Evaluate only a plain CSS expression, never a callback arrow function.
      // In Node/tsx, callback serialization previously caused __name errors.
      const photoPadding = await page.evaluate(
        String.raw`getComputedStyle(document.querySelector('article[data-aj-receipt-page="front"] .aj-thumb')).padding`,
      );
      assert.equal(photoPadding, "0px", "Foto preprinted harus full-fill tanpa padding.");

      const qr = firstFrontPage(page).locator(".aj-qr-box img");
      assert.equal(await qr.count(), 1, "QR dinamis harus ada pada overlay.");
      const qrBox = await requireBoundingBox(qr, "QR image");
      const qrFit = await page.evaluate(
        String.raw`getComputedStyle(document.querySelector('article[data-aj-receipt-page="front"] .aj-qr-box img')).objectFit`,
      );
      assert.equal(qrFit, "contain", "Quiet zone QR harus dipertahankan.");
      assert.ok(qrBox.width > 0 && qrBox.height > 0,
        "QR image must have nonzero dimensions.");
    });

  await withRenderPage(browser, Component, profile,
    RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN, data,
    async (page) => {
      const rows = await readPaymentRows(page);
      assert.ok(rows.some((row) => row.label === "Diskon Item"),
        "Full design harus tetap menampilkan Diskon Item.");
      assert.ok(rows.some((row) => row.label === "Total Order"),
        "Full design multi-item harus tetap menampilkan Total Order.");
      assert.equal(normalizeText(rows.find((row) => row.label === "Harga Item")?.amount),
        formatRupiah(data.items[0]!.listPriceAmount),
        "Harga Item digital harus mempertahankan listPriceAmount.");
    });
}

async function checkSingleItemOverlay(
  browser: Browser,
  Component: RenderComponent,
) {
  const data = buildSingleItemFixture();
  await withRenderPage(browser, Component, RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
    RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY, data,
    async (page) => {
      const rows = await readPaymentRows(page);
      assert.deepEqual(rows.map((row) => row.label), VENDOR_PAYMENT_LABELS,
        "Overlay single-item tanpa diskon juga harus tepat empat baris.");
      assert.equal(await page.locator(FRONT_SELECTOR).count(), 1);
      assert.equal(normalizeText(rows[2]?.amount), formatRupiah(data.items[0]!.finalPriceAmount));
      assert.equal(normalizeText(rows[3]?.amount),
        formatRupiah(data.customerDeposit.externalPaymentDueAmount));
    });
}

function checkHardwarePayload() {
  const id = "8ad038f7-d346-4bd4-8f96-f3fd5c01af70";
  const base = {
    saleId: id,
    invoiceNumber: "AJ-TEST-0001",
    requestSource: "check.receipt-pdf-contract",
    reprint: false,
    requestedAt: new Date("2026-07-17T00:00:00.000Z"),
  };
  // Explicit profile keeps the test deterministic regardless of the outlet's
  // local RECEIPT_DOCUMENT_PROFILE_ID setting.
  const a4 = buildReceiptDocumentPayloadV2({
    ...base,
    documentProfileId: RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
  });
  assert.equal(a4.printProfileId, EPSON_L3251_PRINT_PROFILE_A4_V1);
  assert.equal(a4.download.path, `/api/sales/${id}/receipt-certificate?profile=receipt_a4_landscape_v1`);

  const a5 = buildReceiptDocumentPayloadV2({
    ...base,
    documentProfileId: RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
    renderMode: RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
  });
  assert.equal(a5.printProfileId, RECEIPT_PRINT_PROFILE_A5_V1);
  assert.equal(a5.metadata.renderMode, RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY);
  assert.equal(a5.download.path,
    `/api/sales/${id}/receipt-certificate?profile=receipt_a5_landscape_v1&mode=preprinted_overlay`);
  const front = buildReceiptDocumentPayloadV2({
    ...base, documentProfileId: RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
    renderMode: RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN_FRONT_ONLY,
  });
  assert.equal(front.printProfileId, RECEIPT_PRINT_PROFILE_A5_V1);
  assert.equal(front.metadata.renderMode, RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN_FRONT_ONLY);
  assert.equal(front.download.path,
    `/api/sales/${id}/receipt-certificate?profile=receipt_a5_landscape_v1&mode=full_design_front_only`);
}

async function main() {
  checkHardwarePayload();
  installNextFontTestStub();
  // Crucial: no static runtime import of the renderer above this line.
  const { ReceiptCertificateHtmlDocument } = await import(
    "@/features/sales/documents/receipt-certificate-html"
  );
  const data = buildDiscountedMultiItemFixture();
  const outputDir = KEEP_OUTPUT
    ? path.resolve(".data/receipt-contract-output")
    : fs.mkdtempSync(path.join(os.tmpdir(), "ajrms-receipt-contract-"));
  fs.mkdirSync(outputDir, { recursive: true });

  let browser: Browser | undefined;
  try {
    try {
      browser = await chromium.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: getExecutablePath(),
        headless: true,
      });
    } catch (error) {
      throw new Error(
        "Chromium Playwright belum dapat dijalankan. Pastikan sudah menjalankan `npx playwright install chromium` atau atur PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.",
        { cause: error },
      );
    }

    assert.ok(browser, "Playwright Chromium belum dibuat.");
    const totalItems = data.items.length;
    await renderPdfAndCheck(browser, ReceiptCertificateHtmlDocument,
      RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
      RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN,
      data, totalItems + 1, outputDir);
    await renderPdfAndCheck(browser, ReceiptCertificateHtmlDocument,
      RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
      RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN,
      data, totalItems + 1, outputDir);
    await renderPdfAndCheck(browser, ReceiptCertificateHtmlDocument,
      RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
      RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
      data, 2, outputDir);
    await renderPdfAndCheck(browser, ReceiptCertificateHtmlDocument,
      RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
      RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN_FRONT_ONLY,
      data, totalItems, outputDir);
    await renderPdfAndCheck(browser, ReceiptCertificateHtmlDocument,
      RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
      RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
      data, totalItems, outputDir);
    await checkPaymentOverlay(browser, ReceiptCertificateHtmlDocument, data);
    await checkSingleItemOverlay(browser, ReceiptCertificateHtmlDocument);
    await checkHeaderMetadataOverlay(browser, ReceiptCertificateHtmlDocument);

    console.log("PASS: PDF A4/A5 landscape & mode page counts.");
    console.log("PASS: A5 overlay exactly 4 payment rows; discount/multi-item unchanged in full_design.");
    console.log("PASS: Vendor label/overlay nominal alignment and TOTAL ITEM collision guard.");
    console.log("PASS: QR/photo vendor slot geometry, QR quiet zone, and A5 hardware payload contract.");
    console.log("PASS: Fixed vendor header rows, 3-line invoice clearance, and stable item/date/sales/outlet positions.");
    console.log("NOTE: Font brand di-stub khusus test; verifikasi visual/scan/print fisik tetap diperlukan.");
    if (KEEP_OUTPUT) console.log(`PDF tersedia di: ${outputDir}`);
  } finally {
    await browser?.close();
    if (!KEEP_OUTPUT) fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
