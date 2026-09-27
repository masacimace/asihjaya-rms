import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const service = read("src/features/buybacks/service.ts");
const cashContracts = read("src/features/cash-movements/contracts.ts");
const cashQueries = read("src/features/cash-movements/queries.ts");
const cashExport = read("src/features/cash-movements/export.ts");
const cashPage = read("src/app/(admin)/admin/operasional/kas/page.tsx");
const reportContracts = read("src/features/reports/contracts.ts");
const reportQueries = read("src/features/reports/queries.ts");
const reportPage = read("src/app/(admin)/admin/laporan/page.tsx");
const reconciliation = read("src/lib/shifts/cash-reconciliation.ts");

// Production formula: only the Cash payout portion participates in shortfall.
assert.match(
  service,
  /payload\.payouts\.find\(\(payout\) => payout\.method === "cash"\)\?\.amount \?\? 0/,
);
assert.match(
  service,
  /const currentExpectedCash = Number\(activeShift\.expectedCash \?\? 0\)/,
);
assert.match(
  service,
  /cashPayout > 0 \? Math\.max\(0, cashPayout - currentExpectedCash\) : 0/,
);

// Funding is its own append-only cash movement tied to the same Buyback.
assert.match(service, /type: "cash_in"/);
assert.match(service, /referenceType: "buyback_funding"/);
assert.match(service, /referenceId: buyback\.id/);
assert.match(service, /type: "cash_out"/);
assert.match(service, /referenceType: "buyback"/);

const fundingIndex = service.indexOf('referenceType: "buyback_funding"');
const payoutIndex = service.indexOf(
  'referenceType: "buyback"',
  fundingIndex + 1,
);
assert.ok(
  fundingIndex >= 0 && payoutIndex > fundingIndex,
  "Funding harus dicatat sebelum payout cash dalam transaction Buyback yang sama.",
);

assert.match(
  service,
  /expectedCash: sql`coalesce\(\$\{shifts\.expectedCash\}, 0\) \+ \$\{buybackFundingAmount\} - \$\{cashPayout\}`/,
);

// Reconciliation itself stays generic: cash_in increases expected, cash_out lowers it.
assert.match(reconciliation, /if \(movement\.type === "cash_in"\)/);
assert.match(reconciliation, /summary\.cashIn \+= amount/);
assert.match(reconciliation, /if \(movement\.type === "cash_out"\)/);
assert.match(reconciliation, /summary\.cashOut \+= amount/);

// Admin cash reporting keeps automatic funding out of manual cash-in.
assert.match(cashContracts, /buybackCashFunding: number/);
assert.match(
  cashQueries,
  /manualCashIn:[^\n]*referenceType\}, ''\) <> 'buyback_funding'/,
);
assert.match(
  cashQueries,
  /buybackCashFunding:[^\n]*referenceType\} = 'buyback_funding'/,
);
assert.match(cashQueries, /buybackCashFunding \+/);
assert.match(cashQueries, /"Pendanaan Buyback"/);
assert.match(
  cashQueries,
  /inArray\(cashMovements\.referenceType, \["buyback", "buyback_funding"\]\)/,
);
assert.match(cashPage, /Dana Tambahan Buyback/);
assert.match(cashPage, /data\.summary\.buybackCashFunding/);
assert.match(cashExport, /Dana Tambahan Buyback/);

// General financial report exposes the funding separately too.
assert.match(reportContracts, /buybackCashFunding: number/);
assert.match(
  reportQueries,
  /manualCashIn:[^\n]*referenceType\}, ''\) <> 'buyback_funding'/,
);
assert.match(
  reportQueries,
  /buybackCashFunding:[^\n]*referenceType\} = 'buyback_funding'/,
);
assert.match(
  reportQueries,
  /netCashMovement:[\s\S]*buybackCashFunding \+[\s\S]*-\s*buybackCashPayouts/,
);
assert.match(reportPage, /Pendanaan Buyback/);
assert.match(reportPage, /data\.cashSnapshot\.buybackCashFunding/);

// Business math contract.
function funding(cashPayout: number, expectedCash: number) {
  return cashPayout > 0 ? Math.max(0, cashPayout - expectedCash) : 0;
}

assert.equal(funding(1_000_000, 0), 1_000_000);
assert.equal(funding(1_000_000, 600_000), 400_000);
assert.equal(funding(1_000_000, 2_000_000), 0);
assert.equal(funding(500_000, 0), 500_000);
assert.equal(funding(0, 0), 0);

console.log(
  "Batch 3 Cash Funding contract passed: cash-only shortfall, atomic funding+payout, true expected cash, separate reporting, and existing reconciliation preserved.",
);
