import type {
  PosCartItem,
  PosCheckoutActionResult,
  PosCheckoutPayload,
  PosCheckoutRecoveryStatusResult,
} from "@/features/pos/contracts";
import {
  createCheckoutIdempotencyKey,
  isStoredCheckoutPayment,
  type PosPaymentDraft,
} from "@/features/pos/payment-draft";
import { getPosCartPricingInput } from "@/features/pos/transaction-pricing";

export type StoredCheckoutAttemptState = {
  version: 4;
  payload: PosCheckoutPayload;
  payments: PosPaymentDraft[];
  createdAt: string;
  updatedAt: string;
};

export type CheckoutSubmissionInput = {
  items: PosCartItem[];
  payments: PosPaymentDraft[];
  customerDepositUsedAmount: number;
  customerDepositInAmount: number;
  customerId: string | null;
};

export const POS_CHECKOUT_ATTEMPT_STORAGE_KEY =
  "asihjaya:pos-workspace-checkout-attempt";
export const POS_CHECKOUT_RECOVERY_MAX_POLLS = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isStoredCheckoutPayload(value: unknown): value is PosCheckoutPayload {
  if (
    !isRecord(value) ||
    !Array.isArray(value.itemIds) ||
    !Array.isArray(value.itemPricing) ||
    !Array.isArray(value.payments)
  ) {
    return false;
  }

  return (
    value.itemIds.every((itemId) => typeof itemId === "string") &&
    value.itemPricing.every(
      (item) =>
        isRecord(item) &&
        typeof item.itemId === "string" &&
        (item.priceSource === undefined ||
          item.priceSource === "global" ||
          item.priceSource === "manual_override") &&
        typeof item.pricePerGram === "string" &&
        typeof item.discountAmount === "number" &&
        typeof item.laborAmount === "number" &&
        typeof item.adjustmentAmount === "number",
    ) &&
    value.payments.every(
      (payment) =>
        isRecord(payment) &&
        typeof payment.method === "string" &&
        typeof payment.amount === "number",
    ) &&
    typeof value.idempotencyKey === "string" &&
    value.idempotencyKey.startsWith("pos_")
  );
}

export function parseStoredCheckoutAttemptState(
  value: unknown,
  fallbackIso = new Date().toISOString(),
): StoredCheckoutAttemptState | null {
  if (
    !isRecord(value) ||
    value.version !== 4 ||
    !isStoredCheckoutPayload(value.payload) ||
    !Array.isArray(value.payments)
  ) {
    return null;
  }

  const storedPayments = value.payments.filter(isStoredCheckoutPayment);

  if (storedPayments.length !== value.payments.length) {
    return null;
  }

  return {
    version: 4,
    payload: value.payload,
    payments: storedPayments,
    createdAt:
      typeof value.createdAt === "string" ? value.createdAt : fallbackIso,
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : fallbackIso,
  };
}

export function getStoredCheckoutAttemptState(): StoredCheckoutAttemptState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      POS_CHECKOUT_ATTEMPT_STORAGE_KEY,
    );

    if (!rawValue) {
      return null;
    }

    const parsedValue = parseStoredCheckoutAttemptState(JSON.parse(rawValue));

    if (!parsedValue) {
      window.sessionStorage.removeItem(POS_CHECKOUT_ATTEMPT_STORAGE_KEY);
    }

    return parsedValue;
  } catch {
    window.sessionStorage.removeItem(POS_CHECKOUT_ATTEMPT_STORAGE_KEY);
    return null;
  }
}

