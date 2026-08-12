import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path: string) {
  return readFile(path, "utf8");
}

const [packageJsonRaw, checksRunner, freshRunner, acceptanceDoc] = await Promise.all([
  read("package.json"),
  read("scripts/run-product-batch-import-acceptance-checks.ts"),
  read("scripts/run-product-batch-import-acceptance-fresh.ts"),
  read("docs/development/product-batch-import-local-acceptance.md"),
]);

const packageJson = JSON.parse(packageJsonRaw) as {
  scripts?: Record<string, string>;
};
const scripts = packageJson.scripts ?? {};

assert.equal(
  scripts["check:product-batch-acceptance"],
  "tsx scripts/check-product-batch-import-acceptance.ts",
);
assert.equal(
  scripts["test:product-batch-acceptance:checks"],
  "tsx scripts/run-product-batch-import-acceptance-checks.ts",
);
assert.ok(
  scripts["test:product-batch-acceptance:existing"]?.includes("--profile=existing"),
);
assert.equal(
  scripts["test:product-batch-acceptance:fresh"],
  "tsx scripts/run-product-batch-import-acceptance-fresh.ts",
);
assert.equal(
  scripts["test:product-batch-acceptance:premerge"],
  "npm run check:stabilization && npm run build:clean",
);
assert.ok(scripts["check:product-batch-import"]?.includes("check:product-batch-acceptance"));

for (const marker of [
  'script: "typecheck"',
  'script: "lint"',
  'script: "routes:check"',
  'script: "build"',
  'script: "check:database-deployment"',
  'script: "check:xlsx-security"',
  'script: "check:inventory-label"',
  'script: "check:product-batch-import"',
  'script: "check:legacy-product-migration"',
  'script: "check:pos-stage-1c"',
  'script: "check:database:live"',
  'script: "test:product-batch:local"',
  'script: "check:product-batch-regression"',
]) {
  assert.ok(checksRunner.includes(marker), `Acceptance technical runner belum mencakup ${marker}.`);
}

assert.ok(checksRunner.includes('process.env.NODE_ENV === "production"'));
assert.ok(checksRunner.includes("localhost"));
assert.ok(freshRunner.includes('REQUIRED_CONFIRMATION = "RESET_LOCAL_DATABASE"'));
assert.ok(freshRunner.includes('"--purge-local-storage"'));
assert.ok(freshRunner.includes('"db:fresh:local"'));
assert.ok(freshRunner.includes('"--profile=fresh"'));
assert.ok(freshRunner.includes('process.env.NODE_ENV === "production"'));

for (const section of [
  "Phase A — Existing local DB",
  "Phase B — Fresh local DB",
  "Manual acceptance — valid batch",
  "Duplicate, invalid, dan cancel",
  "Failure dan orphan-media rehearsal",
  "Manual regression flow existing",
  "Pre-merge final gate",
  "Exit criteria 2B.10",
]) {
  assert.ok(acceptanceDoc.includes(section), `Dokumen acceptance belum mempunyai section: ${section}`);
}

for (const marker of [
  "npm install",
  "npm run test:product-batch-acceptance:existing",
  "npm run test:product-batch-acceptance:fresh -- --confirm=RESET_LOCAL_DATABASE",
  "npm run check:product-batch-commit:live",
  "npm run check:product-batch-results:live",
  "npm run test:product-batch-commit-failure:local",
  "npm run check:product-batch-maintenance:live",
  "npm run test:product-batch-acceptance:premerge",
  "routes:check",
]) {
  assert.ok(acceptanceDoc.includes(marker), `Dokumen acceptance belum mencakup marker: ${marker}`);
}

console.log("Pemeriksaan Product Batch Import local acceptance berhasil.");
console.log("- Existing + fresh local DB technical runners tersedia dengan safety guard localhost.");
console.log("- Baseline roadmap, integration/regression, manual acceptance, failure/orphan, dan pre-merge gate terdokumentasi.");
console.log("- Fresh runner memerlukan confirmation eksplisit sebelum reset database/storage lokal.");
