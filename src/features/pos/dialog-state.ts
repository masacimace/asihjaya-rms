import type { PosQuickCustomerActionResult } from "@/features/pos/contracts";
import { parsePaymentAmountInput } from "@/features/pos/payment-draft";

export function getQuickCustomerDialogState(
  result: PosQuickCustomerActionResult | null,
) {
  return {
    fieldErrors: result?.status === "error" ? result.fieldErrors : null,
    duplicateCustomer:
      result?.status === "duplicate" ? result.customer : null,
  };
}

export function getDiscountApprovalDialogState({
  subtotalAmount,
  amountInput,
}: {
  subtotalAmount: number;
  amountInput: string;
}) {
  const parsedDiscountAmount = parsePaymentAmountInput(amountInput);

  return {
    parsedDiscountAmount,
    projectedTotalAmount: Math.max(
      subtotalAmount - parsedDiscountAmount,
      0,
    ),
    discountIsTooHigh:
      parsedDiscountAmount >= subtotalAmount && subtotalAmount > 0,
  };
}
