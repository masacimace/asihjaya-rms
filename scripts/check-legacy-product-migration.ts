import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import { parseLegacyProductWorkbook } from "../src/features/legacy-migration/xlsx-parser";
import {
  collectVerificationReviewFlags,
  createVerificationFingerprint,
  normalizePhysicalBarcode,
} from "../src/features/legacy-migration/verification-rules";

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


assert(
  normalizePhysicalBarcode("3037", 6) === "003037",
  "Input manual barcode harus mempertahankan kontrak leading zero.",
);
assert(
  normalizePhysicalBarcode(" 003037 ", 6) === "003037",
  "Scanner harus menormalisasi whitespace barcode.",
);
const unmatchedFlags = collectVerificationReviewFlags({
  source: "physical_unmatched",
  legacyValidationStatus: null,
  mappedProductMasterId: null,
  selectedProductMasterId: "master-test",
  legacyItemName: null,
  verifiedItemName: "Item fisik test",
  legacyWeightGram: null,
  verifiedWeightGram: 2.5,
  legacyPurity: null,
  verifiedPurity: 40,
  legacyExchangePurity: null,
  verifiedExchangePurity: null,
  legacyColor: null,
  verifiedColor: "Poles",
  condition: "good",
  useLegacyImage: false,
  hasUploadedImage: true,
});
assert(
  unmatchedFlags.includes("BARCODE_NOT_FOUND_IN_LEGACY_EXPORT"),
  "Barcode unmatched harus selalu masuk review manager.",
);
const fingerprintA = createVerificationFingerprint({
  sessionId: "session",
  barcode: "003037",
  legacyRowId: "row",
  targetProductMasterId: "master",
  verifiedItemName: "Item",
  verifiedWeightGram: "2.5",
  verifiedPurity: "40",
  verifiedExchangePurity: null,
  verifiedColor: "Poles",
  condition: "good",
  useLegacyImage: true,
  staffNotes: null,
  imageSha256: null,
});
const fingerprintB = createVerificationFingerprint({
  sessionId: "session",
  barcode: "003037",
  legacyRowId: "row",
  targetProductMasterId: "master",
  verifiedItemName: "Item",
  verifiedWeightGram: "2.6",
  verifiedPurity: "40",
  verifiedExchangePurity: null,
  verifiedColor: "Poles",
  condition: "good",
  useLegacyImage: true,
  staffNotes: null,
  imageSha256: null,
});
assert(
  fingerprintA !== fingerprintB,
  "Fingerprint harus berubah ketika intent verifikasi berubah.",
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

const milestoneTwoMigrationSource = read(
  "drizzle/0005_legacy_master_mapping_sessions.sql",
);
for (const contract of [
  "legacy_product_master_mappings",
  "legacy_migration_sessions",
  "legacy_migration_session_assignments",
  "legacy_master_mapping_status",
  "legacy_migration_session_status",
  "migration.mapping.manage",
  "migration.session.manage",
]) {
  assert(
    milestoneTwoMigrationSource.includes(contract),
    `Migration Milestone 2 wajib memiliki ${contract}.`,
  );
}

const mappingActionSource = read(
  "src/app/actions/legacy-migration-management.ts",
);
for (const contract of [
  "migration.mapping.manage",
  "migration.session.manage",
  "pg_advisory_xact_lock",
  "status: \"draft\"",
  "legacyMigrationSessionAssignments",
]) {
  assert(
    mappingActionSource.includes(contract),
    `Action Milestone 2 wajib memiliki ${contract}.`,
  );
}

const importActionSource = read(
  "src/app/actions/legacy-product-import.ts",
);
assert(
  importActionSource.includes("collectLegacyMasterMappingSeeds"),
  "Import XLSX baru harus menyiapkan mapping master secara otomatis.",
);

const mappingPageSource = read(
  "src/app/(admin)/admin/migrasi-produk/[batchId]/mapping/page.tsx",
);
assert(
  mappingPageSource.includes("Tidak mengatur harga per item"),
  "Halaman mapping harus mempertahankan guardrail pricing per item.",
);

const sessionPageSource = read(
  "src/app/(admin)/admin/migrasi-produk/[batchId]/sesi/page.tsx",
);
const normalizedSessionPageSource = sessionPageSource.replace(/\s+/g, " ");
assert(
  normalizedSessionPageSource.includes(
    "Hasil scan hanya masuk antrean manager dan belum menjadi stok aktif",
  ),
  "Halaman sesi harus mempertahankan guardrail staging-only Milestone 3.",
);

const milestoneThreeMigrationSource = read(
  "drizzle/0006_legacy_physical_verification.sql",
);
for (const contract of [
  "legacy_migration_verifications",
  "legacy_migration_verification_source",
  "legacy_migration_verification_status",
  "legacy_migration_verifications_org_barcode_uq",
  "legacy_migration_verifications_photo_ck",
  "migration.scan",
  "migration.verification.submit",
]) {
  assert(
    milestoneThreeMigrationSource.includes(contract),
    `Migration Milestone 3 wajib memiliki ${contract}.`,
  );
}

const verificationActionSource = read(
  "src/app/actions/legacy-migration-verification.ts",
);
for (const contract of [
  'requirePermission("migration.scan")',
  'requirePermission("migration.verification.submit")',
  "pg_advisory_xact_lock",
  "legacyMigrationVerifications",
  "physical_unmatched",
  "needs_review",
  "submissionFingerprint",
  "SESSION_ASSIGNMENT_REMOVED",
  "TARGET_MASTER_UNAVAILABLE",
  "Gunakan foto legacy atau unggah foto aktual",
]) {
  assert(
    verificationActionSource.includes(contract),
    `Action verifikasi Milestone 3 wajib memiliki ${contract}.`,
  );
}
assert(
  !verificationActionSource.includes("insert(productItems)"),
  "Milestone 3 tidak boleh membuat product_items.",
);
assert(
  !verificationActionSource.includes("insert(itemBarcodes)"),
  "Milestone 3 tidak boleh membuat item_barcodes aktif.",
);

const verificationRulesSource = read(
  "src/features/legacy-migration/verification-rules.ts",
);
for (const contract of [
  'padStart(expectedLength, \"0\")',
  "BARCODE_NOT_FOUND_IN_LEGACY_EXPORT",
  "WEIGHT_CHANGED",
  "createVerificationFingerprint",
]) {
  assert(
    verificationRulesSource.includes(contract),
    `Verification rules wajib memiliki ${contract}.`,
  );
}

const scannerPageSource = read(
  "src/features/legacy-migration/components/mobile-migration-scanner.tsx",
);
for (const contract of [
  "CameraScannerModal",
  "Buka kamera / input manual",
  "Ajukan ke manager",
  "belum menjadi stok aktif",
  'capture="environment"',
]) {
  assert(
    scannerPageSource.includes(contract),
    `Mobile scanner wajib memiliki ${contract}.`,
  );
}

const posShellSource = read("src/components/layout/pos-shell.tsx");
assert(
  posShellSource.includes('href: "/pos/migrasi-barang"'),
  "POS shell custom harus menampilkan menu Migrasi Barang.",
);
assert(
  posShellSource.includes("canAccessMigration"),
  "Menu Migrasi Barang harus dibatasi permission.",
);

const routeSource = read("src/app/(admin)/admin/migrasi-produk/page.tsx");
assert(
  routeSource.includes("Tidak ada baris yang otomatis menjadi stok aktif"),
  "Halaman import harus menjelaskan guardrail inventory aktif.",
);

console.log(
  "OK: parser XLSX, staging-only contract, master mapping, session per etalase, mobile scanner, unmatched item, concurrency guard, permission, schema, dan route migrasi tervalidasi.",
);
