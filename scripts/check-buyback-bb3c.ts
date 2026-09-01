import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const schema = read("src/db/schema/index.ts");
const service = read("src/features/buybacks/service.ts");
const actions = read("src/app/actions/buybacks.ts");
const workspace = read("src/components/buybacks/buyback-workspace.tsx");
const historyPanel = read("src/components/buybacks/buyback-history-panel.tsx");
const hardwareProducer = read("src/lib/hardware/job-producer-v2.ts");
const hardwareClaim = read("src/lib/hardware/job-claim-v2.ts");
const hardwareRunner = read("hardware-hub/lib/protocol-v2-runner.js");
const hardwareReadme = read("hardware-hub/README.md");
const saleActions = read("src/app/actions/pos.ts");
const saleHistory = read("src/app/(pos)/pos/transaksi/page.tsx");

// Transaction-level idempotency is protected both by a transaction lock and a DB unique key.
assert.match(service, /pg_advisory_xact_lock\(hashtext\(/);
assert.match(service, /getExistingBuybackReplayResultInTransaction/);
assert.match(schema, /uniqueIndex\("buybacks_org_idempotency_uq"\)/);

// Same key + different business intent must be rejected instead of silently replaying an old transaction.
assert.match(service, /Sesi Buyback ini sudah dipakai oleh transaksi berhasil dengan data yang berbeda/);
assert.match(service, /storedItems\.length === payload\.items\.length/);
assert.match(service, /storedPayouts\.length === payload\.payouts\.length/);
assert.match(service, /stored\.productItemId === incoming\.productItemId/);
assert.match(service, /readSnapshotText\(snapshot, "productMasterId"\)/);
assert.match(service, /sameNumeric\(stored\.finalAmount, incoming\.finalAmount\)/);
assert.match(service, /sameNumeric\(stored\.amount, incoming\.amount\)/);
assert.match(actions, /getExistingBuybackReplayResult\(/);
assert.match(actions, /idempotencyKey: error\.message/);

// Concurrent item claims and cash/deposit accounting remain serialized/guarded.
assert.match(service, /\.for\("update"\)/);
assert.match(service, /eq\(productItems\.availability, "sold"\)/);
assert.match(service, /eq\(productItems\.locationState, "customer"\)/);
assert.match(service, /claimed\.length !== 1/);
assert.match(service, /lockCustomerDepositBalance/);
assert.match(schema, /uniqueIndex\("cash_movements_reference_guard_uq"\)/);
assert.match(schema, /uniqueIndex\("customer_deposit_ledger_idempotency_uq"\)/);
assert.match(schema, /uniqueIndex\("inventory_movements_reference_guard_uq"\)/);

// External media written by a racing/replayed request is compensating-cleaned.
assert.match(actions, /if \(result\.replayed\) \{[\s\S]*deleteImageFile/);
assert.match(actions, /catch \(error\) \{[\s\S]*storedImageKeys\.map\(\(key\) => deleteImageFile\(key\)\)/);

// Initial receipt is part of the Buyback DB transaction and uses one stable key.
assert.match(service, /createHardwareJobV2InTransaction/);
assert.match(service, /idempotencyKey: `buyback-receipt:\$\{buyback\.id\}:initial`/);
assert.match(schema, /uniqueIndex\("hardware_jobs_idempotency_uq"\)/);
assert.match(hardwareProducer, /\.onConflictDoNothing\(\)/);
assert.match(hardwareProducer, /return \{ job: existing, duplicate: true \}/);

// Manual Buyback reprint now mirrors Sale: request nonce comes from the rendered form,
// so double-submit of one form resolves to one hardware job.
assert.match(historyPanel, /name="requestId" value=\{randomUUID\(\)\}/);
assert.match(actions, /const requestId = String\(formData\.get\("requestId"\)/);
assert.match(actions, /Request cetak ulang nota Buyback tidak valid/);
assert.match(actions, /idempotencyKey: `buyback-receipt:\$\{buyback\.id\}:reprint:\$\{requestId\}`/);
assert.match(saleHistory, /name="requestId" value=\{randomUUID\(\)\}/);
assert.match(saleActions, /idempotencyKey: `receipt:\$\{sale\.id\}:reprint:\$\{requestId\}`/);

// Frontend blocks accidental repeated submits while the action is pending; backend guards remain authoritative.
assert.match(workspace, /const \[state, formAction, isSubmitting\] = useActionState/);
assert.match(workspace, /disabled=\{!canSubmit \|\| isSubmitting\}/);
assert.match(workspace, /Memproses Buyback\.\.\./);

// Hardware Hub v2 claims exactly one pending job and refuses unsafe auto-reprint after dispatch ambiguity.
assert.match(hardwareClaim, /\.for\("update", \{ skipLocked: true \}\)/);
assert.match(hardwareClaim, /row\.attemptStatus === "dispatching"/);
assert.match(hardwareClaim, /status: "unknown_outcome"/);
assert.match(hardwareRunner, /unknown_after_dispatch/);
assert.match(hardwareReadme, /agent tidak mencetak ulang/);
assert.match(hardwareReadme, /printer tidak dijalankan lagi/);

console.log("BB3-C Buyback idempotency/concurrency/retry + Hardware regression contracts: OK");
