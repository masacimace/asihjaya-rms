import assert from "node:assert/strict";

import { PRODUCT_BATCH_IMPORT_LIMITS } from "../src/features/product-batch-import/contracts";
import {
  ProductBatchArchiveError,
  inspectProductBatchArchive,
} from "../src/features/product-batch-import/archive-parser";
import { ProductBatchWorkbookError, parseProductBatchWorkbook } from "../src/features/product-batch-import/xlsx-parser";
import { buildProductBatchImportTemplateBuffer } from "../src/features/product-batch-import/template";
import { buildTestZip } from "./lib/product-batch-import-test-zip";

function expectArchiveCode(code: string, operation: () => unknown): void {
  assert.throws(operation, (error: unknown) => {
    return error instanceof ProductBatchArchiveError && error.code === code;
  });
}

const workbook = buildProductBatchImportTemplateBuffer({ includeSampleRows: false });

expectArchiveCode("ZIP_SIGNATURE_INVALID", () => inspectProductBatchArchive(Buffer.from("not-a-zip")));
expectArchiveCode("ZIP_PATH_TRAVERSAL", () =>
  inspectProductBatchArchive(
    buildTestZip([
      { path: "products.xlsx", data: workbook },
      { path: "../evil.jpg", data: Buffer.from("x") },
    ]),
  ),
);
expectArchiveCode("ZIP_DUPLICATE_ENTRY", () =>
  inspectProductBatchArchive(
    buildTestZip([
      { path: "products.xlsx", data: workbook },
      { path: "products.xlsx", data: workbook },
    ]),
  ),
);
expectArchiveCode("ARCHIVE_IMAGE_DUPLICATE_NORMALIZED", () =>
  inspectProductBatchArchive(
    buildTestZip([
      { path: "products.xlsx", data: workbook },
      { path: "masters/MASTER-001.JPG", data: Buffer.from("a") },
      { path: "masters/master-001.jpg", data: Buffer.from("b") },
    ]),
  ),
);
expectArchiveCode("ZIP_SYMLINK_UNSUPPORTED", () =>
  inspectProductBatchArchive(
    buildTestZip([
      { path: "products.xlsx", data: workbook },
      {
        path: "masters/link.jpg",
        data: Buffer.alloc(0),
        versionMadeBy: 0x0314,
        externalAttributes: (0o120777 << 16) >>> 0,
      },
    ]),
  ),
);
expectArchiveCode("ARCHIVE_WORKBOOK_TOO_LARGE", () =>
  inspectProductBatchArchive(
    buildTestZip([
      {
        path: "products.xlsx",
        data: Buffer.from("tiny"),
        declaredUncompressedSize: PRODUCT_BATCH_IMPORT_LIMITS.workbookBytes + 1,
      },
    ]),
  ),
);
expectArchiveCode("ZIP_BOMB_LIMIT", () =>
  inspectProductBatchArchive(
    buildTestZip([
      {
        path: "products.xlsx",
        data: Buffer.from("tiny"),
        declaredUncompressedSize: PRODUCT_BATCH_IMPORT_LIMITS.archiveUncompressedBytes + 1,
      },
    ]),
  ),
);

const tooManyEntries = Array.from(
  { length: PRODUCT_BATCH_IMPORT_LIMITS.archiveEntries + 1 },
  (_, index) => ({ path: `masters/X-${index}.jpg`, data: Buffer.alloc(0) }),
);
expectArchiveCode("ZIP_TOO_MANY_ENTRIES", () => inspectProductBatchArchive(buildTestZip(tooManyEntries)));

expectArchiveCode("ZIP_FEATURE_UNSUPPORTED", () =>
  inspectProductBatchArchive(
    buildTestZip([{ path: "products.xlsx", data: workbook, flags: 0x0801 }]),
  ),
);
expectArchiveCode("ARCHIVE_PATH_UNSUPPORTED", () =>
  inspectProductBatchArchive(
    buildTestZip([
      { path: "products.xlsx", data: workbook },
      { path: "run.exe", data: Buffer.from("MZ") },
    ]),
  ),
);

assert.throws(
  () =>
    inspectProductBatchArchive(
      buildTestZip([
        { path: "products.xlsx", data: workbook },
        { path: "images/masters/MASTER-001.jpg", data: Buffer.from("x") },
      ]),
    ),
  (error: unknown) =>
    error instanceof ProductBatchArchiveError &&
    error.code === "ARCHIVE_PATH_UNSUPPORTED" &&
    error.message.includes("tepat satu file .xlsx di root") &&
    error.message.includes("physical/") &&
    error.message.includes("masters/"),
);

const arbitraryWorkbookNameInspection = inspectProductBatchArchive(
  buildTestZip([
    { path: "Gelang Rantai Kaki.xlsx", data: workbook },
    { path: "masters/MASTER-001.jpg", data: Buffer.from("legacy-master") },
    { path: "physical/ITEM-001.jpg", data: Buffer.from("physical") },
  ]),
);
assert.equal(
  arbitraryWorkbookNameInspection.workbookEntry.path,
  "Gelang Rantai Kaki.xlsx",
  "ZIP V2 harus menerima nama workbook .xlsx bebas di root.",
);
assert.equal(
  arbitraryWorkbookNameInspection.imageEntries.length,
  2,
  "Folder masters/ legacy dan physical/ harus tetap diterima sesuai compatibility contract.",
);

expectArchiveCode("ARCHIVE_WORKBOOK_DUPLICATE", () =>
  inspectProductBatchArchive(
    buildTestZip([
      { path: "products.xlsx", data: workbook },
      { path: "Produk Lain.xlsx", data: workbook },
    ]),
  ),
);

assert.throws(
  () => parseProductBatchWorkbook(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])),
  (error: unknown) => error instanceof ProductBatchWorkbookError && error.code === "WORKBOOK_CONTAINER_INVALID",
);

console.log("Pemeriksaan Product Batch Import security berhasil.");
console.log("- Corrupt ZIP, zip slip, duplicate entry/name, symlink, encryption, dan executable ditolak.");
console.log("- Workbook oversize, too-many-entry, dan archive-bomb declarations ditolak sebelum extraction.");
console.log("- Nama workbook .xlsx bebas di root diterima; multiple root workbook tetap ditolak.");
console.log("- Folder physical/ dan masters/ legacy tetap mengikuti compatibility contract.");
console.log("- Corrupt XLSX ditolak oleh bounded OOXML container guard.");
