import assert from "node:assert/strict";
import { reconcileCheckoutFinancials } from "@/features/pos/checkout-financials";

function expectSuccess(
  input: Parameters<typeof reconcileCheckoutFinancials>[0],
  expected: { totalAmount: number; totalPaidAmount: number; externalPaymentDueAmount: number },
) {
  const result = reconcileCheckoutFinancials(input);
  if (!result.ok) throw new Error(`Expected success, received ${result.code}.`);
  assert.deepEqual(result, { ok: true, ...expected });
}

function expectFailure(
  input: Parameters<typeof reconcileCheckoutFinancials>[0],
  code: Exclude<ReturnType<typeof reconcileCheckoutFinancials>, { ok: true }>["code"],
) {
  const result = reconcileCheckoutFinancials(input);
  if (result.ok) throw new Error("Expected checkout financial reconciliation to fail.");
  assert.equal(result.code, code);
  return result;
}

expectSuccess(
  { subtotalAmount: 1_010_000, discountAmount: 5_000, additionalFeeAmount: 45_000, customerDepositUsedAmount: 0, customerDepositInAmount: 0, paymentAmounts: [1_050_000] },
  { totalAmount: 1_050_000, totalPaidAmount: 1_050_000, externalPaymentDueAmount: 1_050_000 },
);
expectSuccess(
  { subtotalAmount: 1_000_000, discountAmount: 0, additionalFeeAmount: 0, customerDepositUsedAmount: 250_000, customerDepositInAmount: 0, paymentAmounts: [750_000] },
  { totalAmount: 1_000_000, totalPaidAmount: 750_000, externalPaymentDueAmount: 750_000 },
);
const mismatch = expectFailure(
  { subtotalAmount: 1_000_000, discountAmount: 0, additionalFeeAmount: 0, customerDepositUsedAmount: 0, customerDepositInAmount: 0, paymentAmounts: [999_999] },
  "payment_mismatch",
);
assert.equal(mismatch.expectedAmount, 1_000_000);
expectFailure(
  { subtotalAmount: 1_000_000, discountAmount: 1_000_000, additionalFeeAmount: 0, customerDepositUsedAmount: 0, customerDepositInAmount: 0, paymentAmounts: [] },
  "non_positive_total",
);
expectFailure(
  { subtotalAmount: 1_000_000, discountAmount: 0, additionalFeeAmount: -1, customerDepositUsedAmount: 0, customerDepositInAmount: 0, paymentAmounts: [1_000_000] },
  "invalid_amount",
);

console.log("POS checkout financial invariant checks passed.");
