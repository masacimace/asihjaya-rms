import { formatCurrency, parseAmount } from "@/features/pos/payment-draft";

export type PosShiftVarianceTone =
  | "neutral"
  | "balanced"
  | "surplus"
  | "shortage";

export type PosShiftCashReconciliation = {
  expectedCashAmount: number;
  cashVarianceAmount: number | null;
  cashVarianceLabel: string;
  tone: PosShiftVarianceTone;
};

export function formatPosShiftOpenedAt(value: Date | string) {
  const openedAt = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(openedAt.getTime())) {
    return "waktu tidak diketahui";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(openedAt);
}

export function formatPosShiftVarianceAmount(amount: number) {
  if (amount > 0) {
    return `+${formatCurrency(amount)}`;
  }

  if (amount < 0) {
    return `-${formatCurrency(Math.abs(amount))}`;
  }

  return formatCurrency(0);
}

export function getPosShiftCashReconciliation({
  expectedCash,
  actualCashAmount,
}: {
  expectedCash: string | null;
  actualCashAmount: number | null;
}): PosShiftCashReconciliation {
  const expectedCashAmount = parseAmount(expectedCash);
  const cashVarianceAmount =
    actualCashAmount === null ? null : actualCashAmount - expectedCashAmount;

  if (cashVarianceAmount === null) {
    return {
      expectedCashAmount,
      cashVarianceAmount,
      cashVarianceLabel:
        "Input nominal uang cash aktual untuk melihat selisih.",
      tone: "neutral",
    };
  }

  return {
    expectedCashAmount,
    cashVarianceAmount,
    cashVarianceLabel: formatPosShiftVarianceAmount(cashVarianceAmount),
    tone:
      cashVarianceAmount === 0
        ? "balanced"
        : cashVarianceAmount > 0
          ? "surplus"
          : "shortage",
  };
}
