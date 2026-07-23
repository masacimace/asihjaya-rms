import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const approvalActions = readFileSync("src/app/actions/approvals.ts", "utf8");
const approvalQueries = readFileSync("src/features/approvals/queries.ts", "utf8");

const requiredApprovalActionSnippets = [
  "executeCustomerDepositWithdrawalApproval",
  "customer_deposit_withdrawal",
  "deposit_withdrawal",
  "cash_out",
  "customer_deposit.withdrawal_executed",
  "pg_advisory_xact_lock",
  "balanceBeforeAtExecution",
  "executionStage: \"executed\"",
  "executionStatus: \"completed\" as const",
  "executionIdempotencyKey: `approval:${lockedApproval.id}:customer_deposit_withdrawal`",
  "referenceType: \"customer_deposit_withdrawal\"",
  "approval:${approval.id}:customer_deposit_withdrawal",
  "Tidak ada shift kas terbuka di outlet ini",
  "Saldo Dana Titip customer tidak mencukupi",
];

for (const snippet of requiredApprovalActionSnippets) {
  assert.ok(
    approvalActions.includes(snippet),
    `src/app/actions/approvals.ts missing snippet: ${snippet}`,
  );
}

assert.ok(
  approvalActions.includes("eq(customerDepositLedger.approvalId, approval.id)") &&
    approvalActions.includes("eq(customerDepositLedger.entryType, \"deposit_withdrawal\")"),
  "withdrawal execution must guard against duplicate ledger execution",
);

assert.ok(
  approvalActions.includes("coalesce(${shifts.expectedCash}, 0) - ${amount}"),
  "withdrawal execution must reduce expected cash for the selected open shift",
);

assert.ok(
  approvalActions.includes("revalidatePath(\"/admin/operasional/kas\")") &&
    approvalActions.includes("revalidatePath(`/admin/pelanggan/${result.referenceId}`)"),
  "withdrawal execution must revalidate cash and customer detail pages",
);

assert.ok(
  approvalQueries.includes("Eksekusi") &&
    approvalQueries.includes("Sudah dicatat oleh") &&
    approvalQueries.includes("balanceAfter") &&
    approvalQueries.includes("balanceAfterIfApproved"),
  "approval summary must surface customer deposit withdrawal execution state",
);

console.log("P4-F customer deposit withdrawal execution checks passed.");
