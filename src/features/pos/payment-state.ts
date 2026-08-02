import type {
  PosManualPaymentApproval,
  PosManualPaymentMethod,
} from "@/features/pos/contracts";
import {
  formatRupiahInput,
  type PosPaymentDraft,
} from "@/features/pos/payment-draft";

export type RestoreCheckoutPaymentStateInput = {
  payments: PosPaymentDraft[];
  customerDepositUsedAmount: number | null | undefined;
  customerDepositInAmount: number | null | undefined;
  manualPaymentApproval: PosManualPaymentApproval | null;
};

export type RecoveredCheckoutPaymentState = {
  payments: PosPaymentDraft[];
  selectedMethod: PosManualPaymentMethod;
  selectedPaymentProfileId: string;
  paymentVerificationConfirmed: boolean;
  customerDepositUsedInput: string;
  customerDepositInInput: string;
  manualPaymentApproval: PosManualPaymentApproval | null;
};

export function createRecoveredCheckoutPaymentState({
  payments,
  customerDepositUsedAmount,
  customerDepositInAmount,
  manualPaymentApproval,
}: RestoreCheckoutPaymentStateInput): RecoveredCheckoutPaymentState {
  const firstPayment = payments[0];

  return {
    payments,
    selectedMethod: firstPayment?.method ?? "cash",
    selectedPaymentProfileId: firstPayment?.manualPaymentProfileId ?? "",
    paymentVerificationConfirmed:
      firstPayment?.verificationConfirmed ?? false,
    customerDepositUsedInput: formatRupiahInput(
      customerDepositUsedAmount ?? 0,
    ),
    customerDepositInInput: formatRupiahInput(customerDepositInAmount ?? 0),
    manualPaymentApproval,
  };
}
