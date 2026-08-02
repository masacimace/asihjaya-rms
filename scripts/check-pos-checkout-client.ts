import assert from "node:assert/strict";

import type {
  PosCheckoutActionResult,
  PosManualPaymentApproval,
} from "@/features/pos/contracts";
import {
  applyManualPaymentApprovalToAttempt,
  createCheckoutPayload,
  createStoredCheckoutAttempt,
  getCheckoutErrorMessage,
  getCheckoutRecoveryDecision,
  getCheckoutSubmissionValidationMessage,
  parseStoredCheckoutAttemptState,
  POS_CHECKOUT_ATTEMPT_STORAGE_KEY,
  POS_CHECKOUT_RECOVERY_MAX_POLLS,
  type ActiveDiscountApproval,
  type CheckoutSubmissionInput,
} from "@/features/pos/checkout-client-state";
import type { PosPaymentDraft } from "@/features/pos/payment-draft";

const cashPayment: PosPaymentDraft = {
  id: "payment-1",
  method: "cash",
  methodLabel: "Cash",
  amount: 2_400_000,
  manualPaymentProfileId: null,
  manualPaymentProfileName: null,
  verificationConfirmed: false,
  receivedAmount: 2_500_000,
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

const discountApproval: ActiveDiscountApproval = {
  id: "discount-1",
  status: "approved",
  discountAmount: 100_000,
  reason: "Promo pelanggan",
  responseNotes: "Disetujui",
  createdAtIso: "2026-08-02T07:00:00.000Z",
  resolvedAtIso: "2026-08-02T07:05:00.000Z",
};

const submission: CheckoutSubmissionInput = {
  itemIds: ["item-1"],
  payments: [cashPayment],
  customerDepositUsedAmount: 50_000,
  customerDepositInAmount: 25_000,
  manualPaymentApproval: null,
  customerId: "customer-1",
  discountApproval,
  approvedDiscountAmount: 100_000,
};

const initialPayload = createCheckoutPayload({
  submission,
  existingAttempt: null,
});
assert.match(initialPayload.idempotencyKey, /^pos_/);
assert.deepEqual(initialPayload.itemIds, ["item-1"]);
assert.deepEqual(initialPayload.payments, [
  {
    method: "cash",
    amount: 2_400_000,
    manualPaymentProfileId: null,
    verificationConfirmed: false,
    receivedAmount: 2_500_000,
    changeAmount: 100_000,
    provider: null,
    reference: null,
    note: null,
    verificationSource: null,
    providerPaidAtIso: null,
    evidenceKey: null,
    verificationDetails: {},
  },
]);
assert.equal(initialPayload.customerDepositUsedAmount, 50_000);
assert.equal(initialPayload.customerDepositInAmount, 25_000);
assert.equal(initialPayload.discountApprovalId, "discount-1");
assert.equal(initialPayload.discountAmount, 100_000);
assert.equal(initialPayload.discountReason, "Promo pelanggan");

const initialAttempt = createStoredCheckoutAttempt({
  payload: initialPayload,
  payments: submission.payments,
  discountApproval,
  manualPaymentApproval: null,
  existingAttempt: null,
  nowIso: "2026-08-02T07:10:00.000Z",
});
assert.equal(initialAttempt.createdAt, "2026-08-02T07:10:00.000Z");
assert.equal(initialAttempt.updatedAt, "2026-08-02T07:10:00.000Z");

const retryPayload = createCheckoutPayload({
  submission,
  existingAttempt: initialAttempt,
});
assert.equal(retryPayload.idempotencyKey, initialPayload.idempotencyKey);

const retryAttempt = createStoredCheckoutAttempt({
  payload: retryPayload,
  payments: submission.payments,
  discountApproval,
  manualPaymentApproval: null,
  existingAttempt: initialAttempt,
  nowIso: "2026-08-02T07:15:00.000Z",
});
assert.equal(retryAttempt.createdAt, initialAttempt.createdAt);
assert.equal(retryAttempt.updatedAt, "2026-08-02T07:15:00.000Z");

const manualApproval: PosManualPaymentApproval = {
  id: "approval-1",
  status: "pending",
  reason: "Reference pembayaran perlu diverifikasi",
  responseNotes: null,
  createdAtIso: "2026-08-02T07:16:00.000Z",
  resolvedAtIso: null,
};
const approvalAttempt = applyManualPaymentApprovalToAttempt({
  attempt: retryAttempt,
  approval: manualApproval,
  nowIso: "2026-08-02T07:17:00.000Z",
});
assert.equal(approvalAttempt.payload.manualPaymentApprovalId, "approval-1");
assert.equal(approvalAttempt.manualPaymentApproval?.id, "approval-1");
assert.equal(approvalAttempt.createdAt, initialAttempt.createdAt);
assert.equal(approvalAttempt.updatedAt, "2026-08-02T07:17:00.000Z");

assert.deepEqual(
  parseStoredCheckoutAttemptState(
    approvalAttempt,
    "2026-08-02T08:00:00.000Z",
  ),
  approvalAttempt,
);
assert.equal(parseStoredCheckoutAttemptState({ version: 1 }), null);
assert.equal(
  parseStoredCheckoutAttemptState({
    ...approvalAttempt,
    payments: [{ id: "invalid" }],
  }),
  null,
);
assert.equal(
  parseStoredCheckoutAttemptState(
    {
      ...approvalAttempt,
      createdAt: null,
      updatedAt: null,
    },
    "2026-08-02T08:00:00.000Z",
  )?.createdAt,
  "2026-08-02T08:00:00.000Z",
);

assert.equal(
  getCheckoutSubmissionValidationMessage({
    rawCustomerDepositUsedAmount: 60_000,
    customerDepositUsedAmount: 50_000,
    canFinalizePayment: true,
    paymentValidationMessage: null,
  }),
  "Dana Titip digunakan tidak boleh melebihi saldo customer atau total belanja.",
);
assert.equal(
  getCheckoutSubmissionValidationMessage({
    rawCustomerDepositUsedAmount: 50_000,
    customerDepositUsedAmount: 50_000,
    canFinalizePayment: false,
    paymentValidationMessage: null,
  }),
  "Payment belum lunas atau transaksi belum siap diproses.",
);
assert.equal(
  getCheckoutSubmissionValidationMessage({
    rawCustomerDepositUsedAmount: 50_000,
    customerDepositUsedAmount: 50_000,
    canFinalizePayment: false,
    paymentValidationMessage: "Payment cash tidak valid.",
  }),
  "Payment cash tidak valid.",
);
assert.equal(
  getCheckoutSubmissionValidationMessage({
    rawCustomerDepositUsedAmount: 50_000,
    customerDepositUsedAmount: 50_000,
    canFinalizePayment: true,
    paymentValidationMessage: null,
  }),
  null,
);

const completedSale = {
  id: "sale-1",
  invoiceNumber: "INV-001",
  totalAmount: "2400000",
};
assert.deepEqual(
  getCheckoutRecoveryDecision(
    {
      status: "completed",
      message: "Transaksi selesai.",
      sale: completedSale,
    },
    0,
  ),
  {
    status: "completed",
    sale: completedSale,
  },
);
assert.deepEqual(
  getCheckoutRecoveryDecision(
    {
      status: "processing",
      message: "Masih diproses.",
      retryAfterMs: 2_000,
    },
    0,
  ),
  {
    status: "wait",
    retryAfterMs: 2_000,
  },
);
assert.deepEqual(
  getCheckoutRecoveryDecision(
    {
      status: "approval_required",
      message: "Approval diperlukan.",
      approval: manualApproval,
    },
    0,
  ),
  {
    status: "wait",
    retryAfterMs: 1_500,
  },
);
assert.equal(
  getCheckoutRecoveryDecision(
    {
      status: "failed",
      message: "Transaksi gagal.",
      errorCode: "payment_failed",
      retryable: true,
    },
    0,
  ).status,
  "stop",
);
assert.deepEqual(
  getCheckoutRecoveryDecision(
    {
      status: "not_found",
      message: "Belum ditemukan.",
    },
    1,
  ),
  {
    status: "wait",
    retryAfterMs: 1_500,
  },
);
assert.equal(
  getCheckoutRecoveryDecision(
    {
      status: "not_found",
      message: "Belum ditemukan.",
    },
    2,
  ).status,
  "stop",
);

const checkoutError: Extract<
  PosCheckoutActionResult,
  { status: "error" }
> = {
  status: "error",
  message: "Checkout gagal.",
  code: "validation_error",
  fieldErrors: {
    payments: "Payment belum lunas.",
    customerId: "Customer tidak valid.",
  },
};
assert.equal(
  getCheckoutErrorMessage(checkoutError),
  "Checkout gagal. Payment belum lunas. Customer tidak valid.",
);
assert.equal(
  getCheckoutErrorMessage({
    ...checkoutError,
    message: "Checkout gagal. Payment belum lunas. Customer tidak valid.",
  }),
  "Checkout gagal. Payment belum lunas. Customer tidak valid.",
);

assert.equal(
  POS_CHECKOUT_ATTEMPT_STORAGE_KEY,
  "asihjaya:pos-workspace-checkout-attempt",
);
assert.equal(POS_CHECKOUT_RECOVERY_MAX_POLLS, 12);

console.log("POS checkout client orchestration contracts passed.");
