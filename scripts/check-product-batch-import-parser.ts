import assert from "node:assert/strict";

import sharp from "sharp";
import * as XLSX from "xlsx";

import { buildXlsxBuffer } from "../src/lib/export-files";
import {
  PRODUCT_BATCH_IMPORT_LIMITS,
  PRODUCT_BATCH_IMPORT_MASTER_HEADERS,
} from "../src/features/product-batch-import/contracts";
import { ProductBatchImageError } from "../src/features/product-batch-import/image-manifest";
import { parseProductBatchImportPackage } from "../src/features/product-batch-import/package-parser";
import {
  ProductBatchWorkbookError,
  parseProductBatchWorkbook,
} from "../src/features/product-batch-import/xlsx-parser";
import {
  buildProductBatchImportTemplateBuffer,
  buildProductBatchImportTemplateSheets,
} from "../src/features/product-batch-import/template";
import {
  buildTestZip,
  repackZipWithExtraEntries,
} from "./lib/product-batch-import-test-zip";
import {
  extractStrictZipEntry,
  inspectStrictZipArchive,
} from "../src/features/product-batch-import/zip-reader";

async function expectAsyncCode(
  code: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    return error instanceof Error && "code" in error && (error as { code?: string }).code === code;
  });
}

function expectWorkbookCode(code: string, operation: () => unknown): void {
  assert.throws(operation, (error: unknown) => {
    return error instanceof ProductBatchWorkbookError && error.code === code;
  });
}

