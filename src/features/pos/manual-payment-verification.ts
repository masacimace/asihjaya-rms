import type { PosManualPaymentMethod } from "@/features/pos/contracts";

export const NON_CASH_MANUAL_PAYMENT_METHODS = [
  "debit_card",
  "bank_transfer",
] as const satisfies readonly PosManualPaymentMethod[];

export type NonCashManualPaymentMethod =
  (typeof NON_CASH_MANUAL_PAYMENT_METHODS)[number];

export function isNonCashManualPaymentMethod(
  method: string,
): method is NonCashManualPaymentMethod {
  return NON_CASH_MANUAL_PAYMENT_METHODS.includes(
    method as NonCashManualPaymentMethod,
  );
}

export function getManualPaymentProfileType(
  method: NonCashManualPaymentMethod,
): "edc" | "bank_account" {
  return method === "bank_transfer" ? "bank_account" : "edc";
}
