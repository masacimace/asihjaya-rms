"use client";

import { useState, useTransition } from "react";

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
  requestDiscountApproval: (
    payload: PosDiscountApprovalPayload,
  ) => Promise<PosDiscountApprovalActionResult>;
  getDiscountApprovalStatus: (
    approvalId: string,
  ) => Promise<PosDiscountApprovalStatusResult>;
};

type PosDiscountSideEffects = {
  resetPaymentFlow: () => void;
  refreshWorkspace: () => void;
};

function getDiscountApprovalErrorMessage(
  result: Extract<PosDiscountApprovalActionResult, { status: "error" }>,
) {
  const fieldErrorMessages = Object.values(result.fieldErrors ?? {}).filter(
    Boolean,
  );

  if (fieldErrorMessages.length === 0) {
    return result.message;
  }

  return `${result.message} ${fieldErrorMessages.join(" ")}`;
}

export function usePosDiscount({
  cartItems,
  subtotalAmount,
  selectedCustomerId,
  panelMode,
  paymentCount,
  hasRegister,
  hasActiveShift,
  requestDiscountApproval,
  getDiscountApprovalStatus,
}: UsePosDiscountInput) {
  const [discountApproval, setDiscountApproval] =
    useState<PosDiscountApproval | null>(null);
  const [discountFeedback, setDiscountFeedback] = useState<string | null>(null);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountAmountInput, setDiscountAmountInput] = useState("");
  const [discountReasonInput, setDiscountReasonInput] = useState("");
  const [isDiscountPending, startDiscountTransition] = useTransition();
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
    if (isDiscountPending) {
      return;
    }

    setIsDiscountDialogOpen(false);
  }

  function submitDiscountApproval({
    resetPaymentFlow,
    refreshWorkspace,
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
      setDiscountFeedback(
        "Nominal diskon harus lebih kecil dari subtotal transaksi.",
      );
      return;
    }

    if (reason.length < 5) {
      setDiscountFeedback("Alasan diskon minimal 5 karakter.");
      return;
    }

    setDiscountFeedback("Mengirim request diskon...");

    startDiscountTransition(async () => {
      const result = await requestDiscountApproval({
        itemIds: cartItems.map((item) => item.id),
        discountAmount,
        reason,
        customerId: selectedCustomerId,
      });

      if (result.status === "error") {
        setDiscountFeedback(getDiscountApprovalErrorMessage(result));
        return;
      }

      setDiscountApproval(result.approval);
      setDiscountFeedback(result.message);
      setIsDiscountDialogOpen(false);
      resetPaymentFlow();
      refreshWorkspace();
    });
  }

  function refreshDiscountApprovalStatus({
    resetPaymentFlow,
    refreshWorkspace,
  }: PosDiscountSideEffects) {
    if (!discountApproval) {
      setDiscountFeedback("Belum ada approval diskon yang perlu dicek.");
      return;
    }

    setDiscountFeedback("Mengecek status approval diskon...");

    startDiscountTransition(async () => {
      const result = await getDiscountApprovalStatus(discountApproval.id);

      if (result.status !== "found") {
        setDiscountFeedback(result.message);
        return;
      }

      setDiscountApproval(result.approval);
      setDiscountFeedback(result.message);
      resetPaymentFlow();
      refreshWorkspace();
    });
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
    isDiscountPending,
    clearDiscountApproval,
    openDiscountDialog,
    closeDiscountDialog,
    submitDiscountApproval,
    refreshDiscountApprovalStatus,
  };
}
