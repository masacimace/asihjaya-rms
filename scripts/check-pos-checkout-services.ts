import assert from "node:assert/strict";

import {
  checkoutApprovalRequired,
  checkoutFailure,
  checkoutProcessing,
  checkoutSuccess,
} from "@/features/pos/checkout/action-results";
import {
  allocateLineDiscounts,
  createPosCartFingerprint,
  getDiscountPercent,
} from "@/features/pos/checkout/calculations";
import { CheckoutValidationError } from "@/features/pos/checkout/errors";
import {
  getPaymentProvider,
  isManualPaymentMethod,
} from "@/features/pos/checkout/payment-methods";
import { normalizeCheckoutPayments } from "@/features/pos/checkout/payment-normalization";
import { DEFAULT_MANUAL_PAYMENT_POLICIES } from "@/features/pos/manual-payment-verification";

const firstFingerprint = createPosCartFingerprint({
  outletId: "outlet-1",
  itemIds: ["item-b", "item-a"],
  subtotalAmount: 2_000_000,
  discountAmount: 100_000,
});
const secondFingerprint = createPosCartFingerprint({
  outletId: "outlet-1",
  itemIds: ["item-a", "item-b"],
  subtotalAmount: 2_000_000,
  discountAmount: 100_000,
});

assert.equal(firstFingerprint, secondFingerprint);
assert.equal(getDiscountPercent(100_000, 2_000_000), 5);
assert.equal(getDiscountPercent(100_000, 0), 0);

const allocatedDiscounts = allocateLineDiscounts({
  itemAmounts: [500_000, 750_000, 750_000],
  discountAmount: 100_000,
});
assert.equal(
  allocatedDiscounts.reduce((total, amount) => total + amount, 0),
  100_000,
);
assert.deepEqual(
  allocateLineDiscounts({ itemAmounts: [100, 200], discountAmount: 0 }),
  [0, 0],
);

assert.equal(isManualPaymentMethod("cash"), true);
assert.equal(isManualPaymentMethod("transfer"), false);
assert.equal(getPaymentProvider({ method: "cash", provider: null }), "cash");
assert.equal(
  getPaymentProvider({ method: "debit_card", provider: null }),
  "manual",
);
assert.equal(
  getPaymentProvider({ method: "credit_card", provider: "BCA" }),
  "BCA",
);

const normalizedCash = normalizeCheckoutPayments({
  submittedPayments: [
    {
      method: "cash",
      amount: 900_000,
      receivedAmount: 1_000_000,
      changeAmount: 100_000,
      note: "Tunai",
    },
  ],
  paymentProfilesById: new Map(),
  organizationId: "organization-1",
  policies: structuredClone(DEFAULT_MANUAL_PAYMENT_POLICIES),
  verificationNowIso: "2026-08-02T00:00:00.000Z",
});

assert.deepEqual(normalizedCash, [
  {
    method: "cash",
    amount: 900_000,
    receivedAmount: 1_000_000,
    changeAmount: 100_000,
    provider: null,
    reference: null,
    note: "Tunai",
    verificationSource: null,
    providerPaidAt: null,
    providerPaidAtIso: null,
    evidenceKey: null,
    manualPaymentProfileId: null,
    manualPaymentProfileName: null,
    manualPaymentProfileCode: null,
    manualPaymentProfileRegisterId: null,
    verificationDetails: {},
    normalizedProvider: null,
    normalizedReference: null,
  },
]);

assert.throws(
  () =>
    normalizeCheckoutPayments({
      submittedPayments: [
        {
          method: "cash",
          amount: 900_000,
          receivedAmount: 1_000_000,
          changeAmount: 0,
        },
      ],
      paymentProfilesById: new Map(),
      organizationId: "organization-1",
      policies: structuredClone(DEFAULT_MANUAL_PAYMENT_POLICIES),
      verificationNowIso: "2026-08-02T00:00:00.000Z",
    }),
  (error: unknown) =>
    error instanceof CheckoutValidationError &&
    error.message ===
      "Nominal kembalian cash tidak sesuai dengan uang diterima.",
);

assert.deepEqual(checkoutFailure("Tidak valid", { payments: "Periksa" }), {
  status: "error",
  message: "Tidak valid",
  code: "validation_error",
  fieldErrors: { payments: "Periksa" },
});

const processing = checkoutProcessing("checkout-key", "Masih diproses");
if (processing.status !== "processing") {
  throw new Error(`Expected processing result, received ${processing.status}.`);
}

assert.equal(processing.message, "Masih diproses");
assert.equal(processing.idempotencyKey, "checkout-key");
assert.ok(processing.retryAfterMs > 0);

const success = checkoutSuccess({
  message: "Berhasil",
  sale: {
    id: "sale-1",
    invoiceNumber: "AJ-001",
    totalAmount: "900000",
    receiptCertificateJobId: null,
  },
  recovery: "created",
});
assert.equal(success.status, "success");

const approvalRequired = checkoutApprovalRequired(
  {
    id: "approval-1",
    status: "pending",
    reason: "Perlu verifikasi",
    responseNotes: null,
    createdAtIso: "2026-08-02T00:00:00.000Z",
    resolvedAtIso: null,
  },
  "Menunggu approval",
);
if (approvalRequired.status !== "approval_required") {
  throw new Error(
    `Expected approval_required result, received ${approvalRequired.status}.`,
  );
}

assert.equal(approvalRequired.approval.id, "approval-1");

console.log("POS checkout service boundary checks passed.");
