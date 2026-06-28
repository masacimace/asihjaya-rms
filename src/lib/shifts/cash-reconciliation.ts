export type CashMovementType =
  | "opening_balance"
  | "cash_sale"
  | "cash_refund"
  | "cash_in"
  | "cash_out"
  | "closing_adjustment";

export type CashMovementLike = {
  type: CashMovementType;
  amount: string | number | null;
};

export type CashReconciliationSummary = {
  openingBalance: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  cashRefunds: number;
  closingAdjustments: number;
  expectedCash: number;
  movementCount: number;
};

export function parseCashAmountValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

export function parseCashAmountInput(value: string | null | undefined) {
  const numericValue = String(value ?? "").replace(/[^0-9]/g, "");

  if (!numericValue) {
    return 0;
  }

  const parsedAmount = Number(numericValue);

  return Number.isSafeInteger(parsedAmount) ? parsedAmount : Number.NaN;
}

export function summarizeCashMovements(
  movements: readonly CashMovementLike[],
): CashReconciliationSummary {
  const summary: CashReconciliationSummary = {
    openingBalance: 0,
    cashSales: 0,
    cashIn: 0,
    cashOut: 0,
    cashRefunds: 0,
    closingAdjustments: 0,
    expectedCash: 0,
    movementCount: movements.length,
  };

  for (const movement of movements) {
    const amount = parseCashAmountValue(movement.amount);

    if (movement.type === "opening_balance") {
      summary.openingBalance += amount;
      continue;
    }

    if (movement.type === "cash_sale") {
      summary.cashSales += amount;
      continue;
    }

    if (movement.type === "cash_in") {
      summary.cashIn += amount;
      continue;
    }

    if (movement.type === "cash_out") {
      summary.cashOut += amount;
      continue;
    }

    if (movement.type === "cash_refund") {
      summary.cashRefunds += amount;
      continue;
    }

    if (movement.type === "closing_adjustment") {
      summary.closingAdjustments += amount;
    }
  }

  summary.expectedCash =
    summary.openingBalance +
    summary.cashSales +
    summary.cashIn +
    summary.closingAdjustments -
    summary.cashOut -
    summary.cashRefunds;

  return summary;
}
