"use client";

import {
  useCallback,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";

import type {
  PosManualPaymentMethod,
  PosManualPaymentProfile,
} from "@/features/pos/contracts";
import {
  createRecoveredCheckoutPaymentState,
  type RestoreCheckoutPaymentStateInput,
} from "@/features/pos/payment-state";
import {
  formatRupiahInput,
  getProfilesForMethod,
  profileSupportsMethod,
  type PosPaymentDraft,
} from "@/features/pos/payment-draft";

type UsePosPaymentOptions = {
  paymentProfiles: PosManualPaymentProfile[];
};

export type UsePosPaymentResult = {
  payments: PosPaymentDraft[];
  setPayments: Dispatch<SetStateAction<PosPaymentDraft[]>>;
  selectedMethod: PosManualPaymentMethod;
  selectedPaymentProfileId: string;
  paymentAmountInput: string;
  setPaymentAmountInput: Dispatch<SetStateAction<string>>;
  customerDepositUsedInput: string;
  setCustomerDepositUsedInput: Dispatch<SetStateAction<string>>;
  customerDepositInInput: string;
  setCustomerDepositInInput: Dispatch<SetStateAction<string>>;
  paymentNoteInput: string;
  setPaymentNoteInput: Dispatch<SetStateAction<string>>;
  paymentFeedback: string | null;
  setPaymentFeedback: Dispatch<SetStateAction<string | null>>;
  isAddingPayment: boolean;
  startAddingPaymentTransition: ReturnType<typeof useTransition>[1];
  resetCustomerDepositDraft: () => void;
  resetPaymentForm: (nextMethod?: PosManualPaymentMethod) => void;
  resetPaymentState: () => void;
  restoreCheckoutPaymentState: (
    input: RestoreCheckoutPaymentStateInput,
  ) => void;
  selectPaymentProfile: (profileId: string) => void;
  changePaymentMethod: (
    method: PosManualPaymentMethod,
    remainingAmount: number,
  ) => void;
};

export function usePosPayment({
  paymentProfiles,
}: UsePosPaymentOptions): UsePosPaymentResult {
  const [payments, setPayments] = useState<PosPaymentDraft[]>([]);
  const [selectedMethod, setSelectedMethod] =
    useState<PosManualPaymentMethod>("cash");
  const [selectedPaymentProfileId, setSelectedPaymentProfileId] = useState("");
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [customerDepositUsedInput, setCustomerDepositUsedInput] = useState("");
  const [customerDepositInInput, setCustomerDepositInInput] = useState("");
  const [paymentNoteInput, setPaymentNoteInput] = useState("");
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);
  const [isAddingPayment, startAddingPaymentTransition] = useTransition();

  const resetCustomerDepositDraft = useCallback(() => {
    setCustomerDepositUsedInput("");
    setCustomerDepositInInput("");
  }, []);

  const resetPaymentForm = useCallback(
    (nextMethod: PosManualPaymentMethod = selectedMethod) => {
      const defaultProfile = getProfilesForMethod(
        paymentProfiles,
        nextMethod,
      )[0];

      setSelectedMethod(nextMethod);
      setSelectedPaymentProfileId(defaultProfile?.id ?? "");
      setPaymentAmountInput("");
      setPaymentNoteInput("");
    },
    [paymentProfiles, selectedMethod],
  );

  const resetPaymentState = useCallback(() => {
    setPayments([]);
    setPaymentFeedback(null);
    resetPaymentForm();
  }, [resetPaymentForm]);

  const restoreCheckoutPaymentState = useCallback(
    (input: RestoreCheckoutPaymentStateInput) => {
      const recoveredState = createRecoveredCheckoutPaymentState(input);

      setPayments(recoveredState.payments);
      setSelectedMethod(recoveredState.selectedMethod);
      setSelectedPaymentProfileId(recoveredState.selectedPaymentProfileId);
      setCustomerDepositUsedInput(recoveredState.customerDepositUsedInput);
      setCustomerDepositInInput(recoveredState.customerDepositInInput);
    },
    [],
  );

  const selectPaymentProfile = useCallback(
    (profileId: string) => {
      const profile = paymentProfiles.find(
        (candidate) =>
          candidate.id === profileId &&
          profileSupportsMethod(candidate, selectedMethod),
      );

      setSelectedPaymentProfileId(profile?.id ?? "");
      setPaymentFeedback(
        profile
          ? `${profile.name} dipilih.`
          : "Pilih akun atau terminal pembayaran yang valid.",
      );
    },
    [paymentProfiles, selectedMethod],
  );

  const changePaymentMethod = useCallback(
    (method: PosManualPaymentMethod, remainingAmount: number) => {
      resetPaymentForm(method);
      setPaymentFeedback(null);

      if (remainingAmount > 0) {
        setPaymentAmountInput(formatRupiahInput(remainingAmount));
      }
    },
    [resetPaymentForm],
  );

  return {
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
  };
}
