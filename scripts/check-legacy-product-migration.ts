import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getSuggestedCategoryCode,
  normalizeLegacyCategoryName,
} from "../src/features/legacy-migration/master-mapping";
import { normalizePurityKey } from "../src/features/pricing/metal-price-rates";

assert.equal(getSuggestedCategoryCode("Cincin"), "RING");
assert.equal(getSuggestedCategoryCode("Giwang"), "EARRING");
assert.equal(normalizeLegacyCategoryName(" logam   mulia "), "Logam Mulia");
assert.equal(normalizePurityKey("30.000"), "30");

const actionSource = await readFile(
  new URL("../src/app/actions/legacy-product-import.ts", import.meta.url),
  "utf8",
);
const directServiceSource = await readFile(
  new URL(
    "../src/features/legacy-migration/direct-import-service.ts",
    import.meta.url,
  ),
  "utf8",
);
const mainPageSource = await readFile(
  new URL(
    "../src/app/(admin)/admin/migrasi-produk/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const detailPageSource = await readFile(
  new URL(
    "../src/app/(admin)/admin/migrasi-produk/[batchId]/page.tsx",
    import.meta.url,
  ),
  "utf8",
);

for (const required of [
  "importLegacyBatchDirectlyToInventory",
  "syncLegacyProductImagesAction",
]) {
  assert.ok(
    actionSource.includes(required),
    `Action direct import harus mempertahankan contract: ${required}`,
  );
}

for (const required of [
  'availability: "available"',
  'condition: "good"',
  'movementType: "migration_opening"',
  'source: "legacy_import"',
  'status: "ready"',
  "legacyPricePerGram",
  "needsCleanup",
  "DIRECT_IMPORT_EXISTING_ITEMS_INCONSISTENT",
  "completeCommittedImport",
  "source row",
]) {
  assert.ok(
    directServiceSource.includes(required),
    `Direct import harus mempertahankan contract: ${required}`,
  );
}

const migrationUiSource = `${mainPageSource}\n${detailPageSource}`;
for (const retiredSegment of [
  "/mapping",
  "/sesi",
  "/review",
  "/rekonsiliasi",
  "/cutover",
  "/sold",
]) {
  assert.ok(
    !migrationUiSource.includes(retiredSegment),
    `Route flow lama masih direferensikan: ${retiredSegment}`,
  );
}
assert.ok(!migrationUiSource.includes("MigrationControlCenter"));
assert.ok(mainPageSource.includes("Import XLSX ke Inventaris"));
assert.ok(mainPageSource.includes("Semua row tetap masuk"));
assert.ok(detailPageSource.includes("Data sumber & cleanup"));

console.log("Legacy direct-import contract checks passed.");
