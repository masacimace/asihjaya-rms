import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import { parseLegacyProductWorkbook } from "../src/features/legacy-migration/xlsx-parser";

const projectRoot = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(relativePath: string): string {
  const absolutePath = path.join(projectRoot, relativePath);
  assert(existsSync(absolutePath), `${relativePath} wajib tersedia.`);
  return readFileSync(absolutePath, "utf8");
}

const headers = [
  "No",
  "Kode Produk",
  "Kategori (*)",
  "Kode Master Produk (*)",
  "Nama Master Produk (*)",
  "Nama Produk Per SKU (*)",
  "Kadar Persen (*)",
  "Kadar Tukaran (*)",
  "Harga (*)",
  "Potongan / Gram (*)",
  "Berat / Gram (*)",
  "Warna (*)",
  "Foto (*) (Pastikan Posisi Gambar didalam kolom) (*)",
];

const rows: unknown[][] = [
  headers,
  [
    1,
    3037,
    "CINCIN",
    "CIN/01",
    "Cincin Nikah",
    "Cincin Test 1",
    40,
    48,
    980000,
    25000,
    2.1,
    "Kombinasi",
    "https://legacy.example.test/item-1.jpeg",
  ],
  [
    2,
    "000881",
    "Kalung",
    "KLG/01",
    "Kalung Anak",
    "Kalung Test 1",
    40,
    49.5,
    0,
    25000,
    3.2,
    "Poles",
    "https://legacy.example.test/item-2.jpeg",
  ],
  [
    3,
    123456,
    "GELANG",
    "GLG/01",
    "Gelang Rantai",
    "Gelang Test 1",
    70,
    75,
    1500000,
    30000,
    4.5,
    "Kuning",
    "https://legacy.example.test/item-3.jpeg",
  ],
  [
    4,
    "123456",
    "GELANG",
    "GLG/01",
    "Gelang Rantai",
    "Gelang Test 2",
    70,
    75,
    1500000,
    30000,
    4.7,
    "Kuning",
    "https://legacy.example.test/item-4.jpeg",
  ],
];

const worksheet = XLSX.utils.aoa_to_sheet(rows);
worksheet.M2 = {
  t: "s",
  v: "Lihat Gambar",
  f: 'HYPERLINK("https://legacy.example.test/item-1.jpeg", "Lihat Gambar")',
  l: { Target: "https://legacy.example.test/item-1.jpeg" },
} as XLSX.CellObject;
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Worksheet");
const workbookBuffer = Buffer.from(
  XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
);

const parsed = parseLegacyProductWorkbook(workbookBuffer);
assert(parsed.rows.length === 4, "Parser harus membaca empat baris synthetic.");
assert(
  parsed.rows[0]?.normalizedBarcode === "003037",
  "Barcode numerik harus dipad menjadi enam digit.",
);
assert(
  parsed.rows[1]?.normalizedBarcode === "000881",
  "Leading zero barcode teks harus dipertahankan.",
);
assert(
  parsed.rows[0]?.legacyImageUrl ===
    "https://legacy.example.test/item-1.jpeg",
  "URL HYPERLINK harus dapat diekstrak.",
);
assert(
  parsed.summary.duplicateBarcodeCount === 1,
  "Satu nilai barcode duplikat harus terdeteksi.",
);
assert(
  parsed.rows.filter((row) => row.validationStatus === "invalid").length === 2,
  "Kedua baris dengan barcode duplikat harus invalid.",
);
assert(
  parsed.rows[1]?.validationIssues.some(
    (issue) => issue.code === "PRICE_MISSING_OR_ZERO",
  ),
  "Harga nol harus menjadi warning dan tidak dipercaya sebagai pricing aktif.",
);
assert(
  parsed.summary.sourceWarnings.some((warning) =>
    warning.includes("tidak memiliki status stok"),
  ),
  "Summary wajib menegaskan bahwa status stok legacy tidak tersedia.",
);

const actionSource = read("src/app/actions/legacy-product-import.ts");
assert(
  actionSource.includes('requirePermission("migration.import")'),
  "Import harus dilindungi permission migration.import.",
);
assert(
  !actionSource.includes("productItems"),
  "Milestone 1 tidak boleh menyentuh product_items.",
);
assert(
  actionSource.includes("pg_advisory_xact_lock"),
  "Import harus memakai advisory lock untuk duplicate race.",
);
assert(
  actionSource.includes("INSERT_CHUNK_SIZE"),
  "11 ribu baris harus dimasukkan secara chunked.",
);

const schemaSource = read("src/db/schema/index.ts");
for (const contract of [
  '"legacy_product_import_batches"',
  '"legacy_product_rows"',
  '"item_barcodes"',
  "item_barcodes_org_active_value_uq",
  "item_barcodes_item_active_primary_uq",
]) {
  assert(schemaSource.includes(contract), `Schema wajib memiliki ${contract}.`);
}

const migrationSource = read(
  "drizzle/0004_legacy_product_migration_foundation.sql",
);
for (const contract of [
  "legacy_product_import_batches",
  "legacy_product_rows",
  "item_barcodes_org_active_value_uq",
  "migration.view",
  "migration.import",
]) {
  assert(migrationSource.includes(contract), `Migration wajib memiliki ${contract}.`);
}

const routeSource = read("src/app/(admin)/admin/migrasi-produk/page.tsx");
assert(
  routeSource.includes("Tidak ada baris yang otomatis menjadi stok aktif"),
  "Halaman import harus menjelaskan guardrail inventory aktif.",
);

console.log(
  "OK: parser XLSX, leading zero, hyperlink, duplicate guard, staging-only contract, permission, schema, dan route migrasi tervalidasi.",
);
