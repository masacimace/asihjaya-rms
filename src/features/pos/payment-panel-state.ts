import type {
  PosManualPaymentMethod,
  PosManualPaymentProfile,
} from "@/features/pos/contracts";
import {
  getPaymentConfig,
  getProfilesForMethod,
  parsePaymentAmountInput,
} from "@/features/pos/payment-draft";

export type PosPaymentPanelStateInput = {
  totalAmount: number;
  customerDepositUsedAmount: number;
  externalPaymentDueAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentsCount: number;
  customerDepositBalance: number;
  paymentProfiles: PosManualPaymentProfile[];
  selectedMethod: PosManualPaymentMethod;
  selectedProfileId: string;
  amountInput: string;
  isCheckoutPending: boolean;
  isAddingPayment: boolean;
};

export function getPosPaymentPanelState({
  totalAmount,
  customerDepositUsedAmount,
  externalPaymentDueAmount,
  paidAmount,
  remainingAmount,
  paymentsCount,
  customerDepositBalance,
  paymentProfiles,
  selectedMethod,
  selectedProfileId,
  amountInput,
  isCheckoutPending,
  isAddingPayment,
}: PosPaymentPanelStateInput) {
  const selectedConfig = getPaymentConfig(selectedMethod);
  const eligibleProfiles = getProfilesForMethod(
    paymentProfiles,
    selectedMethod,
  );
  const selectedProfile =
    eligibleProfiles.find((profile) => profile.id === selectedProfileId) ??
    null;
  const parsedInputAmount = parsePaymentAmountInput(amountInput);
  const recognizedCashAmount =
    selectedMethod === "cash"
      ? Math.min(Math.max(parsedInputAmount, 0), remainingAmount)
      : parsedInputAmount;
  const cashChangeAmount =
    selectedMethod === "cash"
      ? Math.max(parsedInputAmount - remainingAmount, 0)
      : 0;
  const hasPayments = paymentsCount > 0;
  const paymentProgressPercentage =
    externalPaymentDueAmount > 0
      ? Math.min((paidAmount / externalPaymentDueAmount) * 100, 100)
      : 100;
  const customerDepositUsedIsTooHigh =
    customerDepositUsedAmount > Math.min(totalAmount, customerDepositBalance);
  const customerDepositControlsDisabled =
    isCheckoutPending || isAddingPayment || hasPayments;
  const nonCashAmountIsTooHigh =
    !selectedConfig.allowOverpayment && parsedInputAmount > remainingAmount;

  return {
    selectedConfig,
    eligibleProfiles,
    selectedProfile,
    parsedInputAmount,
    recognizedCashAmount,
    cashChangeAmount,
    hasPayments,
    paymentProgressPercentage,
    customerDepositUsedIsTooHigh,
    customerDepositControlsDisabled,
    nonCashAmountIsTooHigh,
  };
}
