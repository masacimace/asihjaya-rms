import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";

import { ReceiptCertificateHtmlDocument } from "@/features/sales/documents/receipt-certificate-html";
import {
  RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
  RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
  receiptDocumentProfiles,
} from "@/features/sales/documents/receipt-document-profiles";
import { receiptCertificateSampleData } from "@/features/sales/documents/receipt-certificate-sample-data";
import { validateReceiptPdfBuffer } from "@/features/sales/documents/receipt-pdf-contract";
import {
  EPSON_L3251_PRINT_PROFILE_A4_V1,
  buildReceiptDocumentPayloadV2,
} from "@/lib/hardware/job-payload-contracts-v2";

const KEEP_OUTPUT = process.argv.includes("--keep-output");

function getExecutablePath() {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  if (configured) return configured;
  if (process.platform === "linux" && fs.existsSync("/usr/bin/chromium")) {
    return "/usr/bin/chromium";
  }
  return undefined;
}

function buildHtml(documentProfileId: keyof typeof receiptDocumentProfiles) {
  const markup = renderToStaticMarkup(
    <ReceiptCertificateHtmlDocument
      data={receiptCertificateSampleData}
      documentProfileId={documentProfileId}
    />,
  );

  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt Contract</title></head><body>${markup}</body></html>`;
}

async function renderProfile(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  documentProfileId: keyof typeof receiptDocumentProfiles,
  outputDir: string,
) {
  const profile = receiptDocumentProfiles[documentProfileId];
  const page = await browser.newPage({
    viewport: profile.viewport,
    deviceScaleFactor: 1,
  });
  try {
    await page.setContent(buildHtml(documentProfileId), { waitUntil: "load" });
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    const contract = validateReceiptPdfBuffer(pdf, profile);
    assert.equal(contract.pageCount, receiptCertificateSampleData.items.length);

    const outputPath = path.join(outputDir, `${documentProfileId}.pdf`);
    fs.writeFileSync(outputPath, pdf);
    return outputPath;
  } finally {
    await page.close();
  }
}

async function main() {
  const payload = buildReceiptDocumentPayloadV2({
    saleId: "8ad038f7-d346-4bd4-8f96-f3fd5c01af70",
    invoiceNumber: "AJ-TEST-0001",
    requestSource: "check.receipt_a4",
    reprint: false,
    requestedAt: new Date("2026-07-17T00:00:00.000Z"),
  });
  assert.equal(
    payload.documentProfileId,
    RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
  );
  assert.equal(payload.printProfileId, EPSON_L3251_PRINT_PROFILE_A4_V1);
  assert.equal(
    payload.download.path,
    "/api/sales/8ad038f7-d346-4bd4-8f96-f3fd5c01af70/receipt-certificate?profile=receipt_a4_landscape_v1",
  );

  const tempDir = KEEP_OUTPUT
    ? path.resolve(".data/receipt-contract-output")
    : fs.mkdtempSync(path.join(os.tmpdir(), "ajrms-receipt-contract-"));
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: getExecutablePath(),
    headless: true,
  });

  try {
    const a4Path = await renderProfile(
      browser,
      RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
      tempDir,
    );
    const a5Path = await renderProfile(
      browser,
      RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1,
      tempDir,
    );

    const a4Size = fs.statSync(a4Path).size;
    const a5Size = fs.statSync(a5Path).size;
    assert.ok(a4Size > 10_000, "A4 PDF terlalu kecil.");
    assert.ok(a5Size > 10_000, "A5 PDF terlalu kecil.");

    console.log("OK: receipt A4/A5 PDF contract dan secure payload valid.");
    if (KEEP_OUTPUT) console.log(`Output: ${tempDir}`);
  } finally {
    await browser.close();
    if (!KEEP_OUTPUT) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
