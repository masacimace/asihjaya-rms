import assert from "node:assert/strict";

import type { PosCheckoutPaymentInput } from "@/features/pos/contracts";
import {
  DEFAULT_MANUAL_PAYMENT_POLICIES,
  getManualPaymentProfileType,
  normalizeAndValidateManualPaymentVerification,
} from "@/features/pos/manual-payment-verification";

const organizationId = "11111111-1111-4111-8111-111111111111";

assert.deepEqual(Object.keys(DEFAULT_MANUAL_PAYMENT_POLICIES).sort(), [
  "credit_card",
  "debit_card",
]);
assert.equal(
  DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card.evidenceThreshold,
  20_000_000,
);
assert.equal(
  DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card.coVerificationThreshold,
  30_000_000,
);
assert.equal(
  DEFAULT_MANUAL_PAYMENT_POLICIES.credit_card.evidenceThreshold,
  20_000_000,
);
assert.equal(
  DEFAULT_MANUAL_PAYMENT_POLICIES.credit_card.coVerificationThreshold,
  30_000_000,
);
assert.equal(getManualPaymentProfileType("debit_card"), "edc");
assert.equal(getManualPaymentProfileType("credit_card"), "edc");

function validate(payment: PosCheckoutPaymentInput) {
  if (payment.method === "cash") {
    throw new Error("Check ini khusus metode EDC non-tunai.");
  }

  return normalizeAndValidateManualPaymentVerification({
    payment,
    organizationId,
    policy: DEFAULT_MANUAL_PAYMENT_POLICIES[payment.method],
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
assert.equal(
  validate({
    ...edcPayment,
    method: "credit_card",
    provider: "BNI",
    reference: "APPROVAL-5678",
  }).normalizedProvider,
  "BNI",
);

assert.throws(
  () => validate({ ...edcPayment, verificationConfirmed: false }),
  /Konfirmasi bahwa pembayaran/,
);

assert.throws(
  () => validate({ ...edcPayment, amount: 20_000_000 }),
  /Bukti pembayaran wajib/,
);

console.log("P1-A.1 fast manual EDC payment UX checks passed.");
