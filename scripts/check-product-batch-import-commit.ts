import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const commit = read("src/features/product-batch-import/commit-service.ts");
const masterIdentifiers = read("src/features/product-batch-import/product-master-identifiers.ts");
const itemIdentifiers = read("src/features/inventory/product-item-identifiers.ts");
const action = read("src/app/actions/product-batch-import.ts");
const sessionActions = read("src/components/products/product-batch-import-session-actions.tsx");
const uploadRoute = read("src/app/api/admin/product-batch-import/upload/route.ts");
const mediaRoute = read("src/app/(admin)/admin/produk/import/[sessionId]/media/[mediaId]/route.ts");
const imageStorage = read("src/lib/storage/image-storage.ts");

for (const token of [
  "pg_advisory_xact_lock",
  'session.status !== "ready"',
  'status: "committing"',
  "STAGING_ARCHIVE_HASH_MISMATCH",
  "STAGING_MEDIA_HASH_MISMATCH",
  "plannedProductMasterId",
  "plannedProductItemId",
  "storeImageBuffer",
  "deleteImageFileStrict",
  "getNextProductMasterCode",
  "getNextProductItemIdentifiers",
  "transaction.insert(productMasters)",
  "transaction.insert(productItems)",
  "transaction.insert(itemBarcodes)",
  'source: "system_generated"',
  'movementType: "goods_receipt"',
  'status: "completed"',
  "committedMasterCount",
  "committedItemCount",
  "products.batch_import.commit_completed",
  "products.batch_import.commit_failed",
  "after_first_identifier_allocation",
]) {
  assert.ok(commit.includes(token), `Atomic commit contract hilang: ${token}`);
}

// R3.02 v2 business behavior.
for (const token of [
  "plan.templateVersion === 2",
  "product-batch-import-v2-org:",
  "uniqueCategoryCode",
  "createdCategoryCount",
  "reusedMasterCount",
  'action: "product_category.create"',
  'action: "product_category.update"',
  'action: "product_master.update"',
  "getActiveGoldPriceRateMap",
  "calculateJewelryBasePrice",
  "compatibilityPricePerGram",
  "compatibilitySellingAmount",
  '["good", "used"].includes(condition)',
]) {
  assert.ok(commit.includes(token), `R3.02 v2 commit contract hilang: ${token}`);
}
assert.ok(uploadRoute.includes("session.templateVersion === 2"));
assert.ok(uploadRoute.includes("commitProductBatchImportSession"));
assert.ok(uploadRoute.includes("commitFailure"));

assert.ok(masterIdentifiers.includes("nextval('product_master_number_seq')"));
assert.ok(masterIdentifiers.includes("PM-${normalized}"));
assert.ok(itemIdentifiers.includes("nextval('product_item_number_seq')"));
assert.ok(!commit.includes("MAX(barcode)"));
assert.ok(!commit.includes("legacy_import"));
assert.ok(!commit.includes("legacy_physical_label"));

// V1 compatibility keeps its explicit confirmation action.
assert.ok(action.includes("commitProductBatchImportSessionAction"));
assert.ok(action.includes('confirmation !== "yes"'));
assert.ok(sessionActions.includes("Commit Product Batch Import?"));
assert.ok(sessionActions.includes('name="confirmCommit"'));

assert.ok(imageStorage.includes("deleteImageFileStrict"));
assert.ok(mediaRoute.includes("readImageFile"));
assert.ok(mediaRoute.includes('media.status === "promoted"'));
assert.ok(mediaRoute.includes("imageKeyBelongsToOrganization"));

console.log("Pemeriksaan Product Batch Import atomic commit berhasil.");
console.log("- V2 auto-commit tetap memakai advisory lock, snapshot guard, atomic transaction, dan compensating media cleanup.");
console.log("- Category/master create/reuse diserialisasi per organization dan compatibility price dihitung server dari global rate.");
console.log("- V1 manual confirmation tetap dipertahankan hanya sebagai compatibility path.");
