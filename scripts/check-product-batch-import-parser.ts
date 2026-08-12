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
  buildEmbeddedImageWorkbookFixture,
  buildInCellImageWorkbookFixture,
} from "./lib/product-batch-import-embedded-xlsx";
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
    { path: "masters/MASTER-001.jpg", data: jpeg },
    { path: "masters/MASTER-002.jpg", data: jpeg },
    { path: "physical/ITEM-001.jpg", data: jpeg },
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

function rewriteWorkbookEntry(
  workbook: Buffer,
  entryPath: string,
  transform: (xml: string) => string,
): Buffer {
  const inspection = inspectStrictZipArchive(workbook, {
    maxArchiveBytes: 10 * 1024 * 1024,
    maxEntries: 1_000,
    maxUncompressedBytes: 64 * 1024 * 1024,
    maxFileNameBytes: 1_024,
  });
  let found = false;
  const result = buildTestZip(
    inspection.entries
      .filter((entry) => !entry.isDirectory)
      .map((entry) => {
        const extracted = extractStrictZipEntry(workbook, entry);
        if (entry.path !== entryPath) {
          return { path: entry.path, data: extracted, method: entry.compressionMethod };
        }
        found = true;
        return {
          path: entry.path,
          data: Buffer.from(transform(extracted.toString("utf8")), "utf8"),
          method: entry.compressionMethod,
        };
      }),
  );
  assert.ok(found, `Fixture entry tidak ditemukan: ${entryPath}`);
  return result;
}

function blankWorksheetCells(worksheetXml: string, addresses: string[]) {
  let nextXml = worksheetXml;
  for (const address of addresses) {
    const cellPattern = new RegExp(
      `<c\\b[^>]*\\br=["']${address}["'][^>]*>(?:[\\s\\S]*?)<\\/c>|<c\\b[^>]*\\br=["']${address}["'][^>]*/>`,
      "i",
    );
    assert.match(nextXml, cellPattern, `Fixture cell tidak ditemukan: ${address}`);
    nextXml = nextXml.replace(cellPattern, "");
  }
  return nextXml;
}

function blankEmbeddedImageTextCells(workbookBuffer: Buffer) {
  const mastersBlanked = rewriteWorkbookEntry(
    workbookBuffer,
    "xl/worksheets/sheet2.xml",
    (xml) => blankWorksheetCells(xml, ["H2", "H3"]),
  );
  return rewriteWorkbookEntry(
    mastersBlanked,
    "xl/worksheets/sheet3.xml",
    (xml) => blankWorksheetCells(xml, ["Q2"]),
  );
}

