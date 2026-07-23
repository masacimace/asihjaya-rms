import { readFileSync } from "node:fs";

const checks: Array<{
  file: string;
  snippets: string[];
}> = [
  {
    file: "src/app/actions/customer-deposits.ts",
    snippets: [
      "requestCustomerDepositWithdrawalApprovalAction",
      "type: \"customer_deposit_withdrawal\"",
      "referenceType: \"customer\"",
      "withdrawalAmount: amount",
      "balanceAfterIfApproved",
      "customer_deposit.withdrawal_approval_requested",
    ],
  },
  {
    file: "src/features/customers/contracts.ts",
    snippets: [
      "pendingWithdrawalApproval",
      "requestedByName: string;",
    ],
  },
  {
    file: "src/features/customers/queries.ts",
    snippets: [
      "pendingWithdrawalApprovalRows",
      "customer_deposit_withdrawal",
      "pendingWithdrawalApprovalByOutletId",
    ],
  },
  {
    file: "src/app/(admin)/admin/pelanggan/[customerId]/page.tsx",
    snippets: [
      "requestCustomerDepositWithdrawalApprovalAction",
      "Ajukan tarik tunai",
      "Tarik tunai menunggu approval",
      "depositMessage",
    ],
  },
  {
    file: "src/features/approvals/queries.ts",
    snippets: [
      "Saldo saat diajukan",
      "Estimasi saldo akhir",
      "balanceAfterIfApproved",
    ],
  },
];

for (const check of checks) {
  const content = readFileSync(check.file, "utf8");

  for (const snippet of check.snippets) {
    if (!content.includes(snippet)) {
      throw new Error(`${check.file} missing snippet: ${snippet}`);
    }
  }
}

console.log("P4-E customer deposit withdrawal request checks passed.");
