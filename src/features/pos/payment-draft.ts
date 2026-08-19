import type {
  PosManualPaymentMethod,
  PosManualPaymentProfile,
  PosManualPaymentVerificationDetails,
  PosManualPaymentVerificationSource,
} from "@/features/pos/contracts";

export type PosPaymentDraft = {
  id: string;
  method: PosManualPaymentMethod;
  methodLabel: string;
  amount: number;
  manualPaymentProfileId: string | null;
  manualPaymentProfileName: string | null;
  verificationConfirmed: boolean;
  receivedAmount: number | null;
  changeAmount: number;
  provider: string | null;
  reference: string | null;
  note: string | null;
  verificationSource: PosManualPaymentVerificationSource | null;
  providerPaidAtIso: string | null;
  evidenceKey: string | null;
  evidenceFileName: string | null;
  verificationDetails: PosManualPaymentVerificationDetails;
};

export type PaymentMethodConfig = {
  method: PosManualPaymentMethod;
  label: string;
  shortLabel: string;
  description: string;
  amountLabel: string;
  providerLabel: string | null;
  providerPlaceholder: string | null;
  referenceLabel: string | null;
  referencePlaceholder: string | null;
  requiresReference: boolean;
  allowOverpayment: boolean;
};

export const paymentMethodConfigs: PaymentMethodConfig[] = [
  {
    method: "cash",
    label: "Cash",
    shortLabel: "Cash",
    description: "Tunai, mendukung kembalian.",
    amountLabel: "Uang diterima",
    providerLabel: null,
    providerPlaceholder: null,
    referenceLabel: null,
    referencePlaceholder: null,
    requiresReference: false,
    allowOverpayment: true,
  },
  {
    method: "debit_card",
    label: "EDC",
    shortLabel: "EDC",
    description: "Pembayaran melalui terminal EDC outlet.",
    amountLabel: "Nominal EDC",
    providerLabel: "Terminal EDC",
    providerPlaceholder: null,
    referenceLabel: null,
    referencePlaceholder: null,
    requiresReference: false,
    allowOverpayment: false,
  },
  {
    method: "bank_transfer",
    label: "Transfer",
    shortLabel: "Transfer",
    description: "Transfer manual ke rekening outlet.",
    amountLabel: "Nominal transfer",
    providerLabel: "Rekening tujuan",
    providerPlaceholder: null,
    referenceLabel: null,
    referencePlaceholder: null,
    requiresReference: false,
    allowOverpayment: false,
  },
];

const defaultPaymentMethodConfig = paymentMethodConfigs[0]!;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isStoredCheckoutPayment(
  value: unknown,
): value is PosPaymentDraft {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.method === "string" &&
    paymentMethodConfigs.some((config) => config.method === value.method) &&
    typeof value.methodLabel === "string" &&
    typeof value.amount === "number" &&
    (typeof value.receivedAmount === "number" ||
      value.receivedAmount === null) &&
    typeof value.changeAmount === "number" &&
    (typeof value.verificationSource === "string" ||
      value.verificationSource === null) &&
    (typeof value.providerPaidAtIso === "string" ||
      value.providerPaidAtIso === null) &&
    (typeof value.evidenceKey === "string" || value.evidenceKey === null) &&
    isRecord(value.verificationDetails)
  );
}

export function profileSupportsMethod(
  profile: PosManualPaymentProfile,
  method: PosManualPaymentMethod,
) {
  if (method === "debit_card") {
    return profile.profileType === "edc";
  }

  if (method === "bank_transfer") {
    return profile.profileType === "bank_account";
  }

  return false;
}

export function getProfilesForMethod(
  profiles: PosManualPaymentProfile[],
  method: PosManualPaymentMethod,
) {
  return profiles.filter((profile) => profileSupportsMethod(profile, method));
}

export function getPaymentConfig(
  method: PosManualPaymentMethod,
): PaymentMethodConfig {
  return (
    paymentMethodConfigs.find((config) => config.method === method) ??
    defaultPaymentMethodConfig
  );
}

export function parseAmount(amount: string | null) {
  if (!amount) {
    return 0;
  }

  const parsedAmount = Number(amount);

  return Number.isFinite(parsedAmount) ? parsedAmount : 0;
}

export function formatCurrency(amount: string | number | null) {
  if (amount === null || amount === undefined || amount === "") {
    return "Harga belum diset";
  }

  const parsedAmount = typeof amount === "number" ? amount : Number(amount);

  if (!Number.isFinite(parsedAmount)) {
    return "Harga belum diset";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(parsedAmount);
}

export function getPaymentDraftValidationMessage({
  payments,
  totalAmount,
}: {
  payments: PosPaymentDraft[];
  totalAmount: number;
}) {
  if (payments.length === 0) {
    return totalAmount > 0
      ? "Tambahkan minimal satu pembayaran sebelum menyelesaikan transaksi."
      : null;
  }

  let totalPaidAmount = 0;

  for (const payment of payments) {
    const config = getPaymentConfig(payment.method);

    if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
      return `${config.label} memiliki nominal pembayaran yang tidak valid.`;
    }

    totalPaidAmount += payment.amount;

    if (payment.method === "cash") {
      if (
        payment.receivedAmount === null ||
        !Number.isSafeInteger(payment.receivedAmount) ||
        payment.receivedAmount < payment.amount
      ) {
        return "Nominal uang diterima cash tidak valid.";
      }

      const expectedChangeAmount = Math.max(
        payment.receivedAmount - payment.amount,
        0,
      );

      if (payment.changeAmount !== expectedChangeAmount) {
        return "Nominal kembalian cash tidak sesuai dengan uang diterima.";
      }

      continue;
    }

    if (payment.receivedAmount !== null || payment.changeAmount > 0) {
      return "Kembalian hanya boleh tercatat untuk pembayaran cash.";
    }

    if (!payment.manualPaymentProfileId || !payment.manualPaymentProfileName) {
      return `Preset akun/terminal wajib dipilih untuk ${config.label}.`;
    }

    if (!payment.provider?.trim()) {
      return `Akun/terminal wajib tersedia untuk ${config.label}.`;
    }
  }

  if (totalPaidAmount !== totalAmount) {
    return `Total pembayaran eksternal harus sama dengan ${formatCurrency(totalAmount)} setelah Dana Titip.`;
  }

  return null;
}

export function formatRupiahInput(value: string | number | null) {
  if (value === null || value === undefined) {
    return "";
  }

  const numericValue = String(value)
    .replace(/[^0-9]/g, "")
    .replace(/^0+(?=\d)/, "");

  if (!numericValue) {
    return "";
  }

  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parsePaymentAmountInput(value: string) {
  const numericValue = value.replace(/[^0-9]/g, "");

  if (!numericValue) {
    return 0;
  }

  const parsedAmount = Number(numericValue);

  return Number.isSafeInteger(parsedAmount) ? parsedAmount : Number.NaN;
}

export function createPaymentDraftId() {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createCheckoutIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `pos_${crypto.randomUUID()}`;
  }

  return `pos_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
