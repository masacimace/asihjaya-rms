import { readFileSync } from "node:fs";

const files = {
  contracts: "src/features/sales/admin-contracts.ts",
  queries: "src/features/sales/admin-queries.ts",
  csv: "src/app/(admin)/admin/penjualan/export/route.ts",
  xlsx: "src/app/(admin)/admin/penjualan/export/xlsx/route.ts",
};

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertContains(path: string, content: string, expected: string) {
  if (!content.includes(expected)) {
    throw new Error(`${path} must contain ${expected}`);
  }
}

const contracts = read(files.contracts);
const queries = read(files.queries);
const csv = read(files.csv);
const xlsx = read(files.xlsx);

for (const [path, content] of Object.entries({
  [files.contracts]: contracts,
  [files.queries]: queries,
  [files.csv]: csv,
  [files.xlsx]: xlsx,
})) {
  assertContains(path, content, "customerDepositUsedAmount");
  assertContains(path, content, "customerDepositInAmount");
}

assertContains(files.contracts, contracts, "externalPaidAmount: number;");
assertContains(files.contracts, contracts, 'paymentStatus: "paid" | "partial" | "pending";');

assertContains(files.queries, queries, "customerDepositsBySaleId");
assertContains(files.queries, queries, "customerDepositLedger.saleId");
assertContains(
  files.queries,
  queries,
  "externalPaidAmount + customerDepositUsedAmount - customerDepositInAmount",
);
assertContains(files.queries, queries, "paymentStatus: getPaymentStatusFromAmounts");

for (const [path, content] of Object.entries({
  [files.csv]: csv,
  [files.xlsx]: xlsx,
})) {
  assertContains(path, content, 'paymentLabels.push("Dana Titip")');
  assertContains(path, content, 'paymentLabels.push("Deposit Saldo")');
  assertContains(path, content, '"Status Pembayaran"');
  assertContains(path, content, '"Pembayaran Eksternal"');
  assertContains(path, content, '"Gunakan Saldo"');
  assertContains(path, content, '"Deposit Saldo"');
  assertContains(path, content, "getPaymentStatusLabel");
  assertContains(path, content, "row.externalPaidAmount");
}

console.log("Admin sales export customer deposit checks passed.");
