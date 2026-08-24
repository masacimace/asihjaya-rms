"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  completePosCheckoutAction,
  createPosQuickCustomerAction,
  getPosCatalogPageAction,
  holdPosCartAction,
  lookupPosScanValueAction,
  refreshPosCartPricingAction,
} from "@/app/actions/pos";
import type { PosPanelMode } from "@/components/pos/workspace/pos-mobile-side-panel";
import {
  PosWorkspaceView,
  type PosWorkspaceViewProps,
} from "@/components/pos/workspace/pos-workspace-view";
import {
  type PosAvailableItem,
  type PosCartItem,
  type PosCategoryOption,
  type PosCustomerOption,
  type PosInitialData,
  type PosManualPaymentProfile,
  type PosOperationalContext,
} from "@/features/pos/contracts";
import {
  getCheckoutSubmissionValidationMessage,
  type StoredCheckoutAttemptState,
} from "@/features/pos/checkout-client-state";
import {
  getPosCartAddIssue,
  removePosCartItem,
} from "@/features/pos/cart-state";
import { removeStoredPosCartState } from "@/features/pos/cart-storage";
import { getHeldCartAvailability } from "@/features/pos/held-cart-state";
import {
  createPaymentDraftId,
  formatCurrency,
  formatRupiahInput,
  getPaymentConfig,
  getPaymentDraftValidationMessage,
  parsePaymentAmountInput,
  profileSupportsMethod,
} from "@/features/pos/payment-draft";
import { usePosCart } from "@/features/pos/use-pos-cart";
import { usePosCatalog } from "@/features/pos/use-pos-catalog";
import { usePosCartSession } from "@/features/pos/use-pos-cart-session";
import { usePosCheckout } from "@/features/pos/use-pos-checkout";
import { usePosCustomer } from "@/features/pos/use-pos-customer";
import { usePosHeldCart } from "@/features/pos/use-pos-held-cart";
import { usePosPayment } from "@/features/pos/use-pos-payment";
import { usePosScanner } from "@/features/pos/use-pos-scanner";
import { getPosWorkspaceState } from "@/features/pos/workspace-state";
import {
  getPosCartPricingInput,
  getPosCartPricingTotals,
} from "@/features/pos/transaction-pricing";

type PosWorkspaceProps = {
  categories: PosCategoryOption[];
  items: PosAvailableItem[];
  customers: PosCustomerOption[];
  paymentProfiles: PosManualPaymentProfile[];
  catalogPage: PosInitialData["catalogPage"];
  context: PosOperationalContext;
  canManageShifts: boolean;
  canReopenShifts: boolean;
};

