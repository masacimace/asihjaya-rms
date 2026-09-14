import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const query = read("src/features/pricing/metal-price-rates.ts");
const actions = read("src/app/actions/metal-price-rates.ts");
const buybackQuery = read("src/features/pricing/buyback-price-rates.ts");
const buybackActions = read("src/app/actions/buyback-price-rates.ts");
const buybackManager = read("src/components/pricing/buyback-price-rate-form.tsx");
const settingsTabs = read("src/components/pricing/metal-price-rate-settings-tabs.tsx");
const schema = read("src/db/schema/index.ts");
const buybackMigration = read("drizzle/0025_buyback_price_rates.sql");
const migrationJournal = read("drizzle/meta/_journal.json");
const manager = read("src/components/pricing/metal-price-rate-form.tsx");
const drawer = read("src/components/pricing/metal-price-rate-drawer.tsx");
const dashboard = read("src/app/(admin)/admin/page.tsx");
const page = read("src/app/(admin)/admin/pengaturan/harga-gram/page.tsx");
const settingsHub = read("src/app/(admin)/admin/pengaturan/page.tsx");
const goldReferencePanel = read(
  "src/components/pricing/gold-reference-rate-panel.tsx",
);

assert.match(query, /ne\(productItems\.availability, "sold"\)/);
assert.match(actions, /export async function retireMetalPriceRateAction/);
assert.match(actions, /ne\(productItems\.availability, "sold"\)/);
assert.match(actions, /pricing\.metal_rate\.retire/);
assert.match(actions, /effectiveUntil/);
assert.doesNotMatch(actions, /delete\(metalPriceRates\)/);
assert.match(actions, /revalidatePath\("\/admin"\)/);
assert.match(actions, /revalidatePath\("\/admin\/pengaturan\/harga-gram"\)/);

assert.match(manager, /Rate Global Aktif/);
assert.match(manager, /Tambah Rate Global/);
assert.match(manager, /Kadar Belum Memiliki Rate/);
assert.doesNotMatch(manager, /max-h-\[500px\]\s+overflow-y-auto/);
assert.match(manager, /retireMetalPriceRateAction/);
assert.match(manager, /row\.itemCount === 0/);
assert.match(manager, /Histori harga tetap disimpan/);
assert.match(manager, /function handleMoneyInput/);
assert.match(manager, /onInput=\{handleMoneyInput\}/);

assert.match(drawer, /Harga \/ Gram Global/);
assert.match(drawer, /h-\[100dvh\]/);
assert.match(drawer, /MetalPriceRateForm rows=\{rows\}/);

assert.match(dashboard, /hasPermission\(auth, "pricing\.manage"\)/);
assert.match(dashboard, /getMetalPriceRateSettingsData/);
assert.match(dashboard, /<MetalPriceRateDrawer rows=\{metalPriceRows\} \/>/);
assert.match(page, /Harga \/ Gram Global/);
assert.match(page, /getGoldReference\(\)/);
assert.match(page, /<GoldReferenceRatePanel result=\{goldReference\} \/>/);
assert.match(goldReferencePanel, /Referensi Harga Emas/);
assert.match(goldReferencePanel, /Referensi aktif/);
assert.match(goldReferencePanel, /Rate Global/);
assert.match(goldReferencePanel, /Read-only/);


assert.match(schema, /export const metalBuybackPriceRates = pgTable/);
assert.match(schema, /"metal_buyback_price_rates"/);
assert.match(schema, /metal_buyback_price_rates_purity_active_uq/);
assert.match(buybackMigration, /CREATE TABLE "metal_buyback_price_rates"/);
assert.match(buybackMigration, /metal_buyback_price_rates_purity_active_uq/);
assert.match(migrationJournal, /0025_buyback_price_rates/);

assert.match(buybackQuery, /getActiveGoldBuybackPriceRates/);
assert.match(buybackQuery, /getBuybackPriceRateSettingsData/);
assert.match(buybackQuery, /metalBuybackPriceRates\.effectiveUntil/);
assert.match(buybackActions, /export async function saveBuybackPriceRatesAction/);
assert.match(buybackActions, /export async function retireBuybackPriceRateAction/);
assert.match(buybackActions, /pricing\.buyback_rate\.update/);
assert.match(buybackActions, /pricing\.buyback_rate\.retire/);
assert.doesNotMatch(buybackActions, /delete\(metalBuybackPriceRates\)/);
assert.match(buybackActions, /revalidatePath\("\/pos\/buyback"\)/);

assert.match(buybackManager, /Rate Buyback Aktif/);
assert.match(buybackManager, /Harga Buyback \/ Gram/);
assert.match(buybackManager, /Tambah Rate Buyback/);
assert.match(buybackManager, /Histori Rate Buyback sebelumnya tetap tersimpan/);
assert.match(buybackManager, /function handleMoneyInput/);
assert.match(buybackManager, /onInput=\{handleMoneyInput\}/);
assert.match(settingsTabs, /Rate Jual/);
assert.match(settingsTabs, /Rate Buyback/);
assert.match(page, /getBuybackPriceRateSettingsData/);
assert.match(page, /saleRows=\{saleRows\}/);
assert.match(page, /buybackRows=\{buybackRows\}/);
assert.match(settingsHub, /Rate Jual dan Rate Buyback/);

console.log(
  "Metal Price Rate management contracts: OK — sale and buyback rate domains are separated, historical, and auditable.",
);