function addGoogleSheetsEmptyDrawingContainers(workbookBuffer: Buffer) {
  const inspection = inspectStrictZipArchive(workbookBuffer, {
    maxArchiveBytes: 10 * 1024 * 1024,
    maxEntries: 1_000,
    maxUncompressedBytes: 64 * 1024 * 1024,
    maxFileNameBytes: 1_024,
  });
  const entries = inspection.entries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({
      path: entry.path,
      data: extractStrictZipEntry(workbookBuffer, entry),
      method: entry.compressionMethod,
    }));
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));

  for (const [sheetPath, drawingIndex] of [
    ["xl/worksheets/sheet1.xml", 99],
    ["xl/worksheets/sheet4.xml", 100],
  ] as const) {
    const worksheet = byPath.get(sheetPath);
    assert.ok(worksheet);
    const relationshipId = `rIdGoogleEmpty${drawingIndex}`;
    const worksheetXml = worksheet.data.toString("utf8");
    assert.ok(!/<(?:[A-Za-z_][\w.-]*:)?drawing\b/i.test(worksheetXml));
    worksheet.data = Buffer.from(
      worksheetXml.replace(
        "</worksheet>",
        `<drawing r:id="${relationshipId}"/></worksheet>`,
      ),
      "utf8",
    );

    const relationshipsPath = `${sheetPath.replace(/\/[^/]+$/, "")}/_rels/${sheetPath.split("/").pop()}.rels`;
    const existingRelationships = byPath.get(relationshipsPath);
    const relationshipTag = `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIndex}.xml"/>`;
    if (existingRelationships) {
      existingRelationships.data = Buffer.from(
        existingRelationships.data
          .toString("utf8")
          .replace("</Relationships>", `${relationshipTag}</Relationships>`),
        "utf8",
      );
    } else {
      byPath.set(relationshipsPath, {
        path: relationshipsPath,
        data: Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationshipTag}</Relationships>`,
          "utf8",
        ),
        method: 8 as const,
      });
    }

    byPath.set(`xl/drawings/drawing${drawingIndex}.xml`, {
      path: `xl/drawings/drawing${drawingIndex}.xml`,
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"/>',
        "utf8",
      ),
      method: 8 as const,
    });
  }

  const contentTypes = byPath.get("[Content_Types].xml");
  assert.ok(contentTypes);
  contentTypes.data = Buffer.from(
    contentTypes.data.toString("utf8").replace(
      "</Types>",
      '<Override PartName="/xl/drawings/drawing99.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/drawings/drawing100.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>',
    ),
    "utf8",
  );

  return buildTestZip([...byPath.values()]);
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
  assert.equal(validPackage.packageKind, "zip");
  assert.ok(validPackage.archive);
  assert.match(validPackage.archive.archiveSha256, /^[0-9a-f]{64}$/);
  assert.match(validPackage.workbook.masterRows[0]?.rowFingerprint ?? "", /^[0-9a-f]{64}$/);

  const embeddedBase = blankEmbeddedImageTextCells(validWorkbook);
  const embeddedWorkbook = buildEmbeddedImageWorkbookFixture(embeddedBase, [
    { sheetName: "PRODUCT_MASTERS", rowNumber: 2, columnIndex: 7, data: jpeg, extension: ".jpg" },
    { sheetName: "PRODUCT_MASTERS", rowNumber: 3, columnIndex: 7, data: jpeg, extension: ".jpg" },
    { sheetName: "PHYSICAL_PRODUCTS", rowNumber: 2, columnIndex: 16, data: jpeg, extension: ".jpg" },
  ]);
  const embeddedPackage = await parseProductBatchImportPackage(embeddedWorkbook, {
    fileName: "products-embedded.xlsx",
  });
  assert.equal(embeddedPackage.packageKind, "xlsx_embedded");
  assert.equal(embeddedPackage.archive, null);
  assert.equal(embeddedPackage.images.entries.length, 3);
  assert.match(
    String(embeddedPackage.workbook.masterRows[0]?.normalizedPayload.primary_image ?? ""),
    /^EMBEDDED-MASTER-ROW-0002\.jpg$/,
  );
  assert.match(
    String(embeddedPackage.workbook.itemRows[0]?.normalizedPayload.physical_image ?? ""),
    /^EMBEDDED-PHYSICAL-ROW-0002\.jpg$/,
  );

  const inCellWorkbook = buildInCellImageWorkbookFixture(embeddedBase, [
    { sheetName: "PRODUCT_MASTERS", rowNumber: 2, columnIndex: 7, data: jpeg, extension: ".jpg" },
    { sheetName: "PRODUCT_MASTERS", rowNumber: 3, columnIndex: 7, data: jpeg, extension: ".jpg" },
    { sheetName: "PHYSICAL_PRODUCTS", rowNumber: 2, columnIndex: 16, data: jpeg, extension: ".jpg" },
  ]);
  const inCellPackage = await parseProductBatchImportPackage(inCellWorkbook, {
    fileName: "products-picture-in-cell.xlsx",
  });
  assert.equal(inCellPackage.packageKind, "xlsx_embedded");
  assert.equal(inCellPackage.archive, null);
  assert.equal(inCellPackage.images.entries.length, 3);
  assert.match(
    String(inCellPackage.workbook.masterRows[0]?.normalizedPayload.primary_image ?? ""),
    /^EMBEDDED-MASTER-ROW-0002\.jpg$/,
  );
  assert.match(
    String(inCellPackage.workbook.itemRows[0]?.normalizedPayload.physical_image ?? ""),
    /^EMBEDDED-PHYSICAL-ROW-0002\.jpg$/,
  );

  const nestedInCellWorkbook = buildInCellImageWorkbookFixture(
    embeddedBase,
    [
      { sheetName: "PRODUCT_MASTERS", rowNumber: 2, columnIndex: 7, data: jpeg, extension: ".jpg" },
      { sheetName: "PRODUCT_MASTERS", rowNumber: 3, columnIndex: 7, data: jpeg, extension: ".jpg" },
      { sheetName: "PHYSICAL_PRODUCTS", rowNumber: 2, columnIndex: 16, data: jpeg, extension: ".jpg" },
    ],
    { relationshipTopology: "nested" },
  );
  const nestedInCellPackage = await parseProductBatchImportPackage(
    nestedInCellWorkbook,
    { fileName: "products-picture-in-cell-nested.xlsx" },
  );
  assert.equal(nestedInCellPackage.images.entries.length, 3);

  await expectAsyncCode("WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID", async () => {
    const wrongInCellColumn = buildInCellImageWorkbookFixture(embeddedBase, [
      { sheetName: "PRODUCT_MASTERS", rowNumber: 2, columnIndex: 6, data: jpeg, extension: ".jpg" },
    ]);
    await parseProductBatchImportPackage(wrongInCellColumn, {
      fileName: "picture-in-cell-wrong-column.xlsx",
    });
  });

  const webImageWorkbook = rewriteWorkbookEntry(
    inCellWorkbook,
    "xl/richData/rdrichvaluestructure.xml",
    (xml) => xml.replace('t="_localImage"', 't="_webimage"'),
  );
  await expectAsyncCode("WORKBOOK_RICH_VALUE_IMAGE_UNSUPPORTED", () =>
    parseProductBatchImportPackage(webImageWorkbook, {
      fileName: "picture-in-cell-web-image.xlsx",
    }),
  );

  expectWorkbookCode("WORKBOOK_ACTIVE_CONTENT_REJECTED", () =>
    parseProductBatchWorkbook(inCellWorkbook),
  );

  const googleSheetsEmptyDrawingWorkbook =
    addGoogleSheetsEmptyDrawingContainers(embeddedWorkbook);
  const googleSheetsEmbeddedPackage = await parseProductBatchImportPackage(
    googleSheetsEmptyDrawingWorkbook,
    { fileName: "google-sheets-embedded.xlsx" },
  );
  assert.equal(googleSheetsEmbeddedPackage.images.entries.length, 3);
  assert.equal(googleSheetsEmbeddedPackage.workbook.masterRows.length, 2);
  assert.equal(googleSheetsEmbeddedPackage.workbook.itemRows.length, 3);

  await expectAsyncCode("WORKBOOK_EMBEDDED_IMAGE_TEXT_CONFLICT", async () => {
    const conflicting = buildEmbeddedImageWorkbookFixture(validWorkbook, [
      { sheetName: "PRODUCT_MASTERS", rowNumber: 2, columnIndex: 7, data: jpeg, extension: ".jpg" },
    ]);
    await parseProductBatchImportPackage(conflicting, { fileName: "conflict.xlsx" });
  });

  await expectAsyncCode("WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID", async () => {
    const wrongColumn = buildEmbeddedImageWorkbookFixture(embeddedBase, [
      { sheetName: "PRODUCT_MASTERS", rowNumber: 2, columnIndex: 6, data: jpeg, extension: ".jpg" },
    ]);
    await parseProductBatchImportPackage(wrongColumn, { fileName: "wrong-column.xlsx" });
  });

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
    validOuterZip(validWorkbook, jpeg, [{ path: "physical/UNUSED.jpg", data: jpeg }]),
  );
  assert.equal(unusedPackage.images.warnings.length, 1);
  assert.equal(unusedPackage.images.warnings[0]?.code, "UNUSED_IMAGE");

  await expectAsyncCode("IMAGE_REFERENCE_MISSING", async () => {
    const missing = buildTestZip([
      { path: "products.xlsx", data: validWorkbook },
      { path: "masters/MASTER-001.jpg", data: jpeg },
      { path: "physical/ITEM-001.jpg", data: jpeg },
    ]);
    await parseProductBatchImportPackage(missing);
  });

  await expectAsyncCode("IMAGE_MIME_MISMATCH", async () => {
    const invalid = buildTestZip([
      { path: "products.xlsx", data: validWorkbook },
      { path: "masters/MASTER-001.jpg", data: Buffer.from("not-an-image") },
      { path: "masters/MASTER-002.jpg", data: jpeg },
      { path: "physical/ITEM-001.jpg", data: jpeg },
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
  // External hyperlinks are represented by OOXML external relationships.
  // The bounded container guard intentionally rejects them before SheetJS cell parsing.
  expectWorkbookCode("WORKBOOK_ACTIVE_CONTENT_REJECTED", () =>
    parseProductBatchWorkbook(hyperlinkBuffer),
  );

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
  console.log("- Formula, external hyperlink, hidden sheet, unsupported template, dan over-row ditolak.");
  console.log("- XLSX valid dengan urutan atribut OOXML berbeda tetap diterima.");
  console.log("- ZIP existing tetap kompatibel; single XLSX DrawingML dan local Picture in Cell dipetakan ke row/cell yang exact.");
  console.log("- Picture in Cell wrong-column/_webimage serta embedded image bercampur filename text ditolak deterministic.");
  console.log("- Empty drawing container ala Google Sheets pada METADATA/INSTRUCTIONS diterima tanpa melonggarkan lokasi image.");
  console.log("- Drawing XML tanpa media/external relationship diterima; embedded media pada mode ZIP/external content tetap ditolak.");
}

void main();
