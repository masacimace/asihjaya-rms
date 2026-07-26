import { readFileSync } from "node:fs";

const queryPath = "src/features/sales/admin-queries.ts";
const contractPath = "src/features/sales/admin-contracts.ts";
const pagePath = "src/app/(admin)/admin/penjualan/[transactionId]/page.tsx";

const querySource = readFileSync(queryPath, "utf8");
const contractSource = readFileSync(contractPath, "utf8");
const pageSource = readFileSync(pagePath, "utf8");

const requiredQuerySnippets = [
  "customerDepositRows",
  "customerDepositLedger.saleId",
  "customerDepositUsedAmount",
  "customerDepositInAmount",
  "externalPaidAmount + customerDepositUsedAmount - customerDepositInAmount",
];

for (const snippet of requiredQuerySnippets) {
  if (!querySource.includes(snippet)) {
    throw new Error(`Missing detail query customer deposit snippet: ${snippet}`);
  }
}

const requiredContractSnippets = [
  "externalPaidAmount: number;",
  "customerDepositUsedAmount: number;",
  "customerDepositInAmount: number;",
];

for (const snippet of requiredContractSnippets) {
  if (!contractSource.includes(snippet)) {
    throw new Error(`Missing detail contract customer deposit field: ${snippet}`);
  }
}

const requiredPageSnippets = [
  "sale.customerDepositUsedAmount > 0",
  "Gunakan Saldo",
  "sale.customerDepositInAmount > 0",
  "Deposit Saldo",
  "formatMoney(sale.paidAmount)",
];

for (const snippet of requiredPageSnippets) {
  if (!pageSource.includes(snippet)) {
    throw new Error(`Missing detail invoice customer deposit UI snippet: ${snippet}`);
  }
}

console.log("Admin sale detail customer deposit paid amount checks passed.");
