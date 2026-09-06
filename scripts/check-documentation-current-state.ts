import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  if (!existsSync(file)) {
    throw new Error(`${relativePath} tidak ditemukan.`);
  }
  return readFileSync(file, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readSection(source: string, heading: string, nextHeading: string) {
  const start = source.indexOf(heading);
  assert(start >= 0, `Heading tidak ditemukan: ${heading}`);
  const end = source.indexOf(nextHeading, start + heading.length);
  assert(end >= 0, `Heading berikutnya tidak ditemukan: ${nextHeading}`);
  return source.slice(start, end);
}

const readme = read("README.md");
const buyback = read("docs/development/buyback-lifecycle.md");
const legacy = read("docs/development/legacy-product-migration.md");
const payments = read("src/features/pos/checkout/payment-methods.ts");
const settings = read("src/app/(admin)/admin/pengaturan/page.tsx");
const directImport = read(
  "src/features/legacy-migration/direct-import-service.ts",
);
const imageSync = read("src/features/legacy-migration/image-sync-service.ts");
const migrationChecker = read("scripts/check-legacy-product-migration.ts");
const migrationJournal = read("drizzle/meta/_journal.json");

assert(
  !/midtrans/i.test(readme),
  "README masih menyebut Midtrans/payment gateway lama.",
);

assert(
  !readme.includes("docs/roadmap/"),
  "README masih mengarah ke folder roadmap lama.",
);

for (const marker of [
  "## Sumber Kebenaran Project",
  "## Model Operasional",
  "## Modul Utama Saat Ini",
  "## Model Pembayaran POS",
  "## Harga Jewelry Hybrid",
  "## Buyback — Lifecycle Final Saat Ini",
  "## Migrasi Produk Legacy — Direct Import",
  "## Arsitektur Aplikasi",
  "## Quality Gate",
  "## Status Production",
]) {
  assert(readme.includes(marker), `Heading README hilang: ${marker}`);
}

for (const obsoleteHeading of [
  "## Source of Truth",
  "## Operational Model",
  "## Current Core Modules",
  "## Active POS Payment Model",
  "## Architecture",
  "## Production Status",
]) {
  assert(
    !readme.includes(obsoleteHeading),
    `README masih memakai heading lama/non-Indonesia: ${obsoleteHeading}`,
  );
}

for (const marker of [
  "Cash",
  "EDC",
  "Transfer",
  "/pos/buyback/pemrosesan",
  "/pos/buyback/riwayat",
  "B4 POS + Historical Identity Audit",
  "Telegram Reporting",
  "Backblaze B2",
  "Local Hardware Hub",
  "ACTIVE DEVELOPMENT / UAT / PREVIEW",
  "npm run check:legacy-product-migration",
]) {
  assert(readme.includes(marker), `README marker hilang: ${marker}`);
}

for (const marker of [
  'cash: "Cash"',
  'debit_card: "EDC"',
  'bank_transfer: "Transfer"',
]) {
  assert(payments.includes(marker), `Active payment marker hilang: ${marker}`);
}

for (const marker of [
  "Metode & Akun Pembayaran",
  "Harga / Gram Aktif",
  "Telegram Reporting",
]) {
  assert(
    settings.includes(marker),
    `Settings implementation marker hilang: ${marker}`,
  );
}

for (const marker of [
  "Buyback completed != saleable inventory",
  "Sale Snapshot",
  "Buyback Snapshot",
  "Processing Snapshot",
  "Current Inventory",
]) {
  assert(buyback.includes(marker), `Buyback doc marker hilang: ${marker}`);
}

const legacyReadme = readSection(
  readme,
  "## Migrasi Produk Legacy — Direct Import",
  "## Pelanggan dan Riwayat Penjualan",
);

for (const marker of [
  "direct import",
  "availability = available",
  "condition    = good",
  "migration_opening",
  "Product Master",
  "barcode legacy",
  "sinkronisasi foto",
  "Inventory + POS",
]) {
  assert(
    legacyReadme
      .toLocaleLowerCase("id-ID")
      .includes(marker.toLocaleLowerCase("id-ID")),
    `README Legacy Migration marker hilang: ${marker}`,
  );
}

for (const retired of [
  "/pos/migrasi-barang",
  "/mapping",
  "/sesi",
  "/review",
  "/rekonsiliasi",
  "/cutover",
  "/sold",
  "physical verification",
  "manager review",
]) {
  assert(
    !legacyReadme.includes(retired),
    `README Legacy Migration masih membawa flow lama: ${retired}`,
  );
}

for (const marker of [
  "Direct Import Current-State",
  "Semua Row Tetap Masuk",
  "availability = available",
  "condition    = good",
  "movement_type  = migration_opening",
  "source = legacy_import",
  "Harga/Gram aktif ASIHJAYA",
  "Auto Image Sync",
  "Failure Foto Tidak Memblokir POS",
  "DIRECT_IMPORT_EXISTING_ITEMS_INCONSISTENT",
  "completeCommittedImport",
]) {
  assert(legacy.includes(marker), `Legacy doc marker hilang: ${marker}`);
}

for (const retiredRoute of [
  "/pos/migrasi-barang",
  "/admin/migrasi-produk/[batchId]/review",
  "/admin/migrasi-produk/[batchId]/rekonsiliasi",
  "/admin/migrasi-produk/[batchId]/cutover",
]) {
  assert(
    !legacy.includes(retiredRoute),
    `Legacy doc masih menganggap route lama aktif: ${retiredRoute}`,
  );
}

for (const marker of [
  'availability: "available"',
  'condition: "good"',
  'movementType: "migration_opening"',
  'source: "legacy_import"',
  'status: "ready"',
  "legacyPricePerGram",
  "needsCleanup",
  "DIRECT_IMPORT_EXISTING_ITEMS_INCONSISTENT",
  "completeCommittedImport",
]) {
  assert(
    directImport.includes(marker),
    `Direct-import implementation marker hilang: ${marker}`,
  );
}

for (const marker of [
  "importLegacyImageToPrivateStorage",
  'imageStatus: "synced"',
  'imageStatus: "failed"',
]) {
  assert(
    imageSync.includes(marker),
    `Image sync implementation marker hilang: ${marker}`,
  );
}

for (const retiredSegment of [
  '"/mapping"',
  '"/sesi"',
  '"/review"',
  '"/rekonsiliasi"',
  '"/cutover"',
  '"/sold"',
]) {
  assert(
    migrationChecker.includes(retiredSegment),
    `Legacy checker tidak lagi menjaga retired route: ${retiredSegment}`,
  );
}

assert(
  !existsSync(path.join(root, "docs/development/stage-2c-final-closure.md")),
  "Dokumen historical stage-2c-final-closure.md masih ada; hapus dari current docs.",
);

assert(
  migrationJournal.includes("0022_buyback_processing_lifecycle") &&
    migrationJournal.includes("0023_buyback_simplified_acquisition"),
  "Migration journal Buyback B1/B2 tidak sesuai dokumentasi.",
);

const docLinks = Array.from(
  new Set(readme.match(/docs\/[A-Za-z0-9_./-]+\.md/g) ?? []),
);

for (const relativePath of docLinks) {
  assert(
    existsSync(path.join(root, relativePath)),
    `README mengarah ke dokumen yang tidak ada: ${relativePath}`,
  );
}

console.log(
  `OK: dokumentasi current-state valid — README Indonesia, Legacy Direct Import, Buyback, payment, dan ${docLinks.length} linked docs sinkron.`,
);
