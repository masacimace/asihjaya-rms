import { createHash, randomUUID } from "node:crypto";

import { getBusinessCompactDate } from "@/lib/time/business-time";

export function createPosCartFingerprint({
  outletId,
  itemIds,
  subtotalAmount,
  discountAmount,
}: {
  outletId: string;
  itemIds: string[];
  subtotalAmount: number;
  discountAmount: number;
}) {
  const source = JSON.stringify({
    outletId,
    itemIds: [...itemIds].sort(),
    subtotalAmount,
    discountAmount,
  });

  return createHash("sha256").update(source).digest("hex");
}

export function getDiscountPercent(
  discountAmount: number,
  subtotalAmount: number,
) {
  if (subtotalAmount <= 0) return 0;

  return Number(((discountAmount / subtotalAmount) * 100).toFixed(2));
}

export function allocateLineDiscounts({
  itemAmounts,
  discountAmount,
}: {
  itemAmounts: number[];
  discountAmount: number;
}) {
  if (discountAmount <= 0) {
    return itemAmounts.map(() => 0);
  }

  const subtotalAmount = itemAmounts.reduce((total, amount) => total + amount, 0);

  if (subtotalAmount <= 0) {
    return itemAmounts.map(() => 0);
  }

  let allocatedAmount = 0;

  return itemAmounts.map((amount, index) => {
    if (index === itemAmounts.length - 1) {
      return Math.max(0, discountAmount - allocatedAmount);
    }

    const lineDiscount = Math.min(
      amount,
      Math.floor((amount / subtotalAmount) * discountAmount),
    );

    allocatedAmount += lineDiscount;

    return lineDiscount;
  });
}

export function formatServerCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateInvoiceNumber({
  outletCode,
  date,
  timeZone,
}: {
  outletCode: string;
  date: Date;
  timeZone: string;
}) {
  const dateKey = getBusinessCompactDate(date, timeZone);
  const randomSuffix = randomUUID().slice(0, 8).toUpperCase();

  return `AJ-${outletCode}-${dateKey}-${randomSuffix}`.slice(0, 80);
}
