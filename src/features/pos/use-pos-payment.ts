"use client";

import {
  useCallback,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";

import type {
  PosManualPaymentApproval,
  PosManualPaymentMethod,
  PosManualPaymentProfile,
  PosManualPaymentVerificationSource,
} from "@/features/pos/contracts";
import {
  createRecoveredCheckoutPaymentState,
  type RestoreCheckoutPaymentStateInput,
} from "@/features/pos/payment-state";
import {
  createPaymentVerificationForm,
  formatRupiahInput,
  getProfilesForMethod,
  profileSupportsMethod,
  type PaymentVerificationFormState,
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
  paymentVerificationConfirmed: boolean;
  setPaymentVerificationConfirmed: Dispatch<SetStateAction<boolean>>;
  paymentAmountInput: string;
  setPaymentAmountInput: Dispatch<SetStateAction<string>>;
  customerDepositUsedInput: string;
  setCustomerDepositUsedInput: Dispatch<SetStateAction<string>>;
  customerDepositInInput: string;
  setCustomerDepositInInput: Dispatch<SetStateAction<string>>;
  paymentProviderInput: string;
  setPaymentProviderInput: Dispatch<SetStateAction<string>>;
  paymentReferenceInput: string;
  setPaymentReferenceInput: Dispatch<SetStateAction<string>>;
  paymentNoteInput: string;
  setPaymentNoteInput: Dispatch<SetStateAction<string>>;
  paymentVerificationForm: PaymentVerificationFormState;
  paymentEvidenceFile: File | null;
  setPaymentEvidenceFile: Dispatch<SetStateAction<File | null>>;
  manualPaymentApproval: PosManualPaymentApproval | null;
  setManualPaymentApproval: Dispatch<
    SetStateAction<PosManualPaymentApproval | null>
  >;
  paymentFeedback: string | null;
  setPaymentFeedback: Dispatch<SetStateAction<string | null>>;
  isAddingPayment: boolean;
  startAddingPaymentTransition: ReturnType<typeof useTransition>[1];
  isManualApprovalChecking: boolean;
  startManualApprovalTransition: ReturnType<typeof useTransition>[1];
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
  updatePaymentVerificationForm: (
    field: keyof PaymentVerificationFormState,
    value: string,
  ) => void;
};

export function usePosPayment({
  paymentProfiles,
}: UsePosPaymentOptions): UsePosPaymentResult {
  const [payments, setPayments] = useState<PosPaymentDraft[]>([]);
  const [selectedMethod, setSelectedMethod] =
    useState<PosManualPaymentMethod>("cash");
  const [selectedPaymentProfileId, setSelectedPaymentProfileId] = useState("");
  const [paymentVerificationConfirmed, setPaymentVerificationConfirmed] =
    useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [customerDepositUsedInput, setCustomerDepositUsedInput] = useState("");
  const [customerDepositInInput, setCustomerDepositInInput] = useState("");
  const [paymentProviderInput, setPaymentProviderInput] = useState("");
  const [paymentReferenceInput, setPaymentReferenceInput] = useState("");
  const [paymentNoteInput, setPaymentNoteInput] = useState("");
  const [paymentVerificationForm, setPaymentVerificationForm] =
    useState<PaymentVerificationFormState>(() =>
      createPaymentVerificationForm("cash"),
    );
  const [paymentEvidenceFile, setPaymentEvidenceFile] = useState<File | null>(
    null,
  );
  const [manualPaymentApproval, setManualPaymentApproval] =
    useState<PosManualPaymentApproval | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);
  const [isAddingPayment, startAddingPaymentTransition] = useTransition();
  const [isManualApprovalChecking, startManualApprovalTransition] =
    useTransition();

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
      setPaymentVerificationConfirmed(false);
      setPaymentAmountInput("");
      setPaymentProviderInput(defaultProfile?.provider ?? "");
      setPaymentReferenceInput("");
      setPaymentNoteInput("");
      setPaymentVerificationForm(
        createPaymentVerificationForm(nextMethod, defaultProfile),
      );
      setPaymentEvidenceFile(null);
    },
    [paymentProfiles, selectedMethod],
  );

  const resetPaymentState = useCallback(() => {
    setPayments([]);
    setManualPaymentApproval(null);
    setPaymentFeedback(null);
    resetPaymentForm();
  }, [resetPaymentForm]);

  const restoreCheckoutPaymentState = useCallback(
    (input: RestoreCheckoutPaymentStateInput) => {
      const recoveredState = createRecoveredCheckoutPaymentState(input);

      setPayments(recoveredState.payments);
      setManualPaymentApproval(recoveredState.manualPaymentApproval);
      setSelectedMethod(recoveredState.selectedMethod);
      setSelectedPaymentProfileId(recoveredState.selectedPaymentProfileId);
      setCustomerDepositUsedInput(recoveredState.customerDepositUsedInput);
      setCustomerDepositInInput(recoveredState.customerDepositInInput);
      setPaymentVerificationConfirmed(
        recoveredState.paymentVerificationConfirmed,
      );
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
      setPaymentProviderInput(profile?.provider ?? "");
      setPaymentVerificationConfirmed(false);
      setPaymentVerificationForm(
        createPaymentVerificationForm(selectedMethod, profile),
      );
      setPaymentEvidenceFile(null);
      setPaymentFeedback(
        profile
          ? `${profile.name} dipilih. Masukkan reference dan konfirmasi pembayaran.`
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

  const updatePaymentVerificationForm = useCallback(
    (field: keyof PaymentVerificationFormState, value: string) => {
      setPaymentVerificationForm((current) => ({
        ...current,
        [field]:
          field === "verificationSource"
            ? (value as PosManualPaymentVerificationSource)
            : value,
      }));
    },
    [],
  );

  return {
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
    isManualApprovalChecking,
    startManualApprovalTransition,
    resetCustomerDepositDraft,
    resetPaymentForm,
    resetPaymentState,
    restoreCheckoutPaymentState,
    selectPaymentProfile,
    changePaymentMethod,
    updatePaymentVerificationForm,
  };
}
