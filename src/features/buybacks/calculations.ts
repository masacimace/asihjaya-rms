const WEIGHT_PATTERN = /^\d{1,9}(?:\.\d{1,3})?$/;
const MONEY_PATTERN = /^\d{1,18}$/;

export function normalizeBuybackDecimal(value: unknown): string | null {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!WEIGHT_PATTERN.test(normalized)) return null;

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  return normalized;
}

export function normalizeBuybackPurity(
  value: unknown,
  max = 100,
): string | null {
  const normalized = normalizeBuybackDecimal(value);
  if (!normalized) return null;
  const numeric = Number(normalized);
  return numeric <= max ? normalized : null;
}

export function normalizeBuybackMoney(
  value: unknown,
  { allowZero = false }: { allowZero?: boolean } = {},
): string | null {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^rp\s*/i, "")
    .replace(/[.\s]/g, "")
    .replace(/^0+(?=\d)/, "");

  if (!MONEY_PATTERN.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount) || amount < 0) return null;
  if (!allowZero && amount <= 0) return null;
  return String(amount);
}

export function calculateBuybackLine({
  weightGram,
  pricePerGram,
  deductionPerGram,
}: {
  weightGram: string;
  pricePerGram: string;
  deductionPerGram: string;
}) {
  const [wholeWeight = "0", decimalWeight = ""] = weightGram.split(".");
  const weightMilli =
    BigInt(wholeWeight) * BigInt(1000) +
    BigInt(decimalWeight.padEnd(3, "0"));
  const price = BigInt(pricePerGram);
  const deduction = BigInt(deductionPerGram);

  const base = (weightMilli * price + BigInt(500)) / BigInt(1000);
  const deductionAmount =
    (weightMilli * deduction + BigInt(500)) / BigInt(1000);
  const final = base - deductionAmount;

  if (
    base > BigInt(Number.MAX_SAFE_INTEGER) ||
    deductionAmount > BigInt(Number.MAX_SAFE_INTEGER) ||
    final > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return null;
  }

  return {
    baseAmount: Number(base),
    deductionAmount: Number(deductionAmount),
    finalAmount: Number(final),
  };
}
