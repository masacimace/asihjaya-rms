import type { PosManualPaymentMethod } from "@/features/pos/contracts";
import {
  formatRupiahInput,
  type PosPaymentDraft,
} from "@/features/pos/payment-draft";

export type RestoreCheckoutPaymentStateInput = {
  payments: PosPaymentDraft[];
  customerDepositUsedAmount: number | null | undefined;
  customerDepositInAmount: number | null | undefined;
};

export type RecoveredCheckoutPaymentState = {
  payments: PosPaymentDraft[];
  selectedMethod: PosManualPaymentMethod;
  selectedPaymentProfileId: string;
  customerDepositUsedInput: string;
  customerDepositInInput: string;
};

export function createRecoveredCheckoutPaymentState({
  payments,
  customerDepositUsedAmount,
  customerDepositInAmount,
}: RestoreCheckoutPaymentStateInput): RecoveredCheckoutPaymentState {
  const firstPayment = payments[0];

  return {
    payments,
    selectedMethod: firstPayment?.method ?? "cash",
    selectedPaymentProfileId: firstPayment?.manualPaymentProfileId ?? "",
    customerDepositUsedInput: formatRupiahInput(
      customerDepositUsedAmount ?? 0,
    ),
    customerDepositInInput: formatRupiahInput(customerDepositInAmount ?? 0),
  };
}
