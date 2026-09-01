import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const checkout = read("src/app/actions/pos.ts");
const buybackService = read("src/features/buybacks/service.ts");
const buybackQueries = read("src/features/buybacks/queries.ts");
const saleClaim = read("src/features/pos/inventory-sale-claim.ts");
const reportQueries = read("src/features/reports/queries.ts");
const posQueries = read("src/features/pos/queries.ts");
const adminSaleQueries = read("src/features/sales/admin-queries.ts");
const saleTransactionService = read("src/features/sales/transaction-service.ts");
const telegramDaily = read("src/server/integrations/telegram/telegram-daily-service.ts");
const saleNotifications = read("src/features/notifications/sales.ts");

// Sale checkout must freeze historical weight + acquisition cost before current item state can change later.
assert.match(checkout, /costAmountSnapshot: item!\.costAmount/);
assert.match(checkout, /storedWeightGram: pricing\.storedWeightGram/);
assert.match(checkout, /weightGram: pricing\.transactionWeightGram/);
assert.match(checkout, /costAmountSnapshot: item!\.costAmount,/);

// Buyback must update only current inventory facts while preserving the same physical item identity.
assert.match(buybackService, /eq\(productItems\.id, existing\.id\)/);
assert.match(buybackService, /weightGram: item\.weightGram/);
assert.match(buybackService, /costAmount: String\(item\.finalAmount\)/);
assert.match(buybackService, /availability: "available"/);
assert.match(buybackService, /condition: "used"/);
assert.match(buybackService, /locationState: "outlet"/);
assert.match(buybackService, /previousCostAmount: existing\.costAmount/);
assert.match(buybackQueries, /eq\(productItems\.availability, "sold"\)/);
assert.match(buybackQueries, /eq\(productItems\.locationState, "customer"\)/);
assert.match(buybackQueries, /itemBarcodes\.barcodeValue/);

// A Buyback item (condition used + available/outlet) must remain sellable without identity replacement.
assert.match(saleClaim, /eq\(productItems\.availability, "available"\)/);
assert.match(saleClaim, /inArray\(productItems\.condition, \["good", "used"\]\)/);
assert.match(saleClaim, /eq\(productItems\.locationState, "outlet"\)/);

// Historical reports must use Sale snapshots, never current product weight/cost.
assert.doesNotMatch(
  reportQueries,
  /weightSoldGram: sql<number>`coalesce\(sum\(coalesce\(\$\{productItems\.weightGram\}/,
);
assert.doesNotMatch(
  reportQueries,
  /grossProfit: sql<number>`coalesce\(sum\(\$\{saleItems\.finalPriceAmount\}::numeric - coalesce\(\$\{productItems\.costAmount\}/,
);
assert.doesNotMatch(
  reportQueries,
  /soldWeightGram: sql<number>`coalesce\(sum\(coalesce\(\$\{productItems\.weightGram\}/,
);

const historicalWeightOccurrences =
  reportQueries.match(/saleItems\.snapshot}->>'weightGram'/g)?.length ?? 0;
assert.ok(
  historicalWeightOccurrences >= 4,
  "Summary, sales report, row detail, dan product performance harus memakai weight snapshot Sale.",
);
assert.match(reportQueries, /saleItems\.costAmountSnapshot/);
assert.match(reportQueries, /report_row_sale_items\.cost_amount_snapshot/);

// Sale detail shown in POS/Admin must not mutate after a later Buyback changes current attributes.
const posDetailSource = posQueries.slice(
  posQueries.indexOf("export async function getPosTransactionDetailData"),
);
const adminDetailSource = adminSaleQueries.slice(
  adminSaleQueries.indexOf("export async function getAdminSaleDetailData"),
);
for (const source of [posDetailSource, adminDetailSource]) {
  assert.match(
    source,
    /weightGram: sql<string \| null>`coalesce\(nullif\(\$\{saleItems\.snapshot}->>'weightGram', ''\), nullif\(\$\{saleItems\.snapshot}->>'storedWeightGram', ''\)\)`/,
  );
  assert.match(
    source,
    /purityPercent: sql<string \| null>`nullif\(\$\{saleItems\.snapshot}->>'purityPercent', ''\)`/,
  );
  assert.doesNotMatch(
    source,
    /weightGram: productItems\.weightGram,\n\s*purityPercent: productItems\.purityPercent,\n\s*exchangePurityPercent: productItems\.exchangePurityPercent/,
  );
}

// Refund/return expected weight must be the sold weight, not whatever the physical item weighs today.
assert.match(
  saleTransactionService,
  /weightGram: sql<string \| null>`coalesce\(nullif\(\$\{saleItems\.snapshot}->>'weightGram', ''\), nullif\(\$\{saleItems\.snapshot}->>'storedWeightGram', ''\)\)`/,
);
assert.match(saleTransactionService, /expectedWeightGram: item\.weightGram/);

// Historical inventory movement rows for Sale/Buyback resolve event-time values.
assert.match(reportQueries, /referenceType} in \('sale', 'sale_void', 'sale_refund'\)/);
assert.match(reportQueries, /referenceType} = 'buyback' then cast\(\$\{buybackItems\.weightGram\} as text\)/);
assert.match(reportQueries, /referenceType} = 'buyback' then cast\(\$\{buybackItems\.finalAmount\} as text\)/);
assert.match(reportQueries, /eq\(buybackItems\.buybackId, inventoryMovements\.referenceId\)/);

// Telegram daily margin already uses immutable Sale cost snapshots; Sale notification freezes checkout weight.
assert.match(telegramDaily, /sum\(\$\{saleItems\.costAmountSnapshot\}::numeric\)/);
assert.match(telegramDaily, /missingCostCount/);
assert.match(saleNotifications, /totalWeightGram: normalizeWeight\(input\.totalWeightGram\)/);
assert.match(checkout, /const totalWeightGram = resolvedPricing\.reduce/);

console.log("BB3-B Buyback lifecycle + historical Sale snapshot contracts: OK");
