import type { PosPaymentDraft } from "@/features/pos/payment-draft";

export type PosWorkspacePanelMode = "cart" | "payment" | "success";

export type PosWorkspaceStateInput = {
  panelMode: PosWorkspacePanelMode;
  itemCount: number;
  totalAmount: number;
  payments: PosPaymentDraft[];
  rawCustomerDepositUsedAmount: number;
  rawCustomerDepositInAmount: number;
  customerDepositBalance: number;
  hasSelectedCustomer: boolean;
  hasRegister: boolean;
  hasActiveShift: boolean;
};

export type PosWorkspaceState = {
  customerDepositUsedAmount: number;
  customerDepositInAmount: number;
  externalPaymentDueAmount: number;
  paidAmount: number;
  remainingAmount: number;
  totalChangeAmount: number;
  canCheckout: boolean;
  checkoutDisabledReason: string;
  canFinalizePayment: boolean;
};

export function getPosWorkspaceState({
  itemCount,
  totalAmount,
  payments,
  rawCustomerDepositUsedAmount,
  rawCustomerDepositInAmount,
  customerDepositBalance,
  hasSelectedCustomer,
  hasRegister,
  hasActiveShift,
}: PosWorkspaceStateInput): PosWorkspaceState {
  const customerDepositUsedAmount = hasSelectedCustomer
    ? Math.min(
        rawCustomerDepositUsedAmount,
        totalAmount,
        customerDepositBalance,
      )
    : 0;
  const customerDepositInAmount = hasSelectedCustomer
    ? rawCustomerDepositInAmount
    : 0;
  const externalPaymentDueAmount = Math.max(
    totalAmount - customerDepositUsedAmount + customerDepositInAmount,
    0,
  );
  const paidAmount = payments.reduce(
    (total, payment) => total + payment.amount,
    0,
  );
  const remainingAmount = Math.max(externalPaymentDueAmount - paidAmount, 0);
  const totalChangeAmount = payments.reduce(
    (total, payment) => total + payment.changeAmount,
    0,
  );
  const canCheckout = itemCount > 0 && totalAmount > 0 && hasRegister && hasActiveShift;
  const checkoutDisabledReason = !itemCount
    ? "Tambahkan minimal satu item sebelum lanjut ke pembayaran."
    : totalAmount <= 0
      ? "Total transaksi belum valid. Periksa pricing setiap item."
      : !hasRegister
        ? "Register aktif belum tersedia untuk outlet ini."
        : !hasActiveShift
          ? "Shift aktif belum dibuka, checkout belum bisa dilanjutkan."
          : "Lanjutkan ke pembayaran.";
  const canFinalizePayment =
    canCheckout &&
    remainingAmount === 0 &&
    (payments.length > 0 || customerDepositUsedAmount > 0) &&
    rawCustomerDepositUsedAmount === customerDepositUsedAmount;

  return {
    customerDepositUsedAmount,
    customerDepositInAmount,
    externalPaymentDueAmount,
    paidAmount,
    remainingAmount,
    totalChangeAmount,
    canCheckout,
    checkoutDisabledReason,
    canFinalizePayment,
  };
}

export function getPosWorkspacePanelContent(
  panelMode: PosWorkspacePanelMode,
  hasCheckoutResult: boolean,
): "cart" | "payment" | "success" {
  if (panelMode === "success" && hasCheckoutResult) {
    return "success";
  }

  return panelMode === "payment" ? "payment" : "cart";
}
