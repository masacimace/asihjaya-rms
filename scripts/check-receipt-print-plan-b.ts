/**
 * Static contract check for per-outlet receipt print settings.
 * Run: npx tsx scripts/check-receipt-print-plan-b.ts
 * Complement with npm run check:receipt-pdf + hardware print profile checks.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  getReceiptCertificateRenderModeLabel,
  RECEIPT_CERTIFICATE_RENDER_MODES,
} from "@/features/sales/documents/receipt-certificate-render-modes";

const read = (p: string) => fs.readFileSync(path.resolve(p), "utf8");
const mode = read("src/features/sales/documents/receipt-certificate-render-modes.ts");
const html = read("src/features/sales/documents/receipt-certificate-html.tsx");
const schema = read("src/db/schema/index.ts");
const action = read("src/app/actions/receipt-print-settings.ts");
const ui = read("src/components/hardware/receipt-print-settings-panel.tsx");
const query = read("src/features/hardware/receipt-print-settings.ts");
const hardware = read("hardware-hub/lib/document-print-profiles.js");
const payload = read("src/lib/hardware/job-payload-contracts-v2.ts");

assert.match(mode,/RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN_FRONT_ONLY/);
// Regression: these UI labels also go into PDF HTTP response headers.
// A Unicode em dash (U+2014) causes Node's Response to throw ByteString error.
for (const renderMode of RECEIPT_CERTIFICATE_RENDER_MODES) {
  const label = getReceiptCertificateRenderModeLabel(renderMode);
  assert.doesNotThrow(
    () => new Response(null, { headers: { "X-Receipt-Render-Mode-Label": label } }),
    `HTTP receipt mode label must be ByteString-compatible: ${renderMode}`,
  );
}
assert.match(html,/!isPreprintedOverlay\s*&&\s*renderMode\s*!==\s*RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN_FRONT_ONLY/);
assert.match(html,/certificateItems\.map\(/);
assert.match(schema,/receiptPrintMode:\s*varchar\("receipt_print_mode"/);
assert.match(action,/requirePermission\("admin\.access"\)/);
assert.match(action,/hardware\.agents\.manage/);
assert.match(action,/tx\.insert\(auditLogs\)/);
assert.match(query,/getDefaultOutletReceiptPrintMode/);
assert.match(query,/inArray\(hardwareJobs\.status/);
assert.match(ui,/updateOutletReceiptPrintModeAction/);
assert.match(ui,/confirmPaper/);
assert.match(payload,/RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN_FRONT_ONLY/);
assert.match(hardware,/const isA5PreprintedOverlay/);
assert.match(hardware,/"paper=A5",\s*"fit",\s*"color",\s*"simplex"/);
assert.match(hardware,/"paper=A5",\s*"noscale",\s*"color",\s*"simplex"/);

for (const [pathName, trigger] of [
  ["src/app/actions/pos.ts", /requestSource: "pos\.checkout"/],
  ["src/features/buybacks/service.ts", /requestSource: "pos\.buyback"/],
  ["src/features/sales/admin-actions.ts", /requestSource: "admin\.sales\.detail"/],
  ["src/app/actions/buybacks.ts", /requestSource: "pos\.buyback\.detail"/],
] as const) {
  const source = read(pathName);
  assert.match(source, trigger, `Print job expected: ${pathName}`);
  assert.match(source,/renderMode:\s*(?:await\s+getOutletReceiptPrintMode|receiptPrintMode)/,
    `${pathName}: mode should come from the outlet selection`);
  assert.match(source,/documentProfileId:\s*RECEIPT_DOCUMENT_PROFILE_A5_LANDSCAPE_V1/,
    `${pathName}: printed receipt must be A5`);
}

assert.match(read("src/app/(admin)/admin/operasional/hardware/page.tsx"),/<ReceiptPrintSettingsPanel/);
assert.match(read("drizzle/0030_receipt_print_mode.sql"),/full_design_front_only/);
assert.ok(fs.existsSync("drizzle/meta/0030_snapshot.json"));
console.log("PASS: Receipt print Plan B static source contracts.");
