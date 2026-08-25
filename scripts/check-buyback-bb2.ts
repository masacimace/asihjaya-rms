import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const contracts = read("src/features/buybacks/contracts.ts");
const queries = read("src/features/buybacks/queries.ts");
const page = read("src/app/(pos)/pos/buyback/page.tsx");
const historyPanel = read("src/components/buybacks/buyback-history-panel.tsx");
const workspace = read("src/components/buybacks/buyback-workspace.tsx");
const actions = read("src/app/actions/buybacks.ts");
const service = read("src/features/buybacks/service.ts");
const receiptData = read("src/features/buybacks/documents/buyback-receipt.ts");
const receiptType = read("src/features/sales/documents/receipt-certificate.ts");
const receiptHtml = read("src/features/sales/documents/receipt-certificate-html.tsx");
const pdfAccess = read("src/features/sales/documents/pdf-render-access.ts");
const pdfRenderer = read("src/features/sales/documents/receipt-certificate-pdf.tsx");
const htmlRoute = read(
  "src/app/documents/buybacks/[buybackId]/receipt-certificate-html/page.tsx",
);
const apiRoute = read(
  "src/app/api/buybacks/[buybackId]/receipt-certificate/route.ts",
);
const hardwareContracts = read("src/lib/hardware/job-payload-contracts-v2.ts");
const hardwareAdapter = read("hardware-hub/lib/hardware-adapters.js");
const hardwareCheck = read("scripts/check-hardware-job-payloads.ts");

assert.match(contracts, /export type BuybackHistoryRow/);
assert.match(contracts, /export type BuybackDetail/);
assert.match(contracts, /receiptJobId\?: string \| null/);

assert.match(queries, /export async function getBuybackHistoryData/);
assert.match(queries, /eq\(hardwareJobs\.sourceType, "buyback"\)/);
assert.match(queries, /eq\(hardwareJobs\.jobType, "print_receipt_certificate"\)/);
assert.match(queries, /buybackItems\.snapshot/);
assert.match(queries, /olderDetail/);

assert.match(page, /searchParams/);
assert.match(page, /detailId/);
assert.match(page, /BuybackHistoryPanel/);
assert.match(page, /type: "success" \| "error" \| "info";/);
assert.match(historyPanel, /export function BuybackHistoryPanel/);
assert.match(historyPanel, /data\.rows\.map\(\(row\) =>/);
assert.match(
  historyPanel,
  /href=\{`\/pos\/buyback\?detail=\$\{row\.id\}`\}/,
);
assert.match(historyPanel, /Cetak Ulang Nota/);
assert.match(historyPanel, /Buka Nota PDF/);
assert.match(historyPanel, /snapshot transaksi Buyback/);

assert.match(receiptData, /documentKind: "buyback"/);
assert.match(receiptData, /buybackPricePerGram/);
assert.match(receiptData, /referenceType, "buyback"/);
assert.match(receiptData, /customer_deposit/);
assert.match(receiptType, /documentKind\?: "sale" \| "buyback"/);
assert.match(receiptType, /buybackPricePerGram\?: string \| null/);

assert.match(receiptHtml, /const isBuyback = data\.documentKind === "buyback"/);
assert.match(receiptHtml, /const useBuybackAdjustedLabels = isBuyback && !isPreprintedOverlay/);
assert.match(receiptHtml, /BB\/Gr/);
assert.match(receiptHtml, /No\. Buyback/);
assert.match(receiptHtml, /Payout Buyback/);
assert.match(receiptHtml, /HARGA\/GR/);
assert.match(receiptHtml, /Detail Buyback/);
assert.match(receiptHtml, /Terima kasih telah melakukan Buyback di Asih Jaya/);
assert.match(receiptHtml, /Support Payment/);
assert.match(receiptHtml, /No\. Order/);

assert.match(pdfAccess, /"receipt-buyback"/);
assert.match(pdfAccess, /buybackId: string \| null/);
assert.match(pdfRenderer, /\/documents\/buybacks\/\$\{access\.buybackId\}\/receipt-certificate-html/);
assert.match(htmlRoute, /scope: "receipt-buyback"/);
assert.match(htmlRoute, /requirePermission\("buybacks\.view"\)/);
assert.match(apiRoute, /getBuybackReceiptData/);
assert.match(apiRoute, /scope: "receipt-buyback"/);
assert.match(apiRoute, /authenticateHardwareAgent/);

assert.match(hardwareContracts, /"buyback_receipt"/);
assert.match(hardwareContracts, /buildBuybackReceiptDocumentPayloadV2/);
assert.match(
  hardwareContracts,
  /\/api\/buybacks\/\$\{input\.buybackId\}\/receipt-certificate/,
);
assert.match(
  hardwareAdapter,
  /\^\\\/api\\\/buybacks\\\/\[0-9a-f\]/i,
);
assert.match(hardwareCheck, /buildBuybackReceiptDocumentPayloadV2/);

assert.match(service, /buildBuybackReceiptDocumentPayloadV2/);
assert.match(service, /createHardwareJobV2InTransaction/);
assert.match(service, /idempotencyKey: `buyback-receipt:\$\{buyback\.id\}:initial`/);
assert.match(service, /sourceType: "buyback"/);
assert.match(workspace, /Nota Buyback sudah masuk antrean Document Printer/);

assert.match(actions, /export async function reprintBuybackReceiptAction/);
assert.match(actions, /mode: "manual"/);
assert.match(actions, /buildBuybackReceiptDocumentPayloadV2/);
assert.match(actions, /buyback-receipt:\$\{buyback\.id\}:reprint:/);
const reprintTryIndex = actions.indexOf("try {", actions.indexOf("reprintBuybackReceiptAction"));
const reprintCatchIndex = actions.indexOf("} catch", reprintTryIndex);
const successRedirectIndex = actions.lastIndexOf("redirectBuybackDetailWithFeedback({");
assert.ok(
  reprintTryIndex >= 0 &&
    reprintCatchIndex > reprintTryIndex &&
    successRedirectIndex > reprintCatchIndex,
  "Redirect success cetak ulang wajib berada setelah try/catch agar NEXT_REDIRECT tidak tertangkap.",
);

console.log("BB2 Buyback history/detail/receipt static contracts: OK");
