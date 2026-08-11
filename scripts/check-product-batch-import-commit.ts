import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const commit = read("src/features/product-batch-import/commit-service.ts");
const masterIdentifiers = read(
  "src/features/product-batch-import/product-master-identifiers.ts",
);
const itemIdentifiers = read(
  "src/features/inventory/product-item-identifiers.ts",
);
const action = read("src/app/actions/product-batch-import.ts");
const sessionActions = read(
  "src/components/products/product-batch-import-session-actions.tsx",
);
const mediaRoute = read(
  "src/app/(admin)/admin/produk/import/[sessionId]/media/[mediaId]/route.ts",
);
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

assert.ok(
  masterIdentifiers.includes("nextval('product_master_number_seq')"),
  "Product Master harus memakai sequence existing 2B.2.",
);
assert.ok(masterIdentifiers.includes("PM-${normalized}"));
assert.ok(!masterIdentifiers.includes("max(".toLowerCase()));
assert.ok(
  itemIdentifiers.includes("nextval('product_item_number_seq')"),
  "Product Item harus tetap memakai product_item_number_seq existing.",
);
assert.ok(!commit.includes("MAX(barcode)"));
assert.ok(!commit.includes("legacy_import"));
assert.ok(!commit.includes("legacy_physical_label"));

assert.ok(action.includes("commitProductBatchImportSessionAction"));
assert.ok(action.includes('confirmation !== "yes"'));
assert.ok(sessionActions.includes("Commit Product Batch Import?"));
assert.ok(sessionActions.includes('name="confirmCommit"'));
assert.ok(sessionActions.includes("Rollback aplikasi tidak otomatis menghapus"));
assert.ok(sessionActions.includes("Product Item / barcode"));

assert.ok(imageStorage.includes("deleteImageFileStrict"));
assert.ok(mediaRoute.includes("readImageFile"));
assert.ok(mediaRoute.includes('media.status === "promoted"'));
assert.ok(mediaRoute.includes("imageKeyBelongsToOrganization"));

console.log("Pemeriksaan Product Batch Import atomic commit berhasil.");
console.log("- Session lock/status guard, snapshot hash, planned UUID, dan media promotion tersedia.");
console.log("- Product Master code + Product Item identifiers memakai PostgreSQL sequence existing.");
console.log("- Product/item/barcode/goods receipt/audit disimpan dalam atomic business transaction.");
console.log("- Failure path mempunyai compensating final-image cleanup dan second commit guard.");
