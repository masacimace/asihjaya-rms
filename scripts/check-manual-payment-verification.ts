import assert from "node:assert/strict";

import {
  getManualPaymentProfileType,
  isNonCashManualPaymentMethod,
  NON_CASH_MANUAL_PAYMENT_METHODS,
} from "../src/features/pos/manual-payment-verification";

assert.deepEqual(NON_CASH_MANUAL_PAYMENT_METHODS, [
  "debit_card",
  "bank_transfer",
]);
assert.equal(isNonCashManualPaymentMethod("debit_card"), true);
assert.equal(isNonCashManualPaymentMethod("bank_transfer"), true);
assert.equal(isNonCashManualPaymentMethod("credit_card"), false);
assert.equal(getManualPaymentProfileType("debit_card"), "edc");
assert.equal(getManualPaymentProfileType("bank_transfer"), "bank_account");

console.log("Manual payment method/profile mapping checks passed.");
