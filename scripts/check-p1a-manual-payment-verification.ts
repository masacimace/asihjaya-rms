import assert from "node:assert/strict";

import {
  createManualPaymentVerificationFingerprint,
  DEFAULT_MANUAL_PAYMENT_POLICIES,
  normalizeAndValidateManualPaymentVerification,
} from "../src/features/pos/manual-payment-verification";
import type { PosCheckoutPaymentInput } from "../src/features/pos/contracts";

const organizationId = "11111111-1111-4111-8111-111111111111";
const evidenceKey = `organizations/${organizationId}/payment-evidence/22222222-2222-4222-8222-222222222222.webp`;
const now = new Date("2026-07-13T03:00:00.000Z");

function expectError(run: () => unknown, pattern: RegExp) {
  assert.throws(run, pattern);
}

const validQris: PosCheckoutPaymentInput = {
  method: "qris_manual",
  amount: 5_000_000,
  receivedAmount: null,
  changeAmount: 0,
  provider: "BCA QRIS",
  reference: "QR-20260713-001",
  note: null,
  verificationSource: "merchant_app",
  providerPaidAtIso: "2026-07-13T02:58:00.000Z",
  evidenceKey,
  verificationDetails: { merchantId: "MID-ASIHJAYA-01" },
};

const normalizedQris = normalizeAndValidateManualPaymentVerification({
  payment: validQris,
  organizationId,
  policy: DEFAULT_MANUAL_PAYMENT_POLICIES.qris_manual,
  now,
});
assert.equal(normalizedQris.normalizedReference, "QR20260713001");
assert.equal(normalizedQris.verificationSource, "merchant_app");

expectError(
  () =>
    normalizeAndValidateManualPaymentVerification({
      payment: { ...validQris, provider: null },
      organizationId,
      policy: DEFAULT_MANUAL_PAYMENT_POLICIES.qris_manual,
      now,
    }),
  /Provider\/bank.*wajib/i,
);

expectError(
  () =>
    normalizeAndValidateManualPaymentVerification({
      payment: { ...validQris, evidenceKey: null },
      organizationId,
      policy: DEFAULT_MANUAL_PAYMENT_POLICIES.qris_manual,
      now,
    }),
  /Bukti pembayaran wajib/i,
);

const validEdc: PosCheckoutPaymentInput = {
  method: "debit_card",
  amount: 2_000_000,
  receivedAmount: null,
  changeAmount: 0,
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
normalizeAndValidateManualPaymentVerification({
  payment: validEdc,
  organizationId,
  policy: DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card,
  now,
});

expectError(
  () =>
    normalizeAndValidateManualPaymentVerification({
      payment: {
        ...validEdc,
        verificationDetails: {
          ...validEdc.verificationDetails,
          batchNumber: null,
        },
      },
      organizationId,
      policy: DEFAULT_MANUAL_PAYMENT_POLICIES.debit_card,
      now,
    }),
  /batch.*jaringan kartu/i,
);

expectError(
  () =>
    normalizeAndValidateManualPaymentVerification({
      payment: {
        ...validEdc,
        verificationDetails: {
          ...validEdc.verificationDetails,
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
  payments: [validQris, validEdc],
});
const fingerprintB = createManualPaymentVerificationFingerprint({
  organizationId,
  outletId: "33333333-3333-4333-8333-333333333333",
  cashierId: "44444444-4444-4444-8444-444444444444",
  itemIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  payments: [validEdc, validQris],
});
assert.equal(fingerprintA, fingerprintB);

console.log("P1-A manual payment verification checks passed.");
