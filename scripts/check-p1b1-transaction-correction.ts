import assert from "node:assert/strict";

import {
  classifySaleCorrection,
  getCorrectionReasonLabel,
  getSaleCorrectionEligibility,
} from "../src/features/sales/correction-eligibility";

const sameDayOpen = getSaleCorrectionEligibility({
  saleStatus: "completed",
  shiftStatus: "open",
  completedAt: new Date("2026-07-13T02:00:00.000Z"),
  hasReturnCase: false,
  now: new Date("2026-07-13T10:00:00.000Z"),
});
assert.equal(sameDayOpen.voidEligibleBySystem, true);
assert.equal(
  classifySaleCorrection({
    eligibility: sameDayOpen,
    deliveryAnswer: "not_delivered",
  }),
  "void",
);
assert.equal(
  classifySaleCorrection({
    eligibility: sameDayOpen,
    deliveryAnswer: "delivered",
  }),
  "refund",
);
assert.equal(
  classifySaleCorrection({
    eligibility: sameDayOpen,
    deliveryAnswer: "unsure",
  }),
  "refund",
);

const closedShift = getSaleCorrectionEligibility({
  saleStatus: "completed",
  shiftStatus: "closed",
  completedAt: new Date("2026-07-13T02:00:00.000Z"),
  hasReturnCase: false,
  now: new Date("2026-07-13T10:00:00.000Z"),
});
assert.equal(closedShift.voidEligibleBySystem, false);
assert.equal(
  classifySaleCorrection({
    eligibility: closedShift,
    deliveryAnswer: "not_delivered",
  }),
  "refund",
);

const existingReturn = getSaleCorrectionEligibility({
  saleStatus: "completed",
  shiftStatus: "open",
  completedAt: new Date("2026-07-13T02:00:00.000Z"),
  hasReturnCase: true,
  now: new Date("2026-07-13T10:00:00.000Z"),
});
assert.equal(existingReturn.canRequestCorrection, false);

assert.equal(getCorrectionReasonLabel("void", "wrong_item"), "Salah memilih barang");
assert.equal(getCorrectionReasonLabel("refund", "product_issue"), "Barang bermasalah");
assert.equal(getCorrectionReasonLabel("refund", "unknown"), null);

console.log("P1-B.1 transaction correction eligibility checks passed.");
