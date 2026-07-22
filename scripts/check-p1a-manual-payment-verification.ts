import assert from "node:assert/strict";

import {
  createManualPaymentVerificationFingerprint,
  DEFAULT_MANUAL_PAYMENT_POLICIES,
  getManualPaymentProfileType,
  normalizeAndValidateManualPaymentVerification,
} from "../src/features/pos/manual-payment-verification";
import type { PosCheckoutPaymentInput } from "../src/features/pos/contracts";

const organizationId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-07-13T03:00:00.000Z");

function expectError(run: () => unknown, pattern: RegExp) {
  assert.throws(run, pattern);
}

assert.deepEqual(Object.keys(DEFAULT_MANUAL_PAYMENT_POLICIES).sort(), [
  "credit_card",
  "debit_card",
]);
assert.equal(getManualPaymentProfileType("debit_card"), "edc");
assert.equal(getManualPaymentProfileType("credit_card"), "edc");

const validDebitEdc: PosCheckoutPaymentInput = {
  method: "debit_card",
  amount: 2_000_000,
  receivedAmount: null,
  changeAmount: 0,
  verificationConfirmed: true,
  provider: "BCA EDC",
  reference: "APPROVAL-9911",
  note: null,
  verificationSource: "edc_terminal",
  providerPaidAtIso: "2026-07-13T02:59:00.000Z",
  evidenceKey: null,
  verificationDetails: {
    terminalId: "TID-01",
    traceNumber: "123456",
    batchNumber: "021",
    cardNetwork: "GPN",
    cardLast4: "7788",
  },
};

const normalizedDebit = normalizeAndValidateManualPaymentVerification({
  payment: validDebitEdc,
  organizationId,
  policy: DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card,
  now,
});
assert.equal(normalizedDebit.normalizedReference, "APPROVAL9911");
assert.equal(normalizedDebit.verificationSource, "edc_terminal");
assert.equal(normalizedDebit.details.terminalId, "TID-01");

const validCreditEdc: PosCheckoutPaymentInput = {
  ...validDebitEdc,
  method: "credit_card",
  provider: "Mandiri EDC",
  reference: "APPROVAL-CC-1001",
  verificationDetails: {
    ...validDebitEdc.verificationDetails,
    terminalId: "TID-MANDIRI-01",
    cardNetwork: "VISA",
    cardLast4: "4321",
  },
};

const normalizedCredit = normalizeAndValidateManualPaymentVerification({
  payment: validCreditEdc,
  organizationId,
  policy: DEFAULT_MANUAL_PAYMENT_POLICIES.credit_card,
  now,
});
assert.equal(normalizedCredit.normalizedProvider, "MANDIRI EDC");
assert.equal(normalizedCredit.details.cardLast4, "4321");

expectError(
  () =>
    normalizeAndValidateManualPaymentVerification({
      payment: { ...validDebitEdc, provider: null },
      organizationId,
      policy: DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card,
      now,
    }),
  /Provider\/bank.*wajib/i,
);

expectError(
  () =>
    normalizeAndValidateManualPaymentVerification({
      payment: { ...validDebitEdc, amount: 20_000_000, evidenceKey: null },
      organizationId,
      policy: DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card,
      now,
    }),
  /Bukti pembayaran wajib/i,
);

expectError(
  () =>
    normalizeAndValidateManualPaymentVerification({
      payment: {
        ...validDebitEdc,
        verificationDetails: {
          ...validDebitEdc.verificationDetails,
          terminalId: null,
        },
      },
      organizationId,
      policy: DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card,
      now,
    }),
  /Terminal EDC belum dipilih/i,
);

expectError(
  () =>
    normalizeAndValidateManualPaymentVerification({
      payment: {
        ...validDebitEdc,
        verificationDetails: {
          ...validDebitEdc.verificationDetails,
          cardLast4: "4111111111111111",
        },
      },
      organizationId,
      policy: DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card,
      now,
    }),
  /tepat 4 angka/i,
);

const fingerprintA = createManualPaymentVerificationFingerprint({
  organizationId,
  outletId: "33333333-3333-4333-8333-333333333333",
  cashierId: "44444444-4444-4444-8444-444444444444",
  itemIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  payments: [validDebitEdc, validCreditEdc],
});
const fingerprintB = createManualPaymentVerificationFingerprint({
  organizationId,
  outletId: "33333333-3333-4333-8333-333333333333",
  cashierId: "44444444-4444-4444-8444-444444444444",
  itemIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  payments: [validCreditEdc, validDebitEdc],
});
assert.equal(fingerprintA, fingerprintB);

console.log("P1-A manual EDC payment verification checks passed.");