export function PosWorkspace({
  categories,
  items,
  customers,
  paymentProfiles,
  catalogPage,
  context,
  canManageShifts,
  canReopenShifts,
}: PosWorkspaceProps) {
  const router = useRouter();
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isCloseShiftPanelOpen, setIsCloseShiftPanelOpen] = useState(false);
  const {
    cartItems,
    setCartItems,
    cartItemIds,
    subtotalAmount,
    discountAmount,
    laborAmount,
    adjustmentAmount,
    totalAmount,
    setCartFeedback,
  } = usePosCart();
  const {
    selectedCustomer,
    customerQuery,
    customerOptions,
    customerSearchResults,
    isCustomerSelectorOpen,
    isQuickCustomerDialogOpen,
    quickCustomerForm,
    quickCustomerResult,
    isQuickCustomerPending,
    restoreCustomer,
    selectCustomerState,
    clearCustomerState,
    changeCustomerQuery,
    openCustomerSelector,
    closeCustomerSelectorAfterDelay,
    openQuickCustomerDialog,
    closeQuickCustomerDialog,
    updateQuickCustomerForm,
    submitQuickCustomer: submitQuickCustomerState,
    useExistingQuickCustomer: useExistingQuickCustomerState,
  } = usePosCustomer({
    customers,
    createQuickCustomer: createPosQuickCustomerAction,
  });
  const {
    searchQuery,
    setSearchQuery,
    isScannerOpen,
    setIsScannerOpen,
    isScanLookupPending,
    lookupScannedItem,
  } = usePosScanner({
    lookupScanValue: lookupPosScanValueAction,
    onItemFound: openItemPricing,
    onFeedback: setCartFeedback,
  });
  const {
    catalogItems,
    hasMore: catalogHasMore,
    isRefreshing: isCatalogRefreshing,
    isLoadingMore: isCatalogLoadingMore,
    catalogError,
    loadMore: loadMoreCatalogItems,
  } = usePosCatalog({
    initialItems: items,
    initialCursor: catalogPage.nextCursor,
    initialHasMore: catalogPage.hasMore,
    searchQuery,
    activeCategoryId,
    loadPage: getPosCatalogPageAction,
  });
  const [panelMode, setPanelMode] = useState<PosPanelMode>("cart");
  const {
    payments,
    setPayments,
    selectedMethod,
    selectedPaymentProfileId,
    paymentAmountInput,
    setPaymentAmountInput,
    customerDepositUsedInput,
    setCustomerDepositUsedInput,
    customerDepositInInput,
    setCustomerDepositInInput,
    paymentNoteInput,
    setPaymentNoteInput,
    paymentFeedback,
    setPaymentFeedback,
    isAddingPayment,
    startAddingPaymentTransition,
    resetCustomerDepositDraft,
    resetPaymentForm,
    resetPaymentState,
    restoreCheckoutPaymentState,
    selectPaymentProfile,
    changePaymentMethod,
  } = usePosPayment({ paymentProfiles });
  const {
    isHoldDialogOpen,
    holdTitleInput,
    setHoldTitleInput,
    holdNoteInput,
    setHoldNoteInput,
    holdFeedback,
    isHoldPending,
    openHoldDialog: openHoldDialogState,
    closeHoldDialog,
    holdCurrentCart: holdCurrentCartState,
  } = usePosHeldCart({ holdCart: holdPosCartAction });
  const [pricingTarget, setPricingTarget] = useState<PosAvailableItem | null>(null);
  const [pricingExistingItem, setPricingExistingItem] = useState<PosCartItem | null>(null);
  const [isPricingRefreshPending, startPricingRefreshTransition] = useTransition();


  const restoreCheckoutAttempt = useCallback(
    (attempt: StoredCheckoutAttemptState) => {
      restoreCheckoutPaymentState({
        payments: attempt.payments,
        customerDepositUsedAmount:
          attempt.payload.customerDepositUsedAmount,
        customerDepositInAmount: attempt.payload.customerDepositInAmount,
      });
      setPanelMode("payment");
      setIsMobileCartOpen(true);
    },
    [restoreCheckoutPaymentState, setIsMobileCartOpen, setPanelMode],
  );

  const handleCheckoutSuccess = useCallback(() => {
    setPaymentFeedback(null);
    setCartFeedback(null);
    resetCustomerDepositDraft();
    setCartItems([]);
    clearCustomerState();
    resetPaymentState();
    setPanelMode("success");
    setIsMobileCartOpen(true);
    router.refresh();
  }, [
    clearCustomerState,
    resetCustomerDepositDraft,
    resetPaymentState,
    router,
    setCartFeedback,
    setCartItems,
    setIsMobileCartOpen,
    setPanelMode,
    setPaymentFeedback,
  ]);

  usePosCartSession({
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
  });

  const {
    checkoutResult,
    isCheckoutPending,
    isCheckoutRecovering,
    clearCheckoutResult,
    invalidateCheckoutAttempt,
    processCheckout,
  } = usePosCheckout({
    completeCheckout: completePosCheckoutAction,
    restoreCheckoutAttempt,
    onCheckoutSuccess: handleCheckoutSuccess,
    setPaymentFeedback,
  });

  const rawCustomerDepositUsedAmount = parsePaymentAmountInput(
    customerDepositUsedInput,
  );
  const rawCustomerDepositInAmount = parsePaymentAmountInput(
    customerDepositInInput,
  );
  const {
    customerDepositUsedAmount,
    customerDepositInAmount,
    externalPaymentDueAmount,
    paidAmount,
    remainingAmount,
    totalChangeAmount,
    canCheckout,
    checkoutDisabledReason,
    canFinalizePayment,
  } = getPosWorkspaceState({
    panelMode,
    itemCount: cartItems.length,
    totalAmount,
    payments,
    rawCustomerDepositUsedAmount,
    rawCustomerDepositInAmount,
    customerDepositBalance:
      selectedCustomer?.customerDepositBalance ?? 0,
    hasSelectedCustomer: Boolean(selectedCustomer),
    hasRegister: Boolean(context.register),
    hasActiveShift: Boolean(context.activeShift),
  });
  const {
    canHoldCart,
    disabledReason: holdCartDisabledReason,
  } = getHeldCartAvailability({
    panelMode,
    itemCount: cartItems.length,
    paymentCount: payments.length,
    hasRegister: Boolean(context.register),
    hasActiveShift: Boolean(context.activeShift),
  });

  function resetPayments() {
    invalidateCheckoutAttempt();
    resetPaymentState();
    clearCheckoutResult();
  }

  function resetPaymentFlow() {
    setPanelMode("cart");
    resetPayments();
    resetCustomerDepositDraft();
  }


  function selectCustomer(customer: PosCustomerOption) {
    selectCustomerState(customer);
    clearCheckoutResult();
    resetPaymentFlow();
    setCartFeedback(
      `Customer ${customer.fullName} dipilih untuk transaksi ini.`,
    );
  }

  function submitQuickCustomer() {
    submitQuickCustomerState((customer, message) => {
      selectCustomer(customer);
      setCartFeedback(message);
    });
  }

  function useExistingQuickCustomer(customer: PosCustomerOption) {
    useExistingQuickCustomerState(customer, selectCustomer);
    setCartFeedback(
      `Customer ${customer.fullName} yang sudah terdaftar dipilih untuk transaksi ini.`,
    );
  }

  function clearSelectedCustomer() {
    const customerName = selectedCustomer?.fullName;

    clearCustomerState();
    clearCheckoutResult();
    resetPaymentFlow();

    if (customerName) {
      setCartFeedback(`Customer ${customerName} dihapus dari transaksi.`);
    }
  }

  function handleCustomerQueryChange(value: string) {
    const customerWasCleared = changeCustomerQuery(value);

    if (!customerWasCleared) {
      return;
    }

    resetPaymentFlow();
  }

  function clearCart() {
    setCartItems([]);
    clearCustomerState();
    clearCheckoutResult();
    resetPaymentFlow();
    setCartFeedback("Keranjang transaksi direset.");
  }

  function openHoldDialog() {
    openHoldDialogState({
      canHoldCart,
      disabledReason: holdCartDisabledReason,
      defaultTitle: selectedCustomer?.fullName ?? "",
      onUnavailable: setCartFeedback,
    });
  }

  function holdCurrentCart() {
    holdCurrentCartState({
      canHoldCart,
      disabledReason: holdCartDisabledReason,
      items: cartItems.map(getPosCartPricingInput),
      customerId: selectedCustomer?.id ?? null,
      onSuccess: (result) => {
        setCartItems([]);
        clearCustomerState();
        clearCheckoutResult();
        resetPaymentFlow();
        removeStoredPosCartState();
        setCartFeedback(result.message);
        router.refresh();
      },
    });
  }

  function openItemPricing(item: PosAvailableItem) {
    const addIssue = getPosCartAddIssue({ item, itemIds: cartItemIds });

    if (addIssue) {
      setCartFeedback(addIssue.message);
      return;
    }

    setPricingExistingItem(null);
    setPricingTarget(item);
    setCartFeedback(null);
  }

  function editItemPricing(item: PosCartItem) {
    setPricingExistingItem(item);
    setPricingTarget(item);
    setCartFeedback(null);
  }

  function closeItemPricing() {
    setPricingTarget(null);
    setPricingExistingItem(null);
  }

  function confirmItemPricing(item: PosCartItem) {
    const isEditing = Boolean(pricingExistingItem);

    setCartItems((currentItems) =>
      isEditing
        ? currentItems.map((currentItem) =>
            currentItem.id === item.id ? item : currentItem,
          )
        : [...currentItems, item],
    );
    closeItemPricing();
    clearCheckoutResult();
    resetPaymentFlow();
    setCartFeedback(
      isEditing
        ? `Item transaksi ${item.sku} diperbarui.`
        : `${item.sku} ditambahkan ke keranjang.`,
    );
  }

  function removeItemFromCart(itemId: string) {
    setCartItems((currentItems) => {
      const result = removePosCartItem(currentItems, itemId);

      if (result.status === "removed") {
        resetPaymentFlow();
        setCartFeedback(`${result.removedItem.sku} dihapus dari keranjang.`);
      }

      return result.items;
    });
  }

  function continueToPayment() {
    if (!canCheckout) {
      setCartFeedback(checkoutDisabledReason);
      return;
    }

    startPricingRefreshTransition(async () => {
      const result = await refreshPosCartPricingAction(
        cartItems.map(getPosCartPricingInput),
      );

      if (result.status === "error") {
        setCartFeedback(result.message);
        return;
      }

      const resultMap = new Map(result.items.map((item) => [item.itemId, item]));
      const nextItems = cartItems.map((item) => {
        const refreshed = resultMap.get(item.id);

        return refreshed
          ? {
              ...item,
              activePricePerGram: refreshed.activePricePerGram,
              transactionWeightGram: refreshed.transactionWeightGram,
              priceSource: refreshed.priceSource,
              pricePerGram: refreshed.pricePerGram,
              basePriceAmount: refreshed.basePriceAmount,
              finalPriceAmount: refreshed.finalPriceAmount,
            }
          : item;
      });
      const nextTotals = getPosCartPricingTotals(nextItems);

      setCartItems(nextItems);

      invalidateCheckoutAttempt();
      resetPaymentState();
      resetCustomerDepositDraft();
      clearCheckoutResult();
      setPanelMode("payment");
      setPaymentFeedback(
        result.changed
          ? "Harga standar berubah dan item yang mengikuti rate global sudah dihitung ulang. Harga khusus transaksi tetap dipertahankan."
          : null,
      );
      setPaymentAmountInput(formatRupiahInput(nextTotals.totalAmount));
      setCartFeedback(null);
    });
  }

  function addPayment() {
    if (!canCheckout) {
      setPaymentFeedback(checkoutDisabledReason);
      return;
    }

    if (remainingAmount <= 0) {
      setPaymentFeedback(
        "Pembayaran sudah lunas. Tidak perlu menambah payment.",
      );
      return;
    }

    const config = getPaymentConfig(selectedMethod);
    const selectedProfile = paymentProfiles.find(
      (profile) =>
        profile.id === selectedPaymentProfileId &&
        profileSupportsMethod(profile, selectedMethod),
    );
    const inputAmount = parsePaymentAmountInput(paymentAmountInput);
    const note = paymentNoteInput.trim();

    if (rawCustomerDepositUsedAmount !== customerDepositUsedAmount) {
      setPaymentFeedback(
        "Dana Titip digunakan tidak boleh melebihi saldo customer atau total belanja.",
      );
      return;
    }

    if (!Number.isSafeInteger(inputAmount) || inputAmount <= 0) {
      setPaymentFeedback("Nominal pembayaran harus lebih dari Rp0.");
      return;
    }

    if (!config.allowOverpayment && inputAmount > remainingAmount) {
      setPaymentFeedback(
        `${config.label} tidak boleh lebih besar dari sisa bayar ${formatCurrency(remainingAmount)}.`,
      );
      return;
    }

    if (selectedMethod !== "cash" && !selectedProfile) {
      setPaymentFeedback(
        selectedMethod === "bank_transfer"
          ? "Pilih rekening Transfer yang sudah dikonfigurasi."
          : "Pilih terminal EDC yang sudah dikonfigurasi.",
      );
      return;
    }

    if (note.length > 160) {
      setPaymentFeedback("Catatan payment maksimal 160 karakter.");
      return;
    }

    startAddingPaymentTransition(async () => {
      const recognizedAmount =
        selectedMethod === "cash"
          ? Math.min(inputAmount, remainingAmount)
          : inputAmount;
      const changeAmount =
        selectedMethod === "cash"
          ? Math.max(inputAmount - remainingAmount, 0)
          : 0;
      const nextRemainingAmount = Math.max(
        remainingAmount - recognizedAmount,
        0,
      );

      invalidateCheckoutAttempt();
      setPayments((currentPayments) => [
        ...currentPayments,
        {
          id: createPaymentDraftId(),
          method: selectedMethod,
          methodLabel: config.label,
          amount: recognizedAmount,
          manualPaymentProfileId:
            selectedMethod === "cash" ? null : (selectedProfile?.id ?? null),
          manualPaymentProfileName:
            selectedMethod === "cash" ? null : (selectedProfile?.name ?? null),
          verificationConfirmed: false,
          receivedAmount: selectedMethod === "cash" ? inputAmount : null,
          changeAmount,
          provider:
            selectedMethod === "cash" ? null : (selectedProfile?.provider ?? null),
          reference: null,
          note: note || null,
          verificationSource: null,
          providerPaidAtIso: null,
          evidenceKey: null,
          evidenceFileName: null,
          verificationDetails:
            selectedMethod === "cash"
              ? {}
              : {
                  terminalId: selectedProfile?.terminalId ?? null,
                  destinationAccount: selectedProfile?.destinationAccount ?? null,
                },
        },
      ]);

      resetPaymentForm(selectedMethod);

      if (nextRemainingAmount > 0) {
        setPaymentAmountInput(formatRupiahInput(nextRemainingAmount));
      }

      setPaymentFeedback(
        changeAmount > 0
          ? `${config.label} ditambahkan. Kembalian ${formatCurrency(changeAmount)}.`
          : `${config.label} ${formatCurrency(recognizedAmount)} ditambahkan.`,
      );
    });
  }

  function removePayment(paymentId: string) {
    invalidateCheckoutAttempt();
    setPayments((currentPayments) =>
      currentPayments.filter((payment) => payment.id !== paymentId),
    );
    setPaymentFeedback("Payment dihapus. Periksa kembali sisa bayar.");
  }

  function finalizePayment() {
    const paymentValidationMessage = getPaymentDraftValidationMessage({
      payments,
      totalAmount: externalPaymentDueAmount,
    });
    const validationMessage = getCheckoutSubmissionValidationMessage({
      rawCustomerDepositUsedAmount,
      customerDepositUsedAmount,
      canFinalizePayment,
      paymentValidationMessage,
    });

    if (validationMessage) {
      setPaymentFeedback(validationMessage);
      return;
    }

    processCheckout({
      items: cartItems,
      payments,
      customerDepositUsedAmount,
      customerDepositInAmount,
      customerId: selectedCustomer?.id ?? null,
    });
  }

  function changeCustomerDepositUsed(value: string) {
    if (payments.length > 0) {
      setPaymentFeedback(
        "Reset daftar pembayaran sebelum mengubah Dana Titip.",
      );
      return;
    }

    invalidateCheckoutAttempt();
    setCustomerDepositUsedInput(value);
    setPaymentAmountInput("");
  }

  function changeCustomerDepositIn(value: string) {
    if (payments.length > 0) {
      setPaymentFeedback(
        "Reset daftar pembayaran sebelum mengubah Dana Titip.",
      );
      return;
    }

    invalidateCheckoutAttempt();
    setCustomerDepositInInput(value);
    setPaymentAmountInput("");
  }

  function startNewTransaction() {
    invalidateCheckoutAttempt();
    clearCheckoutResult();
    setCartFeedback(null);
    setPaymentFeedback(null);
    clearCustomerState();
    resetCustomerDepositDraft();
    setPanelMode("cart");
    setIsMobileCartOpen(false);
  }

  const workspaceViewProps = {
    dialogs: {
      quickCustomer: isQuickCustomerDialogOpen
        ? {
            form: quickCustomerForm,
            result: quickCustomerResult,
            isPending: isQuickCustomerPending,
            onChange: updateQuickCustomerForm,
            onCancel: closeQuickCustomerDialog,
            onSubmit: submitQuickCustomer,
            onUseDuplicate: useExistingQuickCustomer,
          }
        : null,
      itemPricing: pricingTarget
        ? {
            item: pricingTarget,
            existingItem: pricingExistingItem,
            onCancel: closeItemPricing,
            onConfirm: confirmItemPricing,
          }
        : null,
      holdCart: isHoldDialogOpen
        ? {
            cartItems,
            totalAmount,
            selectedCustomer,
            titleInput: holdTitleInput,
            noteInput: holdNoteInput,
            feedback: holdFeedback,
            isPending: isHoldPending,
            onTitleInputChange: setHoldTitleInput,
            onNoteInputChange: setHoldNoteInput,
            onCancel: closeHoldDialog,
            onSubmit: holdCurrentCart,
          }
        : null,
    },
    catalog: {
      categories,
      items: catalogItems,
      cartItemIds,
      activeCategoryId,
      isCategoryPickerOpen,
      searchQuery,
      hasMore: catalogHasMore,
      isRefreshing: isCatalogRefreshing,
      isLoadingMore: isCatalogLoadingMore,
      catalogError,
      onActiveCategoryChange: setActiveCategoryId,
      onCategoryPickerOpenChange: setIsCategoryPickerOpen,
      onSearchQueryChange: setSearchQuery,
      onOpenScanner: () => setIsScannerOpen(true),
      onAddItem: openItemPricing,
      onLoadMore: loadMoreCatalogItems,
    },
    shifts: {
      context,
      canManageShifts,
      canReopenShifts,
      isCloseShiftPanelOpen,
      onToggleCloseShiftPanel: () =>
        setIsCloseShiftPanelOpen((isOpen) => !isOpen),
      onCloseShiftPanel: () => setIsCloseShiftPanelOpen(false),
    },
    sidePanel: {
      isMobileOpen: isMobileCartOpen,
      mode: panelMode,
      itemCount: cartItems.length,
      totalAmount,
      cart: {
        cartItems,
        subtotalAmount,
        discountAmount,
        laborAmount,
        adjustmentAmount,
        totalAmount,
        canCheckout,
        checkoutDisabledReason,
        customers: customerOptions,
        selectedCustomer,
        customerQuery,
        customerSearchResults,
        isCustomerSelectorOpen,
        onCustomerQueryChange: handleCustomerQueryChange,
        onCustomerInputFocus: openCustomerSelector,
        onCustomerInputBlur: closeCustomerSelectorAfterDelay,
        onOpenQuickCustomer: openQuickCustomerDialog,
        onSelectCustomer: selectCustomer,
        onClearCustomer: clearSelectedCustomer,
        onEditItemPricing: editItemPricing,
        onRemoveItem: removeItemFromCart,
        onClearCart: clearCart,
        onContinueToPayment: continueToPayment,
        isPricingRefreshing: isPricingRefreshPending,
        canHoldCart,
        holdCartDisabledReason,
        onOpenHoldDialog: openHoldDialog,
      },
      payment: {
        totalAmount,
        customerDepositUsedAmount,
        customerDepositInAmount,
        externalPaymentDueAmount,
        paidAmount,
        remainingAmount,
        totalChangeAmount,
        payments,
        selectedCustomer,
        customerDepositUsedInput,
        customerDepositInInput,
        paymentProfiles,
              selectedMethod,
        selectedProfileId: selectedPaymentProfileId,
        amountInput: paymentAmountInput,
        noteInput: paymentNoteInput,
        paymentFeedback,
        canFinalizePayment,
        isCheckoutPending: isCheckoutPending || isCheckoutRecovering,
        isAddingPayment,
        onBackToCart: () => setPanelMode("cart"),
        onMethodChange: (method) =>
          changePaymentMethod(method, remainingAmount),
        onProfileChange: selectPaymentProfile,
        onAmountInputChange: setPaymentAmountInput,
        onCustomerDepositUsedInputChange: changeCustomerDepositUsed,
        onCustomerDepositInInputChange: changeCustomerDepositIn,
        onNoteInputChange: setPaymentNoteInput,
        onAddPayment: addPayment,
        onRemovePayment: removePayment,
        onResetPayments: resetPayments,
        onFinalizePayment: finalizePayment,
      },
      success: checkoutResult
        ? {
            sale: checkoutResult,
            onStartNewTransaction: startNewTransaction,
          }
        : null,
      onOpenMobile: () => setIsMobileCartOpen(true),
      onCloseMobile: () => setIsMobileCartOpen(false),
    },
    scanner: {
      isOpen: isScannerOpen,
      isProcessing: isScanLookupPending,
      onClose: () => setIsScannerOpen(false),
      onScan: lookupScannedItem,
    },
  } satisfies PosWorkspaceViewProps;

  return <PosWorkspaceView {...workspaceViewProps} />;
}
