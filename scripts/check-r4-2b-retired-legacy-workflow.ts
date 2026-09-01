import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const schema = read("src/db/schema/index.ts");
const seed = read("src/db/seed.ts");
const posLayout = read("src/app/(pos)/pos/layout.tsx");
const posShell = read("src/components/layout/pos-shell.tsx");
const recovery = read("scripts/recover-r3-legacy-duplicate-import.ts");
const directImport = read("src/features/legacy-migration/direct-import-service.ts");
const legacyImportAction = read("src/app/actions/legacy-product-import.ts");

const retiredSchemaTokens = [
  'pgTable(\n  "legacy_migration_sessions"',
  'pgTable(\n  "legacy_migration_session_assignments"',
  'pgTable(\n  "legacy_migration_verifications"',
  'pgTable(\n  "legacy_migration_sold_records"',
  'pgTable(\n  "legacy_migration_cutover_runs"',
  'pgEnum(\n  "legacy_migration_session_status"',
  'pgEnum(\n  "legacy_migration_assignment_role"',
  'pgEnum(\n  "legacy_migration_verification_source"',
  'pgEnum(\n  "legacy_migration_verification_status"',
];

for (const token of retiredSchemaTokens) {
  assert.equal(
    schema.includes(token),
    false,
    `R4.2B schema masih memuat retired legacy workflow: ${token.replaceAll("\n", " ")}`,
  );
}

for (const activeToken of [
  'pgTable(\n  "legacy_product_import_batches"',
  'pgTable(\n  "legacy_product_rows"',
  'pgTable(\n  "legacy_product_master_mappings"',
  'pgTable(\n  "item_barcodes"',
  'pgEnum("item_barcode_source"',
  '"legacy_import"',
]) {
  assert.equal(
    schema.includes(activeToken),
    true,
    `Contract Legacy Direct Import yang masih aktif hilang: ${activeToken.replaceAll("\n", " ")}`,
  );
}

const retiredPermissions = [
  "migration.mapping.manage",
  "migration.session.manage",
  "migration.scan",
  "migration.verification.submit",
  "migration.verification.review",
  "migration.verification.approve",
  "migration.sold.manage",
  "migration.cutover.execute",
];
for (const permission of retiredPermissions) {
  assert.equal(seed.includes(`\"${permission}\"`), false, `Permission retired masih di-seed: ${permission}`);
}
for (const permission of ["migration.view", "migration.import"]) {
  assert.equal(seed.includes(`\"${permission}\"`), true, `Permission aktif wajib dipertahankan: ${permission}`);
}

assert.equal(posLayout.includes('"migration.scan"'), false, "POS layout tidak boleh bergantung pada migration.scan.");
assert.equal(posShell.includes("canAccessMigration"), false, "POS shell masih membawa dead migration access prop.");
assert.equal(posShell.includes('item.access === "migration"'), false, "POS shell masih memiliki dead migration navigation filter.");

for (const retiredRecoveryDependency of [
  "legacy_migration_verifications",
  "legacy_migration_sold_records",
  "legacy_verifications",
  "legacy_sold_records",
]) {
  assert.equal(
    recovery.includes(retiredRecoveryDependency),
    false,
    `Duplicate-import recovery masih bergantung pada retired table: ${retiredRecoveryDependency}`,
  );
}
for (const activeRecoveryDependency of [
  "inventory_movements",
  "item_barcodes",
  "sale_items",
  "sale_return_items",
  "pos_held_cart_items",
  "product_batch_import_item_rows",
]) {
  assert.equal(
    recovery.includes(activeRecoveryDependency),
    true,
    `Duplicate-import recovery kehilangan operational guard: ${activeRecoveryDependency}`,
  );
}

assert.match(directImport, /legacyProductMasterMappings/);
assert.match(directImport, /movementType: "migration_opening"/);
assert.match(directImport, /source: "legacy_import"/);
assert.match(legacyImportAction, /requirePermission\("migration\.import"\)/);

console.log("R4.2B retired legacy migration workflow contracts: OK");
