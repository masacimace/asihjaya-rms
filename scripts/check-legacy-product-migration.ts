import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import { parseLegacyProductWorkbook } from "../src/features/legacy-migration/xlsx-parser";
import type { LegacyCutoverIssueCode } from "../src/features/legacy-migration/cutover-contracts";
import {
  collectVerificationReviewFlags,
  createVerificationFingerprint,
  normalizePhysicalBarcode,
} from "../src/features/legacy-migration/verification-rules";
import {
  canBulkApproveLegacyVerification,
  getLegacyBarcodeAliasSource,
} from "../src/features/legacy-migration/review-rules";
import {
  isSoldDuringMigrationEligibleStatus,
  parseSoldDuringMigrationBarcodes,
} from "../src/features/legacy-migration/sold-rules";
import { getLegacyPhotoMigrationStatus } from "../src/features/legacy-migration/reconciliation-rules";
import {
  getLegacyCutoverAliasSource,
  getLegacyCutoverItemIssues,
  isLegacyCutoverSessionClosed,
  summarizeLegacyCutoverIssueCounts,
} from "../src/features/legacy-migration/cutover-rules";
import {
  calculateLegacyMigrationSellingAmount,
  resolveLegacyMigrationPricing,
} from "../src/features/legacy-migration/pricing-rules";
import {
  getLegacyMigrationSessionLockKey,
  isLegacyMigrationUuid,
  parseLegacyMigrationUuid,
} from "../src/features/legacy-migration/safety";
import { isLegacyImageUrlAllowed } from "../src/lib/storage/legacy-image-url-policy";

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
  calculateLegacyMigrationSellingAmount({
    weightGram: "2.125",
    pricePerGram: "980000",
  }) === "2082500",
  "Harga label migrasi harus memakai berat aktual dikali harga per gram.",
);
assert(
  calculateLegacyMigrationSellingAmount({
    weightGram: "0.001",
    pricePerGram: "500",
  }) === "1",
  "Harga label migrasi harus dibulatkan half-up ke Rupiah penuh.",
);
assert(
  calculateLegacyMigrationSellingAmount({
    weightGram: "999999999.999",
    pricePerGram: "999999999999999999",
  }) === null,
  "Harga label yang melebihi numeric(18,0) harus menjadi blocker, bukan menggagalkan approval.",
);
const regularPricing = resolveLegacyMigrationPricing({
  weightGram: "2.100",
  legacyPricePerGram: "980000",
  legacyDeductionPerGram: "25000",
  categoryName: "Cincin",
});
assert(
  regularPricing.sellingAmount === "2058000" &&
    regularPricing.pricePerGram === "980000" &&
    regularPricing.deductionPerGram === "25000",
  "Pricing legacy valid harus disalin ke Product Item saat approval.",
);
assert(
  resolveLegacyMigrationPricing({
    weightGram: "1.000",
    legacyPricePerGram: "1500000",
    legacyDeductionPerGram: null,
    categoryName: "Logam Mulia",
  }).deductionPerGram === "0",
  "Logam mulia boleh memakai potongan nol ketika XLSX tidak mengisinya.",
);
assert(
  resolveLegacyMigrationPricing({
    weightGram: "1.000",
    legacyPricePerGram: "1500000",
    legacyDeductionPerGram: null,
    categoryName: "Gelang",
  }).deductionPerGram === null,
  "Kategori selain logam mulia harus tetap diblokir bila potongan tidak tersedia.",
);


