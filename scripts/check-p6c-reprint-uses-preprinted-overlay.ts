import { readFileSync } from "node:fs";

const saleDetailPagePath =
  "src/app/(admin)/admin/penjualan/[transactionId]/page.tsx";
const reprintButtonPath =
  "src/app/(admin)/admin/penjualan/[transactionId]/reprint-button.tsx";
const adminActionsPath = "src/features/sales/admin-actions.ts";
const salePdfRoutePath = "src/app/api/sales/[saleId]/receipt-certificate/route.ts";
const saleHtmlPagePath =
  "src/app/documents/sales/[saleId]/receipt-certificate-html/page.tsx";
const hardwarePayloadPath = "src/lib/hardware/job-payload-contracts-v2.ts";

const saleDetailSource = readFileSync(saleDetailPagePath, "utf8");
const reprintButtonSource = readFileSync(reprintButtonPath, "utf8");
const adminActionsSource = readFileSync(adminActionsPath, "utf8");
const salePdfRouteSource = readFileSync(salePdfRoutePath, "utf8");
const saleHtmlPageSource = readFileSync(saleHtmlPagePath, "utf8");
const hardwarePayloadSource = readFileSync(hardwarePayloadPath, "utf8");

function assertIncludes(source: string, snippet: string, description: string) {
  if (!source.includes(snippet)) {
    throw new Error(`Missing ${description}: ${snippet}`);
  }
}

const adminActionSnippets = [
  [
    "RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY",
    "admin action overlay mode import/use",
  ],
  [
    "renderMode: RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY",
    "reprint job uses pre-printed overlay render mode",
  ],
  [
    "overlay kertas custom",
    "admin audit/reprint reason mentions custom paper overlay",
  ],
] as const;

for (const [snippet, description] of adminActionSnippets) {
  assertIncludes(adminActionsSource, snippet, description);
}

const salePdfRouteSnippets = [
  ['request.nextUrl.searchParams.get("mode")', "sale PDF mode query"],
  ["Mode render nota tidak didukung", "sale PDF mode validation"],
  ['htmlUrl.searchParams.set("mode", renderMode)', "sale PDF forwards render mode"],
  ["preprinted-overlay", "sale PDF overlay filename marker"],
  ["X-Receipt-Render-Mode", "sale PDF render mode response header"],
] as const;

for (const [snippet, description] of salePdfRouteSnippets) {
  assertIncludes(salePdfRouteSource, snippet, description);
}

const saleHtmlSnippets = [
  ["mode?: string", "sale HTML mode query type"],
  ["isReceiptCertificateRenderMode(query.mode)", "sale HTML mode validation"],
  ["resolveReceiptCertificateRenderMode(query.mode)", "sale HTML mode resolver"],
  ["renderMode={renderMode}", "sale HTML forwards render mode"],
] as const;

for (const [snippet, description] of saleHtmlSnippets) {
  assertIncludes(saleHtmlPageSource, snippet, description);
}

const hardwarePayloadSnippets = [
  ["HardwareReceiptRenderMode", "hardware receipt render mode type"],
  ["renderMode?: HardwareReceiptRenderMode", "hardware payload renderMode support"],
  ['pathParams.set("mode", renderMode)', "hardware payload mode query"],
  ["payload.metadata.renderMode = renderMode", "hardware metadata render mode marker"],
  ["document intent/profile/mode", "hardware path validator checks mode"],
] as const;

for (const [snippet, description] of hardwarePayloadSnippets) {
  assertIncludes(hardwarePayloadSource, snippet, description);
}

const saleDetailSnippets = [
  [
    "Preview dan download memakai full design, sedangkan reprint memakai overlay kertas custom.",
    "receipt card mode explanation",
  ],
  ["Buka layout HTML full design", "preview remains full design"],
  ["Unduh nota/certificate full design", "download remains full design"],
  ["pre-printed overlay", "reprint overlay note"],
] as const;

for (const [snippet, description] of saleDetailSnippets) {
  assertIncludes(saleDetailSource, snippet, description);
}

assertIncludes(
  reprintButtonSource,
  "Reprint ke kertas custom",
  "reprint button custom paper label",
);

console.log("P6-C reprint pre-printed overlay checks passed.");
