import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  assertHardwareJobPayloadV2,
  buildHardwareTestPayloadV2,
  buildInventoryLabelPayloadV2,
  buildReceiptDocumentPayloadV2,
  RECEIPT_PRINT_PROFILE_A5_V1,
} from "@/lib/hardware/job-payload-contracts-v2";
import { hashHardwareJobPayloadV2 } from "@/lib/hardware/job-payload-v2";

const ROOT = process.cwd();
const SAMPLE_ITEM_ID = "11111111-1111-4111-8111-111111111111";
const SAMPLE_SALE_ID = "22222222-2222-4222-8222-222222222222";
const SAMPLE_AGENT_ID = "33333333-3333-4333-8333-333333333333";

function read(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assertContains(source: string, value: string, message: string) {
  assert.ok(source.includes(value), message);
}

const labelPayload = buildInventoryLabelPayloadV2({
  itemId: SAMPLE_ITEM_ID,
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
assert.equal(labelPayload.templateId, "jewelry_compact");
assert.equal(labelPayload.itemId, SAMPLE_ITEM_ID);
assert.equal(labelPayload.copies, 2);
assert.equal(labelPayload.fields.sku, "AJ-0001");
assertHardwareJobPayloadV2("print_label_sato", labelPayload);

const receiptPayload = buildReceiptDocumentPayloadV2({
  saleId: SAMPLE_SALE_ID,
  invoiceNumber: "INV-2026-0001",
  requestSource: "check.hardware.v2-producers",
  reprint: false,
  requestedAt: new Date("2026-07-16T10:00:00.000Z"),
});
assert.equal(receiptPayload.printProfileId, RECEIPT_PRINT_PROFILE_A5_V1);
assert.equal(
  receiptPayload.download.path,
  `/api/sales/${SAMPLE_SALE_ID}/receipt-certificate`,
);
assert.equal(receiptPayload.download.contentType, "application/pdf");
assertHardwareJobPayloadV2("print_receipt_certificate", receiptPayload);

const testDocumentPayload = buildHardwareTestPayloadV2({
  jobType: "test_document_printer",
  agentId: SAMPLE_AGENT_ID,
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

const printRoute = read("src/app/api/print-jobs/route.ts");
assertContains(
  printRoute,
  'hasPermission(auth, "inventory.print_label")',
  "Label endpoint wajib memakai permission khusus.",
);
assertContains(
  printRoute,
  ".from(productItems)",
  "Label endpoint wajib mengambil item dari database.",
);
assertContains(
  printRoute,
  "buildInventoryLabelPayloadV2",
  "Label endpoint wajib membangun canonical server payload.",
);
assert.ok(
  !printRoute.includes('body["sku"]') && !printRoute.includes("body.sku"),
  "Label endpoint tidak boleh mempercayai SKU dari browser.",
);

const producer = read("src/lib/hardware/job-producer-v2.ts");
for (const required of [
  "HARDWARE_JOB_PROTOCOL_V2",
  "requiredCapability",
  "payloadHash",
  "expiresAt",
  ".onConflictDoNothing()",
  'action: "hardware.job_created"',
]) {
  assertContains(producer, required, `Producer v2 belum memiliki ${required}.`);
}

const posActions = read("src/app/actions/pos.ts");
assertContains(
  posActions,
  "createHardwareJobV2InTransaction",
  "Checkout harus membuat receipt job v2 dalam transaction yang sama.",
);
assertContains(
  posActions,
  "receipt:${sale.id}:initial",
  "Checkout receipt wajib memakai idempotency key intent awal.",
);
assertContains(
  posActions,
  "receipt:${sale.id}:reprint:${requestId}",
  "POS reprint wajib memakai request ID stabil dari form.",
);

const adminActions = read("src/features/sales/admin-actions.ts");
assertContains(
  adminActions,
  "createHardwareJobV2",
  "Admin receipt reprint harus memakai producer v2.",
);
assertContains(
  adminActions,
  "receipt:${sale.id}:reprint:${requestId}",
  "Admin reprint wajib memakai request ID stabil dari form.",
);

const hardwareActions = read("src/app/actions/hardware.ts");
assertContains(
  hardwareActions,
  "targetAgentId: agent.id",
  "Hardware test job wajib diarahkan ke agent yang dipilih.",
);
assertContains(
  hardwareActions,
  "getRequiredHardwareCapability(jobType)",
  "Hardware test wajib memeriksa capability agent.",
);

const legacyRecovery = read("src/lib/hardware/job-recovery.ts");
assertContains(
  legacyRecovery,
  "eq(hardwareJobs.protocolVersion, 1)",
  "Legacy stale recovery tidak boleh menyentuh Protocol v2 attempts.",
);

assertContains(
  hardwareActions,
  'job.status === "unknown_outcome"',
  "Retry biasa wajib menolak job v2 dengan unknown outcome.",
);
assertContains(
  hardwareActions,
  "currentAttemptId: null",
  "Manual retry v2 wajib melepaskan terminal current attempt tanpa menghapus history.",
);
assertContains(
  hardwareActions,
  "Math.max(job.maxAttempts, job.attempts + 1)",
  "Manual retry v2 wajib menyediakan satu attempt baru tanpa mereset attempt counter.",
);

const printButton = read(
  "src/app/(admin)/admin/inventaris/item/[itemId]/print-button.tsx",
);
assertContains(
  printButton,
  "requestIdRef",
  "Label UI wajib mempertahankan request ID setelah response loss.",
);

const adapter = read("hardware-hub/lib/hardware-adapters.js");
assertContains(
  adapter,
  "DOCUMENT_DOWNLOAD_PATH_PATTERNS",
  "Agent wajib menerapkan allowlist path download document.",
);
assertContains(
  adapter,
  "DOCUMENT_PATH_NOT_ALLOWED",
  "Agent wajib menolak path document di luar allowlist.",
);

const permissionMigration = read(
  "drizzle/0025_hardware_v2_secure_job_producers.sql",
);
assertContains(
  permissionMigration,
  "inventory.print_label",
  "Migration permission cetak label belum tersedia.",
);

console.log(
  "OK: Hardware Protocol v2 job producers, canonical payloads, idempotency, permission, and download allowlist checks passed.",
);
