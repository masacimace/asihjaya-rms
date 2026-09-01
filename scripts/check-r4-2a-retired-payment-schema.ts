import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const schema = read("src/db/schema/index.ts");
const posActions = read("src/app/actions/pos.ts");
const saleAdminQueries = read("src/features/sales/admin-queries.ts");
const depositContracts = read("src/features/customer-deposits/contracts.ts");
const depositQueries = read("src/features/customer-deposits/queries.ts");
const financialSuite = read("tests/integration/financial-concurrency-suite.ts");

const retiredSchemaTokens = [
  'pgTable(\n  "approvals"',
  'pgTable(\n  "payment_reconciliations"',
  'pgTable(\n  "settlement_import_mappings"',
  'pgTable(\n  "settlement_import_batches"',
  'pgTable(\n  "settlement_import_rows"',
  'pgTable(\n  "manual_payment_policies"',
  'pgTable(\n  "payment_evidence_uploads"',
  'pgEnum("manual_payment_verification_status"',
  'pgEnum("payment_settlement_status"',
  'pgEnum("settlement_import_status"',
  'pgEnum(\n  "settlement_import_row_status"',
  'pgEnum("approval_execution_status"',
  'pgEnum("approval_status"',
  'pgEnum("approval_type"',
];

for (const token of retiredSchemaTokens) {
  assert.equal(
    schema.includes(token),
    false,
    `R4.2A schema masih memuat retired contract: ${token.replaceAll("\n", " ")}`,
  );
}

for (const column of [
  "normalizedReference",
  "externalOrderId",
  "verificationStatus",
  "providerPaidAt",
  "verificationApprovalId",
  "coVerifiedBy",
  "coVerifiedAt",
  "evidenceKey",
  "settlementStatus",
]) {
  assert.equal(
    new RegExp(`\\b${column}\\s*:`).test(
      schema.slice(schema.indexOf("export const payments"), schema.indexOf("export const buybacks")),
    ),
    false,
    `payments masih memuat retired column ${column}.`,
  );
}

assert.match(schema, /export const manualPaymentProfiles = pgTable/);
assert.match(schema, /manualPaymentProfileId: uuid\("manual_payment_profile_id"\)/);
assert.match(schema, /providerReference: varchar\("provider_reference"/);
assert.match(schema, /verifiedBy: uuid\("verified_by"\)/);
assert.match(schema, /paidAt: timestamp\("paid_at"/);

for (const activeTableBlock of ["customerDepositLedger", "paymentRefunds", "saleReturnCases"]) {
  const start = schema.indexOf(`export const ${activeTableBlock}`);
  assert.notEqual(start, -1, `${activeTableBlock} wajib tetap tersedia.`);
  const next = schema.indexOf("export const ", start + 20);
  const block = schema.slice(start, next === -1 ? schema.length : next);
  assert.equal(block.includes("approvalId:"), false, `${activeTableBlock}.approvalId wajib retired.`);
}

for (const token of [
  "verificationApprovalId:",
  "coVerifiedBy:",
  "coVerifiedAt:",
  "settlementStatus:",
  "normalizedReference:",
  "externalOrderId:",
]) {
  assert.equal(posActions.includes(token), false, `POS persistence masih menulis ${token}`);
}

for (const token of [
  "payments.verificationStatus",
  "payments.providerPaidAt",
  "payments.coVerifiedBy",
  "payments.coVerifiedAt",
  "payments.evidenceKey",
  "payments.settlementStatus",
]) {
  assert.equal(saleAdminQueries.includes(token), false, `Sale detail masih membaca ${token}`);
}

assert.equal(depositContracts.includes("approvalId"), false, "Dana Titip contract tidak boleh membawa approvalId.");
assert.equal(depositQueries.includes("approvalId"), false, "Dana Titip query tidak boleh membawa approvalId.");
assert.equal(financialSuite.includes("settlementImportBatches"), false);
assert.equal(financialSuite.includes('queryCount("approvals")'), false);
assert.equal(financialSuite.includes("lockManualPaymentReference"), false);

console.log("R4.2A retired approval/payment/reconciliation schema contracts: OK");
