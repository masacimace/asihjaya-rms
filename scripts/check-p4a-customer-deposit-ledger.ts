import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schemaSource = readFileSync("src/db/schema/index.ts", "utf8");
const migrationSource = readFileSync(
  "drizzle/0001_customer_deposit_ledger.sql",
  "utf8",
);
const querySource = readFileSync(
  "src/features/customer-deposits/queries.ts",
  "utf8",
);
const contractSource = readFileSync(
  "src/features/customer-deposits/contracts.ts",
  "utf8",
);

for (const requiredSource of [schemaSource, migrationSource, contractSource]) {
  assert.match(requiredSource, /deposit_in/);
  assert.match(requiredSource, /deposit_used/);
  assert.match(requiredSource, /deposit_withdrawal/);
  assert.match(requiredSource, /adjustment/);
}

assert.match(schemaSource, /customerDepositLedgerEntryTypeEnum/);
assert.match(schemaSource, /customerDepositLedgerDirectionEnum/);
assert.match(schemaSource, /customerDepositLedger = pgTable/);
assert.match(schemaSource, /customer_deposit_withdrawal/);
assert.match(schemaSource, /customer_deposit_ledger_balance_nonnegative_ck/);
assert.match(schemaSource, /customer_deposit_ledger_idempotency_uq/);

assert.match(migrationSource, /CREATE TYPE "public"\."customer_deposit_ledger_entry_type"/);
assert.match(migrationSource, /CREATE TYPE "public"\."customer_deposit_ledger_direction"/);
assert.match(migrationSource, /CREATE TABLE "customer_deposit_ledger"/);
assert.match(migrationSource, /ADD VALUE IF NOT EXISTS 'customer_deposit_withdrawal'/);
assert.match(migrationSource, /ON DELETE set null/);

assert.match(querySource, /getCustomerDepositBalance/);
assert.match(querySource, /getCustomerDepositBalancesForCustomer/);
assert.match(querySource, /getCustomerDepositLedgerEntries/);
assert.match(querySource, /createCustomerDepositLedgerEntry/);
assert.match(querySource, /pg_advisory_xact_lock/);
assert.match(querySource, /INSUFFICIENT_BALANCE/);
assert.match(querySource, /Saldo Dana Titip customer tidak mencukupi/);

console.log("P4-A customer deposit ledger checks passed.");
