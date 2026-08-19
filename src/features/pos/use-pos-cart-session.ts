"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";

import type {
  PosAvailableItem,
  PosCustomerOption,
} from "@/features/pos/contracts";
import {
  getStoredPosCartState,
  removeStoredPosCartState,
  saveStoredPosCartState,
} from "@/features/pos/cart-storage";
import {
  getPendingHeldCartResumeState,
  removePendingHeldCartResumeState,
} from "@/features/pos/held-cart-state";
import type { PosPaymentDraft } from "@/features/pos/payment-draft";
import type { PosWorkspacePanelMode } from "@/features/pos/workspace-state";

type UsePosCartSessionInput = {
  cartItems: PosAvailableItem[];
  selectedCustomer: PosCustomerOption | null;
  panelMode: PosWorkspacePanelMode;
  setCartItems: Dispatch<SetStateAction<PosAvailableItem[]>>;
  restoreCustomer: (customer: PosCustomerOption | null) => void;
  setPayments: Dispatch<SetStateAction<PosPaymentDraft[]>>;
  setPaymentFeedback: Dispatch<SetStateAction<string | null>>;
  setPaymentAmountInput: Dispatch<SetStateAction<string>>;
  resetCustomerDepositDraft: () => void;
  setPaymentNoteInput: Dispatch<SetStateAction<string>>;
  setPanelMode: Dispatch<SetStateAction<PosWorkspacePanelMode>>;
  setIsMobileCartOpen: Dispatch<SetStateAction<boolean>>;
  setCartFeedback: Dispatch<SetStateAction<string | null>>;
};

export function usePosCartSession({
  cartItems,
  selectedCustomer,
  panelMode,
  setCartItems,
  restoreCustomer,
  setPayments,
  setPaymentFeedback,
  setPaymentAmountInput,
  resetCustomerDepositDraft,
  setPaymentNoteInput,
  setPanelMode,
  setIsMobileCartOpen,
  setCartFeedback,
}: UsePosCartSessionInput) {
  const router = useRouter();

  useEffect(() => {
    const pendingResumeState = getPendingHeldCartResumeState();
    const storedCartState = pendingResumeState ? null : getStoredPosCartState();

    if (!pendingResumeState && !storedCartState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (pendingResumeState) {
        removePendingHeldCartResumeState();
        removeStoredPosCartState();
        setCartItems(pendingResumeState.items);
        restoreCustomer(pendingResumeState.heldCart.customer);
        setPayments([]);
        setPaymentFeedback(null);
        setPaymentAmountInput("");
        resetCustomerDepositDraft();
        setPaymentNoteInput("");
        setPanelMode("cart");
        setIsMobileCartOpen(true);
        setCartFeedback(
          `Hold ${pendingResumeState.heldCart.holdNumber} berhasil dimasukkan kembali ke cart.`,
        );
        router.refresh();
        return;
      }

      if (!storedCartState) {
        return;
      }

      setCartItems(storedCartState.items);
      restoreCustomer(storedCartState.customer);

      if (storedCartState.items.length > 0) {
        setCartFeedback("Cart POS terakhir dipulihkan dari sesi browser ini.");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    resetCustomerDepositDraft,
    restoreCustomer,
    router,
    setCartFeedback,
    setCartItems,
    setIsMobileCartOpen,
    setPanelMode,
    setPaymentAmountInput,
    setPaymentFeedback,
    setPaymentNoteInput,
    setPayments,
  ]);

  useEffect(() => {
    if (panelMode === "success") {
      removeStoredPosCartState();
      return;
    }

    saveStoredPosCartState({
      items: cartItems,
      customer: selectedCustomer,
    });
  }, [cartItems, panelMode, selectedCustomer]);
}
