import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const workspace = read(
  "src/components/buybacks/buyback-processing-workspace.tsx",
);
const quickActions = read(
  "src/components/buybacks/buyback-processing-quick-actions.tsx",
);
const processingPage = read("src/app/(pos)/pos/buyback/pemrosesan/page.tsx");
const buybackPage = read("src/app/(pos)/pos/buyback/page.tsx");
const historyPage = read("src/app/(pos)/pos/buyback/riwayat/page.tsx");
const historyPanel = read("src/components/buybacks/buyback-history-panel.tsx");
const compactHistory = read(
  "src/components/buybacks/buyback-compact-history-panel.tsx",
);
const contracts = read("src/features/buybacks/processing-contracts.ts");
const printRoute = read("src/app/api/print-jobs/route.ts");

// Existing completion result is the source of truth.
// Batch 4 must not invent a second barcode or item identity.
assert.match(contracts, /productItemId: string/);
assert.match(contracts, /sku: string/);
assert.match(contracts, /barcode: string/);
assert.match(workspace, /state\.result\.productItemId/);
assert.match(workspace, /state\.result\.sku/);
assert.match(workspace, /state\.result\.barcode/);

// Reuse secure existing print endpoint.
assert.match(workspace, /function QuickLabelPrintButton/);
assert.match(workspace, /fetch\("\/api\/print-jobs"/);
assert.match(workspace, /itemId,/);
assert.match(workspace, /copies: 1/);
assert.match(workspace, /requestId: crypto\.randomUUID\(\)/);
assert.match(workspace, /Cetak Label/);
assert.match(workspace, /Cetak Lagi/);
assert.match(workspace, /Label dikirim ke printer\./);

// Existing endpoint remains permission-guarded + SATO Hardware Hub.
assert.match(printRoute, /inventory\.print_label/);
assert.match(printRoute, /buildInventoryLabelPayloadV2/);
assert.match(printRoute, /createHardwareJobV2/);
assert.match(printRoute, /jobType: "print_label_sato"/);
assert.match(printRoute, /copies < 1 \|\| copies > 20/);

// Success drawer stays open and reports completion only once.
assert.match(workspace, /completionReportedRef/);
assert.match(workspace, /state\.status === "success" && state\.result/);
assert.match(workspace, /Processing selesai/);
assert.match(workspace, /Item siap dijual/);
assert.match(
  workspace,
  /Hasil .* sudah masuk[\s\S]*Inventory dan tersedia di POS/,
);

// Print failure is local UI state only; no rollback action/service is called.
assert.match(workspace, /status === "error" \? "text-red-700"/);
assert.doesNotMatch(workspace, /rollback.*processing/i);

// Inventory deep-link is permission-controlled.
assert.match(workspace, /canViewInventory/);
assert.match(
  workspace,
  /\/admin\/inventaris\/item\/\$\{state\.result\.productItemId\}/,
);
assert.match(workspace, /Lihat Item/);

for (const source of [processingPage, buybackPage, historyPage]) {
  assert.match(source, /inventory\.print_label/);
  assert.match(source, /inventory\.view/);
}

// Quick-action lifecycle:
// completing from /pos/buyback or /pos/buyback/riwayat must NOT refresh the
// server component immediately, otherwise its pending-only data disappears and
// unmounts the success drawer before the user can print.
assert.match(quickActions, /useRef/);
assert.match(quickActions, /const refreshOnCloseRef = useRef\(false\)/);
assert.match(
  quickActions,
  /onCompleted=\{\(\) => \{\s*refreshOnCloseRef\.current = true;\s*\}\}/,
);
assert.doesNotMatch(
  quickActions,
  /onCompleted=\{\(\) => \{[\s\S]{0,160}router\.refresh\(\)/,
  "Quick action tidak boleh router.refresh() langsung saat completion.",
);

// Refresh happens only after the user is done with the success drawer.
assert.match(quickActions, /function closeSelected\(\)/);
assert.match(
  quickActions,
  /const shouldRefresh = refreshOnCloseRef\.current;/,
);
assert.match(quickActions, /refreshOnCloseRef\.current = false;/);
assert.match(quickActions, /setSelected\(null\);/);
assert.match(
  quickActions,
  /if \(shouldRefresh\) \{\s*router\.refresh\(\);\s*\}/,
);
assert.match(quickActions, /onClose=\{closeSelected\}/);

// Opening a new pending action resets any previous deferred refresh flag.
assert.match(
  quickActions,
  /refreshOnCloseRef\.current = false;\s*setSelected\(row\);/,
);

// Both history renderers propagate permissions.
assert.match(historyPanel, /canPrintLabel/);
assert.match(historyPanel, /canViewInventory/);
assert.match(compactHistory, /canPrintLabel/);
assert.match(compactHistory, /canViewInventory/);

// Completed processing rows provide a fallback re-print action.
assert.match(workspace, /row\.resultProductItemId && canPrintLabel/);
assert.match(
  workspace,
  /<QuickLabelPrintButton[\s\S]*itemId=\{row\.resultProductItemId\}/,
);

console.log(
  "Batch 4 Quick Print contract passed: success drawer survives quick-action completion, refresh is deferred until close, secure SATO printing and re-print fallback remain intact.",
);
