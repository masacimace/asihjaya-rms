export type CheckoutFinancialInvariantCode =
  | "invalid_amount"
  | "non_positive_total"
  | "deposit_exceeds_total"
  | "invalid_external_due"
  | "payment_mismatch";

export type CheckoutFinancialReconciliation =
  | {
      ok: true;
      totalAmount: number;
      totalPaidAmount: number;
      externalPaymentDueAmount: number;
    }
  | {
      ok: false;
      code: CheckoutFinancialInvariantCode;
      expectedAmount?: number;
      actualAmount?: number;
    };

export type ReconcileCheckoutFinancialsInput = {
  subtotalAmount: number;
  discountAmount: number;
  additionalFeeAmount: number;
  customerDepositUsedAmount: number;
  customerDepositInAmount: number;
  paymentAmounts: readonly number[];
};

function isNonNegativeSafeInteger(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Reconciles the money-moving parts of a POS checkout without touching the
 * database. The checkout action uses this result before any sale/payment
 * writes, while the contract check exercises the same invariant directly.
 */
export function reconcileCheckoutFinancials({
  subtotalAmount,
  discountAmount,
  additionalFeeAmount,
  customerDepositUsedAmount,
  customerDepositInAmount,
  paymentAmounts,
}: ReconcileCheckoutFinancialsInput): CheckoutFinancialReconciliation {
  if (
    !isNonNegativeSafeInteger(subtotalAmount) ||
    !isNonNegativeSafeInteger(discountAmount) ||
    !isNonNegativeSafeInteger(additionalFeeAmount) ||
    !isNonNegativeSafeInteger(customerDepositUsedAmount) ||
    !isNonNegativeSafeInteger(customerDepositInAmount) ||
    paymentAmounts.some(
      (amount) => !Number.isSafeInteger(amount) || amount <= 0,
    )
  ) {
    return { ok: false, code: "invalid_amount" };
  }

  const totalAmount = subtotalAmount - discountAmount + additionalFeeAmount;

  if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
    return { ok: false, code: "non_positive_total" };
  }

  if (customerDepositUsedAmount > totalAmount) {
    return { ok: false, code: "deposit_exceeds_total" };
  }

  const externalPaymentDueAmount =
    totalAmount - customerDepositUsedAmount + customerDepositInAmount;

  if (
    !Number.isSafeInteger(externalPaymentDueAmount) ||
    externalPaymentDueAmount < 0
  ) {
    return { ok: false, code: "invalid_external_due" };
  }

  let totalPaidAmount = 0;

  for (const amount of paymentAmounts) {
    totalPaidAmount += amount;

    if (!Number.isSafeInteger(totalPaidAmount)) {
      return { ok: false, code: "invalid_amount" };
    }
  }

  if (totalPaidAmount !== externalPaymentDueAmount) {
    return {
      ok: false,
      code: "payment_mismatch",
      expectedAmount: externalPaymentDueAmount,
      actualAmount: totalPaidAmount,
    };
  }

  return {
    ok: true,
    totalAmount,
    totalPaidAmount,
    externalPaymentDueAmount,
  };
}
