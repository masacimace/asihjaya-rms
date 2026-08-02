import type { PosManualPaymentMethod } from "@/features/pos/contracts";

export type NormalizedCheckoutPayment = {
  method: PosManualPaymentMethod;
  amount: number;
  receivedAmount: number | null;
  changeAmount: number;
  provider: string | null;
  reference: string | null;
  note: string | null;
  verificationSource: string | null;
  providerPaidAt: Date | null;
  providerPaidAtIso: string | null;
  evidenceKey: string | null;
  manualPaymentProfileId: string | null;
  manualPaymentProfileName: string | null;
  manualPaymentProfileCode: string | null;
  manualPaymentProfileRegisterId: string | null;
  verificationDetails: Record<string, string | null>;
  normalizedProvider: string | null;
  normalizedReference: string | null;
};