export function saveStoredCheckoutAttemptState(
  state: StoredCheckoutAttemptState,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    POS_CHECKOUT_ATTEMPT_STORAGE_KEY,
    JSON.stringify({
      ...state,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function removeStoredCheckoutAttemptState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(POS_CHECKOUT_ATTEMPT_STORAGE_KEY);
}

export async function fetchCheckoutRecoveryStatus(
  idempotencyKey: string,
): Promise<PosCheckoutRecoveryStatusResult> {
  const response = await fetch(
    `/api/pos/checkout-attempts/${encodeURIComponent(idempotencyKey)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    },
  );

  const payload = (await response.json()) as PosCheckoutRecoveryStatusResult;

  if (
    response.ok ||
    (response.status === 404 && payload.status === "not_found")
  ) {
    return payload;
  }

  throw new Error("CHECKOUT_RECOVERY_REQUEST_FAILED");
}

export function waitForCheckoutRecovery(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

export type CheckoutRecoveryDecision =
  | {
      status: "completed";
      sale: Extract<PosCheckoutRecoveryStatusResult, { status: "completed" }>["sale"];
    }
  | { status: "stop"; message: string }
  | { status: "wait"; retryAfterMs: number };

export function getCheckoutRecoveryDecision(
  recoveryStatus: PosCheckoutRecoveryStatusResult,
  pollIndex: number,
): CheckoutRecoveryDecision {
  if (recoveryStatus.status === "completed") {
    return { status: "completed", sale: recoveryStatus.sale };
  }

  if (recoveryStatus.status === "failed") {
    return {
      status: "stop",
      message: `${recoveryStatus.message} Tekan Proses Pembayaran lagi untuk retry dengan kode transaksi yang sama.`,
    };
  }

  if (recoveryStatus.status === "not_found" && pollIndex >= 2) {
    return {
      status: "stop",
      message:
        "Transaksi belum tercatat di server. Tekan Proses Pembayaran lagi; sistem akan memakai kode transaksi yang sama.",
    };
  }

  return {
    status: "wait",
    retryAfterMs:
      recoveryStatus.status === "processing"
        ? recoveryStatus.retryAfterMs
        : 1_500,
  };
}

export function getCheckoutErrorMessage(
  result: Extract<PosCheckoutActionResult, { status: "error" }>,
) {
  const fieldErrorMessages = Object.values(result.fieldErrors ?? {}).filter(
    Boolean,
  );

  if (fieldErrorMessages.length === 0) {
    return result.message;
  }

  const detailMessage = fieldErrorMessages.join(" ");

  return result.message.includes(detailMessage)
    ? result.message
    : `${result.message} ${detailMessage}`;
}

export function getCheckoutSubmissionValidationMessage(input: {
  rawCustomerDepositUsedAmount: number;
  customerDepositUsedAmount: number;
  canFinalizePayment: boolean;
  paymentValidationMessage: string | null;
}) {
  if (
    input.rawCustomerDepositUsedAmount !== input.customerDepositUsedAmount
  ) {
    return "Dana Titip digunakan tidak boleh melebihi saldo customer atau total belanja.";
  }

  if (!input.canFinalizePayment || input.paymentValidationMessage) {
    return (
      input.paymentValidationMessage ??
      "Payment belum lunas atau transaksi belum siap diproses."
    );
  }

  return null;
}

export function createCheckoutPayload(input: {
  submission: CheckoutSubmissionInput;
  existingAttempt: StoredCheckoutAttemptState | null;
}): PosCheckoutPayload {
  const { submission, existingAttempt } = input;

  return {
    itemIds: submission.items.map((item) => item.id),
    itemPricing: submission.items.map(getPosCartPricingInput),
    payments: submission.payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      manualPaymentProfileId: payment.manualPaymentProfileId,
      verificationConfirmed: payment.verificationConfirmed,
      receivedAmount: payment.receivedAmount,
      changeAmount: payment.changeAmount,
      provider: payment.provider,
      reference: payment.reference,
      note: payment.note,
      verificationSource: payment.verificationSource,
      providerPaidAtIso: payment.providerPaidAtIso,
      evidenceKey: payment.evidenceKey,
      verificationDetails: payment.verificationDetails,
    })),
    idempotencyKey:
      existingAttempt?.payload.idempotencyKey ?? createCheckoutIdempotencyKey(),
    customerDepositUsedAmount:
      submission.customerDepositUsedAmount > 0
        ? submission.customerDepositUsedAmount
        : null,
    customerDepositInAmount:
      submission.customerDepositInAmount > 0
        ? submission.customerDepositInAmount
        : null,
    customerId: submission.customerId,
    note: null,
    discountApprovalId: null,
    discountAmount: null,
    discountReason: null,
  };
}

export function createStoredCheckoutAttempt(input: {
  payload: PosCheckoutPayload;
  payments: PosPaymentDraft[];
  existingAttempt: StoredCheckoutAttemptState | null;
  nowIso?: string;
}): StoredCheckoutAttemptState {
  const nowIso = input.nowIso ?? new Date().toISOString();

  return {
    version: 4,
    payload: input.payload,
    payments: input.payments,
    createdAt: input.existingAttempt?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}
