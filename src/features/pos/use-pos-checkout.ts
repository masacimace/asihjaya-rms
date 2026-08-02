"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";

import type {
  PosCheckoutActionResult,
  PosCheckoutPayload,
  PosCheckoutRecoveryStatusResult,
  PosCheckoutSaleResult,
  PosManualPaymentApproval,
  PosManualPaymentApprovalStatusResult,
} from "@/features/pos/contracts";
import {
  applyManualPaymentApprovalToAttempt,
  createCheckoutPayload,
  createStoredCheckoutAttempt,
  fetchCheckoutRecoveryStatus,
  getCheckoutErrorMessage,
  getCheckoutRecoveryDecision,
  getStoredCheckoutAttemptState,
  POS_CHECKOUT_RECOVERY_MAX_POLLS,
  removeStoredCheckoutAttemptState,
  saveStoredCheckoutAttemptState,
  waitForCheckoutRecovery,
  type CheckoutSubmissionInput,
  type StoredCheckoutAttemptState,
} from "@/features/pos/checkout-client-state";

export type UsePosCheckoutOptions = {
  completeCheckout: (
    payload: PosCheckoutPayload,
  ) => Promise<PosCheckoutActionResult>;
  getManualPaymentApprovalStatus: (
    approvalId: string,
  ) => Promise<PosManualPaymentApprovalStatusResult>;
  restoreCheckoutAttempt: (attempt: StoredCheckoutAttemptState) => void;
  onCheckoutSuccess: (sale: PosCheckoutSaleResult) => void;
  setManualPaymentApproval: Dispatch<
    SetStateAction<PosManualPaymentApproval | null>
  >;
  setPaymentFeedback: Dispatch<SetStateAction<string | null>>;
  getRecoveryStatus?: (
    idempotencyKey: string,
  ) => Promise<PosCheckoutRecoveryStatusResult>;
  waitForRecovery?: (delayMs: number) => Promise<void>;
};

export type UsePosCheckoutResult = {
  checkoutResult: PosCheckoutSaleResult | null;
  isCheckoutPending: boolean;
  isCheckoutRecovering: boolean;
  isManualApprovalChecking: boolean;
  clearCheckoutResult: () => void;
  invalidateCheckoutAttempt: () => void;
  recoverCheckoutAttempt: (
    attempt: StoredCheckoutAttemptState,
  ) => Promise<void>;
  processCheckout: (submission: CheckoutSubmissionInput) => void;
  checkManualPaymentApproval: (
    approval: PosManualPaymentApproval | null,
  ) => void;
};

