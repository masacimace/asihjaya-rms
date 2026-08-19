import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path: string) {
  return readFile(path, "utf8");
}

const [packageJsonRaw, suite, runner, localRunner, compose, testPlan] = await Promise.all([
  read("package.json"),
  read("tests/integration/product-batch-import-suite.ts"),
  read("scripts/run-product-batch-import-integration-tests.ts"),
  read("scripts/run-product-batch-import-integration-local.ts"),
  read("compose.product-batch-test.yaml"),
  read("docs/development/product-batch-import-test-matrix.md"),
]);
const packageJson = JSON.parse(packageJsonRaw) as {
  scripts?: Record<string, string>;
};
const scripts = packageJson.scripts ?? {};

assert.equal(
  scripts["test:product-batch"],
  "tsx scripts/run-product-batch-import-integration-tests.ts",
);
assert.equal(
  scripts["test:product-batch:local"],
  "tsx scripts/run-product-batch-import-integration-local.ts",
);
assert.ok(scripts["check:product-batch-regression"]?.includes("check:xlsx-security"));
assert.ok(scripts["check:product-batch-regression"]?.includes("check:legacy-product-migration"));
assert.ok(scripts["check:product-batch-regression"]?.includes("check:inventory-label"));
assert.ok(scripts["check:product-batch-regression"]?.includes("check:camera-scanner"));
assert.ok(scripts["check:product-batch-regression"]?.includes("check:pos-stage-1c"));
assert.ok(scripts["check:product-batch-import"]?.includes("check:product-batch-testing"));

for (const marker of [
  "1 master + 1 draft item",
  "single XLSX Picture in Cell",
  "buildInCellImageWorkbookFixture",
  "one master with many items",
  "multiple masters",
  "MASTER_KEY_DUPLICATE",
  "ROW_KEY_DUPLICATE",
  "CATEGORY_NOT_FOUND_OR_INACTIVE",
  "OUTLET_ACCESS_DENIED",
  "OUTLET_NOT_FOUND_OR_INACTIVE",
  "NUMERIC_VALUE_INVALID",
  "IMAGE_REFERENCE_MISSING",
  "IMAGE_DECODE_FAILED",
  "ProductBatchImportDuplicateError",
  "getProductBatchImportPreview(organizationB.auth, sessionA.id)",
  'testFailpoint: "after_first_media_promotion"',
  'testFailpoint: "after_first_identifier_allocation"',
  "Promise.allSettled",
  "lookupPosItemByScanValue",
  "printProductBatchImportLabels",
  "system_generated",
  "goods_receipt",
]) {
  assert.ok(suite.includes(marker), `Integration suite belum mencakup marker: ${marker}`);
}

assert.ok(runner.includes("TEST_DATABASE_URL"));
assert.ok(runner.includes("assertSafeTestDatabase"));
assert.ok(runner.includes('process.env.IMAGE_STORAGE_DRIVER = "local"'));
assert.ok(runner.includes("product-batch-integration-test"));
assert.ok(localRunner.includes("compose.product-batch-test.yaml"));
assert.ok(localRunner.includes("db:migrate"));
assert.ok(localRunner.includes("test:product-batch"));
assert.ok(localRunner.includes("down",));
assert.ok(localRunner.includes("--volumes"));

assert.ok(compose.includes("postgres:17-alpine"));
assert.ok(compose.includes("asihjaya_rms_product_batch_test"));
assert.ok(compose.includes('127.0.0.1:55438:5432'));
assert.ok(compose.includes("product_batch_test_postgres_data"));

for (const section of [
  "Automated integration suite",
  "Parser/security coverage",
  "Database/atomic coverage",
  "Regression gates",
  "Manual browser/hardware checks",
  "Single XLSX embedded",
  "Picture in Cell",
  "Dual ingress parity",
  "Exit criteria 2B.9",
]) {
  assert.ok(testPlan.includes(section), `Test matrix belum mempunyai section: ${section}`);
}

console.log("Pemeriksaan Product Batch Import testing berhasil.");
console.log("- Disposable PostgreSQL 17 integration runner + isolated local storage tersedia.");
console.log("- ZIP + single XLSX DrawingML/Picture in Cell, valid/invalid, duplicate, tenant isolation, atomic failure/concurrency, POS dan label coverage terdaftar.");
console.log("- Regression matrix mengikat legacy migration, POS, inventory label dan database deployment checks.");
