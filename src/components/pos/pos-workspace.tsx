"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import {
  completePosCheckoutAction,
  createPosQuickCustomerAction,
  getPosDiscountApprovalStatusAction,
  getPosManualPaymentApprovalStatusAction,
  holdPosCartAction,
  lookupPosScanValueAction,
  requestPosDiscountApprovalAction,
  uploadPosPaymentEvidenceAction,
} from "@/app/actions/pos";
import { CameraScannerModal } from "@/components/scanner/camera-scanner-modal";
import { PosCartContent } from "@/components/pos/workspace/pos-cart-content";
import { PosCatalogPanel } from "@/components/pos/workspace/pos-catalog-panel";
import { PosCheckoutSuccessContent } from "@/components/pos/workspace/pos-checkout-success-content";
import {
  PosCloseShiftCard,
  PosContextNotice,
  PosOpenShiftCard,
} from "@/components/pos/workspace/pos-shift-controls";
import { PosDiscountApprovalDialog } from "@/components/pos/workspace/pos-discount-approval-dialog";
import { PosHoldCartDialog } from "@/components/pos/workspace/pos-hold-cart-dialog";
import { PosQuickCustomerDialog } from "@/components/pos/workspace/pos-quick-customer-dialog";
import {
  PosMobileSidePanel,
  type PosPanelMode,
} from "@/components/pos/workspace/pos-mobile-side-panel";
import { PosPaymentPanel } from "@/components/pos/workspace/pos-payment-panel";
import {
  type PosAvailableItem,
  type PosCategoryOption,
  type PosCustomerOption,
  type PosDiscountApprovalActionResult,
  type PosManualPaymentPolicy,
  type PosManualPaymentProfile,
  type PosOperationalContext,
} from "@/features/pos/contracts";
import {
  getCheckoutSubmissionValidationMessage,
  type ActiveDiscountApproval,
  type StoredCheckoutAttemptState,
} from "@/features/pos/checkout-client-state";
import {
  getPosCartAddIssue,
  removePosCartItem,
} from "@/features/pos/cart-state";
import {
  getStoredPosCartState,
  removeStoredPosCartState,
  saveStoredPosCartState,
} from "@/features/pos/cart-storage";
import {
  getHeldCartAvailability,
  getPendingHeldCartResumeState,
  removePendingHeldCartResumeState,
} from "@/features/pos/held-cart-state";
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
import { usePosCheckout } from "@/features/pos/use-pos-checkout";
import { usePosCustomer } from "@/features/pos/use-pos-customer";
import { usePosHeldCart } from "@/features/pos/use-pos-held-cart";
import { usePosPayment } from "@/features/pos/use-pos-payment";
import { usePosScanner } from "@/features/pos/use-pos-scanner";

