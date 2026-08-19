import assert from "node:assert/strict";

import type { PosManualPaymentProfile } from "@/features/pos/contracts";
import { getPosPaymentPanelState } from "@/features/pos/payment-panel-state";

const debitProfile: PosManualPaymentProfile = {
  id: "profile-debit-bca",
  profileType: "edc",
  code: "EDC-BCA-01",
  name: "EDC BCA Kasir 1",
  provider: "BCA",
  verificationSource: "edc_terminal",
  merchantId: "MID-001",
  terminalId: "TID-001",
  destinationAccount: null,
  registerId: "register-1",
  registerName: "Kasir 1",
};



const cashState = getPosPaymentPanelState({
  totalAmount: 1_000_000,
  customerDepositUsedAmount: 0,
  externalPaymentDueAmount: 1_000_000,
  paidAmount: 1_200_000,
  remainingAmount: 400_000,
  paymentsCount: 1,
  customerDepositBalance: 0,
  paymentProfiles: [debitProfile],
  selectedMethod: "cash",
  selectedProfileId: "",
  amountInput: "Rp500.000",
  isCheckoutPending: false,
  isAddingPayment: false,
});

assert.equal(cashState.selectedConfig.method, "cash");
assert.equal(cashState.selectedProfile, null);
assert.equal(cashState.parsedInputAmount, 500_000);
assert.equal(cashState.recognizedCashAmount, 400_000);
assert.equal(cashState.cashChangeAmount, 100_000);
assert.equal(cashState.paymentProgressPercentage, 100);
assert.equal(cashState.hasPayments, true);
assert.equal(cashState.customerDepositControlsDisabled, true);
assert.equal(cashState.nonCashAmountIsTooHigh, false);

const debitState = getPosPaymentPanelState({
  totalAmount: 6_000_000,
  customerDepositUsedAmount: 1_500_000,
  externalPaymentDueAmount: 5_000_000,
  paidAmount: 1_000_000,
  remainingAmount: 4_000_000,
  paymentsCount: 0,
  customerDepositBalance: 1_000_000,
  paymentProfiles: [debitProfile],
  selectedMethod: "debit_card",
  selectedProfileId: debitProfile.id,
  amountInput: "5.000.000",
  isCheckoutPending: false,
  isAddingPayment: false,
});

assert.equal(debitState.selectedConfig.method, "debit_card");
assert.equal(debitState.eligibleProfiles.length, 1);
assert.equal(debitState.selectedProfile?.id, debitProfile.id);
assert.equal(debitState.recognizedCashAmount, 5_000_000);
assert.equal(debitState.cashChangeAmount, 0);
assert.equal(debitState.paymentProgressPercentage, 20);
assert.equal(debitState.customerDepositUsedIsTooHigh, true);
assert.equal(debitState.customerDepositControlsDisabled, false);
assert.equal(debitState.nonCashAmountIsTooHigh, true);

const pendingState = getPosPaymentPanelState({
  totalAmount: 0,
  customerDepositUsedAmount: 0,
  externalPaymentDueAmount: 0,
  paidAmount: 0,
  remainingAmount: 0,
  paymentsCount: 0,
  customerDepositBalance: 0,
  paymentProfiles: [],
  selectedMethod: "bank_transfer",
  selectedProfileId: "missing",
  amountInput: "",
  isCheckoutPending: true,
  isAddingPayment: false,
});

assert.equal(pendingState.paymentProgressPercentage, 100);
assert.equal(pendingState.selectedProfile, null);
assert.equal(pendingState.customerDepositControlsDisabled, true);

console.log("OK: POS payment panel derived-state contract passed.");
