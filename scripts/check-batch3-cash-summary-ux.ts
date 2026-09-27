import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(process.cwd(), "src/app/(admin)/admin/operasional/kas/page.tsx"),
  "utf8",
);

assert.match(source, /data-cash-summary-layout="two-column-compact"/);
assert.match(
  source,
  /xl:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(360px,0\.85fr\)\]/,
);

assert.doesNotMatch(source, /function SummaryCard/);
assert.doesNotMatch(source, /title="Deposit Saldo"/);
assert.doesNotMatch(source, /title="Tarik Dana Titip"/);
assert.doesNotMatch(source, /title="Dana Tambahan Buyback"/);
assert.doesNotMatch(source, /title="Payout Buyback"/);

assert.match(source, />Pendanaan</);
assert.match(source, />Payout</);
assert.match(source, />Masuk</);
assert.match(source, />Keluar</);
assert.match(source, />Modal awal</);
assert.match(source, />Refund cash</);
assert.match(source, />Koreksi closing</);

assert.match(source, />Deposit saldo</);
assert.match(source, />Gunakan saldo</);
assert.match(source, />Tarik tunai</);
assert.match(source, />Adjustment</);

assert.match(source, /data\.summary\.buybackCashFunding/);
assert.match(source, /data\.summary\.buybackCashPayouts/);
assert.match(source, /data\.summary\.manualCashIn/);
assert.match(source, /data\.summary\.manualCashOut/);
assert.match(source, /data\.customerDepositSummary\.closingBalance/);

console.log(
  "Batch 3 compact cash summary UX contract passed: two-column hierarchy, grouped Buyback/manual cash, compact Dana Titip rows, and no duplicated overview cards.",
);
