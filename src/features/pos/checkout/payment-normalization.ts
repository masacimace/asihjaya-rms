import type {
  PosCheckoutPayload,
  PosManualPaymentVerificationSource,
} from "@/features/pos/contracts";
import {
  getManualPaymentProfileType,
  normalizeAndValidateManualPaymentVerification,
  type ManualPaymentPolicy,
  type NonCashManualPaymentMethod,
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

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.slice(0, maxLength);
}

function normalizeVerificationSource(
  value: string,
): PosManualPaymentVerificationSource | null {
  return value === "merchant_app" ||
    value === "edc_terminal" ||
    value === "bank_app" ||
    value === "bank_statement"
    ? value
    : null;
}

export function normalizeCheckoutPayments({
  submittedPayments,
  paymentProfilesById,
  organizationId,
  policies,
  verificationNowIso,
}: {
  submittedPayments: PosCheckoutPayload["payments"];
  paymentProfilesById: ReadonlyMap<string, CheckoutPaymentProfile>;
  organizationId: string;
  policies: Record<NonCashManualPaymentMethod, ManualPaymentPolicy>;
  verificationNowIso: string;
}): NormalizedCheckoutPayment[] {
  return submittedPayments.map((payment, index) => {
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
    const reference = normalizeNullableText(payment.reference, 160);
    const note = normalizeNullableText(payment.note, 160);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new CheckoutValidationError(
        `Nominal pembayaran ${methodLabel} harus lebih dari Rp0.`,
      );
    }

    if (!Number.isSafeInteger(changeAmount) || changeAmount < 0) {
      throw new CheckoutValidationError("Nominal kembalian cash tidak valid.");
    }

    if (method === "cash") {
      if (receivedAmount === null) {
        throw new CheckoutValidationError(
          "Nominal uang diterima cash wajib dikirim dari POS.",
        );
      }

      if (!Number.isSafeInteger(receivedAmount) || receivedAmount < amount) {
        throw new CheckoutValidationError(
          "Nominal uang diterima cash tidak valid.",
        );
      }

      const expectedChange = Math.max(receivedAmount - amount, 0);

      if (changeAmount !== expectedChange) {
        throw new CheckoutValidationError(
          "Nominal kembalian cash tidak sesuai dengan uang diterima.",
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
        verificationDetails: {},
        normalizedProvider: null,
        normalizedReference: null,
      };
    }

    if (changeAmount > 0 || receivedAmount !== null) {
      throw new CheckoutValidationError(
        "Kembalian hanya boleh untuk pembayaran cash.",
      );
    }

    try {
      const profileId = String(payment.manualPaymentProfileId ?? "").trim();

      if (!UUID_PATTERN.test(profileId)) {
        throw new Error("Pilih akun/terminal pembayaran yang sudah dikonfigurasi.");
      }

      const profile = paymentProfilesById.get(profileId);

      if (!profile) {
        throw new Error(
          "Akun/terminal pembayaran tidak aktif atau bukan milik outlet ini.",
        );
      }

      if (profile.profileType !== getManualPaymentProfileType(method)) {
        throw new Error("Akun/terminal tidak mendukung metode pembayaran ini.");
      }

      const verification = normalizeAndValidateManualPaymentVerification({
        payment: {
          ...payment,
          method,
          amount,
          manualPaymentProfileId: profile.id,
          verificationConfirmed: payment.verificationConfirmed === true,
          provider: profile.provider,
          reference,
          verificationSource: normalizeVerificationSource(
            profile.verificationSource,
          ),
          providerPaidAtIso: payment.providerPaidAtIso ?? verificationNowIso,
          verificationDetails: {
            ...payment.verificationDetails,
            merchantId: profile.merchantId,
            terminalId: profile.terminalId,
            destinationAccount: profile.destinationAccount,
          },
        },
        organizationId,
        policy: policies[method],
      });

      return {
        method,
        amount,
        receivedAmount: null,
        changeAmount: 0,
        provider: profile.provider,
        reference,
        note,
        verificationSource: verification.verificationSource,
        providerPaidAt: verification.providerPaidAt,
        providerPaidAtIso: verification.providerPaidAt.toISOString(),
        evidenceKey: verification.evidenceKey,
        manualPaymentProfileId: profile.id,
        manualPaymentProfileName: profile.name,
        manualPaymentProfileCode: profile.code,
        manualPaymentProfileRegisterId: profile.registerId,
        verificationDetails: verification.details as Record<
          string,
          string | null
        >,
        normalizedProvider: verification.normalizedProvider,
        normalizedReference: verification.normalizedReference,
      };
    } catch (error) {
      throw new CheckoutValidationError(
        `${methodLabel}: ${
          error instanceof Error ? error.message : "data verifikasi tidak valid"
        }`,
      );
    }
  });
}
