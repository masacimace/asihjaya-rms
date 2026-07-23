import { readFileSync } from "node:fs";

const checks: Array<{
  file: string;
  snippets: string[];
}> = [
  {
    file: "src/features/customers/contracts.ts",
    snippets: [
      "AdminCustomerDepositBalanceRow",
      "AdminCustomerDepositLedgerRow",
      "customerDeposits:",
      "recentEntries: AdminCustomerDepositLedgerRow[]",
    ],
  },
  {
    file: "src/features/customers/queries.ts",
    snippets: [
      "getCustomerDepositBalancesForCustomer",
      "getCustomerDepositLedgerEntries",
      "createEmptyCustomerDepositData",
      "customerDeposits: {",
      "outletId,",
      "limit: 8",
    ],
  },
  {
    file: "src/app/(admin)/admin/pelanggan/[customerId]/page.tsx",
    snippets: [
      "CustomerDepositPanel",
      "Saldo Dana Titip pelanggan",
      "Saldo per outlet",
      "Mutasi terbaru",
      "customerDeposits",
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

console.log("P4-B customer deposit admin detail checks passed.");
