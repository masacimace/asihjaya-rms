import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(path: string, needles: string[]) {
  const source = read(path);
  const missing = needles.filter((needle) => !source.includes(needle));

  if (missing.length > 0) {
    throw new Error(
      `${path} is missing required P4.6 markers:\n${missing
        .map((needle) => `- ${needle}`)
        .join("\n")}`,
    );
  }
}

assertIncludes("src/features/cash-movements/contracts.ts", [
  "AdminCashMovementCustomerDepositSummary",
  "customerDepositCashWithdrawals: number;",
  "customerDepositSummary: AdminCashMovementCustomerDepositSummary;",
]);

assertIncludes("src/features/cash-movements/queries.ts", [
  "customerDepositLedger",
  "getCustomerDepositSummary",
  "customer_deposit_withdrawal",
  "deposit_withdrawal",
  "customerDepositCashWithdrawals",
  "closingBalance: openingBalance + netChange",
]);

assertIncludes("src/app/(admin)/admin/operasional/kas/page.tsx", [
  "Liability Dana Titip",
  "Rekap Dana Titip periode ini",
  "Deposit Saldo",
  "Gunakan saldo",
  "Tarik Dana Titip",
  "ledgerEntryCount",
]);

assertIncludes("src/features/cash-movements/export.ts", [
  "Tarik tunai Dana Titip",
  "Saldo awal Dana Titip",
  "Deposit Saldo",
  "Gunakan saldo",
  "Saldo akhir Dana Titip",
]);

assertIncludes("src/features/reports/contracts.ts", [
  "customerDepositCashWithdrawals: number;",
  "customerDepositClosingBalance: number;",
  "customerDepositNetChange: number;",
]);

assertIncludes("src/features/reports/queries.ts", [
  "customerDepositLedger",
  "customerDepositOpeningBalance",
  "customerDepositCashWithdrawals",
  "customerDepositClosingBalance",
]);

assertIncludes("src/app/(admin)/admin/laporan/page.tsx", [
  "Tarik tunai Dana Titip",
  "Deposit Saldo",
  "Gunakan saldo",
  "Saldo akhir Dana Titip",
]);

console.log("P4-G customer deposit cash report checks passed.");
