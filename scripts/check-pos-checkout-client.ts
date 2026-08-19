import assert from "node:assert/strict";

import type { PosCartItem, PosCheckoutActionResult } from "@/features/pos/contracts";
import {
  createCheckoutPayload,
  createStoredCheckoutAttempt,
  getCheckoutErrorMessage,
  getCheckoutRecoveryDecision,
  getCheckoutSubmissionValidationMessage,
  parseStoredCheckoutAttemptState,
  POS_CHECKOUT_ATTEMPT_STORAGE_KEY,
  POS_CHECKOUT_RECOVERY_MAX_POLLS,
  type CheckoutSubmissionInput,
} from "@/features/pos/checkout-client-state";
import type { PosPaymentDraft } from "@/features/pos/payment-draft";

const item: PosCartItem = {
  id: "item-1",
  sku: "SKU-001",
  barcode: "899000000001",
  qrValue: null,
  serialNumber: null,
  productId: "product-1",
  productCode: "PRD-001",
  productName: "Cincin Uji",
  categoryId: "category-1",
  categoryName: "Cincin",
  weightGram: "1",
  purityPercent: "30",
  exchangePurityPercent: "35",
  size: null,
  color: "Poles",
  gemstone: null,
  deductionPerGram: "25000",
  sellingAmount: "1010000",
  activePricePerGram: "1010000",
  imageKey: null,
  productImageKey: null,
  outletId: "outlet-1",
  outletCode: "OUT-1",
  outletName: "Outlet Uji",
  pricePerGram: "1010000",
  basePriceAmount: "1010000",
  discountAmount: "5000",
  laborAmount: "35000",
  adjustmentAmount: "10000",
  finalPriceAmount: "1050000",
};

const cashPayment: PosPaymentDraft = {
  id: "payment-1",
  method: "cash",
  methodLabel: "Cash",
  amount: 1_050_000,
  manualPaymentProfileId: null,
  manualPaymentProfileName: null,
  verificationConfirmed: false,
  receivedAmount: 1_100_000,
  changeAmount: 50_000,
  provider: null,
  reference: null,
  note: null,
  verificationSource: null,
  providerPaidAtIso: null,
  evidenceKey: null,
  evidenceFileName: null,
  verificationDetails: {},
};

const submission: CheckoutSubmissionInput = {
  items: [item],
  payments: [cashPayment],
  customerDepositUsedAmount: 0,
  customerDepositInAmount: 0,
  customerId: null,
};

const initialPayload = createCheckoutPayload({ submission, existingAttempt: null });
assert.match(initialPayload.idempotencyKey, /^pos_/);
assert.deepEqual(initialPayload.itemIds, ["item-1"]);
assert.deepEqual(initialPayload.itemPricing, [{
  itemId: "item-1",
  pricePerGram: "1010000",
  discountAmount: 5000,
  laborAmount: 35000,
  adjustmentAmount: 10000,
}]);
assert.equal(initialPayload.discountApprovalId, null);
assert.equal(initialPayload.discountAmount, null);
assert.equal(initialPayload.discountReason, null);

const initialAttempt = createStoredCheckoutAttempt({
  payload: initialPayload,
  payments: submission.payments,
  existingAttempt: null,
  nowIso: "2026-08-19T12:00:00.000Z",
});
assert.equal(initialAttempt.version, 4);
assert.deepEqual(parseStoredCheckoutAttemptState(initialAttempt), initialAttempt);
assert.equal(parseStoredCheckoutAttemptState({ version: 3 }), null);

const retryPayload = createCheckoutPayload({ submission, existingAttempt: initialAttempt });
assert.equal(retryPayload.idempotencyKey, initialPayload.idempotencyKey);

assert.equal(getCheckoutSubmissionValidationMessage({
  rawCustomerDepositUsedAmount: 0,
  customerDepositUsedAmount: 0,
  canFinalizePayment: true,
  paymentValidationMessage: null,
}), null);
assert.equal(getCheckoutRecoveryDecision({ status: "processing", message: "Masih diproses.", retryAfterMs: 2000 }, 0).status, "wait");

const checkoutError: Extract<PosCheckoutActionResult, { status: "error" }> = {
  status: "error",
  message: "Checkout gagal.",
  code: "validation_error",
  fieldErrors: { payments: "Payment belum lunas." },
};
assert.equal(getCheckoutErrorMessage(checkoutError), "Checkout gagal. Payment belum lunas.");
assert.equal(POS_CHECKOUT_ATTEMPT_STORAGE_KEY, "asihjaya:pos-workspace-checkout-attempt");
assert.equal(POS_CHECKOUT_RECOVERY_MAX_POLLS, 12);

console.log("POS checkout per-item pricing client contracts passed.");
