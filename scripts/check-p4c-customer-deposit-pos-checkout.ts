import { readFileSync } from "node:fs";

const requiredFiles = [
  "src/features/pos/contracts.ts",
  "src/features/pos/queries.ts",
  "src/app/actions/pos.ts",
  "src/components/pos/pos-workspace.tsx",
];

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertIncludes(source: string, text: string, message: string) {
  if (!source.includes(text)) {
    throw new Error(message);
  }
}

for (const file of requiredFiles) {
  read(file);
}

const contracts = read("src/features/pos/contracts.ts");
assertIncludes(
  contracts,
  "customerDepositUsedAmount?: number | null;",
  "POS checkout payload must carry customer deposit used amount.",
);
assertIncludes(
  contracts,
  "customerDepositInAmount?: number | null;",
  "POS checkout payload must carry new customer deposit amount.",
);
assertIncludes(
  contracts,
  "customerDepositBalance: number;",
  "POS customer option must expose outlet-scoped customer deposit balance.",
);

const queries = read("src/features/pos/queries.ts");
assertIncludes(
  queries,
  "customerDepositLedger",
  "POS initial data must read customer deposit ledger balances.",
);
assertIncludes(
  queries,
  "latestDepositByCustomerId",
  "POS initial data must map latest deposit balance per customer.",
);

const actions = read("src/app/actions/pos.ts");
assertIncludes(
  actions,
  "customerDepositUsedAmount",
  "POS checkout action must validate and persist customer deposit used amount.",
);
assertIncludes(
  actions,
  "externalPaymentDueAmount",
  "POS checkout action must validate external payment due after customer deposit.",
);
assertIncludes(
  actions,
  "entryType: \"deposit_used\"",
  "POS checkout must create a debit ledger entry when customer deposit is used.",
);
assertIncludes(
  actions,
  "entryType: \"deposit_in\"",
  "POS checkout must create a credit ledger entry for new customer deposit.",
);
assertIncludes(
  actions,
  "pg_advisory_xact_lock(hashtext(${depositLockKey}))",
  "POS checkout must lock customer deposit scope before changing balance.",
);

const workspace = read("src/components/pos/pos-workspace.tsx");
assertIncludes(
  workspace,
  "Dana Titip digunakan",
  "POS payment panel must expose customer deposit used input.",
);
assertIncludes(
  workspace,
  "Dana Titip baru",
  "POS payment panel must expose new customer deposit input.",
);
assertIncludes(
  workspace,
  "externalPaymentDueAmount",
  "POS workspace must compute external payment due after customer deposit.",
);

console.log("P4-C customer deposit POS checkout checks passed.");
