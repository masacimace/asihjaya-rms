import assert from "node:assert/strict";

import * as XLSX from "xlsx";

import {
  PRODUCT_BATCH_IMPORT_FORBIDDEN_OPERATOR_HEADERS,
  PRODUCT_BATCH_IMPORT_ITEM_HEADERS,
  PRODUCT_BATCH_IMPORT_LIMITS,
  PRODUCT_BATCH_IMPORT_MASTER_HEADERS,
  PRODUCT_BATCH_IMPORT_SHEET_NAMES,
  PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
  PRODUCT_BATCH_IMPORT_TYPE,
} from "../src/features/product-batch-import/contracts";
import { buildProductBatchImportTemplateBuffer } from "../src/features/product-batch-import/template";

function readWorkbook(buffer: Buffer) {
  return XLSX.read(buffer, {
    type: "buffer",
    cellFormula: true,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    dense: false,
  });
}

function getSheetRows(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  assert.ok(sheet, `Sheet ${name} harus tersedia.`);
  return XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
}

function assertHeaders(actual: unknown[], expected: readonly string[], name: string) {
  assert.deepEqual(actual.slice(0, expected.length), [...expected], `${name} headers tidak sesuai contract.`);
  assert.equal(actual.length, expected.length, `${name} tidak boleh mempunyai header ekstra.`);
}

function assertNoFormulaOrHyperlink(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  assert.ok(sheet, `Sheet ${sheetName} harus tersedia.`);

  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith("!")) continue;
    assert.ok(!cell.f, `${sheetName}!${address} tidak boleh mengandung formula.`);
    assert.ok(!cell.l, `${sheetName}!${address} tidak boleh mengandung hyperlink.`);
  }
}

function assertTemplate(buffer: Buffer, expectSamples: boolean) {
  assert.ok(buffer.length > 1_000, "Template XLSX terlalu kecil/tidak valid.");
  assert.ok(
    buffer.length <= PRODUCT_BATCH_IMPORT_LIMITS.workbookBytes,
    "Template XLSX melebihi batas workbook 5 MB.",
  );

  const workbook = readWorkbook(buffer);
  assert.deepEqual(
    workbook.SheetNames,
    [...PRODUCT_BATCH_IMPORT_SHEET_NAMES],
    "Nama/urutan sheet harus exact sesuai template v1.",
  );

  const metadataRows = getSheetRows(workbook, "METADATA");
  assertHeaders(metadataRows[0] ?? [], ["key", "value"], "METADATA");
  const metadata = new Map(metadataRows.slice(1).map((row) => [String(row[0] ?? ""), String(row[1] ?? "")]));
  assert.equal(metadata.get("template_version"), PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION);
  assert.equal(metadata.get("import_type"), PRODUCT_BATCH_IMPORT_TYPE);
  assert.match(metadata.get("generated_at") ?? "", /^\d{4}-\d{2}-\d{2}$/);

  const masterRows = getSheetRows(workbook, "PRODUCT_MASTERS");
  assertHeaders(masterRows[0] ?? [], PRODUCT_BATCH_IMPORT_MASTER_HEADERS, "PRODUCT_MASTERS");
  assert.equal(masterRows.length > 1, expectSamples, "Sample row PRODUCT_MASTERS tidak sesuai mode generator.");

  const itemRows = getSheetRows(workbook, "PHYSICAL_PRODUCTS");
  assertHeaders(itemRows[0] ?? [], PRODUCT_BATCH_IMPORT_ITEM_HEADERS, "PHYSICAL_PRODUCTS");
  assert.equal(itemRows.length > 1, expectSamples, "Sample row PHYSICAL_PRODUCTS tidak sesuai mode generator.");

  const normalizedHeaders = new Set(
    [...(masterRows[0] ?? []), ...(itemRows[0] ?? [])].map((value) => String(value).toLowerCase()),
  );
  for (const forbiddenHeader of PRODUCT_BATCH_IMPORT_FORBIDDEN_OPERATOR_HEADERS) {
    assert.ok(!normalizedHeaders.has(forbiddenHeader), `Template tidak boleh menyediakan kolom operator ${forbiddenHeader}.`);
  }

  const instructionRows = getSheetRows(workbook, "INSTRUCTIONS");
  assertHeaders(instructionRows[0] ?? [], ["bagian", "panduan"], "INSTRUCTIONS");
  assert.ok(instructionRows.length >= 8, "INSTRUCTIONS harus cukup lengkap untuk operator non-developer.");
  const instructionText = instructionRows.flat().map((value) => String(value)).join("\n");
  assert.ok(instructionText.includes("masters"), "INSTRUCTIONS harus menjelaskan folder masters/ di root ZIP.");
  assert.ok(instructionText.includes("physical"), "INSTRUCTIONS harus menjelaskan folder physical/ di root ZIP.");
  assert.ok(instructionText.includes("Google Sheets"), "INSTRUCTIONS harus menjelaskan workflow Google Sheets.");
  assert.ok(!instructionText.includes("images/masters"), "INSTRUCTIONS tidak boleh memakai layout images/masters lama.");
  assert.ok(!instructionText.includes("images/physical"), "INSTRUCTIONS tidak boleh memakai layout images/physical lama.");

  assertNoFormulaOrHyperlink(workbook, "PRODUCT_MASTERS");
  assertNoFormulaOrHyperlink(workbook, "PHYSICAL_PRODUCTS");
}

const deterministicDate = new Date("2026-08-10T00:00:00.000Z");
const withSamples = buildProductBatchImportTemplateBuffer({
  generatedAt: deterministicDate,
  includeSampleRows: true,
});
const withoutSamples = buildProductBatchImportTemplateBuffer({
  generatedAt: deterministicDate,
  includeSampleRows: false,
});

assertTemplate(withSamples, true);
assertTemplate(withoutSamples, false);

console.log("Pemeriksaan Product Batch Import template berhasil.");
console.log("- 4 sheet exact dan metadata v1 valid.");
console.log("- Header master/item exact tanpa identifier teknis operator.");
console.log("- Workbook dengan dan tanpa sample row sama-sama valid.");
console.log("- Data sheet bebas formula dan hyperlink.");
console.log("- Ukuran template berada di bawah limit workbook v1.");
