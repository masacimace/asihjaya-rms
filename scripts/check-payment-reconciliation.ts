import assert from "node:assert/strict";

import {
  parseReconciliationFilters,
  reconciliationStatuses,
} from "@/features/reconciliation/contracts";

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

const invalidFilters = parseReconciliationFilters({
  status: "invalid-status",
  method: "invalid-method",
  range: "invalid-range",
  page: "0",
});
assert.equal(invalidFilters.status, "unreconciled");
assert.equal(invalidFilters.method, null);
assert.equal(invalidFilters.range, "30d");
assert.equal(invalidFilters.page, 1);

console.log("Payment reconciliation contract checks passed.");
