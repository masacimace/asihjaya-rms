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
const upload = read("src/components/products/product-batch-import-upload.tsx");
const importPage = read("src/app/(admin)/admin/produk/import/page.tsx");
const sessionActions = read("src/components/products/product-batch-import-session-actions.tsx");
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

// Contract V2 utama + compatibility V1 tetap hidup di validator yang sama.
for (const required of [
  "CATEGORY_AMBIGUOUS",
  "PRODUCT_MASTER_AMBIGUOUS",
  "OUTLET_NOT_FOUND_OR_INACTIVE",
  "ITEM_CONDITION_NOT_SELLABLE",
  "PERMISSION_PRICING_REQUIRED",
  "MASTER_IMAGE_FALLBACK",
]) {
  assert.ok(validation.includes(required), `Validation contract hilang: ${required}`);
}

// Staging/validation tidak boleh menulis business tables sebelum atomic commit.
assert.ok(!service.includes("transaction.insert(productMasters)"));
assert.ok(!service.includes("transaction.insert(productItems)"));
assert.ok(!service.includes("transaction.insert(itemBarcodes)"));
assert.ok(!service.includes("transaction.insert(inventoryMovements)"));

// Upload route tetap bounded, authenticated, same-origin, dan no-store.
assert.ok(route.includes("request.body.getReader()"));
assert.ok(route.includes("getProductBatchImportUploadLimit(fileName)"));
assert.ok(route.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
assert.ok(route.includes("CROSS_ORIGIN_REJECTED"));
assert.ok(route.includes('import { serverEnv } from "@/lib/env";'));
assert.ok(route.includes("const expectedOrigin = serverEnv.APP_URL;"));
assert.ok(route.includes("origin !== expectedOrigin"));
assert.ok(!route.includes("origin !== requestOrigin"));
assert.ok(route.includes("getCurrentAuth()"));
assert.ok(route.includes('hasPermission(auth, "products.batch_import")'));
assert.ok(route.includes("x-product-batch-file-name"));
assert.ok(route.includes('"Cache-Control": "no-store, max-age=0"'));

// Template V2 yang valid di-auto-commit; V1 tetap memakai compatibility session flow.
assert.ok(route.includes("session.templateVersion === 2 && session.status === \"ready\""));
assert.ok(route.includes("commitProductBatchImportSession"));
assert.ok(route.includes('status: commitResult ? "completed" : commitFailure ? "failed" : session.status'));

assert.ok(storage.includes("product-batch-import"));
assert.ok(storage.includes('CacheControl: "private, no-store"'));
assert.ok(storage.includes("deleteProductBatchImportStagingFiles"));
assert.ok(action.includes("cancelProductBatchImportSession"));

// UX resmi R3.02: single XLSX satu-sheet menjadi jalur utama.
for (const required of [
  "Upload products.xlsx",
  "Workflow utama cukup satu file XLSX",
  "Gelang Rantai Kaki.xlsx",
  "Upload & Import",
]) {
  assert.ok(upload.includes(required), `Upload UX V2 hilang: ${required}`);
}
for (const required of [
  "Import banyak produk dari satu XLSX",
  "Template baru hanya mempunyai satu worksheet PRODUCTS",
  "3. Upload & selesai",
  "Single XLSX adalah workflow utama",
  "Template lama v1 empat-sheet tetap dapat dibaca",
]) {
  assert.ok(importPage.includes(required), `Import page V2 contract hilang: ${required}`);
}

// V1 compatibility masih mempunyai cancel/manual-commit session action.
assert.ok(sessionActions.includes("cancelProductBatchImportSessionAction"));
assert.ok(sessionActions.includes("Batalkan staging"));

// Manual Physical Product flow sudah mengikuti domain R2: foto hanya item,
// field legacy tidak diekspos kembali, dan harga compatibility berasal dari rate aktif.
assert.ok(itemAction.includes("if (image)"));
assert.ok(itemAction.includes("entityType: \"items\""));
assert.ok(itemAction.includes("size: null"));
assert.ok(itemAction.includes("gemstone: null"));
assert.ok(itemAction.includes("costAmount: null"));
assert.ok(itemAction.includes("locationCode: null"));
assert.ok(itemAction.includes("const pricePerGram = activeRate?.ratePerGram ?? null"));
assert.ok(itemAction.includes('if (!["good", "used"].includes(conditionRaw))'));
assert.ok(!itemAction.includes("willHaveEffectiveImage"));
assert.ok(!itemAction.includes("foto aktual atau foto katalog Product Master"));

console.log("Pemeriksaan Product Batch Import staging berhasil.");
console.log("- Upload raw ZIP/XLSX bounded + same-origin/auth guard tetap tersedia.");
console.log("- Duplicate guard, staging rows/media, cancel/expiry cleanup tetap tersedia.");
console.log("- Template V2 single XLSX auto-commit hanya setelah validation ready; V1 compatibility tetap tersedia.");
console.log("- Staging service tidak menulis Product Master/Item/barcode/inventory sebelum atomic commit.");
console.log("- Manual Physical Item tetap selaras dengan domain R2: foto item-only, pricing compatibility dari global rate.");
