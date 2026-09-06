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

const readme = read("README.md");
const buyback = read("docs/development/buyback-lifecycle.md");
const payments = read("src/features/pos/checkout/payment-methods.ts");
const settings = read("src/app/(admin)/admin/pengaturan/page.tsx");
const migrationJournal = read("drizzle/meta/_journal.json");

assert(
  !/midtrans/i.test(readme),
  "README masih menyebut payment gateway lama yang sudah tidak menjadi scope aktif.",
);

assert(
  !readme.includes("docs/roadmap/"),
  "README masih mengarah ke folder roadmap lama yang bukan source-of-truth current state.",
);

for (const marker of [
  "Cash",
  "EDC",
  "Transfer",
  "Hybrid Jewelry Pricing",
  "Buyback — Current Final Lifecycle",
  "/pos/buyback/pemrosesan",
  "/pos/buyback/riwayat",
  "B4 POS + Historical Identity Audit",
  "Telegram Reporting",
  "Backblaze B2",
  "Local Hardware Hub",
  "ACTIVE DEVELOPMENT / UAT / PREVIEW",
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
  "Existing ASIHJAYA Item",
  "External Buyback",
  "Sale Snapshot",
  "Buyback Snapshot",
  "Processing Snapshot",
  "Current Inventory",
  "availability = available",
  "condition    = good | used",
  "B4 POS + Historical Identity Audit",
]) {
  assert(buyback.includes(marker), `Buyback doc marker hilang: ${marker}`);
}

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
  `OK: documentation current-state sync valid (${docLinks.length} linked docs checked).`,
);
