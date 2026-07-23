import { readFileSync } from "node:fs";

const checks: Array<{
  file: string;
  snippets: string[];
}> = [
  {
    file: "src/features/sales/documents/receipt-certificate.ts",
    snippets: [
      "customerDepositLedger",
      "customerDeposit:",
      "usedAmount: string;",
      "inAmount: string;",
      "externalPaymentDueAmount",
    ],
  },
  {
    file: "src/features/sales/documents/receipt-certificate-html.tsx",
    snippets: [
      "Deposit Saldo",
      "Gunakan Saldo",
      "Total Pembayaran",
      "customerDepositUsedAmount",
      "customerDepositInAmount",
    ],
  },
  {
    file: "src/features/customers/public-history.ts",
    snippets: [
      "customerDepositLedger",
      "customerDepositBalanceAmount",
      "externalPaymentDueAmount",
      "paymentMethods.push(\"Dana Titip\")",
    ],
  },
  {
    file: "src/app/v/[token]/page.tsx",
    snippets: [
      "Saldo Dana Titip outlet ini",
      "Deposit Saldo",
      "Gunakan saldo",
      "Total dibayar",
      "customerDeposit.externalPaymentDueAmount",
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

console.log("P4-D customer deposit receipt and history checks passed.");
