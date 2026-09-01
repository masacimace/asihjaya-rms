import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Snapshot = {
  prevId: string;
  tables: Record<
    string,
    {
      columns: Record<string, unknown>;
      indexes: Record<string, unknown>;
      foreignKeys: Record<string, { tableTo?: string }>;
      checkConstraints: Record<string, { value?: string }>;
    }
  >;
  enums: Record<string, unknown>;
};

type Journal = {
  entries: Array<{ idx: number; tag: string }>;
};

type SnapshotTable = Snapshot["tables"][string];

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(resolve(root, relativePath), "utf8");

const migration = read("drizzle/0021_r4_final_schema_cleanup.sql");
const journal = JSON.parse(read("drizzle/meta/_journal.json")) as Journal;
const previousSnapshot = JSON.parse(
  read("drizzle/meta/0020_snapshot.json"),
) as Snapshot & { id: string };
const snapshot = JSON.parse(
  read("drizzle/meta/0021_snapshot.json"),
) as Snapshot;
const schema = read("src/db/schema/index.ts");
const databaseCheck = read("scripts/check-database-migrations.ts");

function requireSnapshotTable(tableName: string): SnapshotTable {
  const table = snapshot.tables[`public.${tableName}`];
  assert(table, `Final snapshot kehilangan ${tableName}`);
  return table;
}

const latestJournalEntry = journal.entries.at(-1);
assert.equal(latestJournalEntry?.idx, 21);
assert.equal(latestJournalEntry?.tag, "0021_r4_final_schema_cleanup");
assert.equal(
  snapshot.prevId,
  previousSnapshot.id,
  "0021 snapshot wajib menunjuk snapshot 0020",
);
assert.equal(
  /\bCASCADE\b/i.test(migration),
  false,
  "R4 final cleanup tidak boleh mengandalkan DROP ... CASCADE",
);

const retiredTables = [
  "approvals",
  "payment_reconciliations",
  "settlement_import_mappings",
  "settlement_import_batches",
  "settlement_import_rows",
  "manual_payment_policies",
  "payment_evidence_uploads",
  "legacy_migration_sessions",
  "legacy_migration_session_assignments",
  "legacy_migration_verifications",
  "legacy_migration_sold_records",
  "legacy_migration_cutover_runs",
];
for (const table of retiredTables) {
  assert.equal(snapshot.tables[`public.${table}`], undefined, `Snapshot masih memuat ${table}`);
  assert.match(migration, new RegExp(`DROP TABLE "${table}"`));
}

for (const activeTable of [
  "manual_payment_profiles",
  "legacy_product_import_batches",
  "legacy_product_rows",
  "legacy_product_master_mappings",
  "item_barcodes",
  "payments",
  "finance_closing_snapshots",
]) {
  requireSnapshotTable(activeTable);
}

const retiredEnums = [
  "approval_execution_status",
  "approval_status",
  "approval_type",
  "manual_payment_verification_status",
  "payment_settlement_status",
  "settlement_import_status",
  "settlement_import_row_status",
  "legacy_migration_session_status",
  "legacy_migration_assignment_role",
  "legacy_migration_verification_source",
  "legacy_migration_verification_status",
];
for (const enumName of retiredEnums) {
  assert.equal(snapshot.enums[`public.${enumName}`], undefined, `Snapshot masih memuat enum ${enumName}`);
  assert.match(migration, new RegExp(`DROP TYPE "public"\\."${enumName}"`));
}

const payments = requireSnapshotTable("payments");
for (const retiredColumn of [
  "normalized_reference",
  "external_order_id",
  "verification_status",
  "verification_source",
  "provider_paid_at",
  "verification_approval_id",
  "co_verified_by",
  "co_verified_at",
  "evidence_key",
  "settlement_status",
]) {
  assert.equal(payments.columns[retiredColumn], undefined, `payments.${retiredColumn} masih ada`);
  assert.match(migration, new RegExp(`DROP COLUMN "${retiredColumn}"`));
}
for (const activeColumn of [
  "provider_reference",
  "manual_payment_profile_id",
  "verified_by",
  "verified_at",
  "paid_at",
  "metadata",
]) {
  assert(payments.columns[activeColumn], `payments.${activeColumn} wajib dipertahankan`);
}

for (const [table, column] of [
  ["customer_deposit_ledger", "approval_id"],
  ["payment_refunds", "approval_id"],
  ["sale_return_cases", "approval_id"],
  ["finance_closing_snapshots", "pending_approval_count"],
] as const) {
  assert.equal(
    requireSnapshotTable(table).columns[column],
    undefined,
    `${table}.${column} masih ada`,
  );
}

const financeClosingSnapshots = requireSnapshotTable(
  "finance_closing_snapshots",
);
const countsConstraint =
  financeClosingSnapshots.checkConstraints[
    "finance_closing_snapshots_counts_nonnegative_ck"
  ]?.value ?? "";
assert.match(countsConstraint, /transaction_count/);
assert.match(countsConstraint, /items_sold_count/);
assert.match(countsConstraint, /held_transaction_count/);
assert.doesNotMatch(countsConstraint, /pending_approval_count/);

for (const permission of [
  "shifts.reopen",
  "migration.mapping.manage",
  "migration.session.manage",
  "migration.scan",
  "migration.verification.submit",
  "migration.verification.review",
  "migration.verification.approve",
  "migration.sold.manage",
  "migration.cutover.execute",
]) {
  assert.match(migration, new RegExp(permission.replaceAll(".", "\\.")));
}

// Source of truth and live-DB acceptance must agree with the migration.
for (const token of [
  'pgTable(\n  "approvals"',
  'pgTable(\n  "legacy_migration_sessions"',
  'integer("pending_approval_count")',
]) {
  assert.equal(schema.includes(token), false, `Final source schema masih memuat ${token}`);
}
assert.match(databaseCheck, /const retiredTables = \[/);
assert.match(databaseCheck, /const retiredColumns = new Map/);
assert.match(databaseCheck, /const retiredEnums = \[/);
assert.match(databaseCheck, /const retiredPermissionCodes = \[/);

console.log("R4.3 final schema cleanup migration contracts: OK");
