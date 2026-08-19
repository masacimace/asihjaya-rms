import type { PosCheckoutPayload } from "@/features/pos/contracts";
import {
  getManualPaymentProfileType,
} from "@/features/pos/manual-payment-verification";
import { CheckoutValidationError } from "@/features/pos/checkout/errors";
import {
  isManualPaymentMethod,
  manualPaymentMethodLabels,
} from "@/features/pos/checkout/payment-methods";
import type { NormalizedCheckoutPayment } from "@/features/pos/checkout/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CheckoutPaymentProfile = {
  id: string;
  profileType: string;
  code: string;
  name: string;
  provider: string;
  verificationSource: string;
  merchantId: string | null;
  terminalId: string | null;
  destinationAccount: string | null;
  registerId: string | null;
};

function normalizeNullableText(
  value: string | null | undefined,
  maxLength: number,
) {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue ? trimmedValue.slice(0, maxLength) : null;
}

export function normalizeCheckoutPayments({
  submittedPayments,
  paymentProfilesById,
}: {
  submittedPayments: PosCheckoutPayload["payments"];
  paymentProfilesById: ReadonlyMap<string, CheckoutPaymentProfile>;
}): NormalizedCheckoutPayment[] {
  return submittedPayments.map<NormalizedCheckoutPayment>((payment, index) => {
    const method = String(payment.method ?? "");

    if (!isManualPaymentMethod(method)) {
      throw new CheckoutValidationError(
        `Metode pembayaran baris ${index + 1} tidak valid.`,
      );
    }

    const methodLabel = manualPaymentMethodLabels[method];
    const amount = Number(payment.amount);
    const receivedAmount =
      payment.receivedAmount === null || payment.receivedAmount === undefined
        ? null
        : Number(payment.receivedAmount);
    const changeAmount = Number(payment.changeAmount ?? 0);
    const note = normalizeNullableText(payment.note, 160);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new CheckoutValidationError(
        `${methodLabel}: nominal pembayaran harus lebih dari Rp0.`,
      );
    }

    if (method === "cash") {
      if (
        receivedAmount === null ||
        !Number.isSafeInteger(receivedAmount) ||
        receivedAmount < amount
      ) {
        throw new CheckoutValidationError(
          "Cash: uang diterima tidak boleh lebih kecil dari nominal pembayaran.",
        );
      }

      const expectedChangeAmount = Math.max(receivedAmount - amount, 0);

      if (!Number.isSafeInteger(changeAmount) || changeAmount !== expectedChangeAmount) {
        throw new CheckoutValidationError(
          "Cash: nominal kembalian tidak sesuai dengan uang diterima.",
        );
      }

      return {
        method,
        amount,
        receivedAmount,
        changeAmount,
        provider: null,
        reference: null,
        note,
        verificationSource: null,
        providerPaidAt: null,
        providerPaidAtIso: null,
        evidenceKey: null,
        manualPaymentProfileId: null,
        manualPaymentProfileName: null,
        manualPaymentProfileCode: null,
        manualPaymentProfileRegisterId: null,
        verificationDetails: {} as Record<string, string | null>,
        normalizedProvider: null,
        normalizedReference: null,
      };
    }

    if (receivedAmount !== null || changeAmount !== 0) {
      throw new CheckoutValidationError(
        `${methodLabel}: kembalian hanya boleh digunakan untuk Cash.`,
      );
    }

    const profileId = String(payment.manualPaymentProfileId ?? "").trim();

    if (!UUID_PATTERN.test(profileId)) {
      throw new CheckoutValidationError(
        `${methodLabel}: pilih akun/terminal pembayaran yang sudah dikonfigurasi.`,
      );
    }

    const profile = paymentProfilesById.get(profileId);

    if (!profile) {
      throw new CheckoutValidationError(
        `${methodLabel}: akun/terminal pembayaran tidak ditemukan atau tidak aktif.`,
      );
    }

    if (profile.profileType !== getManualPaymentProfileType(method)) {
      throw new CheckoutValidationError(
        `${methodLabel}: preset pembayaran tidak sesuai dengan metode yang dipilih.`,
      );
    }

    if (method === "debit_card" && !profile.terminalId) {
      throw new CheckoutValidationError(
        "EDC: Terminal ID pada preset belum dikonfigurasi.",
      );
    }

    if (method === "bank_transfer" && !profile.destinationAccount) {
      throw new CheckoutValidationError(
        "Transfer: rekening tujuan pada preset belum dikonfigurasi.",
      );
    }

    const provider = normalizeNullableText(profile.provider, 80);

    if (!provider) {
      throw new CheckoutValidationError(
        `${methodLabel}: provider/bank pada preset belum dikonfigurasi.`,
      );
    }

    return {
      method,
      amount,
      receivedAmount: null,
      changeAmount: 0,
      provider,
      reference: null,
      note,
      verificationSource: null,
      providerPaidAt: null,
      providerPaidAtIso: null,
      evidenceKey: null,
      manualPaymentProfileId: profile.id,
      manualPaymentProfileName: profile.name,
      manualPaymentProfileCode: profile.code,
      manualPaymentProfileRegisterId: profile.registerId,
      verificationDetails: {
        terminalId: profile.terminalId,
        destinationAccount: profile.destinationAccount,
      } as Record<string, string | null>,
      normalizedProvider: provider.toUpperCase().replace(/\s+/g, " "),
      normalizedReference: null,
    };
  });
}
