import type { PosManualPaymentMethod } from "@/features/pos/contracts";

export const manualPaymentMethodLabels: Record<
  PosManualPaymentMethod,
  string
> = {
  cash: "Cash",
  debit_card: "EDC",
  bank_transfer: "Transfer",
};

const manualPaymentMethods = Object.keys(
  manualPaymentMethodLabels,
) as PosManualPaymentMethod[];

export function isManualPaymentMethod(
  value: string,
): value is PosManualPaymentMethod {
  return manualPaymentMethods.includes(value as PosManualPaymentMethod);
}

export function getPaymentProvider({
  method,
  provider,
}: {
  method: PosManualPaymentMethod;
  provider: string | null;
}) {
  if (provider) {
    return provider;
  }

  return method === "cash" ? "cash" : "manual";
}
