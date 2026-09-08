import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const query = read("src/features/pricing/metal-price-rates.ts");
const actions = read("src/app/actions/metal-price-rates.ts");
const manager = read("src/components/pricing/metal-price-rate-form.tsx");
const drawer = read("src/components/pricing/metal-price-rate-drawer.tsx");
const dashboard = read("src/app/(admin)/admin/page.tsx");
const page = read("src/app/(admin)/admin/pengaturan/harga-gram/page.tsx");

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
assert.match(manager, /max-h-\[500px\]/);
assert.match(manager, /retireMetalPriceRateAction/);
assert.match(manager, /row\.itemCount === 0/);
assert.match(manager, /Histori harga tetap disimpan/);

assert.match(drawer, /Harga \/ Gram Global/);
assert.match(drawer, /h-\[100dvh\]/);
assert.match(drawer, /MetalPriceRateForm rows=\{rows\}/);

assert.match(dashboard, /hasPermission\(auth, "pricing\.manage"\)/);
assert.match(dashboard, /getMetalPriceRateSettingsData/);
assert.match(dashboard, /<MetalPriceRateDrawer rows=\{metalPriceRows\} \/>/);
assert.match(page, /Harga \/ Gram Global/);

console.log(
  "Metal Price Rate management contracts: OK — compact manager, safe retire, unsold usage, dashboard drawer.",
);
