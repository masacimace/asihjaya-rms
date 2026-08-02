import assert from "node:assert/strict";

import type { PosPaymentDraft } from "@/features/pos/payment-draft";
import { createRecoveredCheckoutPaymentState } from "@/features/pos/payment-state";

const debitDraft: PosPaymentDraft = {
  id: "pay_debit_recovery",
  method: "debit_card",
  methodLabel: "Debit Card EDC",
  amount: 1_250_000,
  manualPaymentProfileId: "profile-edc-1",
  manualPaymentProfileName: "EDC BCA Utama",
  verificationConfirmed: true,
  receivedAmount: null,
  changeAmount: 0,
  provider: "BCA",
  reference: "APPROVAL-001",
  note: null,
  verificationSource: "edc_terminal",
  providerPaidAtIso: "2026-08-02T04:00:00.000Z",
  evidenceKey: null,
  evidenceFileName: null,
  verificationDetails: {
    merchantId: "MID-001",
    terminalId: "TID-001",
  },
};

const recoveredState = createRecoveredCheckoutPaymentState({
  payments: [debitDraft],
  customerDepositUsedAmount: 250_000,
  customerDepositInAmount: 50_000,
  manualPaymentApproval: null,
});

assert.deepEqual(recoveredState.payments, [debitDraft]);
assert.equal(recoveredState.selectedMethod, "debit_card");
assert.equal(recoveredState.selectedPaymentProfileId, "profile-edc-1");
assert.equal(recoveredState.paymentVerificationConfirmed, true);
assert.equal(recoveredState.customerDepositUsedInput, "250.000");
assert.equal(recoveredState.customerDepositInInput, "50.000");
assert.equal(recoveredState.manualPaymentApproval, null);

const emptyRecoveredState = createRecoveredCheckoutPaymentState({
  payments: [],
  customerDepositUsedAmount: null,
  customerDepositInAmount: undefined,
  manualPaymentApproval: null,
});

assert.equal(emptyRecoveredState.selectedMethod, "cash");
assert.equal(emptyRecoveredState.selectedPaymentProfileId, "");
assert.equal(emptyRecoveredState.paymentVerificationConfirmed, false);
assert.equal(emptyRecoveredState.customerDepositUsedInput, "0");
assert.equal(emptyRecoveredState.customerDepositInInput, "0");

console.log("POS payment state recovery checks passed.");
