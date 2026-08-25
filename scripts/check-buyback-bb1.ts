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
const posShell = read("src/components/layout/pos-shell.tsx");
const posLayout = read("src/app/(pos)/pos/layout.tsx");
const seed = read("src/db/seed.ts");
const productMastersAction = read("src/app/actions/product-masters.ts");
const inventoryItemPage = read("src/app/(admin)/admin/inventaris/item/[itemId]/page.tsx");

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
assert.match(migration, /inventory_movement_type" ADD VALUE IF NOT EXISTS 'buyback'/);
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

assert.match(action, /requirePermission\("buybacks\.create"\)/);
assert.match(action, /Total payout harus sama persis dengan Total Buyback/);
assert.match(action, /externalImages = new Map<string, File \| null>/);
assert.match(action, /Validate every external image before writing any file/);
assert.match(action, /eq\(buybacks\.organizationId, auth\.organization\.id\)/);
assert.match(action, /storeImageFile/);
assert.match(action, /deleteImageFile/);

assert.match(service, /db\.transaction/);
assert.match(service, /pg_advisory_xact_lock/);
assert.match(service, /eq\(productItems\.availability, "sold"\)/);
assert.match(service, /eq\(productItems\.locationState, "customer"\)/);
assert.match(service, /availability: "available"/);
assert.match(service, /condition: "used"/);
assert.match(service, /locationState: "outlet"/);
assert.match(service, /costAmount: String\(item\.finalAmount\)/);
assert.match(service, /movementType: "buyback" as const/);
assert.match(service, /type: "cash_out"/);
assert.match(service, /entryType: "deposit_in"/);
assert.match(service, /direction: "credit"/);
assert.match(service, /lockCustomerDepositBalance/);
assert.match(service, /product_item\.reacquired_by_buyback/);
assert.match(service, /product_item\.created_by_buyback/);
assert.match(service, /action: "buyback\.completed"/);
assert.match(service, /expectedCash: sql`coalesce\(\$\{shifts\.expectedCash\}, 0\) - \$\{cashPayout\}`/);
assert.match(inventoryItemPage, /buyback: "Buyback"/);

assert.match(page, /title="Buyback"/);
assert.match(page, /Tanpa Global Buyback Rate/);
assert.match(page, /BuybackWorkspace/);
assert.match(workspace, /Produk ASIHJAYA/);
assert.match(workspace, /Produk Eksternal/);
assert.match(workspace, /Harga Buyback \/ Gram/);
assert.match(workspace, /Dana Titip/);
assert.match(workspace, /Selesaikan Buyback/);
assert.match(workspace, /externalImage:/);

const buybackNavOccurrences = posShell.match(/href: "\/pos\/buyback"/g)?.length ?? 0;
assert.ok(buybackNavOccurrences >= 2, "Buyback harus tersedia pada desktop dan Menu Lainnya mobile.");
assert.match(posShell, /requiresBuybackAccess/);
assert.match(posLayout, /canAccessBuybacks: hasPermission\(auth, "buybacks\.view"\)/);

assert.match(seed, /code: "buybacks\.view"/);
assert.match(seed, /code: "buybacks\.create"/);
assert.match(productMastersAction, /creationSource === "buyback"/);
assert.match(productMastersAction, /"buybacks\.create"/);
assert.match(productMastersAction, /pos_buyback_external_item/);

console.log("BB1 Buyback core static contracts: OK");
