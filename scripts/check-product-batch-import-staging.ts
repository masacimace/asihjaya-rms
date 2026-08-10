import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const service = read("src/features/product-batch-import/session-service.ts");
const storage = read("src/lib/storage/product-batch-import-storage.ts");
const route = read("src/app/api/admin/product-batch-import/upload/route.ts");
const validation = read("src/features/product-batch-import/validation.ts");
const action = read("src/app/actions/product-batch-import.ts");
const page = read("src/components/products/product-batch-import-upload.tsx");
const itemAction = read("src/app/actions/product-items.ts");

for (const required of [
  "products.batch_import",
  "product-batch-import:${auth.organization.id}:${fileSha256}",
  "DUPLICATE_GUARD_STATUSES",
  'status: "uploaded"',
  'status: "validating"',
  '? "invalid" : "ready"',
  "productBatchImportMasterRows",
  "productBatchImportItemRows",
  "productBatchImportMedia",
  "products.batch_import.upload",
]) {
  assert.ok(service.includes(required), `Session service contract hilang: ${required}`);
}

for (const required of [
  "CATEGORY_NOT_FOUND_OR_INACTIVE",
  "OUTLET_NOT_FOUND_OR_INACTIVE",
  "MASTER_IMAGE_FALLBACK",
  "PERMISSION_PRICING_REQUIRED",
  "PARENT_MASTER_INVALID",
]) {
  assert.ok(validation.includes(required), `Validation contract hilang: ${required}`);
}

assert.ok(!service.includes("transaction.insert(productMasters)"));
assert.ok(!service.includes("transaction.insert(productItems)"));
assert.ok(!service.includes("transaction.insert(itemBarcodes)"));
assert.ok(!service.includes("transaction.insert(inventoryMovements)"));

assert.ok(route.includes("request.body.getReader()"));
assert.ok(route.includes("PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes"));
assert.ok(route.includes("CROSS_ORIGIN_REJECTED"));
assert.ok(route.includes("getCurrentAuth()"));
assert.ok(route.includes('hasPermission(auth, "products.batch_import")'));
assert.ok(route.includes("x-product-batch-file-name"));
assert.ok(route.includes('"Cache-Control": "no-store, max-age=0"'));

assert.ok(storage.includes("product-batch-import"));
assert.ok(storage.includes('CacheControl: "private, no-store"'));
assert.ok(storage.includes("deleteProductBatchImportStagingFiles"));
assert.ok(action.includes("cancelProductBatchImportSession"));
assert.ok(page.includes("Upload & validasi ZIP"));
assert.ok(page.includes("Batalkan staging ini"));

assert.ok(itemAction.includes("productImageKey: productMasters.imageKey"));
assert.ok(itemAction.includes("willHaveEffectiveImage"));
assert.ok(itemAction.includes("foto aktual atau foto katalog Product Master"));

console.log("Pemeriksaan Product Batch Import staging berhasil.");
console.log("- Upload raw ZIP bounded + same-origin/auth guard tersedia.");
console.log("- Duplicate guard, session transitions, staging rows/media, cancel/expiry cleanup tersedia.");
console.log("- 2B.4 tidak menyentuh product master/item/barcode/inventory tables.");
console.log("- Manual Product Item effective-image rule sudah selaras dengan contract batch.");
