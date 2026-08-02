import type { PosDiscountApproval } from "@/features/pos/contracts";
import type { PosPaymentDraft } from "@/features/pos/payment-draft";

export type PosWorkspacePanelMode = "cart" | "payment" | "success";

export type PosWorkspaceStateInput = {
  panelMode: PosWorkspacePanelMode;
  itemCount: number;
  subtotalAmount: number;
  payments: PosPaymentDraft[];
  discountApproval: PosDiscountApproval | null;
  rawCustomerDepositUsedAmount: number;
  rawCustomerDepositInAmount: number;
  customerDepositBalance: number;
  hasSelectedCustomer: boolean;
  hasRegister: boolean;
  hasActiveShift: boolean;
};

export type PosDiscountAvailabilityInput = {
  panelMode: PosWorkspacePanelMode;
  itemCount: number;
  paymentCount: number;
  subtotalAmount: number;
  discountApproval: PosDiscountApproval | null;
  hasRegister: boolean;
  hasActiveShift: boolean;
};

export type PosDiscountAvailability = {
  canRequestDiscount: boolean;
  discountDisabledReason: string;
};

export function getPosDiscountAvailability({
  panelMode,
  itemCount,
  paymentCount,
  subtotalAmount,
  discountApproval,
  hasRegister,
  hasActiveShift,
}: PosDiscountAvailabilityInput): PosDiscountAvailability {
  const canRequestDiscount =
    panelMode === "cart" &&
    itemCount > 0 &&
    paymentCount === 0 &&
    subtotalAmount > 0 &&
    !discountApproval &&
    hasRegister &&
    hasActiveShift;
  const discountDisabledReason = !itemCount
    ? "Tambahkan item sebelum meminta diskon."
    : paymentCount > 0
      ? "Diskon harus diajukan sebelum payment ditambahkan."
      : !hasRegister
        ? "Register aktif belum tersedia untuk outlet ini."
        : !hasActiveShift
          ? "Shift aktif belum dibuka, request diskon belum bisa dibuat."
          : discountApproval
            ? "Selesaikan atau reset request diskon yang sedang aktif."
            : "Minta approval diskon manager/owner.";

  return { canRequestDiscount, discountDisabledReason };
}

export type PosWorkspaceState = {
  approvedDiscountAmount: number;
  totalAmount: number;
  hasPendingDiscountApproval: boolean;
  canRequestDiscount: boolean;
  discountDisabledReason: string;
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
  panelMode,
  itemCount,
  subtotalAmount,
  payments,
  discountApproval,
  rawCustomerDepositUsedAmount,
  rawCustomerDepositInAmount,
  customerDepositBalance,
  hasSelectedCustomer,
  hasRegister,
  hasActiveShift,
}: PosWorkspaceStateInput): PosWorkspaceState {
  const approvedDiscountAmount =
    discountApproval?.status === "approved"
      ? discountApproval.discountAmount
      : 0;
  const totalAmount = Math.max(subtotalAmount - approvedDiscountAmount, 0);
  const hasPendingDiscountApproval = discountApproval?.status === "pending";
  const { canRequestDiscount, discountDisabledReason } =
    getPosDiscountAvailability({
      panelMode,
      itemCount,
      paymentCount: payments.length,
      subtotalAmount,
      discountApproval,
      hasRegister,
      hasActiveShift,
    });
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
  const canCheckout =
    itemCount > 0 && hasRegister && hasActiveShift && !hasPendingDiscountApproval;
  const checkoutDisabledReason = !itemCount
    ? "Tambahkan minimal satu item sebelum lanjut ke pembayaran."
    : !hasRegister
      ? "Register aktif belum tersedia untuk outlet ini."
      : !hasActiveShift
        ? "Shift aktif belum dibuka, checkout belum bisa dilanjutkan."
        : hasPendingDiscountApproval
          ? "Request diskon masih pending. Cek status approval atau reset request."
          : "Lanjutkan ke pembayaran manual.";
  const canFinalizePayment =
    canCheckout &&
    remainingAmount === 0 &&
    (payments.length > 0 || customerDepositUsedAmount > 0) &&
    rawCustomerDepositUsedAmount === customerDepositUsedAmount;

  return {
    approvedDiscountAmount,
    totalAmount,
    hasPendingDiscountApproval,
    canRequestDiscount,
    discountDisabledReason,
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
