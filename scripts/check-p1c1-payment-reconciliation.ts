import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  parseReconciliationFilters,
  reconciliationStatuses,
} from "../src/features/reconciliation/contracts";

async function main() {
  assert.deepEqual(reconciliationStatuses, [
    "unreconciled",
    "pending_settlement",
    "reconciled",
    "mismatch",
    "not_found",
    "waived",
  ]);

  const defaultFilters = parseReconciliationFilters({});
  assert.equal(defaultFilters.status, "unreconciled");
  assert.equal(defaultFilters.range, "30d");
  assert.equal(defaultFilters.page, 1);

  const parsedFilters = parseReconciliationFilters({
    status: "mismatch",
    method: "debit_card",
    range: "7d",
    page: "3",
  });
  assert.equal(parsedFilters.status, "mismatch");
  assert.equal(parsedFilters.method, "debit_card");
  assert.equal(parsedFilters.range, "7d");
  assert.equal(parsedFilters.page, 3);

  const [schema, action, listPage, detailPage, seed] = await Promise.all([
    readFile("src/db/schema/index.ts", "utf8"),
    readFile("src/app/actions/payment-reconciliation.ts", "utf8"),
    readFile(
      "src/app/(admin)/admin/keuangan/rekonsiliasi/page.tsx",
      "utf8",
    ),
    readFile(
      "src/app/(admin)/admin/keuangan/rekonsiliasi/[paymentId]/page.tsx",
      "utf8",
    ),
    readFile("src/db/seed.ts", "utf8"),
  ]);

  assert.match(schema, /payment_reconciliations_payment_uq/);
  assert.match(schema, /payment_reconciliations_net_formula_ck/);
  assert.match(schema, /payment_reconciliations_reconciled_complete_ck/);

  assert.match(action, /pg_advisory_xact_lock/);
  assert.match(action, /payments\.reconciliation\.manage/);
  assert.match(action, /payments\.reconciliation\.resolve/);
  assert.match(action, /onConflictDoUpdate/);

  assert.match(listPage, /rekonsiliasi pembayaran/i);
  assert.match(detailPage, /PaymentReconciliationForm/);

  // Setelah migration squash, permission wajib divalidasi dari seed terkini,
  // bukan dari nama migration historis tertentu.
  assert.match(
    seed,
    /code:\s*"payments\.reconciliation\.view"/,
    "Seed wajib mendefinisikan permission payments.reconciliation.view.",
  );
  assert.match(
    seed,
    /code:\s*"payments\.reconciliation\.manage"/,
    "Seed wajib mendefinisikan permission payments.reconciliation.manage.",
  );
  assert.match(
    seed,
    /code:\s*"payments\.reconciliation\.resolve"/,
    "Seed wajib mendefinisikan permission payments.reconciliation.resolve.",
  );

  console.log("P1-C.1 manual payment reconciliation checks passed.");
}

main().catch((error: unknown) => {
  console.error("P1-C.1 check gagal.", error);
  process.exitCode = 1;
});
