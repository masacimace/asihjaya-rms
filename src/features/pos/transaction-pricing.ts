import type {
  PosAvailableItem,
  PosCartItem,
  PosCartPricingInput,
  PosPriceSource,
  PosWeightSource,
} from "@/features/pos/contracts";

function toSafeMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeWeightMilli(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).trim().replace(",", ".");

  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) {
    return null;
  }

  const [whole = "0", decimal = ""] = normalized.split(".");
  const weightMilli =
    BigInt(whole) * BigInt(1000) + BigInt(decimal.padEnd(3, "0"));
  const maxWeightMilli = BigInt("999999999999");

  return weightMilli > BigInt(0) && weightMilli <= maxWeightMilli
    ? weightMilli
    : null;
}

function formatWeightMilli(weightMilli: bigint) {
  const whole = weightMilli / BigInt(1000);
  const decimal = String(weightMilli % BigInt(1000)).padStart(3, "0");
  return `${whole}.${decimal}`;
}

export function normalizePosTransactionWeight(
  value: string | number | null | undefined,
) {
  const weightMilli = normalizeWeightMilli(value);
  return weightMilli ? formatWeightMilli(weightMilli) : null;
}

export function formatPosWeightInput(value: string | number | null | undefined) {
  const raw = String(value ?? "")
    .trim()
    .replace(".", ",")
    .replace(/[^0-9,]/g, "");

  if (!raw) {
    return "";
  }

  const commaIndex = raw.indexOf(",");
  const wholeRaw = (commaIndex >= 0 ? raw.slice(0, commaIndex) : raw).replace(
    /\D/g,
    "",
  );
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";

  if (commaIndex < 0) {
    return whole;
  }

  const decimal = raw
    .slice(commaIndex + 1)
    .replace(/\D/g, "")
    .slice(0, 3);

  return `${whole},${decimal}`;
}

export function getPosWeightSource({
  storedWeightGram,
  transactionWeightGram,
}: {
  storedWeightGram: string | null | undefined;
  transactionWeightGram: string | null | undefined;
}): PosWeightSource {
  const storedWeight = normalizePosTransactionWeight(storedWeightGram);
  const transactionWeight = normalizePosTransactionWeight(transactionWeightGram);

  return storedWeight && transactionWeight === storedWeight
    ? "stored"
    : "reweighed";
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

export function getPosPriceSource({
  activePricePerGram,
  transactionPricePerGram,
}: {
  activePricePerGram: string | null | undefined;
  transactionPricePerGram: string | null | undefined;
}): PosPriceSource {
  return activePricePerGram && activePricePerGram === transactionPricePerGram
    ? "global"
    : "manual_override";
}

export type PosPricingDraftValues = {
  transactionWeightGram?: string | number | null;
  priceSource?: PosPriceSource;
  pricePerGram?: string | number | null;
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
  const transactionWeightGram = normalizePosTransactionWeight(
    values.transactionWeightGram ?? item.weightGram,
  );
  const submittedPricePerGram =
    values.pricePerGram === null || values.pricePerGram === undefined
      ? item.activePricePerGram
      : String(values.pricePerGram).trim();
  const pricePerGram =
    submittedPricePerGram && /^\d+$/.test(submittedPricePerGram)
      ? submittedPricePerGram
      : null;

  if (!item.purityPercent) {
    return {
      status: "error",
      message: `${item.sku} belum memiliki Kadar Persen. Lengkapi data item sebelum dijual.`,
    };
  }

  if (!transactionWeightGram) {
    return {
      status: "error",
      message: "Berat transaksi harus lebih dari 0 gr dan maksimal 3 angka desimal.",
    };
  }

  if (!pricePerGram || Number(pricePerGram) <= 0) {
    return {
      status: "error",
      message: "Harga/Gram transaksi harus lebih dari Rp0.",
    };
  }

  const basePriceAmount = calculatePosBasePrice({
    weightGram: transactionWeightGram,
    pricePerGram,
  });

  if (!basePriceAmount) {
    return {
      status: "error",
      message: `${item.sku} belum bisa dihitung karena Berat atau Harga/Gram transaksi tidak valid.`,
    };
  }

  const finalPriceAmount = calculatePosFinalPrice({
    basePriceAmount,
    discountAmount: values.discountAmount,
    laborAmount: values.laborAmount,
    adjustmentAmount: values.adjustmentAmount,
  });

  if (!finalPriceAmount) {
    return {
      status: "error",
      message:
        values.discountAmount > basePriceAmount
          ? "Diskon item tidak boleh lebih besar dari Harga Dasar."
          : "Perhitungan harga item tidak valid. Periksa Berat, Harga/Gram, Diskon, Ongkos, dan Round.",
    };
  }

  return {
    status: "success",
    item: {
      ...item,
      transactionWeightGram,
      priceSource: getPosPriceSource({
        activePricePerGram: item.activePricePerGram,
        transactionPricePerGram: pricePerGram,
      }),
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
    transactionWeightGram:
      normalizePosTransactionWeight(item.transactionWeightGram) ??
      normalizePosTransactionWeight(item.weightGram) ??
      undefined,
    priceSource:
      item.priceSource ??
      getPosPriceSource({
        activePricePerGram: item.activePricePerGram,
        transactionPricePerGram: item.pricePerGram,
      }),
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
