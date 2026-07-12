import assert from "node:assert/strict";

import type { PosCheckoutPaymentInput } from "@/features/pos/contracts";
import {
  DEFAULT_MANUAL_PAYMENT_POLICIES,
  getManualPaymentProfileType,
  normalizeAndValidateManualPaymentVerification,
} from "@/features/pos/manual-payment-verification";

const organizationId = "11111111-1111-4111-8111-111111111111";

assert.equal(
  DEFAULT_MANUAL_PAYMENT_POLICIES.qris_manual.evidenceThreshold,
  7_500_000,
);
assert.equal(
  DEFAULT_MANUAL_PAYMENT_POLICIES.qris_manual.coVerificationThreshold,
  9_000_000,
);
assert.equal(
  DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card.evidenceThreshold,
  20_000_000,
);
assert.equal(
  DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card.coVerificationThreshold,
  30_000_000,
);
assert.equal(
  DEFAULT_MANUAL_PAYMENT_POLICIES.bank_transfer.coVerificationThreshold,
  40_000_000,
);
assert.equal(getManualPaymentProfileType("qris_manual"), "qris");
assert.equal(getManualPaymentProfileType("debit_card"), "edc");
assert.equal(getManualPaymentProfileType("bank_transfer"), "bank_account");

function validate(payment: PosCheckoutPaymentInput) {
  return normalizeAndValidateManualPaymentVerification({
    payment,
    organizationId,
    policy: DEFAULT_MANUAL_PAYMENT_POLICIES[
      payment.method as keyof typeof DEFAULT_MANUAL_PAYMENT_POLICIES
    ],
    now: new Date("2026-07-13T10:00:00.000Z"),
  });
}

const edcPayment: PosCheckoutPaymentInput = {
  method: "debit_card",
  amount: 5_000_000,
  manualPaymentProfileId: "22222222-2222-4222-8222-222222222222",
  verificationConfirmed: true,
  provider: "BCA",
  reference: "APPROVAL-1234",
  verificationSource: "edc_terminal",
  providerPaidAtIso: "2026-07-13T09:59:00.000Z",
  verificationDetails: {
    terminalId: "TERM-01",
  },
};

assert.equal(validate(edcPayment).details.terminalId, "TERM-01");

const transferPayment: PosCheckoutPaymentInput = {
  method: "bank_transfer",
  amount: 10_000_000,
  manualPaymentProfileId: "33333333-3333-4333-8333-333333333333",
  verificationConfirmed: true,
  provider: "BCA",
  reference: "TRANSFER-1234",
  verificationSource: "bank_app",
  providerPaidAtIso: "2026-07-13T09:59:00.000Z",
  verificationDetails: {
    destinationAccount: "BCA •••• 1234 — Asih Jaya",
  },
};

assert.equal(validate(transferPayment).details.senderName, null);

assert.throws(
  () =>
    validate({
      ...transferPayment,
      amount: 40_000_000,
      evidenceKey:
        "organizations/11111111-1111-4111-8111-111111111111/payment-evidence/44444444-4444-4444-8444-444444444444.webp",
    }),
  /Nama pengirim wajib/,
);

assert.throws(
  () => validate({ ...edcPayment, verificationConfirmed: false }),
  /Konfirmasi bahwa pembayaran/,
);

assert.throws(
  () => validate({ ...edcPayment, amount: 20_000_000 }),
  /Bukti pembayaran wajib/,
);

console.log("P1-A.1 fast manual payment UX checks passed.");
