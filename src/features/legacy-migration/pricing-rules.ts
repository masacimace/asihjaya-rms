const WHOLE_MONEY_PATTERN = /^\d{1,18}$/;
const WEIGHT_PATTERN = /^\d{1,9}(?:\.\d{1,3})?$/;

function normalizeUnsignedInteger(value: string) {
  return value.replace(/^0+(?=\d)/, "");
}

function normalizeWholeMoney(value: string | null | undefined) {
  const normalized = normalizeUnsignedInteger(value?.trim() ?? "");
  return WHOLE_MONEY_PATTERN.test(normalized) ? normalized : null;
}

function weightToMilliGram(value: string | null | undefined) {
  const normalized = value?.trim().replace(",", ".") ?? "";
  if (!WEIGHT_PATTERN.test(normalized)) return null;

  const parts = normalized.split(".");
  const whole = parts[0];
  if (!whole) return null;

  const fraction = parts[1] ?? "";
  const milliGram = normalizeUnsignedInteger(
    `${whole}${fraction.padEnd(3, "0")}`,
  );

  return milliGram === "0" ? null : milliGram;
}

function multiplyUnsignedIntegers(left: string, right: string) {
  const result = new Array<number>(left.length + right.length).fill(0);

  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    const leftDigit = left.charCodeAt(leftIndex) - 48;

    for (
      let rightIndex = right.length - 1;
      rightIndex >= 0;
      rightIndex -= 1
    ) {
      const rightDigit = right.charCodeAt(rightIndex) - 48;
      const resultIndex = leftIndex + rightIndex + 1;
      const multiplied = leftDigit * rightDigit + (result[resultIndex] ?? 0);

      result[resultIndex] = multiplied % 10;
      result[resultIndex - 1] =
        (result[resultIndex - 1] ?? 0) + Math.floor(multiplied / 10);
    }
  }

  for (let index = result.length - 1; index > 0; index -= 1) {
    const digit = result[index] ?? 0;
    if (digit < 10) continue;

    result[index] = digit % 10;
    result[index - 1] =
      (result[index - 1] ?? 0) + Math.floor(digit / 10);
  }

  return normalizeUnsignedInteger(result.join(""));
}

function incrementUnsignedInteger(value: string) {
  const digits = value.split("");

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const digit = Number(digits[index]);
    if (digit < 9) {
      digits[index] = String(digit + 1);
      return digits.join("");
    }

    digits[index] = "0";
  }

  return `1${digits.join("")}`;
}

function roundMilliGramProductToWholeRupiah(product: string) {
  const padded = product.padStart(4, "0");
  const quotientEnd = padded.length - 3;
  const quotient = normalizeUnsignedInteger(padded.slice(0, quotientEnd));
  const remainder = Number(padded.slice(quotientEnd));

  return remainder >= 500 ? incrementUnsignedInteger(quotient) : quotient;
}

export function isPositiveLegacyMigrationMoney(
  value: string | null | undefined,
) {
  const normalized = normalizeWholeMoney(value);
  return normalized !== null && normalized !== "0";
}

export function isNonNegativeLegacyMigrationMoney(
  value: string | null | undefined,
) {
  return normalizeWholeMoney(value) !== null;
}

export function isFineGoldLegacyCategory(
  value: string | null | undefined,
) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("id-ID")
    .includes("logam mulia");
}

export function calculateLegacyMigrationSellingAmount(input: {
  weightGram: string | null | undefined;
  pricePerGram: string | null | undefined;
}) {
  const weightMilliGram = weightToMilliGram(input.weightGram);
  const normalizedPrice = normalizeWholeMoney(input.pricePerGram);
  if (!weightMilliGram || !normalizedPrice || normalizedPrice === "0") {
    return null;
  }

  // Round half-up to a whole Rupiah. Weight is stored at three decimals.
  const product = multiplyUnsignedIntegers(weightMilliGram, normalizedPrice);
  const sellingAmount = roundMilliGramProductToWholeRupiah(product);

  return sellingAmount !== "0" && WHOLE_MONEY_PATTERN.test(sellingAmount)
    ? sellingAmount
    : null;
}

export function resolveLegacyMigrationPricing(input: {
  weightGram: string | null | undefined;
  legacyPricePerGram: string | null | undefined;
  legacyDeductionPerGram: string | null | undefined;
  categoryName: string | null | undefined;
}) {
  const pricePerGram = isPositiveLegacyMigrationMoney(
    input.legacyPricePerGram,
  )
    ? normalizeWholeMoney(input.legacyPricePerGram)
    : null;
  const deductionPerGram = isNonNegativeLegacyMigrationMoney(
    input.legacyDeductionPerGram,
  )
    ? normalizeWholeMoney(input.legacyDeductionPerGram)
    : isFineGoldLegacyCategory(input.categoryName)
      ? "0"
      : null;
  const sellingAmount = calculateLegacyMigrationSellingAmount({
    weightGram: input.weightGram,
    pricePerGram,
  });

  return {
    pricePerGram,
    deductionPerGram,
    sellingAmount,
  };
}
