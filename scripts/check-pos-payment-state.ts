import assert from "node:assert/strict";

import type { PosPaymentDraft } from "@/features/pos/payment-draft";
import { createRecoveredCheckoutPaymentState } from "@/features/pos/payment-state";

const edcDraft: PosPaymentDraft = {
  id: "pay_edc_recovery",
  method: "debit_card",
  methodLabel: "EDC",
  amount: 1_250_000,
  manualPaymentProfileId: "profile-edc-1",
  manualPaymentProfileName: "EDC BCA Utama",
  verificationConfirmed: false,
  receivedAmount: null,
  changeAmount: 0,
  provider: "BCA",
  reference: null,
  note: null,
  verificationSource: null,
  providerPaidAtIso: null,
  evidenceKey: null,
  evidenceFileName: null,
  verificationDetails: {
    terminalId: "TID-001",
  },
};

const recoveredState = createRecoveredCheckoutPaymentState({
  payments: [edcDraft],
  customerDepositUsedAmount: 250_000,
  customerDepositInAmount: 50_000,
});

assert.deepEqual(recoveredState.payments, [edcDraft]);
assert.equal(recoveredState.selectedMethod, "debit_card");
assert.equal(recoveredState.selectedPaymentProfileId, "profile-edc-1");
assert.equal(recoveredState.customerDepositUsedInput, "250.000");
assert.equal(recoveredState.customerDepositInInput, "50.000");

const emptyRecoveredState = createRecoveredCheckoutPaymentState({
  payments: [],
  customerDepositUsedAmount: null,
  customerDepositInAmount: undefined,
});

assert.equal(emptyRecoveredState.selectedMethod, "cash");
assert.equal(emptyRecoveredState.selectedPaymentProfileId, "");
assert.equal(emptyRecoveredState.customerDepositUsedInput, "0");
assert.equal(emptyRecoveredState.customerDepositInInput, "0");

console.log("POS payment state recovery checks passed.");
