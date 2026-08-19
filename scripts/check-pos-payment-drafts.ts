import assert from "node:assert/strict";

import type { PosManualPaymentProfile } from "@/features/pos/contracts";
import {
  createCheckoutIdempotencyKey,
  createPaymentDraftId,
  formatCurrency,
  formatRupiahInput,
  getPaymentConfig,
  getPaymentDraftValidationMessage,
  getProfilesForMethod,
  isStoredCheckoutPayment,
  parseAmount,
  parsePaymentAmountInput,
  paymentMethodConfigs,
  profileSupportsMethod,
  type PosPaymentDraft,
} from "@/features/pos/payment-draft";

const edcProfile: PosManualPaymentProfile = {
  id: "profile-edc-1",
  profileType: "edc",
  code: "EDC-BCA",
  name: "EDC BCA Utama",
  provider: "BCA",
  verificationSource: "edc_terminal",
  merchantId: "MID-001",
  terminalId: "TID-001",
  destinationAccount: null,
  registerId: "register-1",
  registerName: "Kasir Utama",
};

assert.deepEqual(
  paymentMethodConfigs.map((config) => config.method),
  ["cash", "debit_card", "bank_transfer"],
);
assert.equal(getPaymentConfig("cash").allowOverpayment, true);
assert.equal(getPaymentConfig("debit_card").requiresReference, false);
assert.equal(profileSupportsMethod(edcProfile, "cash"), false);
assert.equal(profileSupportsMethod(edcProfile, "debit_card"), true);
assert.deepEqual(getProfilesForMethod([edcProfile], "bank_transfer"), []);

assert.equal(parseAmount("1500000"), 1_500_000);
assert.equal(parseAmount("invalid"), 0);
assert.equal(formatRupiahInput("001500000"), "1.500.000");
assert.equal(parsePaymentAmountInput("Rp 1.500.000"), 1_500_000);
assert.ok(formatCurrency(500_000).includes("500.000"));

const cashDraft: PosPaymentDraft = {
  id: "pay-cash-1",
  method: "cash",
  methodLabel: "Cash",
  amount: 900_000,
  manualPaymentProfileId: null,
  manualPaymentProfileName: null,
  verificationConfirmed: false,
  receivedAmount: 1_000_000,
  changeAmount: 100_000,
  provider: null,
  reference: null,
  note: null,
  verificationSource: null,
  providerPaidAtIso: null,
  evidenceKey: null,
  evidenceFileName: null,
  verificationDetails: {},
};

assert.equal(
  getPaymentDraftValidationMessage({
    payments: [cashDraft],
    totalAmount: 900_000,
  }),
  null,
);
assert.equal(
  getPaymentDraftValidationMessage({
    payments: [{ ...cashDraft, changeAmount: 0 }],
    totalAmount: 900_000,
  }),
  "Nominal kembalian cash tidak sesuai dengan uang diterima.",
);

const debitDraft: PosPaymentDraft = {
  id: "pay-debit-1",
  method: "debit_card",
  methodLabel: "EDC",
  amount: 500_000,
  manualPaymentProfileId: edcProfile.id,
  manualPaymentProfileName: edcProfile.name,
  verificationConfirmed: false,
  receivedAmount: null,
  changeAmount: 0,
  provider: edcProfile.provider,
  reference: null,
  note: null,
  verificationSource: null,
  providerPaidAtIso: null,
  evidenceKey: null,
  evidenceFileName: null,
  verificationDetails: {
    terminalId: edcProfile.terminalId,
  },
};

assert.equal(
  getPaymentDraftValidationMessage({
    payments: [debitDraft],
    totalAmount: 500_000,
  }),
  null,
);
assert.equal(
  getPaymentDraftValidationMessage({
    payments: [
      {
        ...debitDraft,
        verificationDetails: { terminalId: null },
      },
    ],
    totalAmount: 500_000,
  }),
  null,
);

assert.equal(isStoredCheckoutPayment(cashDraft), true);
assert.equal(
  isStoredCheckoutPayment({ ...cashDraft, verificationDetails: null }),
  false,
);
assert.match(createPaymentDraftId(), /^pay_/);
assert.match(createCheckoutIdempotencyKey(), /^pos_/);

console.log("POS payment draft domain checks passed.");