assert(
  normalizePhysicalBarcode("3037", 6) === "003037",
  "Input manual barcode harus mempertahankan kontrak leading zero.",
);
assert(
  normalizePhysicalBarcode(" 003037 ", 6) === "003037",
  "Scanner harus menormalisasi whitespace barcode.",
);
assert(
  isLegacyMigrationUuid("550e8400-e29b-41d4-a716-446655440000"),
  "UUID standar harus diterima oleh shared migration UUID helper.",
);
assert(
  !isLegacyMigrationUuid("550e8400-e29b-41d4-a716446655440000"),
  "UUID dengan segmen atau hyphen yang hilang harus ditolak.",
);
assert(
  parseLegacyMigrationUuid(" 550e8400-e29b-41d4-a716-446655440000 ") ===
    "550e8400-e29b-41d4-a716-446655440000",
  "Parser UUID harus menormalisasi whitespace sebelum validasi.",
);
assert(
  getLegacyMigrationSessionLockKey({
    organizationId: "organization",
    sessionId: "session-a",
  }) !==
    getLegacyMigrationSessionLockKey({
      organizationId: "organization",
      sessionId: "session-b",
    }),
  "Advisory lock sesi harus unik per organisasi dan sesi.",
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
  actionSource.includes("isLegacyMigrationUuid") &&
    !actionSource.includes("const UUID_PATTERN"),
  "Import migrasi harus memakai shared UUID helper.",
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

for (const contract of [
  "getLegacyMigrationSessionLockKey",
  "SESSION_CANCEL_HAS_DATA",
  "SESSION_STATE_CHANGED",
  "SESSION_ASSIGNMENT_UPDATE_COUNT_MISMATCH",
  '.for("update")',
  '.returning({ id: legacyMigrationSessions.id })',
]) {
  assert(
    mappingActionSource.includes(contract),
    `Safety hotfix session management wajib memiliki ${contract}.`,
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
]) {
  assert(
    verificationActionSource.includes(contract),
    `Action verifikasi Milestone 3 wajib memiliki ${contract}.`,
  );
}
for (const contract of [
  "getLegacyMigrationSessionLockKey",
  '.for("update")',
  "VERIFICATION_RESUBMIT_STATE_CHANGED",
  '.returning({ id: legacyMigrationVerifications.id })',
]) {
  assert(
    verificationActionSource.includes(contract),
    `Safety hotfix verification wajib memiliki ${contract}.`,
  );
}

assert(
  verificationActionSource.includes("existingReturnedVerification?.imageKey"),
  "Action verifikasi harus mendukung mempertahankan foto aktual saat resubmit.",
);
assert(
  verificationActionSource.includes(
    'source === "physical_unmatched" && useLegacyImage',
  ),
  "Item physical_unmatched tidak boleh menggunakan foto legacy.",
);
assert(
  verificationActionSource.includes("useLegacyImage && selectedImage"),
  "Action verifikasi harus menolak foto legacy dan unggahan aktual secara bersamaan.",
);

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

assert(
  canBulkApproveLegacyVerification({
    status: "submitted",
    reviewFlags: [],
    condition: "good",
  }),
  "Item clean harus eligible untuk bulk approval.",
);
assert(
  !canBulkApproveLegacyVerification({
    status: "needs_review",
    reviewFlags: ["BARCODE_NOT_FOUND_IN_LEGACY_EXPORT"],
    condition: "good",
  }),
  "Item needs review tidak boleh masuk bulk approval.",
);
assert(
  getLegacyBarcodeAliasSource("legacy_match") === "legacy_import" &&
    getLegacyBarcodeAliasSource("physical_unmatched") ===
      "legacy_physical_label",
  "Sumber alias barcode harus membedakan export dan label fisik unmatched.",
);

const milestoneFourMigrationSource = read(
  "drizzle/0007_legacy_manager_review_inventory_hold.sql",
);
for (const contract of [
  "migration_hold",
  "product_item_id",
  "legacy_migration_verifications_product_item_uq",
  "migration.verification.review",
  "migration.verification.approve",
]) {
  assert(
    milestoneFourMigrationSource.includes(contract),
    `Migration Milestone 4 wajib memiliki ${contract}.`,
  );
}

const reviewActionSource = read(
  "src/app/actions/legacy-migration-review.ts",
);
for (const contract of [
  "pg_advisory_xact_lock",
  "getNextProductItemIdentifiers",
  'availability: "migration_hold"',
  "transaction.insert(itemBarcodes)",
  "isPrimary: true",
  "migration.verification.approve",
  "VERIFICATION_NOT_CLEAN",
]) {
  assert(
    reviewActionSource.includes(contract),
    `Manager review action wajib memiliki ${contract}.`,
  );
}
assert(
  !reviewActionSource.includes("inventoryMovements"),
  "Approval migration hold tidak boleh membuat inventory movement.",
);
assert(
  !reviewActionSource.includes('availability: "available"'),
  "Milestone 4 tidak boleh mengaktifkan item menjadi available.",
);

const productMasterActionSource = read(
  "src/app/actions/product-masters.ts",
);
assert(
  productMasterActionSource.includes(
    '"draft" | "migration_hold" | "available" | "reserved"',
  ),
  "Product Master tidak boleh dinonaktifkan ketika masih memiliki item migration hold.",
);

const reviewQueueSource = read(
  "src/app/(admin)/admin/migrasi-produk/[batchId]/review/page.tsx",
);
assert(
  reviewQueueSource.includes("Bulk approve clean") &&
    reviewQueueSource.includes("migration hold"),
  "Halaman antrean manager harus memiliki bulk approval dan guardrail hold.",
);

const resubmitActionSource = read(
  "src/app/actions/legacy-migration-verification.ts",
);
for (const contract of [
  'status === "returned"',
  "existingVerificationId",
  "legacy_migration_verification.resubmit",
  "revision: sql",
]) {
  assert(
    resubmitActionSource.includes(contract),
    `Resubmit returned verification wajib memiliki ${contract}.`,
  );
}

const soldBarcodeParse = parseSoldDuringMigrationBarcodes(
  "3037\n003037, 918161;918161 invalid*",
  6,
);
assert(
  JSON.stringify(soldBarcodeParse.barcodes) ===
    JSON.stringify(["003037", "918161"]),
  "Parser sold during migration harus mempertahankan leading zero dan urutan barcode.",
);
assert(
  soldBarcodeParse.duplicateCount === 2 &&
    soldBarcodeParse.invalidBarcodes[0] === "invalid*",
  "Parser sold during migration harus menghitung duplikat dan input invalid.",
);
assert(
  isSoldDuringMigrationEligibleStatus("approved") &&
    !isSoldDuringMigrationEligibleStatus("sold_during_migration") &&
    !isSoldDuringMigrationEligibleStatus("activated"),
  "Status sold during migration harus membatasi transisi yang aman.",
);

const milestoneFiveAMigrationSource = read(
  "drizzle/0008_legacy_sold_during_migration.sql",
);
for (const contract of [
  "legacy_migration_sold_records",
  "legacy_migration_sold_records_org_barcode_active_uq",
  "legacy_migration_sold_records_link_ck",
  "legacy_migration_sold_records_revert_ck",
  "migration.sold.manage",
]) {
  assert(
    milestoneFiveAMigrationSource.includes(contract),
    `Migration Milestone 5A wajib memiliki ${contract}.`,
  );
}

const soldActionSource = read("src/app/actions/legacy-migration-sold.ts");
for (const contract of [
  'requirePermission("migration.sold.manage")',
  "legacy-barcode:",
  'status: "sold_during_migration"',
  'availability: "sold"',
  "isActive: false",
  "legacy_migration_sold.mark",
  "legacy_migration_sold.revert",
  "legacy_migration_sold.assign_session",
  "getLegacyMigrationSessionLockKey",
  "sessionId: selectedSession.id",
  'availability: "migration_hold"',
]) {
  assert(
    soldActionSource.includes(contract),
    `Action Milestone 5A wajib memiliki ${contract}.`,
  );
}
assert(
  !soldActionSource.includes("inventoryMovements"),
  "Milestone 5A tidak boleh membuat inventory movement.",
);
assert(
  !soldActionSource.includes('availability: "available"'),
  "Milestone 5A tidak boleh mengaktifkan item menjadi available.",
);

for (const source of [verificationActionSource, reviewActionSource]) {
  assert(
    source.includes("legacyMigrationSoldRecords") &&
      source.includes("legacy-barcode:"),
    "Scanner dan approval harus memakai sold guard serta barcode lock yang sama.",
  );
}
assert(
  verificationActionSource.includes("BARCODE_SOLD_DURING_MIGRATION") &&
    reviewActionSource.includes("VERIFICATION_SOLD_DURING_MIGRATION"),
  "Scanner dan manager review harus menolak barcode yang ditandai terjual.",
);

const soldPageSource = read(
  "src/app/(admin)/admin/migrasi-produk/[batchId]/sold/page.tsx",
);
for (const contract of [
  "Terjual di Sistem Lama",
  "tempel satu kolom dari Excel",
  "Tandai terjual dan kecualikan",
  "Pilih sesi asal barang",
  "Ada catatan lama tanpa sesi etalase",
  "Alasan pembatalan",
]) {
  assert(
    soldPageSource.includes(contract),
    `Halaman Milestone 5A wajib memiliki ${contract}.`,
  );
}

assert(
  getLegacyPhotoMigrationStatus({
    useLegacyImage: false,
    itemImageKey: "organizations/org/items/item/photo.webp",
    attributes: {},
  }) === "not_required" &&
    getLegacyPhotoMigrationStatus({
      useLegacyImage: true,
      itemImageKey: "organizations/org/items/item/photo.webp",
      attributes: {},
    }) === "copied" &&
    getLegacyPhotoMigrationStatus({
      useLegacyImage: true,
      itemImageKey: null,
      attributes: {
        legacyPhotoMigration: {
          status: "failed",
          attemptedAt: new Date(0).toISOString(),
          sourceUrl: "https://asihjaya.com/photo.jpg",
        },
      },
    }) === "failed",
  "Status foto legacy harus membedakan upload aktual, copied, pending, dan failed.",
);
assert(
  isLegacyImageUrlAllowed(
    "https://asihjaya.com/storage/item.jpeg",
    ["asihjaya.com"],
  ) &&
    isLegacyImageUrlAllowed(
      "https://cdn.asihjaya.com/storage/item.jpeg",
      ["asihjaya.com"],
    ) &&
    !isLegacyImageUrlAllowed("http://asihjaya.com/item.jpeg", ["asihjaya.com"]) &&
    !isLegacyImageUrlAllowed("https://127.0.0.1/item.jpeg", ["asihjaya.com"]),
  "Download foto legacy harus membatasi HTTPS dan host allowlist tanpa IP lokal.",
);

const reconciliationActionSource = read(
  "src/app/actions/legacy-migration-reconciliation.ts",
);
for (const contract of [
  'requirePermission("migration.verification.approve")',
  "LEGACY_PHOTO_MIGRATION_BATCH_SIZE",
  "importLegacyImageToPrivateStorage",
  "pg_advisory_xact_lock",
  "legacy_migration_photo.copy",
  "legacy_migration_photo.copy_failed",
  "deleteImageFile",
]) {
  assert(
    reconciliationActionSource.includes(contract),
    `Action Milestone 5B wajib memiliki ${contract}.`,
  );
}
assert(
  !reconciliationActionSource.includes("inventoryMovements"),
  "Milestone 5B tidak boleh membuat inventory movement.",
);
assert(
  !reconciliationActionSource.includes('availability: "available"'),
  "Milestone 5B tidak boleh mengaktifkan item menjadi available.",
);

const reconciliationQuerySource = read(
  "src/features/legacy-migration/reconciliation-queries.ts",
);
for (const contract of [
  "getLegacyMigrationCutoverData",
  "readiness.sessions",
  "executableSessionCount",
  "masterFallback",
  "noFallback",
]) {
  assert(
    reconciliationQuerySource.includes(contract),
    `Query rekonsiliasi Milestone 5B/R5F2 wajib memiliki ${contract}.`,
  );
}

const reconciliationPageSource = read(
  "src/app/(admin)/admin/migrasi-produk/[batchId]/rekonsiliasi/page.tsx",
);
for (const contract of [
  "Rekonsiliasi Akhir & Foto Legacy",
  "Readiness per sesi",
  "Sesi lain boleh tetap aktif",
  "Salin hingga",
  "Ulangi foto gagal",
  "Foto gagal tidak memblokir cutover",
  "tidak mengubah",
]) {
  assert(
    reconciliationPageSource.includes(contract),
    `Halaman Milestone 5B wajib memiliki ${contract}.`,
  );
}

const imageStorageSource = read("src/lib/storage/image-storage.ts");
assert(
  imageStorageSource.includes("export async function storeImageBuffer") &&
    imageStorageSource.includes("transformImageBuffer"),
  "Foto legacy harus memakai pipeline image storage internal yang sama.",
);

assert(
  isLegacyCutoverSessionClosed("locked") &&
    isLegacyCutoverSessionClosed("completed") &&
    !isLegacyCutoverSessionClosed("active"),
  "Helper status tertutup harus mengenali sesi locked dan completed.",
);
assert(
  getLegacyCutoverAliasSource("legacy_match") === "legacy_import" &&
    getLegacyCutoverAliasSource("physical_unmatched") ===
      "legacy_physical_label",
  "Cutover harus mempertahankan sumber alias barcode legacy.",
);
assert(
  getLegacyCutoverItemIssues({
    source: "legacy_match",
    barcodeValue: "003037",
    batchOutletId: "outlet",
    targetProductMasterId: "master",
    productItemId: "item",
    itemProductMasterId: "master",
    itemAvailability: "migration_hold",
    itemIsActive: true,
    itemOutletId: "outlet",
    itemLegacyId: "003037",
    itemSellingAmount: "2058000",
    itemPricePerGram: "980000",
    itemDeductionPerGram: "25000",
    itemCondition: "good",
    itemLocationState: "outlet",
    masterStatus: "active",
    categoryName: "Cincin",
    categoryIsActive: true,
    aliasId: "alias",
    aliasSource: "legacy_import",
    aliasIsPrimary: true,
    aliasIsActive: true,
    hasActiveSoldRecord: false,
  }).length === 0,
  "Item hold yang konsisten harus lolos preflight cutover.",
);

const invalidPricingIssues = getLegacyCutoverItemIssues({
  source: "legacy_match",
  barcodeValue: "003037",
  batchOutletId: "outlet",
  targetProductMasterId: "master-review",
  productItemId: "item",
  itemProductMasterId: "master-edited",
  itemAvailability: "migration_hold",
  itemIsActive: true,
  itemOutletId: "outlet",
  itemLegacyId: "003037",
  itemSellingAmount: null,
  itemPricePerGram: "0",
  itemDeductionPerGram: null,
  itemCondition: "repair",
  itemLocationState: "warehouse",
  masterStatus: "draft",
  categoryName: "Gelang",
  categoryIsActive: false,
  aliasId: null,
  aliasSource: null,
  aliasIsPrimary: null,
  aliasIsActive: null,
  hasActiveSoldRecord: false,
});
for (const expectedIssue of [
  "ITEM_MASTER_MISMATCH",
  "MASTER_NOT_ACTIVE",
  "CATEGORY_NOT_ACTIVE",
  "SELLING_AMOUNT_INVALID",
  "PRICE_PER_GRAM_INVALID",
  "DEDUCTION_PER_GRAM_INVALID",
  "ITEM_CONDITION_INVALID",
  "ITEM_LOCATION_INVALID",
  "BARCODE_ALIAS_INVALID",
] as const) {
  assert(
    invalidPricingIssues.includes(expectedIssue),
    `Preflight R5F2 wajib mendeteksi ${expectedIssue}.`,
  );
}
const summarizedIssueCounts = summarizeLegacyCutoverIssueCounts(
  new Map<LegacyCutoverIssueCode, number>([
    ["SELLING_AMOUNT_INVALID", 125],
    ["UNRESOLVED_VERIFICATION", 3],
  ]),
);
assert(
  summarizedIssueCounts.find(
    (issue) => issue.code === "SELLING_AMOUNT_INVALID",
  )?.count === 125,
  "Readiness harus menyimpan jumlah blocker tanpa membuat array per item.",
);

const sessionReadinessMigrationSource = read(
  "drizzle/0010_legacy_session_readiness.sql",
);
for (const contract of [
  'ADD COLUMN "session_id" uuid',
  "legacy_migration_sold_records_session_id_legacy_migration_sessions_id_fk",
  "legacy_migration_sold_records_batch_session_sold_at_idx",
  'SET "session_id" = verification."session_id"',
  '"price_per_gram" = coalesce',
  '"selling_amount" = coalesce',
  "BETWEEN 1 AND 999999999999999999",
]) {
  assert(
    sessionReadinessMigrationSource.includes(contract),
    `Migration R5F2 wajib memiliki ${contract}.`,
  );
}

const milestoneFiveCMigrationSource = read(
  "drizzle/0009_legacy_transactional_cutover.sql",
);
for (const contract of [
  "migration_opening",
  "legacy_migration_cutover_runs",
  "legacy_migration_cutover_runs_session_uq",
  "legacy_migration_cutover_runs_item_count_ck",
  "migration.cutover.execute",
]) {
  assert(
    milestoneFiveCMigrationSource.includes(contract),
    `Migration Milestone 5C wajib memiliki ${contract}.`,
  );
}

const pricingRulesSource = read(
  "src/features/legacy-migration/pricing-rules.ts",
);
for (const contract of [
  "calculateLegacyMigrationSellingAmount",
  "resolveLegacyMigrationPricing",
  "Round half-up",
]) {
  assert(
    pricingRulesSource.includes(contract),
    `Pricing rules R5F2 wajib memiliki ${contract}.`,
  );
}
assert(
  !pricingRulesSource.includes("BigInt") && !/\d+n\b/.test(pricingRulesSource),
  "Pricing rules harus kompatibel dengan target ES2017 tanpa BigInt.",
);
for (const contract of [
  "resolveLegacyMigrationPricing",
  "sellingAmount: pricing.sellingAmount",
  "pricePerGram: pricing.pricePerGram",
  "deductionPerGram: pricing.deductionPerGram",
  'pricingSource: pricing.pricePerGram ? "legacy_xlsx" : "pending_manual"',
  "getLegacyMigrationSessionLockKey",
  "REVIEW_SESSION_NOT_ACTIVE",
  'verification.sessionStatus !== "active"',
]) {
  assert(
    reviewActionSource.includes(contract),
    `Approval R5F2 wajib memiliki ${contract}.`,
  );
}

const cutoverQuerySource = read(
  "src/features/legacy-migration/cutover-queries.ts",
);
for (const contract of [
  "soldBeforeScanBySession",
  "processedItemCount",
  "targetShortfall",
  "targetSurplus",
  "ITEM_MASTER_MISMATCH",
  "SELLING_AMOUNT_INVALID",
  "CATEGORY_NOT_ACTIVE",
  "SOLD_SESSION_UNASSIGNED",
  "executableSessionCount",
]) {
  assert(
    cutoverQuerySource.includes(contract),
    `Readiness per sesi R5F2 wajib memiliki ${contract}.`,
  );
}
assert(
  !cutoverQuerySource.includes("globalReady") &&
    !cutoverQuerySource.includes("CUTOVER_GLOBAL_NOT_READY"),
  "Cutover sesi tidak boleh lagi bergantung pada readiness global batch.",
);
for (const targetBlocker of [
  "SESSION_TARGET_MISSING",
  "TARGET_SHORTFALL",
  "TARGET_SURPLUS",
]) {
  assert(
    !cutoverQuerySource.includes(targetBlocker),
    `Target opsional tidak boleh menghasilkan blocker ${targetBlocker}.`,
  );
}
assert(
  !cutoverQuerySource.includes("expected !== null &&") &&
    !cutoverQuerySource.includes("targetShortfall === 0") &&
    !cutoverQuerySource.includes("targetSurplus === 0"),
  "Target opsional tidak boleh menjadi syarat canExecute cutover.",
);

const cutoverActionSource = read(
  "src/app/actions/legacy-migration-cutover.ts",
);
for (const contract of [
  'requirePermission("migration.cutover.execute")',
  "pg_advisory_xact_lock",
  "legacy-barcode:",
  'movementType: "migration_opening"',
  'availability: "available"',
  'status: "activated"',
  "legacy_migration_cutover.execute",
]) {
  assert(
    cutoverActionSource.includes(contract),
    `Action Milestone 5C wajib memiliki ${contract}.`,
  );
}
assert(
  cutoverActionSource.includes("db.transaction") &&
    cutoverActionSource.includes("legacyMigrationCutoverRuns"),
  "Cutover wajib transactional dan memiliki run idempotency.",
);
const existingRunCheckIndex = cutoverActionSource.indexOf("const [existingRun]");
const lockedStatusCheckIndex = cutoverActionSource.indexOf(
  'session.status !== "locked"',
);
assert(
  existingRunCheckIndex >= 0 &&
    lockedStatusCheckIndex >= 0 &&
    existingRunCheckIndex < lockedStatusCheckIndex,
  "Cutover retry concurrent harus mengecek run idempotency sebelum menolak status completed.",
);

for (const contract of [
  "parseLegacyMigrationUuid",
  "getLegacyMigrationSessionLockKey",
  "CUTOVER_ITEM_UPDATE_COUNT_MISMATCH",
  "CUTOVER_VERIFICATION_UPDATE_COUNT_MISMATCH",
  "CUTOVER_SESSION_UPDATE_COUNT_MISMATCH",
  'session.status !== "locked"',
  "CUTOVER_SOLD_SESSION_UNASSIGNED",
  "pricingValidated: true",
]) {
  assert(
    cutoverActionSource.includes(contract),
    `Safety hotfix cutover wajib memiliki ${contract}.`,
  );
}

for (const targetGuard of [
  "CUTOVER_SESSION_TARGET_MISSING",
  "CUTOVER_TARGET_MISMATCH",
  "processedItems !== session.expectedItemCount",
]) {
  assert(
    !cutoverActionSource.includes(targetGuard),
    `Transactional cutover tidak boleh diblokir oleh target opsional: ${targetGuard}.`,
  );
}

for (const contract of [
  "Target jumlah item (opsional)",
  "Hanya sebagai pembanding progress",
]) {
  assert(
    sessionPageSource.includes(contract),
    `Form sesi wajib menjelaskan target opsional melalui ${contract}.`,
  );
}

for (const source of [
  mappingActionSource,
  verificationActionSource,
  reviewActionSource,
  soldActionSource,
  reconciliationActionSource,
  cutoverActionSource,
]) {
  assert(
    !source.includes("const UUID_PATTERN"),
    "Action migrasi harus memakai shared UUID helper tanpa regex lokal.",
  );
}

const cutoverContractsSource = read(
  "src/features/legacy-migration/cutover-contracts.ts",
);
assert(
  cutoverContractsSource.includes('LEGACY_CUTOVER_CONFIRMATION = "AKTIFKAN STOK"'),
  "Cutover wajib memakai konfirmasi eksplisit AKTIFKAN STOK.",
);

const reviewQueuePageSource = read(
  "src/app/(admin)/admin/migrasi-produk/[batchId]/review/page.tsx",
);
const reviewDetailPageSource = read(
  "src/app/(admin)/admin/migrasi-produk/[batchId]/review/[verificationId]/page.tsx",
);
for (const contract of [
  'row.sessionStatus === "active"',
  "Sesi {row.sessionStatus}",
]) {
  assert(
    reviewQueuePageSource.includes(contract),
    `Antrean review R5F2 wajib memiliki ${contract}.`,
  );
}
for (const contract of [
  'verification.sessionStatus === "active"',
  "Sesi tidak sedang aktif",
]) {
  assert(
    reviewDetailPageSource.includes(contract),
    `Detail review R5F2 wajib memiliki ${contract}.`,
  );
}

const cutoverPageSource = read(
  "src/app/(admin)/admin/migrasi-produk/[batchId]/cutover/page.tsx",
);
for (const contract of [
  "Aktivasi Stok Transactional",
  "opening inventory movement",
  "Target hanya menjadi pembanding dan tidak memblokir proses.",
  "Pricing, master, kondisi, lokasi, dan barcode tetap diperiksa",
  "Blocker milik sesi lain tidak lagi menahan",
  "Milestone 5D",
]) {
  assert(
    cutoverPageSource.includes(contract),
    `Halaman Milestone 5C wajib memiliki ${contract}.`,
  );
}

console.log(
  "OK: Legacy product migration Milestone 1-5C + R5F2 contracts tervalidasi.",
);