export function usePosCheckout({
  completeCheckout,
  getManualPaymentApprovalStatus,
  restoreCheckoutAttempt,
  onCheckoutSuccess,
  setManualPaymentApproval,
  setPaymentFeedback,
  getRecoveryStatus = fetchCheckoutRecoveryStatus,
  waitForRecovery = waitForCheckoutRecovery,
}: UsePosCheckoutOptions): UsePosCheckoutResult {
  const [checkoutResult, setCheckoutResult] =
    useState<PosCheckoutSaleResult | null>(null);
  const [checkoutAttempt, setCheckoutAttempt] =
    useState<StoredCheckoutAttemptState | null>(null);
  const [isCheckoutRecovering, setIsCheckoutRecovering] = useState(false);
  const [isCheckoutPending, startCheckoutTransition] = useTransition();
  const [isManualApprovalChecking, startManualApprovalTransition] =
    useTransition();
  const checkoutRecoverySequenceRef = useRef(0);
  const restoreCheckoutAttemptRef = useRef(restoreCheckoutAttempt);
  const setPaymentFeedbackRef = useRef(setPaymentFeedback);
  const recoverCheckoutAttemptRef = useRef<
    (attempt: StoredCheckoutAttemptState) => Promise<void>
  >(async () => undefined);

  const clearCheckoutResult = useCallback(() => {
    setCheckoutResult(null);
  }, []);

  const invalidateCheckoutAttempt = useCallback(() => {
    checkoutRecoverySequenceRef.current += 1;
    setCheckoutAttempt(null);
    setIsCheckoutRecovering(false);
    removeStoredCheckoutAttemptState();
  }, []);

  const applyCheckoutSuccess = useCallback(
    (sale: PosCheckoutSaleResult) => {
      invalidateCheckoutAttempt();
      setCheckoutResult(sale);
      onCheckoutSuccess(sale);
    },
    [invalidateCheckoutAttempt, onCheckoutSuccess],
  );

  const recoverCheckoutAttempt = useCallback(
    async (attempt: StoredCheckoutAttemptState) => {
      const recoverySequence = ++checkoutRecoverySequenceRef.current;
      setIsCheckoutRecovering(true);
      setPaymentFeedback(
        "Status transaksi belum diketahui. Sedang memeriksa hasil transaksi...",
      );

      try {
        for (
          let pollIndex = 0;
          pollIndex < POS_CHECKOUT_RECOVERY_MAX_POLLS;
          pollIndex += 1
        ) {
          if (recoverySequence !== checkoutRecoverySequenceRef.current) {
            return;
          }

          const recoveryStatus = await getRecoveryStatus(
            attempt.payload.idempotencyKey,
          );

          if (recoverySequence !== checkoutRecoverySequenceRef.current) {
            return;
          }

          const recoveryDecision = getCheckoutRecoveryDecision(
            recoveryStatus,
            pollIndex,
          );

          if (recoveryDecision.status === "completed") {
            applyCheckoutSuccess(recoveryDecision.sale);
            return;
          }

          if (recoveryDecision.status === "stop") {
            setPaymentFeedback(recoveryDecision.message);
            return;
          }

          await waitForRecovery(recoveryDecision.retryAfterMs);
        }

        setPaymentFeedback(
          "Status transaksi masih belum pasti. Jangan membuat transaksi baru; tekan Proses Pembayaran lagi untuk melakukan pengecekan aman.",
        );
      } catch {
        setPaymentFeedback(
          "Status transaksi belum bisa diperiksa karena koneksi bermasalah. Jangan membuat transaksi baru; coba proses kembali dengan cart yang sama.",
        );
      } finally {
        if (recoverySequence === checkoutRecoverySequenceRef.current) {
          setIsCheckoutRecovering(false);
        }
      }
    },
    [applyCheckoutSuccess, getRecoveryStatus, setPaymentFeedback, waitForRecovery],
  );

  useEffect(() => {
    restoreCheckoutAttemptRef.current = restoreCheckoutAttempt;
  }, [restoreCheckoutAttempt]);

  useEffect(() => {
    setPaymentFeedbackRef.current = setPaymentFeedback;
  }, [setPaymentFeedback]);

  useEffect(() => {
    recoverCheckoutAttemptRef.current = recoverCheckoutAttempt;
  }, [recoverCheckoutAttempt]);

  useEffect(() => {
    const storedAttempt = getStoredCheckoutAttemptState();

    if (!storedAttempt) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCheckoutAttempt(storedAttempt);
      restoreCheckoutAttemptRef.current(storedAttempt);

      if (storedAttempt.manualPaymentApproval) {
        setPaymentFeedbackRef.current(
          "Checkout menunggu verifikasi pembayaran manual. Cek status approval sebelum memproses ulang.",
        );
      } else {
        void recoverCheckoutAttemptRef.current(storedAttempt);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const processCheckout = useCallback(
    (submission: CheckoutSubmissionInput) => {
      const checkoutPayload = createCheckoutPayload({
        submission,
        existingAttempt: checkoutAttempt,
      });
      const nextAttempt = createStoredCheckoutAttempt({
        payload: checkoutPayload,
        payments: submission.payments,
        discountApproval: submission.discountApproval,
        manualPaymentApproval: submission.manualPaymentApproval,
        existingAttempt: checkoutAttempt,
      });

      setCheckoutAttempt(nextAttempt);
      saveStoredCheckoutAttemptState(nextAttempt);
      setPaymentFeedback("Memproses transaksi POS...");

      startCheckoutTransition(async () => {
        try {
          const result = await completeCheckout(checkoutPayload);

          if (result.status === "processing") {
            setPaymentFeedback(result.message);
            await recoverCheckoutAttempt(nextAttempt);
            return;
          }

          if (result.status === "error") {
            if (result.code === "idempotency_conflict") {
              invalidateCheckoutAttempt();
            }

            setPaymentFeedback(getCheckoutErrorMessage(result));
            return;
          }

          if (result.status === "approval_required") {
            const approvalAttempt = applyManualPaymentApprovalToAttempt({
              attempt: nextAttempt,
              approval: result.approval,
            });

            setManualPaymentApproval(result.approval);
            setCheckoutAttempt(approvalAttempt);
            saveStoredCheckoutAttemptState(approvalAttempt);
            setPaymentFeedback(result.message);
            return;
          }

          applyCheckoutSuccess(result.sale);
        } catch {
          await recoverCheckoutAttempt(nextAttempt);
        }
      });
    },
    [
      applyCheckoutSuccess,
      checkoutAttempt,
      completeCheckout,
      invalidateCheckoutAttempt,
      recoverCheckoutAttempt,
      setManualPaymentApproval,
      setPaymentFeedback,
    ],
  );

  const checkManualPaymentApproval = useCallback(
    (approval: PosManualPaymentApproval | null) => {
      if (!approval) {
        setPaymentFeedback("Request verifikasi pembayaran belum tersedia.");
        return;
      }

      startManualApprovalTransition(async () => {
        const result = await getManualPaymentApprovalStatus(approval.id);

        if (result.status !== "found") {
          setPaymentFeedback(result.message);
          return;
        }

        const updatedAttempt = checkoutAttempt
          ? applyManualPaymentApprovalToAttempt({
              attempt: checkoutAttempt,
              approval: result.approval,
            })
          : null;

        setManualPaymentApproval(result.approval);

        if (updatedAttempt) {
          setCheckoutAttempt(updatedAttempt);
          saveStoredCheckoutAttemptState(updatedAttempt);
        }

        setPaymentFeedback(result.message);
      });
    },
    [
      checkoutAttempt,
      getManualPaymentApprovalStatus,
      setManualPaymentApproval,
      setPaymentFeedback,
    ],
  );

  return {
    checkoutResult,
    isCheckoutPending,
    isCheckoutRecovering,
    isManualApprovalChecking,
    clearCheckoutResult,
    invalidateCheckoutAttempt,
    recoverCheckoutAttempt,
    processCheckout,
    checkManualPaymentApproval,
  };
}
