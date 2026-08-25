import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const service = read("src/features/buybacks/service.ts");
const shiftClosing = read("src/lib/shifts/shift-closing.ts");
const cashReconciliation = read("src/lib/shifts/cash-reconciliation.ts");
const cashContracts = read("src/features/cash-movements/contracts.ts");
const cashQueries = read("src/features/cash-movements/queries.ts");
const cashPage = read("src/app/(admin)/admin/operasional/kas/page.tsx");
const reportContracts = read("src/features/reports/contracts.ts");
const reportQueries = read("src/features/reports/queries.ts");
const stockPage = read("src/app/(admin)/admin/laporan/stok/page.tsx");
const reportExport = read("src/features/reports/export.ts");
const workspace = read("src/components/buybacks/buyback-workspace.tsx");
const buybackActions = read("src/app/actions/buybacks.ts");

// Core Buyback financial integration stays atomic and references Buyback explicitly.
assert.match(service, /type: "cash_out"/);
assert.match(service, /referenceType: "buyback"/);
assert.match(service, /expectedCash: sql`coalesce\(\$\{shifts\.expectedCash\}, 0\) - \$\{cashPayout\}`/);
assert.match(service, /entryType: "deposit_in"/);
assert.match(service, /direction: "credit"/);
assert.match(service, /lockCustomerDepositBalance/);
assert.match(service, /idempotencyKey: `buyback:\$\{payload\.idempotencyKey\}:deposit_in`/);
assert.match(service, /movementType: "buyback" as const/);
assert.doesNotMatch(service, /Kas shift tidak mencukupi untuk payout Cash Buyback/);

// Closing shift recomputes expected cash from append-only cash movements, so Buyback cash_out is included once.
assert.match(shiftClosing, /summarizeCashMovements\(movementRows\)/);
assert.match(cashReconciliation, /if \(movement\.type === "cash_out"\)/);
assert.match(cashReconciliation, /summary\.expectedCash =[\s\S]*summary\.cashOut/);

// Admin cash reporting must not classify Buyback payout as manual cash out.
assert.match(cashContracts, /buybackCashPayouts: number/);
assert.match(cashQueries, /referenceType} = 'buyback'/);
assert.match(cashQueries, /not in \('customer_deposit_withdrawal', 'buyback'\)/);
assert.match(cashQueries, /buybackNumber: buybacks\.buybackNumber/);
assert.match(cashPage, /Payout Cash Buyback/);

// Inventory report recognizes Buyback as stock-in everywhere.
assert.match(reportContracts, /\| "buyback";/);
assert.match(reportContracts, /value: "buyback", label: "Buyback masuk"/);
const stockInBuybackOccurrences = reportQueries.match(/'migration_opening', 'buyback', 'transfer_in'/g)?.length ?? 0;
assert.ok(stockInBuybackOccurrences >= 2, "Buyback wajib dihitung sebagai stock-in pada summary dan trend.");
assert.match(stockPage, /buyback: "Buyback masuk"/);
assert.match(reportExport, /buyback: "Buyback masuk"/);

// General financial report separates Buyback payout from manual cash out.
assert.match(reportContracts, /buybackCashPayouts: number/);
assert.match(reportQueries, /buybackCashPayouts:/);
assert.match(reportQueries, /buybackCashPayouts -/);

// BB3-A refinement: clearer payout UX and external image upload remains wired to persistence.
assert.match(workspace, /3\. Payout ke Customer/);
assert.match(workspace, /Simpan ke Dana Titip/);
assert.match(workspace, /Foto terpilih/);
assert.match(workspace, /name=\{`externalImage:\$\{clientKey\}`\}/);
assert.match(workspace, /setPreviewUrl\(objectUrl\)/);
assert.match(workspace, /setFileName\(file\.name\)/);
assert.match(buybackActions, /formData\.get\(`externalImage:\$\{item\.clientKey\}`\)/);
assert.match(buybackActions, /storeImageFile\(\{/);

console.log("BB3-A Buyback cash/deposit/inventory integration contracts: OK");