async function makeJpeg() {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 220, g: 180, b: 80 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

function validOuterZip(workbook: Buffer, jpeg: Buffer, extras = [] as Array<{ path: string; data: Buffer }>) {
  return buildTestZip([
    { path: "products.xlsx", data: workbook },
    { path: "images/masters/MASTER-001.jpg", data: jpeg },
    { path: "images/masters/MASTER-002.jpg", data: jpeg },
    { path: "images/physical/ITEM-001.jpg", data: jpeg },
    ...extras,
  ]);
}

function rewriteWorkbookContentTypes(
  workbook: Buffer,
  transform: (xml: string) => string,
): Buffer {
  const inspection = inspectStrictZipArchive(workbook, {
    maxArchiveBytes: 10 * 1024 * 1024,
    maxEntries: 1_000,
    maxUncompressedBytes: 64 * 1024 * 1024,
    maxFileNameBytes: 1_024,
  });

  return buildTestZip(
    inspection.entries
      .filter((entry) => !entry.isDirectory)
      .map((entry) => {
        const extracted = extractStrictZipEntry(workbook, entry);
        return {
          path: entry.path,
          data:
            entry.path === "[Content_Types].xml"
              ? Buffer.from(transform(extracted.toString("utf8")), "utf8")
              : extracted,
          method: entry.compressionMethod,
        };
      }),
  );
}

async function main() {
  const jpeg = await makeJpeg();
  const validWorkbook = buildProductBatchImportTemplateBuffer({
    generatedAt: new Date("2026-08-10T00:00:00.000Z"),
    includeSampleRows: true,
  });
  const validPackage = await parseProductBatchImportPackage(validOuterZip(validWorkbook, jpeg));
  assert.equal(validPackage.workbook.templateVersion, "1");
  assert.equal(validPackage.workbook.masterRows.length, 2);
  assert.equal(validPackage.workbook.itemRows.length, 3);
  assert.equal(validPackage.images.entries.length, 3);
  assert.equal(validPackage.images.warnings.length, 0);
  assert.match(validPackage.archive.archiveSha256, /^[0-9a-f]{64}$/);
  assert.match(validPackage.workbook.masterRows[0]?.rowFingerprint ?? "", /^[0-9a-f]{64}$/);

  const googleSheetsStyleWorkbook = rewriteWorkbookContentTypes(validWorkbook, (xml) =>
    xml.replace(
      /<Override\s+PartName="\/xl\/workbook\.xml"\s+ContentType="([^"]+)"\s*\/>/i,
      '<Override ContentType="$1" PartName="/xl/workbook.xml"/>',
    ),
  );
  const googleSheetsStylePackage = await parseProductBatchImportPackage(
    validOuterZip(googleSheetsStyleWorkbook, jpeg),
  );
  assert.equal(googleSheetsStylePackage.workbook.templateVersion, "1");

  const unusedPackage = await parseProductBatchImportPackage(
    validOuterZip(validWorkbook, jpeg, [{ path: "images/physical/UNUSED.jpg", data: jpeg }]),
  );
  assert.equal(unusedPackage.images.warnings.length, 1);
  assert.equal(unusedPackage.images.warnings[0]?.code, "UNUSED_IMAGE");

  await expectAsyncCode("IMAGE_REFERENCE_MISSING", async () => {
    const missing = buildTestZip([
      { path: "products.xlsx", data: validWorkbook },
      { path: "images/masters/MASTER-001.jpg", data: jpeg },
      { path: "images/physical/ITEM-001.jpg", data: jpeg },
    ]);
    await parseProductBatchImportPackage(missing);
  });

  await expectAsyncCode("IMAGE_MIME_MISMATCH", async () => {
    const invalid = buildTestZip([
      { path: "products.xlsx", data: validWorkbook },
      { path: "images/masters/MASTER-001.jpg", data: Buffer.from("not-an-image") },
      { path: "images/masters/MASTER-002.jpg", data: jpeg },
      { path: "images/physical/ITEM-001.jpg", data: jpeg },
    ]);
    await parseProductBatchImportPackage(invalid);
  });

  const formulaBook = XLSX.read(validWorkbook, { type: "buffer", cellFormula: true });
  const formulaSheet = formulaBook.Sheets.PRODUCT_MASTERS;
  assert.ok(formulaSheet);
  formulaSheet.B2 = { t: "n", v: 2, f: "1+1" };
  const formulaBuffer = XLSX.write(formulaBook, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
  expectWorkbookCode("WORKBOOK_FORMULA_REJECTED", () => parseProductBatchWorkbook(formulaBuffer));

  const hyperlinkBook = XLSX.read(validWorkbook, { type: "buffer", cellFormula: true });
  const hyperlinkSheet = hyperlinkBook.Sheets.PRODUCT_MASTERS;
  assert.ok(hyperlinkSheet?.B2);
  hyperlinkSheet.B2.l = { Target: "https://example.com" };
  const hyperlinkBuffer = XLSX.write(hyperlinkBook, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
  expectWorkbookCode("WORKBOOK_HYPERLINK_REJECTED", () => parseProductBatchWorkbook(hyperlinkBuffer));

  const hiddenBook = XLSX.read(validWorkbook, { type: "buffer" });
  assert.ok(hiddenBook.Workbook?.Sheets?.[0]);
  hiddenBook.Workbook.Sheets[0]!.Hidden = 1;
  const hiddenBuffer = XLSX.write(hiddenBook, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
  expectWorkbookCode("WORKBOOK_HIDDEN_SHEET", () => parseProductBatchWorkbook(hiddenBuffer));

  const unsupportedSheets = buildProductBatchImportTemplateSheets({
    generatedAt: new Date("2026-08-10T00:00:00.000Z"),
    includeSampleRows: false,
  });
  unsupportedSheets[0]!.rows[0]![1] = "999";
  const unsupportedBuffer = buildXlsxBuffer(unsupportedSheets);
  expectWorkbookCode("WORKBOOK_TEMPLATE_UNSUPPORTED", () => parseProductBatchWorkbook(unsupportedBuffer));

  const tooManySheets = buildProductBatchImportTemplateSheets({
    generatedAt: new Date("2026-08-10T00:00:00.000Z"),
    includeSampleRows: false,
  });
  tooManySheets[1]!.rows = Array.from({ length: PRODUCT_BATCH_IMPORT_LIMITS.masterRows + 1 }, (_, index) => [
    `MASTER-${index + 1}`,
    "Name",
    "CATEGORY",
    "",
    "",
    "",
    "",
    "master.jpg",
    "active",
  ]);
  assert.equal(tooManySheets[1]!.columns.length, PRODUCT_BATCH_IMPORT_MASTER_HEADERS.length);
  const tooManyRowsBuffer = buildXlsxBuffer(tooManySheets);
  expectWorkbookCode("WORKBOOK_RANGE_LIMIT", () => parseProductBatchWorkbook(tooManyRowsBuffer));

  const harmlessDrawing = repackZipWithExtraEntries(validWorkbook, [
    {
      path: "xl/drawings/drawing1.xml",
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"/>',
      ),
    },
  ]);
  const harmlessDrawingWorkbook = parseProductBatchWorkbook(harmlessDrawing);
  assert.equal(harmlessDrawingWorkbook.templateVersion, "1");

  const externalDrawingRelationship = repackZipWithExtraEntries(harmlessDrawing, [
    {
      path: "xl/drawings/_rels/drawing1.xml.rels",
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/external" TargetMode="External"/></Relationships>',
      ),
    },
  ]);
  expectWorkbookCode("WORKBOOK_ACTIVE_CONTENT_REJECTED", () =>
    parseProductBatchWorkbook(externalDrawingRelationship),
  );

  const embeddedMedia = repackZipWithExtraEntries(validWorkbook, [
    { path: "xl/media/image1.png", data: Buffer.from("fake") },
  ]);
  expectWorkbookCode("WORKBOOK_ACTIVE_CONTENT_REJECTED", () => parseProductBatchWorkbook(embeddedMedia));

  const macroWorkbook = repackZipWithExtraEntries(validWorkbook, [
    { path: "xl/vbaProject.bin", data: Buffer.from("fake-vba") },
  ]);
  expectWorkbookCode("WORKBOOK_ACTIVE_CONTENT_REJECTED", () => parseProductBatchWorkbook(macroWorkbook));

  assert.ok(ProductBatchImageError);
  console.log("Pemeriksaan Product Batch Import parser berhasil.");
  console.log("- Valid package, SHA-256 row/archive, dan image manifest terbaca.");
  console.log("- Missing/invalid image ditolak; unused image menjadi warning.");
  console.log("- Formula, hyperlink, hidden sheet, unsupported template, dan over-row ditolak.");
  console.log("- XLSX valid dengan urutan atribut OOXML berbeda tetap diterima.");
  console.log("- Drawing XML tanpa media/external relationship diterima; embedded media/external content tetap ditolak.");
}

void main();
