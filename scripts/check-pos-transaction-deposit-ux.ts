import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const contracts = read("src/features/pos/contracts.ts");
const queries = read("src/features/pos/queries.ts");
const page = read("src/app/(pos)/pos/transaksi/page.tsx");

assert.ok(
  (contracts.match(/customerDepositUsedAmount: number;/g)?.length ?? 0) >= 2,
  "Transaction list/detail contracts must expose customerDepositUsedAmount.",
);

assert.match(queries, /customerDepositLedger\.entryType,\s*"deposit_used"/);
assert.match(queries, /customerDepositLedger\.direction,\s*"debit"/);
assert.match(
  queries,
  /const paidAmount = externalPaidAmount \+ customerDepositUsedAmount;/,
);
assert.match(page, /customerDepositUsedAmount > 0 \? \["Dana Titip"\]/);
assert.match(page, /Saldo Dana Titip customer digunakan untuk transaksi ini\./);
assert.match(page, /formatMoney\(detail\.customerDepositUsedAmount\)/);

console.log("POS transaction Dana Titip UX contracts passed.");
