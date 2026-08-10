import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8").replace(
    /\r\n?/g,
    "\n",
  );
}

const schema = read("src/db/schema/index.ts");
const seed = read("src/db/seed.ts");
const migration = read("drizzle/0016_product_batch_import_staging.sql");
const journal = JSON.parse(read("drizzle/meta/_journal.json")) as {
  entries: Array<{ idx: number; tag: string }>;
};
const snapshot = JSON.parse(read("drizzle/meta/0016_snapshot.json")) as {
  prevId: string;
  tables: Record<string, unknown>;
  enums: Record<string, unknown>;
  sequences: Record<string, unknown>;
};
const previousSnapshot = JSON.parse(read("drizzle/meta/0015_snapshot.json")) as {
  id: string;
};

assert.equal(journal.entries.at(-1)?.idx, 16);
assert.equal(
  journal.entries.at(-1)?.tag,
  "0016_product_batch_import_staging",
);
assert.equal(snapshot.prevId, previousSnapshot.id);

for (const symbol of [
  "productMasterNumberSequence",
  "productBatchImportStatusEnum",
  "productBatchImportRowValidationStatusEnum",
  "productBatchImportMediaEntityKindEnum",
  "productBatchImportMediaStatusEnum",
  "productBatchImportSessions",
  "productBatchImportMasterRows",
  "productBatchImportItemRows",
  "productBatchImportMedia",
]) {
  assert.match(schema, new RegExp(`export const ${symbol}\\b`));
}

for (const databaseObject of [
  "public.product_master_number_seq",
]) {
  assert(snapshot.sequences[databaseObject], `Sequence ${databaseObject} wajib ada.`);
}

for (const enumName of [
  "public.product_batch_import_status",
  "public.product_batch_import_row_validation_status",
  "public.product_batch_import_media_entity_kind",
  "public.product_batch_import_media_status",
]) {
  assert(snapshot.enums[enumName], `Enum ${enumName} wajib ada.`);
}

for (const tableName of [
  "public.product_batch_import_sessions",
  "public.product_batch_import_master_rows",
  "public.product_batch_import_item_rows",
  "public.product_batch_import_media",
]) {
  assert(snapshot.tables[tableName], `Table ${tableName} wajib ada.`);
}

assert.match(
  migration,
  /CREATE SEQUENCE "public"\."product_master_number_seq"/,
);
assert.match(migration, /CREATE TABLE "product_batch_import_sessions"/);
assert.match(migration, /CREATE TABLE "product_batch_import_master_rows"/);
assert.match(migration, /CREATE TABLE "product_batch_import_item_rows"/);
assert.match(migration, /CREATE TABLE "product_batch_import_media"/);
assert.match(
  migration,
  /product_batch_import_sessions_org_hash_active_uq[\s\S]*WHERE[\s\S]*'completed'/,
);
assert.match(migration, /'products\.batch_import'/);
assert.match(
  migration,
  /role_record\."code" IN \('system_admin', 'owner', 'manager', 'stock_admin'\)/,
);

assert.doesNotMatch(migration, /\bDROP\s+(?:TABLE|COLUMN|TYPE|INDEX|SEQUENCE)\b/i);
assert.doesNotMatch(migration, /\bTRUNCATE\b/i);
assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);
assert.doesNotMatch(migration, /ALTER\s+TABLE\s+"(?:product_masters|product_items|item_barcodes|inventory_movements)"/i);

assert.match(seed, /code: "products\.batch_import"/);
for (const roleCode of ["manager", "stock_admin"]) {
  const roleBlock = seed.match(
    new RegExp(`${roleCode}: \\[([\\s\\S]*?)\\n  \\],`),
  )?.[1];
  assert(roleBlock, `Role ${roleCode} tidak ditemukan pada seed.`);
  assert.match(roleBlock, /"products\.batch_import"/);
}

for (const routePath of [
  "src/app/(admin)/admin/produk/import/page.tsx",
  "src/app/(admin)/admin/produk/import/template/route.ts",
]) {
  assert.match(
    read(routePath),
    /requirePermission\("products\.batch_import"\)/,
    `${routePath} wajib memakai permission final products.batch_import.`,
  );
}

const catalogPage = read("src/app/(admin)/admin/produk/page.tsx");
assert.match(
  catalogPage,
  /hasPermission\(auth, "products\.batch_import"\)/,
);
assert.match(catalogPage, /\{canBatchImport \? \(/);

console.log(
  "OK: Product Batch Import 2B.2 additive schema, staging metadata, sequence, permission, dan route guard konsisten.",
);