type PosWorkspaceProps = {
  categories: PosCategoryOption[];
  items: PosAvailableItem[];
  customers: PosCustomerOption[];
  paymentProfiles: PosManualPaymentProfile[];
  paymentPolicies: PosManualPaymentPolicy[];
  context: PosOperationalContext;
  canManageShifts: boolean;
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

export function PosWorkspace({
  categories,
  items,
  customers,
  paymentProfiles,
  paymentPolicies,
  context,
  canManageShifts,
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
    onItemFound: addItemToCart,
    onFeedback: setCartFeedback,
  });
  const [panelMode, setPanelMode] = useState<PosPanelMode>("cart");
  const {
    payments,
    setPayments,
    selectedMethod,
    selectedPaymentProfileId,
    paymentVerificationConfirmed,
    setPaymentVerificationConfirmed,
    paymentAmountInput,
    setPaymentAmountInput,
    customerDepositUsedInput,
    setCustomerDepositUsedInput,
    customerDepositInInput,
    setCustomerDepositInInput,
    paymentProviderInput,
    setPaymentProviderInput,
    paymentReferenceInput,
    setPaymentReferenceInput,
    paymentNoteInput,
    setPaymentNoteInput,
    paymentVerificationForm,
    paymentEvidenceFile,
    setPaymentEvidenceFile,
    manualPaymentApproval,
    setManualPaymentApproval,
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
    updatePaymentVerificationForm,
  } = usePosPayment({ paymentProfiles });
  const [discountApproval, setDiscountApproval] =
    useState<ActiveDiscountApproval | null>(null);
  const [discountFeedback, setDiscountFeedback] = useState<string | null>(null);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountAmountInput, setDiscountAmountInput] = useState("");
  const [discountReasonInput, setDiscountReasonInput] = useState("");
  const [isDiscountPending, startDiscountTransition] = useTransition();
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

  const restoreCheckoutAttempt = useCallback(
    (attempt: StoredCheckoutAttemptState) => {
      setDiscountApproval(attempt.discountApproval);
      restoreCheckoutPaymentState({
        payments: attempt.payments,
        customerDepositUsedAmount:
          attempt.payload.customerDepositUsedAmount,
        customerDepositInAmount: attempt.payload.customerDepositInAmount,
        manualPaymentApproval: attempt.manualPaymentApproval,
      });
      setPanelMode("payment");
      setIsMobileCartOpen(true);
    },
    [
      restoreCheckoutPaymentState,
      setDiscountApproval,
      setIsMobileCartOpen,
      setPanelMode,
    ],
  );

  const handleCheckoutSuccess = useCallback(() => {
    setPaymentFeedback(null);
    setCartFeedback(null);
    resetCustomerDepositDraft();
    setCartItems([]);
    clearCustomerState();
    resetPaymentState();
    setDiscountApproval(null);
    setDiscountFeedback(null);
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
    setDiscountApproval,
    setDiscountFeedback,
    setIsMobileCartOpen,
    setPanelMode,
    setPaymentFeedback,
  ]);

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
        setPaymentProviderInput("");
        setPaymentReferenceInput("");
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
    setPaymentAmountInput,
    setPaymentFeedback,
    setPaymentNoteInput,
    setPaymentProviderInput,
    setPaymentReferenceInput,
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

  const {
    checkoutResult,
    isCheckoutPending,
    isCheckoutRecovering,
    isManualApprovalChecking,
    clearCheckoutResult,
    invalidateCheckoutAttempt,
    processCheckout,
    checkManualPaymentApproval: checkManualPaymentApprovalState,
  } = usePosCheckout({
    completeCheckout: completePosCheckoutAction,
    getManualPaymentApprovalStatus:
      getPosManualPaymentApprovalStatusAction,
    restoreCheckoutAttempt,
    onCheckoutSuccess: handleCheckoutSuccess,
    setManualPaymentApproval,
    setPaymentFeedback,
  });

  const approvedDiscountAmount =
    discountApproval?.status === "approved"
      ? discountApproval.discountAmount
      : 0;
  const totalAmount = Math.max(subtotalAmount - approvedDiscountAmount, 0);
  const hasPendingDiscountApproval = discountApproval?.status === "pending";
  const canRequestDiscount =
    panelMode === "cart" &&
    cartItems.length > 0 &&
    payments.length === 0 &&
    subtotalAmount > 0 &&
    !discountApproval &&
    Boolean(context.register) &&
    Boolean(context.activeShift);
  const discountDisabledReason = !cartItems.length
    ? "Tambahkan item sebelum meminta diskon."
    : payments.length > 0
      ? "Diskon harus diajukan sebelum payment ditambahkan."
      : !context.register
        ? "Register aktif belum tersedia untuk outlet ini."
        : !context.activeShift
          ? "Shift aktif belum dibuka, request diskon belum bisa dibuat."
          : discountApproval
            ? "Selesaikan atau reset request diskon yang sedang aktif."
            : "Minta approval diskon manager/owner.";
  const customerDepositBalance = selectedCustomer?.customerDepositBalance ?? 0;
  const rawCustomerDepositUsedAmount = parsePaymentAmountInput(
    customerDepositUsedInput,
  );
  const rawCustomerDepositInAmount = parsePaymentAmountInput(
    customerDepositInInput,
  );
  const customerDepositUsedAmount = selectedCustomer
    ? Math.min(
        rawCustomerDepositUsedAmount,
        totalAmount,
        customerDepositBalance,
      )
    : 0;
  const customerDepositInAmount = selectedCustomer
    ? rawCustomerDepositInAmount
    : 0;
  const externalPaymentDueAmount = Math.max(
    totalAmount - customerDepositUsedAmount + customerDepositInAmount,
    0,
  );
  const paidAmount = useMemo(
    () => payments.reduce((total, payment) => total + payment.amount, 0),
    [payments],
  );
  const remainingAmount = Math.max(externalPaymentDueAmount - paidAmount, 0);
  const totalChangeAmount = useMemo(
    () => payments.reduce((total, payment) => total + payment.changeAmount, 0),
    [payments],
  );
  const canCheckout =
    cartItems.length > 0 &&
    Boolean(context.register) &&
    Boolean(context.activeShift) &&
    !hasPendingDiscountApproval;
  const checkoutDisabledReason = !cartItems.length
    ? "Tambahkan minimal satu item sebelum lanjut ke pembayaran."
    : !context.register
      ? "Register aktif belum tersedia untuk outlet ini."
      : !context.activeShift
        ? "Shift aktif belum dibuka, checkout belum bisa dilanjutkan."
        : hasPendingDiscountApproval
          ? "Request diskon masih pending. Cek status approval atau reset request."
          : "Lanjutkan ke pembayaran manual.";
  const canFinalizePayment =
    canCheckout &&
    remainingAmount === 0 &&
    (payments.length > 0 || customerDepositUsedAmount > 0) &&
    rawCustomerDepositUsedAmount === customerDepositUsedAmount;
  const {
    canHoldCart,
    disabledReason: holdCartDisabledReason,
  } = getHeldCartAvailability({
    panelMode,
    itemCount: cartItems.length,
    paymentCount: payments.length,
    hasDiscountApproval: Boolean(discountApproval),
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

  function clearDiscountApproval(message?: string) {
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

  function requestDiscountApproval() {
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
      const result = await requestPosDiscountApprovalAction({
        itemIds: cartItems.map((item) => item.id),
        discountAmount,
        reason,
        customerId: selectedCustomer?.id ?? null,
      });

      if (result.status === "error") {
        setDiscountFeedback(getDiscountApprovalErrorMessage(result));
        return;
      }

      setDiscountApproval(result.approval);
      setDiscountFeedback(result.message);
      setIsDiscountDialogOpen(false);
      resetPaymentFlow();
      router.refresh();
    });
  }

  function refreshDiscountApprovalStatus() {
    if (!discountApproval) {
      setDiscountFeedback("Belum ada approval diskon yang perlu dicek.");
      return;
    }

    setDiscountFeedback("Mengecek status approval diskon...");

    startDiscountTransition(async () => {
      const result = await getPosDiscountApprovalStatusAction(
        discountApproval.id,
      );

      if (result.status !== "found") {
        setDiscountFeedback(result.message);
        return;
      }

      setDiscountApproval(result.approval);
      setDiscountFeedback(result.message);
      resetPaymentFlow();
      router.refresh();
    });
  }

  function selectCustomer(customer: PosCustomerOption) {
    selectCustomerState(customer);
    clearCheckoutResult();
    resetPaymentFlow();
    if (discountApproval) {
      setDiscountApproval(null);
      setDiscountFeedback(
        "Request diskon direset karena customer transaksi berubah.",
      );
    }
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
    if (discountApproval) {
      setDiscountApproval(null);
      setDiscountFeedback(
        "Request diskon direset karena customer transaksi berubah.",
      );
    }

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
    if (discountApproval) {
      setDiscountApproval(null);
      setDiscountFeedback(
        "Request diskon direset karena customer transaksi berubah.",
      );
    }
  }

  function clearCart() {
    setCartItems([]);
    clearCustomerState();
    clearCheckoutResult();
    resetPaymentFlow();
    if (discountApproval) {
      setDiscountApproval(null);
      setDiscountFeedback(null);
    }
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
      itemIds: cartItems.map((item) => item.id),
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

  function addItemToCart(item: PosAvailableItem) {
    const addIssue = getPosCartAddIssue({ item, itemIds: cartItemIds });

    if (addIssue) {
      setCartFeedback(addIssue.message);
      return;
    }

    setCartItems((currentItems) => [...currentItems, item]);
    clearCheckoutResult();
    resetPaymentFlow();
    if (discountApproval) {
      setDiscountApproval(null);
      setDiscountFeedback("Request diskon direset karena cart berubah.");
    }
    setCartFeedback(`${item.sku} ditambahkan ke keranjang.`);
  }

  function removeItemFromCart(itemId: string) {
    setCartItems((currentItems) => {
      const result = removePosCartItem(currentItems, itemId);

      if (result.status === "removed") {
        resetPaymentFlow();
        if (discountApproval) {
          setDiscountApproval(null);
          setDiscountFeedback("Request diskon direset karena cart berubah.");
        }
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

    setPanelMode("payment");
    setPaymentFeedback(null);
    setPaymentAmountInput(formatRupiahInput(remainingAmount || totalAmount));
    setCartFeedback(null);
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
    const selectedPolicy = paymentPolicies.find(
      (policy) => policy.method === selectedMethod,
    );
    const inputAmount = parsePaymentAmountInput(paymentAmountInput);
    const provider =
      selectedProfile?.provider.trim() ?? paymentProviderInput.trim();
    const reference = paymentReferenceInput.trim();
    const note = paymentNoteInput.trim();

    if (rawCustomerDepositUsedAmount !== customerDepositUsedAmount) {
      setPaymentFeedback(
        "Dana Titip digunakan tidak boleh melebihi saldo customer atau total belanja.",
      );
      return;
    }

    if (!Number.isFinite(inputAmount) || inputAmount <= 0) {
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
        "Pilih akun atau terminal pembayaran yang sudah dikonfigurasi.",
      );
      return;
    }

    if (selectedMethod !== "cash" && !paymentVerificationConfirmed) {
      setPaymentFeedback(
        "Konfirmasi bahwa pembayaran sudah terlihat berhasil di terminal EDC outlet.",
      );
      return;
    }

    if (
      selectedMethod !== "cash" &&
      selectedPolicy &&
      !selectedPolicy.isEnabled
    ) {
      setPaymentFeedback(
        "Metode pembayaran ini sedang dinonaktifkan oleh manager.",
      );
      return;
    }

    if (config.requiresReference && !reference) {
      setPaymentFeedback(
        `${config.referenceLabel ?? "Reference"} wajib diisi.`,
      );
      return;
    }

    if (provider.length > 80) {
      setPaymentFeedback("Provider/bank maksimal 80 karakter.");
      return;
    }

    if (reference.length > 160) {
      setPaymentFeedback("Reference number maksimal 160 karakter.");
      return;
    }

    if (note.length > 160) {
      setPaymentFeedback("Catatan payment maksimal 160 karakter.");
      return;
    }

    if (selectedMethod !== "cash") {
      if (!paymentVerificationForm.providerPaidAtLocal) {
        setPaymentFeedback("Waktu pembayaran dari provider wajib diisi.");
        return;
      }

      if (
        paymentVerificationForm.cardLast4 &&
        !/^\d{4}$/.test(paymentVerificationForm.cardLast4)
      ) {
        setPaymentFeedback("Last 4 kartu harus terdiri dari empat angka.");
        return;
      }

      if (
        selectedPolicy &&
        inputAmount >= selectedPolicy.evidenceThreshold &&
        !paymentEvidenceFile
      ) {
        setPaymentFeedback(
          `Bukti pembayaran wajib untuk nominal minimal ${formatCurrency(selectedPolicy.evidenceThreshold)}.`,
        );
        return;
      }
    }

    startAddingPaymentTransition(async () => {
      let evidenceKey: string | null = null;

      if (selectedMethod !== "cash" && paymentEvidenceFile) {
        setPaymentFeedback("Mengunggah bukti pembayaran...");
        const formData = new FormData();
        formData.set("file", paymentEvidenceFile);
        const uploadResult = await uploadPosPaymentEvidenceAction(formData);

        if (uploadResult.status === "error") {
          setPaymentFeedback(uploadResult.message);
          return;
        }

        evidenceKey = uploadResult.evidenceKey;
      }

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
      const providerPaidAtIso =
        selectedMethod === "cash"
          ? null
          : new Date(paymentVerificationForm.providerPaidAtLocal).toISOString();

      invalidateCheckoutAttempt();
      setManualPaymentApproval(null);
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
          verificationConfirmed:
            selectedMethod === "cash" ? false : paymentVerificationConfirmed,
          receivedAmount: selectedMethod === "cash" ? inputAmount : null,
          changeAmount,
          provider: provider || null,
          reference: reference || null,
          note: note || null,
          verificationSource:
            selectedMethod === "cash"
              ? null
              : paymentVerificationForm.verificationSource,
          providerPaidAtIso,
          evidenceKey,
          evidenceFileName: paymentEvidenceFile?.name ?? null,
          verificationDetails:
            selectedMethod === "cash"
              ? {}
              : {
                  merchantId: paymentVerificationForm.merchantId.trim() || null,
                  terminalId: paymentVerificationForm.terminalId.trim() || null,
                  batchNumber:
                    paymentVerificationForm.batchNumber.trim() || null,
                  traceNumber:
                    paymentVerificationForm.traceNumber.trim() || null,
                  cardNetwork:
                    paymentVerificationForm.cardNetwork.trim() || null,
                  cardLast4: paymentVerificationForm.cardLast4.trim() || null,
                  senderName: paymentVerificationForm.senderName.trim() || null,
                  destinationAccount:
                    paymentVerificationForm.destinationAccount.trim() || null,
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
    setManualPaymentApproval(null);
    setPayments((currentPayments) =>
      currentPayments.filter((payment) => payment.id !== paymentId),
    );
    setPaymentFeedback("Payment dihapus. Periksa kembali sisa bayar.");
  }

  function checkManualPaymentApproval() {
    checkManualPaymentApprovalState(manualPaymentApproval);
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
      itemIds: cartItems.map((item) => item.id),
      payments,
      customerDepositUsedAmount,
      customerDepositInAmount,
      manualPaymentApproval,
      customerId: selectedCustomer?.id ?? null,
      discountApproval,
      approvedDiscountAmount,
    });
  }

  const cartContent = (
    <PosCartContent
      cartItems={cartItems}
      subtotalAmount={subtotalAmount}
      discountAmount={approvedDiscountAmount}
      totalAmount={totalAmount}
      discountApproval={discountApproval}
      isDiscountPending={isDiscountPending}
      discountFeedback={discountFeedback}
      canRequestDiscount={canRequestDiscount}
      discountDisabledReason={discountDisabledReason}
      canCheckout={canCheckout}
      checkoutDisabledReason={checkoutDisabledReason}
      customers={customerOptions}
      selectedCustomer={selectedCustomer}
      customerQuery={customerQuery}
      customerSearchResults={customerSearchResults}
      isCustomerSelectorOpen={isCustomerSelectorOpen}
      onCustomerQueryChange={handleCustomerQueryChange}
      onCustomerInputFocus={openCustomerSelector}
      onCustomerInputBlur={closeCustomerSelectorAfterDelay}
      onOpenQuickCustomer={openQuickCustomerDialog}
      onSelectCustomer={selectCustomer}
      onClearCustomer={clearSelectedCustomer}
      onRemoveItem={removeItemFromCart}
      onClearCart={clearCart}
      onOpenDiscountDialog={openDiscountDialog}
      onRefreshDiscountApproval={refreshDiscountApprovalStatus}
      onClearDiscountApproval={() =>
        clearDiscountApproval("Request diskon direset dari cart.")
      }
      onContinueToPayment={continueToPayment}
      canHoldCart={canHoldCart}
      holdCartDisabledReason={holdCartDisabledReason}
      onOpenHoldDialog={openHoldDialog}
    />
  );

  const paymentContent = (
    <PosPaymentPanel
      totalAmount={totalAmount}
      customerDepositUsedAmount={customerDepositUsedAmount}
      customerDepositInAmount={customerDepositInAmount}
      externalPaymentDueAmount={externalPaymentDueAmount}
      paidAmount={paidAmount}
      remainingAmount={remainingAmount}
      totalChangeAmount={totalChangeAmount}
      payments={payments}
      selectedCustomer={selectedCustomer}
      customerDepositUsedInput={customerDepositUsedInput}
      customerDepositInInput={customerDepositInInput}
      paymentProfiles={paymentProfiles}
      paymentPolicies={paymentPolicies}
      selectedMethod={selectedMethod}
      selectedProfileId={selectedPaymentProfileId}
      verificationConfirmed={paymentVerificationConfirmed}
      amountInput={paymentAmountInput}
      referenceInput={paymentReferenceInput}
      noteInput={paymentNoteInput}
      verificationForm={paymentVerificationForm}
      evidenceFileName={paymentEvidenceFile?.name ?? null}
      manualPaymentApproval={manualPaymentApproval}
      paymentFeedback={paymentFeedback}
      canFinalizePayment={canFinalizePayment}
      isCheckoutPending={isCheckoutPending || isCheckoutRecovering}
      isAddingPayment={isAddingPayment}
      isApprovalChecking={isManualApprovalChecking}
      onBackToCart={() => setPanelMode("cart")}
      onMethodChange={(method) => changePaymentMethod(method, remainingAmount)}
      onProfileChange={selectPaymentProfile}
      onVerificationConfirmedChange={setPaymentVerificationConfirmed}
      onAmountInputChange={setPaymentAmountInput}
      onCustomerDepositUsedInputChange={(value) => {
        if (payments.length > 0) {
          setPaymentFeedback(
            "Reset daftar pembayaran sebelum mengubah Dana Titip.",
          );
          return;
        }

        invalidateCheckoutAttempt();
        setCustomerDepositUsedInput(value);
        setPaymentAmountInput("");
      }}
      onCustomerDepositInInputChange={(value) => {
        if (payments.length > 0) {
          setPaymentFeedback(
            "Reset daftar pembayaran sebelum mengubah Dana Titip.",
          );
          return;
        }

        invalidateCheckoutAttempt();
        setCustomerDepositInInput(value);
        setPaymentAmountInput("");
      }}
      onReferenceInputChange={setPaymentReferenceInput}
      onNoteInputChange={setPaymentNoteInput}
      onVerificationFormChange={updatePaymentVerificationForm}
      onEvidenceFileChange={setPaymentEvidenceFile}
      onCheckManualPaymentApproval={checkManualPaymentApproval}
      onAddPayment={addPayment}
      onRemovePayment={removePayment}
      onResetPayments={resetPayments}
      onFinalizePayment={finalizePayment}
    />
  );

  const successContent = checkoutResult ? (
    <PosCheckoutSuccessContent
      sale={checkoutResult}
      onStartNewTransaction={() => {
        invalidateCheckoutAttempt();
        clearCheckoutResult();
        setCartFeedback(null);
        setPaymentFeedback(null);
        clearCustomerState();
        resetCustomerDepositDraft();
        setPanelMode("cart");
        setIsMobileCartOpen(false);
      }}
    />
  ) : null;

  const sidePanelContent =
    panelMode === "success" && successContent
      ? successContent
      : panelMode === "payment"
        ? paymentContent
        : cartContent;

  return (
    <>
      {isQuickCustomerDialogOpen ? (
        <PosQuickCustomerDialog
          form={quickCustomerForm}
          result={quickCustomerResult}
          isPending={isQuickCustomerPending}
          onChange={updateQuickCustomerForm}
          onCancel={closeQuickCustomerDialog}
          onSubmit={submitQuickCustomer}
          onUseDuplicate={useExistingQuickCustomer}
        />
      ) : null}

      {isDiscountDialogOpen ? (
        <PosDiscountApprovalDialog
          cartItems={cartItems}
          subtotalAmount={subtotalAmount}
          selectedCustomer={selectedCustomer}
          amountInput={discountAmountInput}
          reasonInput={discountReasonInput}
          feedback={discountFeedback}
          isPending={isDiscountPending}
          onAmountInputChange={setDiscountAmountInput}
          onReasonInputChange={setDiscountReasonInput}
          onCancel={closeDiscountDialog}
          onSubmit={requestDiscountApproval}
        />
      ) : null}

      {isHoldDialogOpen ? (
        <PosHoldCartDialog
          cartItems={cartItems}
          totalAmount={totalAmount}
          selectedCustomer={selectedCustomer}
          titleInput={holdTitleInput}
          noteInput={holdNoteInput}
          feedback={holdFeedback}
          isPending={isHoldPending}
          onTitleInputChange={setHoldTitleInput}
          onNoteInputChange={setHoldNoteInput}
          onCancel={closeHoldDialog}
          onSubmit={holdCurrentCart}
        />
      ) : null}

      <div className="lg:grid lg:h-[calc(100vh-7.5rem)] lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
        {/* Katalog */}
        <PosCatalogPanel
          categories={categories}
          items={items}
          cartItemIds={cartItemIds}
          activeCategoryId={activeCategoryId}
          isCategoryPickerOpen={isCategoryPickerOpen}
          searchQuery={searchQuery}
          onActiveCategoryChange={setActiveCategoryId}
          onCategoryPickerOpenChange={setIsCategoryPickerOpen}
          onSearchQueryChange={setSearchQuery}
          onOpenScanner={() => setIsScannerOpen(true)}
          onAddItem={addItemToCart}
        >
          <PosContextNotice
            context={context}
            canManageShifts={canManageShifts}
            isCloseShiftPanelOpen={isCloseShiftPanelOpen}
            onCloseShiftClick={() =>
              setIsCloseShiftPanelOpen((isOpen) => !isOpen)
            }
          />

          {canManageShifts ? <PosOpenShiftCard context={context} /> : null}

          {canManageShifts &&
          isCloseShiftPanelOpen &&
          context.activeShift ? (
            <PosCloseShiftCard
              context={context}
              onCancel={() => setIsCloseShiftPanelOpen(false)}
            />
          ) : null}
        </PosCatalogPanel>

        {/* Cart desktop */}
        <aside className="hidden min-h-0 overflow-y-auto bg-white lg:block">
          {sidePanelContent}
        </aside>
      </div>

      <PosMobileSidePanel
        isOpen={isMobileCartOpen}
        mode={panelMode}
        itemCount={cartItems.length}
        totalAmount={totalAmount}
        onOpen={() => setIsMobileCartOpen(true)}
        onClose={() => setIsMobileCartOpen(false)}
      >
        {sidePanelContent}
      </PosMobileSidePanel>

      <CameraScannerModal
        isOpen={isScannerOpen}
        isProcessing={isScanLookupPending}
        onClose={() => setIsScannerOpen(false)}
        onScan={lookupScannedItem}
      />
    </>
  );
}
