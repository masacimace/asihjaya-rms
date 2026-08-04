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
const migrationPlan = loadMigrationPlan(path.join(projectRoot, "drizzle"));
assert(migrationPlan.length > 0, "Migration plan tidak boleh kosong.");
assert.equal(migrationPlan[0]?.index, 0);
assert.match(migrationPlan[0]?.hash ?? "", /^[a-f0-9]{64}$/);

const firstTwoApplied = migrationPlan.slice(0, 2).map((migration, index) => ({
  id: index + 1,
  hash: migration.hash,
  createdAt: migration.createdAt,
}));
const partial = analyzeMigrationHistory(migrationPlan, firstTwoApplied);
assert.equal(partial.appliedCount, 2);
assert.equal(partial.pending.length, migrationPlan.length - 2);
assert.equal(analyzeMigrationHistory(migrationPlan, []).pending.length, migrationPlan.length);
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

assert.throws(
  () => analyzeMigrationHistory(migrationPlan, [{ ...firstTwoApplied[0]!, hash: "tampered" }]),
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
    sql,
    filePath: `${tag}.sql`,
  };
}

assert.deepEqual(findDestructiveMigrationFindings([migration("select 1;")]), []);
assert.deepEqual(findDestructiveMigrationFindings([migration("-- DROP TABLE ignored\nselect 1;")]), []);
for (const [sql, operation] of [
  ["DROP TABLE sales;", "DROP TABLE"],
  ["ALTER TABLE sales DROP COLUMN total;", "DROP COLUMN"],
  ["TRUNCATE TABLE sales;", "TRUNCATE"],
  ["DELETE FROM sales;", "DELETE FROM"],
  ["ALTER TABLE sales ALTER COLUMN total TYPE text;", "ALTER COLUMN TYPE"],
  ["ALTER TABLE sales DROP CONSTRAINT sales_pkey;", "DROP CONSTRAINT"],
] as const) {
  assert.equal(findDestructiveMigrationFindings([migration(sql)])[0]?.operation, operation);
}

assert.equal(parsePositiveInteger(undefined, 10, "TEST", 100), 10);
assert.equal(parsePositiveInteger("25", 10, "TEST", 100), 25);
assert.throws(() => parsePositiveInteger("0", 10, "TEST", 100));
assert.throws(() => parsePositiveInteger("101", 10, "TEST", 100));
assert.equal(parseBoolean("true"), true);
assert.equal(parseBoolean("off"), false);
assert.throws(() => parseBoolean("maybe"));

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
for (const scriptName of [
  "db:deploy",
  "db:deploy:production",
  "check:database-deployment",
  "test:database-deployment:local",
]) {
  assert(packageJson.scripts?.[scriptName], `package.json wajib memiliki ${scriptName}.`);
}

const dockerfile = readFileSync(path.join(projectRoot, "Dockerfile"), "utf8");
assert.match(dockerfile, /FROM toolchain AS migrator/);
assert.match(dockerfile, /USER migrator/);
assert.match(dockerfile, /CMD \["npm", "run", "db:deploy"\]/);

const compose = readFileSync(path.join(projectRoot, "compose.production.yaml"), "utf8");
assert.match(compose, /\n  migrate:\n/);
assert.match(compose, /target: migrator/);
assert.match(compose, /condition: service_completed_successfully/);
assert.match(compose, /restart: "no"/);
assert.match(compose, /read_only: true/);
assert.match(compose, /DATABASE_MIGRATION_ALLOW_DESTRUCTIVE/);

const drizzleConfig = readFileSync(path.join(projectRoot, "drizzle.config.ts"), "utf8");
assert.match(drizzleConfig, /DRIZZLE_MIGRATIONS_DIR/);

const runner = readFileSync(path.join(projectRoot, "scripts/run-database-deployment.ts"), "utf8");
assert.match(runner, /pg_try_advisory_lock/);
assert.match(runner, /pg_advisory_unlock/);
assert.match(runner, /DATABASE_MIGRATION_APPROVAL_REFERENCE/);
assert.match(runner, /analyzeMigrationHistory/);
assert.match(runner, /runDrizzleMigration/);
assert.match(runner, /DRIZZLE_MIGRATIONS_DIR/);
assert.doesNotMatch(runner, /console\.(?:log|error)\([^\n]*DATABASE_URL/);

const attributes = readFileSync(path.join(projectRoot, ".gitattributes"), "utf8");
assert.match(attributes, /^drizzle\/\*\.sql text eol=lf$/m);

console.log(
  `OK: ${migrationPlan.length} migration memiliki preflight history, destructive guard, PostgreSQL advisory lock, migrator container, dan deployment scripts yang konsisten.`,
);
