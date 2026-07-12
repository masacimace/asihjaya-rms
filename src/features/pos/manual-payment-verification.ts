import { createHash } from "node:crypto";

import type {
  PosCheckoutPaymentInput,
  PosManualPaymentMethod,
  PosManualPaymentVerificationDetails,
  PosManualPaymentVerificationSource,
} from "@/features/pos/contracts";

export const NON_CASH_MANUAL_PAYMENT_METHODS = [
  "qris_manual",
  "debit_card",
  "credit_card",
  "bank_transfer",
] as const satisfies readonly PosManualPaymentMethod[];

export type NonCashManualPaymentMethod =
  (typeof NON_CASH_MANUAL_PAYMENT_METHODS)[number];

export type ManualPaymentPolicy = {
  method: NonCashManualPaymentMethod;
  coVerificationThreshold: number;
  evidenceThreshold: number;
  duplicateLookbackDays: number;
  isEnabled: boolean;
};

export const DEFAULT_MANUAL_PAYMENT_POLICIES: Record<
  NonCashManualPaymentMethod,
  ManualPaymentPolicy
> = {
  qris_manual: {
    method: "qris_manual",
    coVerificationThreshold: 5_000_000,
    evidenceThreshold: 5_000_000,
    duplicateLookbackDays: 90,
    isEnabled: true,
  },
  debit_card: {
    method: "debit_card",
    coVerificationThreshold: 10_000_000,
    evidenceThreshold: 10_000_000,
    duplicateLookbackDays: 7,
    isEnabled: true,
  },
  credit_card: {
    method: "credit_card",
    coVerificationThreshold: 10_000_000,
    evidenceThreshold: 10_000_000,
    duplicateLookbackDays: 7,
    isEnabled: true,
  },
  bank_transfer: {
    method: "bank_transfer",
    coVerificationThreshold: 10_000_000,
    evidenceThreshold: 10_000_000,
    duplicateLookbackDays: 180,
    isEnabled: true,
  },
};

const PAYMENT_EVIDENCE_KEY_PATTERN =
  /^organizations\/[0-9a-f-]{36}\/payment-evidence\/[0-9a-f-]{36}\.webp$/i;

