import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const reportsContracts = read("src/features/reports/contracts.ts");
const reportsQueries = read("src/features/reports/queries.ts");
const reportsExport = read("src/features/reports/export.ts");
const reportsPage = read("src/app/(admin)/admin/laporan/page.tsx");
const cashReconciliation = read("src/lib/shifts/cash-reconciliation.ts");
const shiftClosing = read("src/lib/shifts/shift-closing.ts");
const buybackService = read("src/features/buybacks/service.ts");
const telegramDailyService = read(
  "src/server/integrations/telegram/telegram-daily-service.ts",
);
const telegramWeeklyService = read(
  "src/server/integrations/telegram/telegram-weekly-service.ts",
);
const telegramMonthlyService = read(
  "src/server/integrations/telegram/telegram-monthly-service.ts",
);
const telegramOutboxContract = read(
  "src/server/integrations/telegram/telegram-outbox-contract.ts",
);

// Reporting: Buyback cash payout is its own cash-out bucket and must reduce net cash.
assert.match(reportsContracts, /buybackCashPayouts: number/);
assert.match(
  reportsQueries,
  /referenceType\} = 'buyback' then \$\{cashMovements\.amount\}/,
);
assert.match(
  reportsQueries,
  /netCashMovement:[\s\S]*-\s*buybackCashPayouts\s*-/,
);
assert.match(reportsPage, /Payout cash Buyback/);

// Inventory reporting: Buyback is stock-in, filterable/exportable, and its movement
// weight/cost are historical Buyback facts instead of the mutable current item.
assert.match(reportsContracts, /\{ value: "buyback", label: "Buyback masuk" \}/);
assert.match(reportsExport, /buyback: "Buyback masuk"/);
assert.match(
  reportsQueries,
  /movementType\} in \('goods_receipt', 'migration_opening', 'buyback'/,
);
assert.match(
  reportsQueries,
  /referenceType\} = 'buyback' then cast\(\$\{buybackItems\.weightGram\} as text\)/,
);
assert.match(
  reportsQueries,
  /referenceType\} = 'buyback' then cast\(\$\{buybackItems\.finalAmount\} as text\)/,
);

// Current stock summary intentionally stays on product_items current state.
assert.match(
  reportsQueries,
  /availableWeightGram:[^\n]*productItems\.weightGram/,
);
assert.match(
  reportsQueries,
  /availableCostValue:[^\n]*productItems\.costAmount/,
);

// Buyback cash payout must flow through normal shift cash reconciliation.
assert.match(buybackService, /type: "cash_out"/);
assert.match(buybackService, /referenceType: "buyback"/);
assert.match(cashReconciliation, /summary\.cashOut \+= amount/);
assert.match(
  cashReconciliation,
  /summary\.expectedCash =[\s\S]*-\s*summary\.cashOut\s*-/,
);
assert.match(
  shiftClosing,
  /const expectedCash = cashSummary\.expectedCash/,
);
assert.match(
  shiftClosing,
  /finalizeTelegramDailyFinanceInTransaction\(transaction, \{[\s\S]*expectedCash,/,
);

// Buyback Dana Titip is a credit/deposit-in. Telegram closing finance aggregates
// that generic ledger movement, so Buyback credits are reflected without a new report type.
assert.match(buybackService, /entryType: "deposit_in"/);
assert.match(buybackService, /direction: "credit"/);
assert.match(buybackService, /referenceType: "buyback"/);
assert.match(
  telegramDailyService,
  /entryType\} = 'deposit_in' and \$\{customerDepositLedger\.direction\} = 'credit'/,
);
assert.match(
  telegramDailyService,
  /customerDepositIn: depositSummary\.depositIn/,
);

// Telegram historical finance must use immutable Sale cost snapshots and the
// reconciled shift expected cash. Weekly/monthly reports aggregate only current
// (non-superseded) closing snapshots.
assert.match(
  telegramDailyService,
  /sum\(\$\{saleItems\.costAmountSnapshot\}::numeric\)/,
);
assert.match(
  telegramDailyService,
  /missingCostCount:[^\n]*saleItems\.costAmountSnapshot/,
);
assert.match(
  telegramDailyService,
  /expectedCash: integerString\(input\.expectedCash\)/,
);
assert.match(
  telegramWeeklyService,
  /isNull\(financeClosingSnapshots\.supersededAt\)/,
);
assert.match(
  telegramMonthlyService,
  /isNull\(financeClosingSnapshots\.supersededAt\)/,
);

// No new dedicated Buyback Telegram report/HTTP side-channel is introduced.
// Buyback affects the established finance snapshot through cash/deposit facts.
assert.equal(
  telegramOutboxContract.includes('"buyback"'),
  false,
  "BB3-D tidak boleh menambah report type Telegram khusus Buyback tanpa requirement client.",
);
assert.equal(
  telegramDailyService.includes("sendMessage("),
  false,
  "Telegram daily service harus tetap memakai outbox, bukan HTTP langsung.",
);
assert.equal(
  telegramDailyService.includes("fetch("),
  false,
  "Telegram daily service harus tetap memakai outbox, bukan fetch langsung.",
);

console.log(
  "BB3-D Buyback reporting + Telegram regression + final integration contracts: OK",
);
