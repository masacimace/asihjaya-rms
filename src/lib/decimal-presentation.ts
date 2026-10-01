export type DecimalPresentationValue =
  | string
  | number
  | null
  | undefined;

function parseDecimalPresentationValue(value: DecimalPresentationValue) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized =
    typeof value === "string" ? value.trim().replace(",", ".") : value;
  const numeric = Number(normalized);

  return Number.isFinite(numeric) ? numeric : null;
}

export function formatDecimalDisplay(
  value: DecimalPresentationValue,
  options: { useGrouping?: boolean } = {},
) {
  const numeric = parseDecimalPresentationValue(value);
  if (numeric === null) {
    return null;
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
    useGrouping: options.useGrouping ?? true,
  }).format(numeric);
}

export function formatDecimalInput(value: DecimalPresentationValue) {
  return formatDecimalDisplay(value, { useGrouping: false }) ?? "";
}

export function formatGramDisplay(
  value: DecimalPresentationValue,
  fallback = "-",
) {
  const formatted = formatDecimalDisplay(value);
  return formatted ? `${formatted} gr` : fallback;
}

export function formatPercentDisplay(
  value: DecimalPresentationValue,
  fallback = "-",
) {
  const formatted = formatDecimalDisplay(value);
  return formatted ? `${formatted}%` : fallback;
}
