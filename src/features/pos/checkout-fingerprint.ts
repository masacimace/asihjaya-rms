import { createHash } from "node:crypto";

import { type PosCheckoutPayload } from "@/features/pos/contracts";

const IDEMPOTENCY_KEY_PATTERN = /^pos_[a-zA-Z0-9_-]{8,116}$/;

export type PosCheckoutFingerprintContext = {
  organizationId: string;
  outletId: string;
  registerId: string;
  shiftId: string;
  cashierId: string;
};

function normalizeFingerprintText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function canonicalizeCheckoutPayload(payload: PosCheckoutPayload) {
  const payments = payload.payments
    .map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      manualPaymentProfileId: normalizeFingerprintText(
        payment.manualPaymentProfileId,
      ),
      verificationConfirmed: payment.verificationConfirmed === true,
      receivedAmount: payment.receivedAmount ?? null,
      changeAmount: payment.changeAmount ?? 0,
      provider: normalizeFingerprintText(payment.provider),
      reference: normalizeFingerprintText(payment.reference),
      note: normalizeFingerprintText(payment.note),
      verificationSource: normalizeFingerprintText(payment.verificationSource),
      providerPaidAtIso: normalizeFingerprintText(payment.providerPaidAtIso),
      evidenceKey: normalizeFingerprintText(payment.evidenceKey),
      verificationDetails: payment.verificationDetails ?? null,
    }))
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );

  return {
    itemIds: [...new Set(payload.itemIds)].sort(),
    payments,
    customerId: normalizeFingerprintText(payload.customerId),
    note: normalizeFingerprintText(payload.note),
    discountApprovalId: normalizeFingerprintText(payload.discountApprovalId),
    discountAmount: payload.discountAmount ?? 0,
    discountReason: normalizeFingerprintText(payload.discountReason),
  };
}

export function createPosCheckoutRequestFingerprint({
  context,
  payload,
}: {
  context: PosCheckoutFingerprintContext;
  payload: PosCheckoutPayload;
}) {
  const canonicalRequest = {
    version: 1,
    organizationId: context.organizationId,
    outletId: context.outletId,
    registerId: context.registerId,
    shiftId: context.shiftId,
    cashierId: context.cashierId,
    checkout: canonicalizeCheckoutPayload(payload),
  };

  return createHash("sha256")
    .update(JSON.stringify(canonicalRequest))
    .digest("hex");
}

export function isValidPosCheckoutIdempotencyKey(value: string) {
  return value.length <= 120 && IDEMPOTENCY_KEY_PATTERN.test(value);
}
