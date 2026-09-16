import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  analyzeMigrationHistory,
  findDestructiveMigrationFindings,
  loadMigrationPlan,
  parseBoolean,
  parsePositiveInteger,
  type MigrationDescriptor,
} from "./database-deployment-state";

const projectRoot = process.cwd();

function readProjectText(relativePath: string): string {
  const absolutePath = path.join(projectRoot, relativePath);
  return readFileSync(absolutePath, "utf8").replace(/\r\n?/g, "\n");
}

const migrationPlan = loadMigrationPlan(path.join(projectRoot, "drizzle"));
assert(migrationPlan.length > 0, "Migration plan tidak boleh kosong.");
assert.equal(migrationPlan[0]?.index, 0);
assert.match(migrationPlan[0]?.hash ?? "", /^[a-f0-9]{64}$/);
assert(
  migrationPlan.every((migration) =>
    migration.compatibleLineEndingHashes.every((hash) =>
      /^[a-f0-9]{64}$/.test(hash),
    ),
  ),
  "Hash compatibility line-ending migration harus berupa SHA-256.",
);

const firstTwoApplied = migrationPlan.slice(0, 2).map((migration, index) => ({
  id: index + 1,
  hash: migration.hash,
  createdAt: migration.createdAt,
}));
const partial = analyzeMigrationHistory(migrationPlan, firstTwoApplied);
assert.equal(partial.appliedCount, 2);
assert.equal(partial.pending.length, migrationPlan.length - 2);
assert.equal(
  analyzeMigrationHistory(migrationPlan, []).pending.length,
  migrationPlan.length,
);
assert.equal(
  analyzeMigrationHistory(
    migrationPlan,
    migrationPlan.map((migration, index) => ({
      id: index + 1,
      hash: migration.hash,
      createdAt: migration.createdAt,
    })),
  ).pending.length,
  0,
);

const firstMigration = migrationPlan[0]!;
const compatibleLineEndingHash = firstMigration.compatibleLineEndingHashes[0];
if (compatibleLineEndingHash) {
  const compatible = analyzeMigrationHistory(migrationPlan, [
    { ...firstTwoApplied[0]!, hash: compatibleLineEndingHash },
  ]);
  assert.deepEqual(compatible.lineEndingCompatibilityMatches, [
    {
      index: 0,
      tag: firstMigration.tag,
      databaseHash: compatibleLineEndingHash,
      releaseHash: firstMigration.hash,
    },
  ]);
}

assert.throws(
  () =>
    analyzeMigrationHistory(migrationPlan, [
      { ...firstTwoApplied[0]!, hash: "tampered" },
    ]),
  /hash SQL tidak cocok/,
);
assert.throws(
  () =>
    analyzeMigrationHistory(migrationPlan, [
      { ...firstTwoApplied[0]!, createdAt: "1" },
    ]),
  /timestamp database/,
);
assert.throws(
  () =>
    analyzeMigrationHistory(migrationPlan.slice(0, 1), [
      firstTwoApplied[0]!,
      firstTwoApplied[1]!,
    ]),
  /schema yang lebih baru/,
);

function migration(sql: string, tag = "9999_test"): MigrationDescriptor {
  return {
    index: 9999,
    tag,
    createdAt: "9999999999999",
    hash: "0".repeat(64),
    compatibleLineEndingHashes: [],
    sql,
    filePath: `${tag}.sql`,
  };
}

assert.deepEqual(findDestructiveMigrationFindings([migration("select 1;")]), []);
assert.deepEqual(
  findDestructiveMigrationFindings([
    migration("-- DROP TABLE ignored\nselect 1;"),
  ]),
  [],
);
for (const [sql, operation] of [
  ["DROP TABLE sales;", "DROP TABLE"],
  ["ALTER TABLE sales DROP COLUMN total;", "DROP COLUMN"],
  ["TRUNCATE TABLE sales;", "TRUNCATE"],
  ["DELETE FROM sales;", "DELETE FROM"],
  ["ALTER TABLE sales ALTER COLUMN total TYPE text;", "ALTER COLUMN TYPE"],
  ["ALTER TABLE sales DROP CONSTRAINT sales_pkey;", "DROP CONSTRAINT"],
] as const) {
  assert.equal(
    findDestructiveMigrationFindings([migration(sql)])[0]?.operation,
    operation,
  );
}

