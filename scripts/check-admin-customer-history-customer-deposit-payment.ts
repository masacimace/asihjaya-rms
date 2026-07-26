import { readFileSync } from "node:fs";

const querySource = readFileSync("src/features/customers/queries.ts", "utf8");
const pageSource = readFileSync(
  "src/app/(admin)/admin/pelanggan/[customerId]/page.tsx",
  "utf8",
);

const requiredQuerySnippets = [
  "customerDepositLedger,",
  "const [itemRows, paymentRows, customerDepositRows] =",
  "customerDepositLedger.saleId",
  "eq(customerDepositLedger.organizationId, auth.organization.id)",
  "eq(customerDepositLedger.customerId, customerId)",
  "inArray(customerDepositLedger.saleId, saleIds)",
  "const customerDepositsBySaleId = new Map<string, typeof customerDepositRows>();",
  "for (const deposit of customerDepositRows)",
  "deposit.entryType === \"deposit_used\" && deposit.direction === \"debit\"",
  "deposit.entryType === \"deposit_in\" && deposit.direction === \"credit\"",
  "paymentMethods.push(\"customer_deposit\")",
  "paymentMethods.push(\"customer_deposit_in\")",
];

const requiredPageSnippets = [
  "customer_deposit: \"Dana Titip\"",
  "customer_deposit_in: \"Deposit Saldo\"",
  "return methods",
  "Belum bayar",
];

for (const snippet of requiredQuerySnippets) {
  if (!querySource.includes(snippet)) {
    throw new Error(`Missing customer history deposit query snippet: ${snippet}`);
  }
}

for (const snippet of requiredPageSnippets) {
  if (!pageSource.includes(snippet)) {
    throw new Error(`Missing customer history payment label snippet: ${snippet}`);
  }
}

console.log("Admin customer history customer deposit payment checks passed.");
