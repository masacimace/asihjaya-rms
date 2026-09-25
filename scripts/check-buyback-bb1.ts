import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const schema = read("src/db/schema/index.ts");
const migration = read("drizzle/0020_buyback_core_transaction.sql");
const action = read("src/app/actions/buybacks.ts");
const service = read("src/features/buybacks/service.ts");
const contracts = read("src/features/buybacks/contracts.ts");
const calculations = read("src/features/buybacks/calculations.ts");
const queries = read("src/features/buybacks/queries.ts");
const page = read("src/app/(pos)/pos/buyback/page.tsx");
const workspace = read("src/components/buybacks/buyback-workspace.tsx");
const historyPanel = read("src/components/buybacks/buyback-history-panel.tsx");
const compactHistoryPanel = read(
  "src/components/buybacks/buyback-compact-history-panel.tsx",
);
const historyPage = read("src/app/(pos)/pos/buyback/riwayat/page.tsx");
const processingWorkspace = read(
  "src/components/buybacks/buyback-processing-workspace.tsx",
);
const processingQuickActions = read(
  "src/components/buybacks/buyback-processing-quick-actions.tsx",
);
const posShell = read("src/components/layout/pos-shell.tsx");
const posLayout = read("src/app/(pos)/pos/layout.tsx");
const seed = read("src/db/seed.ts");
const productMastersAction = read("src/app/actions/product-masters.ts");
const inventoryItemPage = read(
  "src/app/(admin)/admin/inventaris/item/[itemId]/page.tsx",
);
const buybackPriceRates = read("src/features/pricing/buyback-price-rates.ts");

