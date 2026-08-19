import type {
  PosAvailableItem,
  PosCartItem,
  PosCartPricingInput,
} from "@/features/pos/contracts";

function toSafeMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeWeightMilli(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(",", ".");

  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) {
    return null;
  }

  const [whole = "0", decimal = ""] = normalized.split(".");
  const weightMilli =
    BigInt(whole) * BigInt(1000) + BigInt(decimal.padEnd(3, "0"));

  return weightMilli > BigInt(0) ? weightMilli : null;
}

export function calculatePosBasePrice({
  weightGram,
  pricePerGram,
}: {
  weightGram: string | null | undefined;
  pricePerGram: string | null | undefined;
}) {
  const weightMilli = normalizeWeightMilli(weightGram);

  if (!weightMilli || !pricePerGram || !/^\d+$/.test(pricePerGram)) {
    return null;
  }

  const rate = BigInt(pricePerGram);

  if (rate <= BigInt(0)) {
    return null;
  }

  const amount = (weightMilli * rate + BigInt(500)) / BigInt(1000);

  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(amount);
}

export function calculatePosFinalPrice({
  basePriceAmount,
  discountAmount,
  laborAmount,
  adjustmentAmount,
}: {
  basePriceAmount: number;
  discountAmount: number;
  laborAmount: number;
  adjustmentAmount: number;
}) {
  if (
    !Number.isSafeInteger(basePriceAmount) ||
    basePriceAmount <= 0 ||
    !Number.isSafeInteger(discountAmount) ||
    discountAmount < 0 ||
    !Number.isSafeInteger(laborAmount) ||
    laborAmount < 0 ||
    !Number.isSafeInteger(adjustmentAmount) ||
    adjustmentAmount < 0 ||
    discountAmount > basePriceAmount
  ) {
    return null;
  }

  const finalPriceAmount =
    basePriceAmount - discountAmount + laborAmount + adjustmentAmount;

  return Number.isSafeInteger(finalPriceAmount) && finalPriceAmount > 0
    ? finalPriceAmount
    : null;
}

export type PosPricingDraftValues = {
  discountAmount: number;
  laborAmount: number;
  adjustmentAmount: number;
};

export type BuildPosCartItemResult =
  | { status: "success"; item: PosCartItem }
  | { status: "error"; message: string };

export function buildPosCartItem(
  item: PosAvailableItem,
  values: PosPricingDraftValues,
): BuildPosCartItemResult {
  const pricePerGram = item.activePricePerGram;

  if (!item.purityPercent) {
    return {
      status: "error",
      message: `${item.sku} belum memiliki Kadar Persen. Lengkapi data item sebelum dijual.`,
    };
  }

  if (!item.weightGram) {
    return {
      status: "error",
      message: `${item.sku} belum memiliki berat. Lengkapi data item sebelum dijual.`,
    };
  }

  if (!pricePerGram) {
    return {
      status: "error",
      message: `Harga/Gram aktif untuk kadar ${item.purityPercent}% belum diatur. Atur Harga / Gram Aktif terlebih dahulu.`,
    };
  }

  const basePriceAmount = calculatePosBasePrice({
    weightGram: item.weightGram,
    pricePerGram,
  });

  if (!basePriceAmount) {
    return {
      status: "error",
      message: `${item.sku} belum bisa dihitung karena berat atau Harga/Gram tidak valid.`,
    };
  }

  const finalPriceAmount = calculatePosFinalPrice({
    basePriceAmount,
    ...values,
  });

  if (!finalPriceAmount) {
    return {
      status: "error",
      message:
        values.discountAmount > basePriceAmount
          ? "Diskon item tidak boleh lebih besar dari Harga Dasar."
          : "Perhitungan harga item tidak valid. Periksa Diskon, Ongkos, dan Round.",
    };
  }

  return {
    status: "success",
    item: {
      ...item,
      pricePerGram,
      basePriceAmount: String(basePriceAmount),
      discountAmount: String(values.discountAmount),
      laborAmount: String(values.laborAmount),
      adjustmentAmount: String(values.adjustmentAmount),
      finalPriceAmount: String(finalPriceAmount),
    },
  };
}

export function getPosCartPricingInput(item: PosCartItem): PosCartPricingInput {
  return {
    itemId: item.id,
    pricePerGram: item.pricePerGram,
    discountAmount: toSafeMoney(item.discountAmount) ?? 0,
    laborAmount: toSafeMoney(item.laborAmount) ?? 0,
    adjustmentAmount: toSafeMoney(item.adjustmentAmount) ?? 0,
  };
}

export function getPosCartPricingTotals(items: readonly PosCartItem[]) {
  return items.reduce(
    (totals, item) => {
      totals.subtotalAmount += toSafeMoney(item.basePriceAmount) ?? 0;
      totals.discountAmount += toSafeMoney(item.discountAmount) ?? 0;
      totals.laborAmount += toSafeMoney(item.laborAmount) ?? 0;
      totals.adjustmentAmount += toSafeMoney(item.adjustmentAmount) ?? 0;
      totals.totalAmount += toSafeMoney(item.finalPriceAmount) ?? 0;
      return totals;
    },
    {
      subtotalAmount: 0,
      discountAmount: 0,
      laborAmount: 0,
      adjustmentAmount: 0,
      totalAmount: 0,
    },
  );
}
