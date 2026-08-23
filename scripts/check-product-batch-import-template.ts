import assert from "node:assert/strict";

import * as XLSX from "xlsx";

import {
  PRODUCT_BATCH_IMPORT_FORBIDDEN_OPERATOR_HEADERS,
  PRODUCT_BATCH_IMPORT_LIMITS,
  PRODUCT_BATCH_IMPORT_TEMPLATE_FILENAME,
  PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
  PRODUCT_BATCH_IMPORT_TYPE,
  PRODUCT_BATCH_IMPORT_V2_HEADERS,
  PRODUCT_BATCH_IMPORT_V2_SHEET_NAME,
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
  assert.deepEqual(
    actual.slice(0, expected.length),
    [...expected],
    `${name} headers tidak sesuai contract.`,
  );
  assert.equal(
    actual.length,
    expected.length,
    `${name} tidak boleh mempunyai header ekstra.`,
  );
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
    [PRODUCT_BATCH_IMPORT_V2_SHEET_NAME],
    "Template resmi v2 harus hanya mempunyai worksheet PRODUCTS.",
  );

  const productRows = getSheetRows(workbook, PRODUCT_BATCH_IMPORT_V2_SHEET_NAME);
  assertHeaders(
    productRows[0] ?? [],
    PRODUCT_BATCH_IMPORT_V2_HEADERS,
    PRODUCT_BATCH_IMPORT_V2_SHEET_NAME,
  );
  assert.equal(
    productRows.length > 1,
    expectSamples,
    "Sample row PRODUCTS tidak sesuai mode generator.",
  );

  const normalizedHeaders = new Set(
    (productRows[0] ?? []).map((value) => String(value).toLowerCase()),
  );
  for (const forbiddenHeader of PRODUCT_BATCH_IMPORT_FORBIDDEN_OPERATOR_HEADERS) {
    assert.ok(
      !normalizedHeaders.has(forbiddenHeader),
      `Template v2 tidak boleh menyediakan kolom operator ${forbiddenHeader}.`,
    );
  }
  for (const retired of [
    "master_key",
    "row_key",
    "primary_image",
    "cost_amount",
    "selling_amount",
    "price_per_gram",
    "size",
    "gemstone",
    "location_code",
    "initial_availability",
  ]) {
    assert.ok(!normalizedHeaders.has(retired), `Template v2 tidak boleh mengekspos ${retired}.`);
  }

  assertNoFormulaOrHyperlink(workbook, PRODUCT_BATCH_IMPORT_V2_SHEET_NAME);
}

const withSamples = buildProductBatchImportTemplateBuffer({ includeSampleRows: true });
const withoutSamples = buildProductBatchImportTemplateBuffer({ includeSampleRows: false });

assert.equal(PRODUCT_BATCH_IMPORT_TEMPLATE_FILENAME, "products.xlsx");
assert.equal(PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION, "2");
assert.equal(PRODUCT_BATCH_IMPORT_TYPE, "single_sheet_products_create");
assertTemplate(withSamples, true);
assertTemplate(withoutSamples, false);

console.log("Pemeriksaan Product Batch Import template berhasil.");
console.log("- Template resmi bernama products.xlsx dan hanya mempunyai worksheet PRODUCTS.");
console.log("- Header v2 exact tanpa pricing/cost/master_key/row_key dan baggage field lama.");
console.log("- Workbook dengan dan tanpa sample row sama-sama valid serta bebas formula/hyperlink.");
