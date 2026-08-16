import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1 } from "@/features/sales/documents/receipt-document-profiles";
import { RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY } from "@/features/sales/documents/receipt-certificate-render-modes";
import {
  assertHardwareJobPayloadV2,
  buildHardwareTestPayloadV2,
  buildInventoryLabelPayloadV2,
  buildReceiptDocumentPayloadV2,
  EPSON_L3251_PRINT_PROFILE_A4_V1,
} from "@/lib/hardware/job-payload-contracts-v2";
import { hashHardwareJobPayloadV2 } from "@/lib/hardware/job-payload-v2";

const itemId = "11111111-1111-4111-8111-111111111111";
const saleId = "22222222-2222-4222-8222-222222222222";
const agentId = "33333333-3333-4333-8333-333333333333";

const labelPayload = buildInventoryLabelPayloadV2({
  itemId,
  copies: 2,
  sku: "AJ-0001",
  barcode: "899000000001",
  productName: "Cincin Emas",
  weightGram: "2.350",
  purityPercent: "75",
  exchangePurityPercent: "70",
  size: "12",
  color: "Kuning",
  gemstone: "Zircon",
  sellingAmount: "3500000",
});
assert.equal(labelPayload.schemaVersion, 1);
assert.equal(labelPayload.templateId, "jewelry_barbell_host_bold_v2");
assert.equal(labelPayload.printerProfileId, "sato_cg408_jewelry_barbell_host_bold_v2");
assertHardwareJobPayloadV2("print_label_sato", labelPayload);

const receiptPayload = buildReceiptDocumentPayloadV2({
  saleId,
  invoiceNumber: "INV-2026-0001",
  requestSource: "check.hardware.job-payloads",
  reprint: false,
  requestedAt: new Date("2026-07-16T10:00:00.000Z"),
});
assert.equal(
  receiptPayload.documentProfileId,
  RECEIPT_DOCUMENT_PROFILE_A4_LANDSCAPE_V1,
);
assert.equal(receiptPayload.printProfileId, EPSON_L3251_PRINT_PROFILE_A4_V1);
assert.equal(
  receiptPayload.download.path,
  `/api/sales/${saleId}/receipt-certificate?profile=receipt_a4_landscape_v1`,
);
assertHardwareJobPayloadV2("print_receipt_certificate", receiptPayload);

const overlayReceiptPayload = buildReceiptDocumentPayloadV2({
  saleId,
  invoiceNumber: "INV-2026-0001",
  requestSource: "check.hardware.job-payloads.overlay",
  reprint: false,
  requestedAt: new Date("2026-07-16T10:00:00.000Z"),
  renderMode: RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
});
assert.equal(
  overlayReceiptPayload.download.path,
  `/api/sales/${saleId}/receipt-certificate?profile=receipt_a4_landscape_v1&mode=preprinted_overlay`,
);
assert.equal(
  overlayReceiptPayload.metadata.renderMode,
  RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
);
assertHardwareJobPayloadV2("print_receipt_certificate", overlayReceiptPayload);

const posActionsSource = readFileSync(
  new URL("../src/app/actions/pos.ts", import.meta.url),
  "utf8",
);
const adminSalesActionsSource = readFileSync(
  new URL("../src/features/sales/admin-actions.ts", import.meta.url),
  "utf8",
);

function assertPhysicalReceiptCallUsesOverlay(
  source: string,
  requestSource: string,
) {
  const marker = `requestSource: "${requestSource}"`;
  const markerIndex = source.indexOf(marker);
  assert.notEqual(
    markerIndex,
    -1,
    `Receipt call ${requestSource} tidak ditemukan.`,
  );

  const callStart = source.lastIndexOf(
    "buildReceiptDocumentPayloadV2({",
    markerIndex,
  );
  const callEnd = source.indexOf("}),", markerIndex);
  assert.ok(callStart >= 0 && callEnd > markerIndex);

  const callSource = source.slice(callStart, callEnd);
  assert.match(
    callSource,
    /renderMode:\s*RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY/,
    `${requestSource} wajib mencetak overlay pada kertas nota preprinted.`,
  );
}

assertPhysicalReceiptCallUsesOverlay(posActionsSource, "pos.checkout");
assertPhysicalReceiptCallUsesOverlay(posActionsSource, "pos.transaction_detail");
assertPhysicalReceiptCallUsesOverlay(
  adminSalesActionsSource,
  "admin.sales.detail",
);

const testDocumentPayload = buildHardwareTestPayloadV2({
  jobType: "test_document_printer",
  agentId,
  requestedAt: new Date("2026-07-16T10:00:00.000Z"),
});
assertHardwareJobPayloadV2("test_document_printer", testDocumentPayload);

assert.throws(
  () =>
    assertHardwareJobPayloadV2("print_receipt_certificate", {
      ...receiptPayload,
      download: {
        ...receiptPayload.download,
        path: "https://evil.example/receipt.pdf",
      },
    }),
  /relative \/api\//,
);

const firstHash = hashHardwareJobPayloadV2({
  schemaVersion: 1,
  nested: { barcode: "899000000001", copies: 1 },
});
const reorderedHash = hashHardwareJobPayloadV2({
  nested: { copies: 1, barcode: "899000000001" },
  schemaVersion: 1,
});
assert.equal(firstHash, reorderedHash, "Canonical payload hash harus stabil.");

console.log("Hardware job payload contract checks passed.");
