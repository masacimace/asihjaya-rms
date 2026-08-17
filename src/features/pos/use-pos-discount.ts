"use client";

import { useState } from "react";

import type {
  PosAvailableItem,
  PosDiscountApproval,
  PosDiscountApprovalActionResult,
  PosDiscountApprovalPayload,
  PosDiscountApprovalStatusResult,
} from "@/features/pos/contracts";
import { parsePaymentAmountInput } from "@/features/pos/payment-draft";
import {
  getPosDiscountAvailability,
  type PosWorkspacePanelMode,
} from "@/features/pos/workspace-state";

type UsePosDiscountInput = {
  cartItems: PosAvailableItem[];
  subtotalAmount: number;
  selectedCustomerId: string | null;
  panelMode: PosWorkspacePanelMode;
  paymentCount: number;
  hasRegister: boolean;
  hasActiveShift: boolean;
  requestDiscountApproval?: (
    payload: PosDiscountApprovalPayload,
  ) => Promise<PosDiscountApprovalActionResult>;
  getDiscountApprovalStatus?: (
    approvalId: string,
  ) => Promise<PosDiscountApprovalStatusResult>;
};

type PosDiscountSideEffects = {
  resetPaymentFlow: () => void;
  refreshWorkspace: () => void;
};

export function usePosDiscount({
  cartItems,
  subtotalAmount,
  panelMode,
  paymentCount,
  hasRegister,
  hasActiveShift,
}: UsePosDiscountInput) {
  const [discountApproval, setDiscountApproval] =
    useState<PosDiscountApproval | null>(null);
  const [discountFeedback, setDiscountFeedback] = useState<string | null>(null);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountAmountInput, setDiscountAmountInput] = useState("");
  const [discountReasonInput, setDiscountReasonInput] = useState("");
  const { canRequestDiscount, discountDisabledReason } =
    getPosDiscountAvailability({
      panelMode,
      itemCount: cartItems.length,
      paymentCount,
      subtotalAmount,
      discountApproval,
      hasRegister,
      hasActiveShift,
    });

  function clearDiscountApproval(
    message: string | undefined,
    resetPaymentFlow: () => void,
  ) {
    setDiscountApproval(null);
    setDiscountAmountInput("");
    setDiscountReasonInput("");
    setDiscountFeedback(message ?? null);
    resetPaymentFlow();
  }

  function openDiscountDialog() {
    if (!canRequestDiscount) {
      setDiscountFeedback(discountDisabledReason);
      return;
    }

    setDiscountAmountInput("");
    setDiscountReasonInput("");
    setDiscountFeedback(null);
    setIsDiscountDialogOpen(true);
  }

  function closeDiscountDialog() {
    setIsDiscountDialogOpen(false);
  }

  function submitDiscountApproval({
    resetPaymentFlow,
  }: PosDiscountSideEffects) {
    if (!canRequestDiscount) {
      setDiscountFeedback(discountDisabledReason);
      return;
    }

    const discountAmount = parsePaymentAmountInput(discountAmountInput);
    const reason = discountReasonInput.trim();

    if (!Number.isSafeInteger(discountAmount) || discountAmount <= 0) {
      setDiscountFeedback("Nominal diskon harus lebih dari Rp0.");
      return;
    }

    if (discountAmount >= subtotalAmount) {
      setDiscountFeedback("Nominal diskon harus lebih kecil dari subtotal transaksi.");
      return;
    }

    setDiscountApproval({
      id: crypto.randomUUID(),
      status: "approved",
      discountAmount,
      reason,
      responseNotes: null,
      createdAtIso: new Date().toISOString(),
      resolvedAtIso: new Date().toISOString(),
    });
    setDiscountFeedback("Diskon diterapkan langsung ke transaksi.");
    setIsDiscountDialogOpen(false);
    resetPaymentFlow();
  }

  function refreshDiscountApprovalStatus() {
    setDiscountFeedback("Diskon langsung aktif dan tidak memerlukan approval.");
  }

  return {
    discountApproval,
    canRequestDiscount,
    discountDisabledReason,
    setDiscountApproval,
    discountFeedback,
    setDiscountFeedback,
    isDiscountDialogOpen,
    discountAmountInput,
    setDiscountAmountInput,
    discountReasonInput,
    setDiscountReasonInput,
    isDiscountPending: false,
    clearDiscountApproval,
    openDiscountDialog,
    closeDiscountDialog,
    submitDiscountApproval,
    refreshDiscountApprovalStatus,
  };
}