assert.match(schema, /export const buybacks = pgTable\(/);
assert.match(schema, /export const buybackItems = pgTable\(/);
assert.match(schema, /export const buybackPayouts = pgTable\(/);
assert.match(schema, /"buyback_status"/);
assert.match(schema, /"buyback_item_source"/);
assert.match(schema, /"buyback_payout_method"/);
assert.match(schema, /"migration_opening",\s*"buyback"/);
assert.match(schema, /buybacks_org_idempotency_uq/);

assert.match(migration, /CREATE TABLE "buybacks"/);
assert.match(migration, /CREATE TABLE "buyback_items"/);
assert.match(migration, /CREATE TABLE "buyback_payouts"/);
assert.match(
  migration,
  /inventory_movement_type" ADD VALUE IF NOT EXISTS 'buyback'/,
);
assert.match(migration, /'buybacks\.view'/);
assert.match(migration, /'buybacks\.create'/);
assert.match(migration, /buybacks_org_idempotency_uq/);

assert.match(contracts, /BUYBACK_MAX_ITEMS = 20/);
assert.match(contracts, /"asihjaya" \| "external"/);
assert.match(contracts, /"cash" \| "bank_transfer" \| "customer_deposit"/);
assert.doesNotMatch(contracts, /globalBuyback/i);
assert.doesNotMatch(calculations, /globalBuyback/i);
assert.match(calculations, /baseAmount/);
assert.match(calculations, /deductionAmount/);
assert.match(calculations, /finalAmount/);

assert.match(queries, /eq\(productItems\.availability, "sold"\)/);
assert.match(queries, /eq\(productItems\.locationState, "customer"\)/);
assert.match(queries, /itemBarcodes/);
assert.match(queries, /eq\(itemBarcodes\.isActive, true\)/);
assert.match(queries, /ilike\(itemBarcodes\.barcodeValue, pattern\)/);
assert.match(queries, /inArray\(productItems\.id, barcodeItemIds\)/);
assert.match(queries, /lastInvoiceNumber/);
assert.match(queries, /finalPriceAmount: saleItems\.finalPriceAmount/);
assert.match(
  queries,
  /lastSaleFinalPriceAmount: latestSale\?\.finalPriceAmount \?\? null/,
);
assert.match(contracts, /lastSaleFinalPriceAmount: string \| null/);
assert.doesNotMatch(
  contracts,
  /recommendedBuybackAmount/,
  "Recommendation Buyback tidak boleh dipercaya dari payload client.",
);

assert.match(action, /requirePermission\("buybacks\.create"\)/);
assert.match(action, /Total payout harus sama persis dengan Total Buyback/);
assert.match(action, /const itemImages = new Map<string, File>\(\)/);
assert.match(action, /formData\.get\(`itemImage:\$\{item\.clientKey\}`\)/);
assert.match(action, /const validation = validateImageFile\(image\)/);
const imageValidationIndex = action.indexOf(
  "const validation = validateImageFile(image);",
);
const imageStoreIndex = action.indexOf(
  "const imageKey = await storeImageFile({",
);
assert.ok(
  imageValidationIndex >= 0 &&
    imageStoreIndex >= 0 &&
    imageValidationIndex < imageStoreIndex,
  "Semua foto item Buyback harus divalidasi sebelum file pertama disimpan.",
);
assert.match(action, /eq\(buybacks\.organizationId, auth\.organization\.id\)/);
assert.match(action, /storeImageFile/);
assert.match(action, /deleteImageFile/);

assert.match(service, /db\.transaction/);
assert.match(service, /pg_advisory_xact_lock/);
assert.match(service, /eq\(productItems\.availability, "sold"\)/);
assert.match(service, /eq\(productItems\.locationState, "customer"\)/);
assert.match(service, /availability: "processing"/);
assert.match(service, /condition: "used"/);
assert.match(service, /locationState: "outlet"/);
assert.match(service, /costAmount: String\(item\.finalAmount\)/);
assert.match(service, /movementType: "buyback" as const/);
assert.match(service, /type: "cash_out"/);
assert.match(service, /entryType: "deposit_in"/);
assert.match(service, /direction: "credit"/);
assert.match(service, /lockCustomerDepositBalance/);
assert.match(service, /product_item\.reacquired_by_buyback/);
assert.match(service, /buyback_item\.processing_queued/);
assert.match(service, /transaction\.insert\(buybackItemProcessings\)/);
assert.match(service, /status: "pending"/);
assert.match(service, /action: "buyback\.completed"/);
assert.match(
  service,
  /expectedCash: sql`coalesce\(\$\{shifts\.expectedCash\}, 0\) - \$\{cashPayout\}`/,
);
assert.match(service, /metalBuybackPriceRates/);
assert.match(service, /normalizePurityKey\(item\.purityPercent\)/);
assert.match(service, /calculateJewelryBasePrice\(\{/);
assert.match(service, /lte\(metalBuybackPriceRates\.effectiveFrom, now\)/);
assert.match(service, /gt\(metalBuybackPriceRates\.effectiveUntil, now\)/);
assert.match(service, /buybackPricePerGram,/);
assert.match(service, /recommendedBuybackAmount/);
assert.match(
  service,
  /buybackRecommendationSource: "server_active_buyback_rate"/,
);
assert.match(
  service,
  /buybackRateStatus: buybackPricePerGram \? "available" : "missing"/,
);
assert.match(inventoryItemPage, /buyback: "Buyback"/);

assert.match(page, /title="Buyback Pembelian"/);
assert.match(page, /Pemrosesan Cuci\/Rongsok/);
assert.match(page, /BuybackWorkspace/);
assert.match(workspace, /Produk ASIHJAYA/);
assert.match(workspace, /Tambah Produk External/);
assert.match(workspace, /Total Harga Buyback/);
assert.match(workspace, /Harga Jual Sebelumnya/);
assert.match(workspace, /item\.lastSaleFinalPriceAmount/);
assert.match(workspace, /formatPreviousSaleDate\(item\.soldAt, timeZone\)/);
assert.match(page, /timeZone=\{auth\.organization\.timezone\}/);
assert.match(page, /getActiveGoldBuybackPriceRates/);
assert.match(page, /buybackPriceRates=\{activeBuybackPriceRates\.map/);
assert.match(buybackPriceRates, /metalBuybackPriceRates/);
assert.match(workspace, /Harga Rekomendasi Buyback/);
assert.match(workspace, /calculateRecommendedBuybackAmount/);
assert.match(
  workspace,
  /priceRates\.find\(\(rate\) => rate\.purityKey === purityKey\)/,
);
assert.match(workspace, /Rate Buyback \$\{purityKey\}% belum diatur/);
assert.match(workspace, /Nominal final ditentukan manual oleh staff/);
assert.match(workspace, /Dana Titip/);
assert.match(workspace, /Selesaikan Buyback/);
assert.match(workspace, /imageSelected: boolean/);
assert.match(workspace, /name={`itemImage:\$\{clientKey\}`}/);
assert.match(
  workspace,
  /<BuybackImageInput[\s\S]{0,800}showCamera/,
  "Produk internal dan external Buyback wajib menampilkan action Ambil Foto.",
);
assert.doesNotMatch(
  workspace,
  /showCamera=\{item\.source === "external"\}/,
  "Camera Buyback tidak boleh dibatasi hanya untuk produk external.",
);
assert.match(
  workspace,
  /existingSearchDebounceRef/,
  "Search produk internal Buyback wajib auto-search di mobile.",
);
assert.match(
  workspace,
  /setTimeout\(\(\) => \{[\s\S]{0,300}searchExisting\(trimmedQuery\)[\s\S]{0,100}\}, 350\)/,
);
assert.match(workspace, /type="search"/);
assert.match(workspace, /enterKeyHint="search"/);
assert.match(
  workspace,
  /function addExistingItem[\s\S]{0,1500}setExistingQuery\(""\);[\s\S]{0,300}setExistingResults\(\[\]\);/,
  "Search dan hasil harus dibersihkan setelah produk internal berhasil dipilih.",
);
assert.match(historyPanel, /Snapshot Rate Buyback/);
assert.match(historyPanel, /Rate saat transaksi/);
assert.match(historyPanel, /Rekomendasi/);
assert.match(historyPanel, /buybackRecommendationSource/);
assert.match(historyPanel, /server_active_buyback_rate/);
assert.match(page, /getBuybackProcessingData/);
assert.match(page, /getActiveProductMasterOptions/);
assert.match(page, /getActiveGoldPriceRates/);
assert.match(page, /processingQuickActions=\{processingQuickActions\}/);
assert.match(page, /BuybackCompactHistoryPanel/);
assert.match(page, /mode="preview"/);
assert.match(compactHistoryPanel, /data-history-layout="compact-row-card"/);
assert.match(compactHistoryPanel, /Transaksi Buyback terbaru/);
assert.match(compactHistoryPanel, /Riwayat transaksi Buyback/);
assert.match(compactHistoryPanel, /BuybackProcessingQuickActions/);
assert.match(compactHistoryPanel, /Lihat semua riwayat/);
assert.doesNotMatch(compactHistoryPanel, /<table/);
assert.match(historyPage, /getBuybackProcessingData/);
assert.match(historyPage, /getActiveProductMasterOptions/);
assert.match(historyPage, /getActiveGoldPriceRates/);
assert.match(historyPage, /processingQuickActions=\{processingQuickActions\}/);
assert.match(historyPanel, /BuybackProcessingQuickActions/);
assert.match(processingQuickActions, /Proses Cuci/);
assert.match(processingQuickActions, /Proses Rongsok/);
assert.match(processingQuickActions, /pendingByType\.cleaning\.length > 1/);
assert.match(processingQuickActions, /pendingByType\.recondition\.length > 1/);
assert.match(processingQuickActions, /ProcessingDrawer/);
assert.match(processingWorkspace, /export function ProcessingDrawer\(/);

const finalPhysicalStart = processingWorkspace.indexOf(
  'data-processing-layout="balanced-final-fields"',
);
const finalPhysicalEnd = processingWorkspace.indexOf(
  "<ResultImageInput",
  finalPhysicalStart,
);
assert.ok(
  finalPhysicalStart >= 0 && finalPhysicalEnd > finalPhysicalStart,
  "Layout final physical processing harus ditemukan.",
);
const finalPhysicalSection = processingWorkspace.slice(
  finalPhysicalStart,
  finalPhysicalEnd,
);
const finalPhysicalLabels = [
  "Kategori *",
  "Product Master *",
  "Nama Produk *",
  "Warna *",
  "Berat Sesudah (gr) *",
  "Kadar (%) *",
  "Kadar Tukaran *",
  "Potongan / Gram *",
  "Harga / Gram Hasil *",
];
let previousFieldIndex = -1;
for (const label of finalPhysicalLabels) {
  const fieldIndex = finalPhysicalSection.indexOf(label);
  assert.ok(
    fieldIndex > previousFieldIndex,
    "Urutan field physical final processing harus konsisten.",
  );
  previousFieldIndex = fieldIndex;
}

const processingFormStart = processingWorkspace.indexOf(
  'className="min-h-0 flex flex-1 flex-col"',
);
const processingScrollBodyStart = processingWorkspace.indexOf(
  'data-processing-scroll-body="true"',
);
const dockedActionStart = processingWorkspace.indexOf(
  'data-processing-action="docked-submit"',
);
const processingFormEnd = processingWorkspace.indexOf(
  "</form>",
  dockedActionStart,
);

assert.ok(processingFormStart >= 0, "Form processing flex-column harus tersedia.");
assert.ok(
  processingScrollBodyStart > processingFormStart,
  "Scrollable processing body harus berada di dalam form.",
);
assert.ok(
  dockedActionStart > processingScrollBodyStart,
  "Docked submit processing harus berada di luar scroll body.",
);
assert.ok(
  processingFormEnd > dockedActionStart,
  "Docked submit harus tetap berada di dalam form processing.",
);

const processingScrollSection = processingWorkspace.slice(
  processingScrollBodyStart,
  dockedActionStart,
);
assert.match(processingScrollSection, /min-h-0 flex-1[\s\S]{0,160}overflow-y-auto/);
assert.match(processingScrollSection, /<ResultImageInput/);

const dockedActionSection = processingWorkspace.slice(
  dockedActionStart,
  processingFormEnd,
);
assert.match(dockedActionSection, /shrink-0/);
assert.match(dockedActionSection, /border-t/);
assert.match(dockedActionSection, /bg-white/);
assert.match(dockedActionSection, /sm:w-auto sm:min-w-\[220px\]/);
assert.doesNotMatch(dockedActionSection, /sticky|bottom-0|-mb-|backdrop-blur/);
assert.doesNotMatch(dockedActionSection, />\s*Kembali\s*</);

const buybackNavOccurrences =
  posShell.match(/href: "\/pos\/buyback"/g)?.length ?? 0;
assert.ok(
  buybackNavOccurrences >= 2,
  "Buyback harus tersedia pada desktop dan Menu Lainnya mobile.",
);
assert.match(posShell, /requiresBuybackAccess/);
assert.match(
  posLayout,
  /canAccessBuybacks: hasPermission\(auth, "buybacks\.view"\)/,
);

assert.match(seed, /code: "buybacks\.view"/);
assert.match(seed, /code: "buybacks\.create"/);
assert.match(productMastersAction, /creationSource === "buyback"/);
assert.match(productMastersAction, /"buybacks\.create"/);
assert.match(productMastersAction, /pos_buyback_external_item/);

console.log("BB1 Buyback core static contracts: OK");