function normalizeText(value: string | null | undefined, maxLength = 160) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function normalizeManualPaymentReference(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeManualPaymentProvider(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export function isNonCashManualPaymentMethod(
  method: string,
): method is NonCashManualPaymentMethod {
  return NON_CASH_MANUAL_PAYMENT_METHODS.includes(
    method as NonCashManualPaymentMethod,
  );
}

export function isValidPaymentEvidenceKey(
  evidenceKey: string | null | undefined,
  organizationId?: string,
) {
  if (!evidenceKey || !PAYMENT_EVIDENCE_KEY_PATTERN.test(evidenceKey)) {
    return false;
  }

  return organizationId
    ? evidenceKey.startsWith(`organizations/${organizationId}/payment-evidence/`)
    : true;
}

function normalizeDetails(
  details: PosManualPaymentVerificationDetails | null | undefined,
): PosManualPaymentVerificationDetails {
  return {
    terminalId: normalizeText(details?.terminalId, 80),
    merchantId: normalizeText(details?.merchantId, 80),
    batchNumber: normalizeText(details?.batchNumber, 40),
    traceNumber: normalizeText(details?.traceNumber, 40),
    cardNetwork: normalizeText(details?.cardNetwork, 40),
    cardLast4: normalizeText(details?.cardLast4, 4),
    senderName: normalizeText(details?.senderName, 120),
    destinationAccount: normalizeText(details?.destinationAccount, 120),
  };
}

export type NormalizedManualPaymentVerification = {
  verificationSource: PosManualPaymentVerificationSource;
  providerPaidAt: Date;
  evidenceKey: string | null;
  details: PosManualPaymentVerificationDetails;
  normalizedProvider: string;
  normalizedReference: string;
};

export function normalizeAndValidateManualPaymentVerification({
  payment,
  organizationId,
  policy,
  now = new Date(),
}: {
  payment: PosCheckoutPaymentInput;
  organizationId: string;
  policy: ManualPaymentPolicy;
  now?: Date;
}): NormalizedManualPaymentVerification {
  if (!isNonCashManualPaymentMethod(payment.method)) {
    throw new Error("MANUAL_PAYMENT_METHOD_NOT_NON_CASH");
  }

  if (!policy.isEnabled) {
    throw new Error("Metode pembayaran manual ini sedang dinonaktifkan.");
  }

  const provider = normalizeText(payment.provider, 80);
  const reference = normalizeText(payment.reference, 160);
  const verificationSource = payment.verificationSource ?? null;
  const providerPaidAt = payment.providerPaidAtIso
    ? new Date(payment.providerPaidAtIso)
    : null;
  const evidenceKey = normalizeText(payment.evidenceKey, 300);
  const rawCardLast4 = payment.verificationDetails?.cardLast4?.trim() ?? "";
  const details = normalizeDetails(payment.verificationDetails);

  if (rawCardLast4 && !/^\d{4}$/.test(rawCardLast4)) {
    throw new Error("Empat digit terakhir kartu harus terdiri dari tepat 4 angka.");
  }

  if (!provider) {
    throw new Error("Provider/bank pembayaran manual wajib diisi.");
  }

  if (!reference) {
    throw new Error("Reference/approval code pembayaran manual wajib diisi.");
  }

  if (!verificationSource) {
    throw new Error("Sumber verifikasi pembayaran manual wajib dipilih.");
  }

  if (!providerPaidAt || Number.isNaN(providerPaidAt.getTime())) {
    throw new Error("Waktu pembayaran dari provider wajib diisi.");
  }

  if (providerPaidAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    throw new Error("Waktu pembayaran provider tidak boleh berada di masa depan.");
  }

  if (providerPaidAt.getTime() < now.getTime() - 7 * 24 * 60 * 60 * 1000) {
    throw new Error("Waktu pembayaran provider terlalu lama untuk checkout POS ini.");
  }

  if (
    evidenceKey &&
    !isValidPaymentEvidenceKey(evidenceKey, organizationId)
  ) {
    throw new Error("Bukti pembayaran tidak valid atau bukan milik organisasi ini.");
  }

  if (payment.amount >= policy.evidenceThreshold && !evidenceKey) {
    throw new Error(
      `Bukti pembayaran wajib dilampirkan untuk nominal minimal Rp${policy.evidenceThreshold.toLocaleString("id-ID")}.`,
    );
  }

  if (payment.method === "qris_manual") {
    if (verificationSource !== "merchant_app" && verificationSource !== "bank_app") {
      throw new Error("QRIS manual harus diverifikasi dari aplikasi merchant atau bank.");
    }

    if (!details.merchantId) {
      throw new Error("Merchant ID/akun QRIS wajib diisi.");
    }
  }

  if (payment.method === "debit_card" || payment.method === "credit_card") {
    if (verificationSource !== "edc_terminal") {
      throw new Error("Pembayaran kartu manual harus diverifikasi dari terminal EDC.");
    }

    if (
      !details.terminalId ||
      !details.traceNumber ||
      !details.batchNumber ||
      !details.cardNetwork
    ) {
      throw new Error(
        "Terminal ID, trace/STAN, batch, dan jaringan kartu EDC wajib diisi.",
      );
    }

    if (details.cardLast4 && !/^\d{4}$/.test(details.cardLast4)) {
      throw new Error("Empat digit terakhir kartu harus terdiri dari 4 angka.");
    }
  }

  if (payment.method === "bank_transfer") {
    if (
      verificationSource !== "bank_app" &&
      verificationSource !== "bank_statement"
    ) {
      throw new Error("Transfer harus diverifikasi dari aplikasi atau mutasi bank toko.");
    }

    if (!details.destinationAccount || !details.senderName) {
      throw new Error("Rekening tujuan toko dan nama pengirim wajib diisi.");
    }
  }

  const normalizedProvider = normalizeManualPaymentProvider(provider);
  const normalizedReference = normalizeManualPaymentReference(reference);

  if (normalizedReference.length < 4) {
    throw new Error("Reference pembayaran terlalu pendek atau tidak valid.");
  }

  return {
    verificationSource,
    providerPaidAt,
    evidenceKey,
    details,
    normalizedProvider,
    normalizedReference,
  };
}

export function createManualPaymentVerificationFingerprint({
  organizationId,
  outletId,
  cashierId,
  itemIds,
  customerId,
  discountApprovalId,
  payments,
}: {
  organizationId: string;
  outletId: string;
  cashierId: string;
  itemIds: string[];
  customerId?: string | null;
  discountApprovalId?: string | null;
  payments: PosCheckoutPaymentInput[];
}) {
  const canonicalPayments = payments
    .filter((payment) => payment.method !== "cash")
    .map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      provider: normalizeManualPaymentProvider(payment.provider ?? ""),
      reference: normalizeManualPaymentReference(payment.reference ?? ""),
      verificationSource: payment.verificationSource ?? null,
      providerPaidAtIso: payment.providerPaidAtIso ?? null,
      evidenceKey: payment.evidenceKey ?? null,
      details: normalizeDetails(payment.verificationDetails),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 1,
        organizationId,
        outletId,
        cashierId,
        itemIds: [...new Set(itemIds)].sort(),
        customerId: customerId ?? null,
        discountApprovalId: discountApprovalId ?? null,
        payments: canonicalPayments,
      }),
    )
    .digest("hex");
}
