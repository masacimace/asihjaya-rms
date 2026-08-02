import assert from "node:assert/strict";

import { reconcileCheckoutFinancials } from "@/features/pos/checkout-financials";

function expectSuccess(
  input: Parameters<typeof reconcileCheckoutFinancials>[0],
  expected: {
    totalAmount: number;
    totalPaidAmount: number;
    externalPaymentDueAmount: number;
  },
) {
  const result = reconcileCheckoutFinancials(input);

  if (!result.ok) {
    throw new Error(`Expected success, received ${result.code}.`);
  }

  assert.deepEqual(result, { ok: true, ...expected });
}

function expectFailure(
  input: Parameters<typeof reconcileCheckoutFinancials>[0],
  code: Exclude<ReturnType<typeof reconcileCheckoutFinancials>, { ok: true }>["code"],
) {
  const result = reconcileCheckoutFinancials(input);

  if (result.ok) {
    throw new Error("Expected checkout financial reconciliation to fail.");
  }

  assert.equal(result.code, code);
  return result;
}

expectSuccess(
  {
    subtotalAmount: 1_000_000,
    discountAmount: 0,
    customerDepositUsedAmount: 0,
    customerDepositInAmount: 0,
    paymentAmounts: [1_000_000],
  },
  {
    totalAmount: 1_000_000,
    totalPaidAmount: 1_000_000,
    externalPaymentDueAmount: 1_000_000,
  },
);

expectSuccess(
  {
    subtotalAmount: 1_100_000,
    discountAmount: 100_000,
    customerDepositUsedAmount: 0,
    customerDepositInAmount: 0,
    paymentAmounts: [400_000, 600_000],
  },
  {
    totalAmount: 1_000_000,
    totalPaidAmount: 1_000_000,
    externalPaymentDueAmount: 1_000_000,
  },
);

expectSuccess(
  {
    subtotalAmount: 1_000_000,
    discountAmount: 0,
    customerDepositUsedAmount: 250_000,
    customerDepositInAmount: 0,
    paymentAmounts: [750_000],
  },
  {
    totalAmount: 1_000_000,
    totalPaidAmount: 750_000,
    externalPaymentDueAmount: 750_000,
  },
);

expectSuccess(
  {
    subtotalAmount: 1_000_000,
    discountAmount: 0,
    customerDepositUsedAmount: 100_000,
    customerDepositInAmount: 150_000,
    paymentAmounts: [1_050_000],
  },
  {
    totalAmount: 1_000_000,
    totalPaidAmount: 1_050_000,
    externalPaymentDueAmount: 1_050_000,
  },
);

expectSuccess(
  {
    subtotalAmount: 1_000_000,
    discountAmount: 0,
    customerDepositUsedAmount: 1_000_000,
    customerDepositInAmount: 0,
    paymentAmounts: [],
  },
  {
    totalAmount: 1_000_000,
    totalPaidAmount: 0,
    externalPaymentDueAmount: 0,
  },
);

const mismatch = expectFailure(
  {
    subtotalAmount: 1_000_000,
    discountAmount: 0,
    customerDepositUsedAmount: 0,
    customerDepositInAmount: 0,
    paymentAmounts: [999_999],
  },
  "payment_mismatch",
);
assert.equal(mismatch.expectedAmount, 1_000_000);
assert.equal(mismatch.actualAmount, 999_999);

expectFailure(
  {
    subtotalAmount: 1_000_000,
    discountAmount: 0,
    customerDepositUsedAmount: 1_000_001,
    customerDepositInAmount: 0,
    paymentAmounts: [],
  },
  "deposit_exceeds_total",
);

expectFailure(
  {
    subtotalAmount: 1_000_000,
    discountAmount: 1_000_000,
    customerDepositUsedAmount: 0,
    customerDepositInAmount: 0,
    paymentAmounts: [],
  },
  "non_positive_total",
);

expectFailure(
  {
    subtotalAmount: Number.MAX_SAFE_INTEGER,
    discountAmount: 0,
    customerDepositUsedAmount: 0,
    customerDepositInAmount: 1,
    paymentAmounts: [Number.MAX_SAFE_INTEGER],
  },
  "invalid_external_due",
);

expectFailure(
  {
    subtotalAmount: 1_000_000,
    discountAmount: 0,
    customerDepositUsedAmount: 0,
    customerDepositInAmount: 0,
    paymentAmounts: [0],
  },
  "invalid_amount",
);

console.log("POS checkout financial invariant checks passed.");