assert.equal(parsePositiveInteger(undefined, 10, "TEST", 100), 10);
assert.equal(parsePositiveInteger("25", 10, "TEST", 100), 25);
assert.throws(() => parsePositiveInteger("0", 10, "TEST", 100));
assert.throws(() => parsePositiveInteger("101", 10, "TEST", 100));
assert.equal(parseBoolean("true"), true);
assert.equal(parseBoolean("off"), false);
assert.throws(() => parseBoolean("maybe"));

const packageJson = JSON.parse(readProjectText("package.json")) as {
  scripts?: Record<string, string>;
};
for (const scriptName of [
  "db:deploy",
  "db:deploy:production",
  "check:database-deployment",
  "test:database-deployment:local",
]) {
  assert(
    packageJson.scripts?.[scriptName],
    `package.json wajib memiliki ${scriptName}.`,
  );
}

const dockerfile = readProjectText("Dockerfile");
assert.match(dockerfile, /FROM toolchain AS migrator/);
assert.match(dockerfile, /USER migrator/);
assert.match(dockerfile, /CMD \["npm", "run", "db:deploy"\]/);

const compose = readProjectText("compose.production.yaml");
assert.match(compose, /\n  migrate:\n/);
assert.match(compose, /target: migrator/);
assert.match(compose, /condition: service_completed_successfully/);
assert.match(compose, /restart: "no"/);
assert.match(compose, /read_only: true/);

const drizzleConfig = readProjectText("drizzle.config.ts");
assert.match(drizzleConfig, /DRIZZLE_MIGRATIONS_DIR/);

const runner = readProjectText("scripts/run-database-deployment.ts");
assert.match(runner, /pg_try_advisory_lock/);
assert.match(runner, /pg_advisory_unlock/);
assert.match(runner, /--allow-destructive/);
assert.match(runner, /before\.appliedCount === 0/);
assert.match(runner, /Fresh database terdeteksi/);
assert.match(runner, /applyPendingMigrationsOneByOne/);
assert.match(runner, /Menerapkan migration .*commit boundary terpisah/);
assert.match(runner, /migration\.index \+ 1/);
assert.match(runner, /analyzeMigrationHistory/);
assert.match(runner, /Compatibility migration line-ending diterima/);
assert.match(runner, /runDrizzleMigration/);
assert.match(runner, /DRIZZLE_MIGRATIONS_DIR/);
assert.doesNotMatch(runner, /DATABASE_MIGRATION_APPROVAL_REFERENCE/);
assert.doesNotMatch(runner, /DATABASE_MIGRATION_ALLOW_DESTRUCTIVE/);
assert.doesNotMatch(
  runner,
  /console\.(?:log|error)\([^\n]*DATABASE_URL/,
);

const localRehearsal = readProjectText(
  "scripts/run-database-deployment-local.ts",
);
assert.match(localRehearsal, /Fresh database terdeteksi/);
assert.match(localRehearsal, /--allow-destructive/);
assert.match(localRehearsal, /0007_legacy_manager_review_inventory_hold/);
assert.match(localRehearsal, /0008_legacy_sold_during_migration/);
assert.match(localRehearsal, /0009_legacy_transactional_cutover/);
assert.match(localRehearsal, /0011_legacy_cutover_hardening/);
assert.doesNotMatch(localRehearsal, /DATABASE_MIGRATION_APPROVAL_REFERENCE/);

const attributes = readProjectText(".gitattributes");
assert.match(attributes, /^drizzle\/\*\.sql text eol=lf$/m);

console.log(
  `OK: ${migrationPlan.length} migration memiliki preflight history, fresh-DB auto approval, one-shot destructive guard, per-migration commit boundary, PostgreSQL advisory lock, migrator container, dan deployment scripts yang konsisten.`,
);
