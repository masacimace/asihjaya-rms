import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db";
import { metalPriceRates, metalPurities, metals } from "@/db/schema";
import type {
  PosCartPricingInput,
  PosPriceSource,
} from "@/features/pos/contracts";
import {
  calculatePosBasePrice,
  calculatePosFinalPrice,
} from "@/features/pos/transaction-pricing";
import { normalizePurityKey } from "@/features/pricing/metal-price-rates";

type PosDbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PosTransactionPricingSourceItem = {
  id: string;
  sku: string;
  weightGram: string | null;
  purityPercent: string | null;
};

export type ResolvedPosTransactionPricing = {
  itemId: string;
  priceSource: PosPriceSource;
  activePricePerGram: string | null;
  pricePerGram: string;
  basePriceAmount: number;
  discountAmount: number;
  laborAmount: number;
  adjustmentAmount: number;
  finalPriceAmount: number;
  rateChanged: boolean;
};

export class PosTransactionPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PosTransactionPricingError";
  }
}

function isSafeMoney(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function normalizePriceSource(value: unknown): PosPriceSource {
  return value === "manual_override" ? "manual_override" : "global";
}

export function normalizePosCartPricingInputs(
  values: readonly PosCartPricingInput[] | null | undefined,
): PosCartPricingInput[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new PosTransactionPricingError(
      "Pricing item transaksi belum tersedia. Kembali ke cart lalu atur harga item.",
    );
  }

  if (values.length > 50) {
    throw new PosTransactionPricingError("Maksimal 50 item dalam satu transaksi POS.");
  }

  const seenItemIds = new Set<string>();

  return values.map((value) => {
    const itemId = String(value?.itemId ?? "").trim();
    const pricePerGram = String(value?.pricePerGram ?? "").trim();
    const priceSource = normalizePriceSource(value?.priceSource);

    if (!itemId || seenItemIds.has(itemId)) {
      throw new PosTransactionPricingError(
        "Pricing item transaksi mengandung item duplikat atau tidak valid.",
      );
    }

    if (!/^\d+$/.test(pricePerGram) || Number(pricePerGram) <= 0) {
      throw new PosTransactionPricingError(
        "Harga/Gram transaksi tidak valid. Kembali ke cart lalu atur harga item.",
      );
    }

    if (
      !isSafeMoney(value.discountAmount) ||
      !isSafeMoney(value.laborAmount) ||
      !isSafeMoney(value.adjustmentAmount)
    ) {
      throw new PosTransactionPricingError(
        "Diskon, Ongkos, atau Round pada item tidak valid.",
      );
    }

    seenItemIds.add(itemId);

    return {
      itemId,
      priceSource,
      pricePerGram,
      discountAmount: value.discountAmount,
      laborAmount: value.laborAmount,
      adjustmentAmount: value.adjustmentAmount,
    };
  });
}

async function getActiveGoldRateMap(
  transaction: PosDbTransaction,
  organizationId: string,
  at: Date,
) {
  const rows = await transaction
    .select({
      purityPercent: metalPurities.purityPercentage,
      ratePerGram: metalPriceRates.ratePerGram,
    })
    .from(metalPriceRates)
    .innerJoin(metalPurities, eq(metalPriceRates.metalPurityId, metalPurities.id))
    .innerJoin(metals, eq(metalPurities.metalId, metals.id))
    .where(
      and(
        eq(metals.organizationId, organizationId),
        eq(metals.code, "GOLD"),
        eq(metals.isActive, true),
        eq(metalPurities.isActive, true),
        lte(metalPriceRates.effectiveFrom, at),
        or(
          isNull(metalPriceRates.effectiveUntil),
          gt(metalPriceRates.effectiveUntil, at),
        ),
      ),
    )
    .orderBy(desc(metalPriceRates.effectiveFrom));

  const result = new Map<string, string>();

  for (const row of rows) {
    const purityKey = normalizePurityKey(row.purityPercent);
    if (purityKey && !result.has(purityKey)) {
      result.set(purityKey, row.ratePerGram);
    }
  }

  return result;
}

export async function resolvePosTransactionPricing({
  transaction,
  organizationId,
  at,
  items,
  pricingInputs,
}: {
  transaction: PosDbTransaction;
  organizationId: string;
  at: Date;
  items: readonly PosTransactionPricingSourceItem[];
  pricingInputs: readonly PosCartPricingInput[];
}): Promise<ResolvedPosTransactionPricing[]> {
  if (items.length !== pricingInputs.length) {
    throw new PosTransactionPricingError(
      "Pricing item tidak cocok dengan isi cart. Kembali ke cart lalu coba lagi.",
    );
  }

  const inputMap = new Map(pricingInputs.map((input) => [input.itemId, input]));
  const activeRateMap = await getActiveGoldRateMap(
    transaction,
    organizationId,
    at,
  );

  return items.map((item) => {
    const input = inputMap.get(item.id);
    if (!input) {
      throw new PosTransactionPricingError(
        `Pricing ${item.sku} belum tersedia. Kembali ke cart lalu atur harga item.`,
      );
    }

    const purityKey = normalizePurityKey(item.purityPercent);
    if (!purityKey) {
      throw new PosTransactionPricingError(
        `${item.sku} belum memiliki Kadar Persen yang valid. Lengkapi data item sebelum dijual.`,
      );
    }

    const activePricePerGram = activeRateMap.get(purityKey) ?? null;
    const priceSource = normalizePriceSource(input.priceSource);
    let pricePerGram: string;
    let rateChanged = false;

    if (priceSource === "manual_override") {
      pricePerGram = input.pricePerGram;
    } else {
      if (!activePricePerGram) {
        throw new PosTransactionPricingError(
          `Harga standar untuk kadar ${item.purityPercent}% belum tersedia. Edit Harga/Gram transaksi pada item ini agar penjualan tetap bisa dilanjutkan.`,
        );
      }

      pricePerGram = activePricePerGram;
      rateChanged = input.pricePerGram !== activePricePerGram;
    }

    const basePriceAmount = calculatePosBasePrice({
      weightGram: item.weightGram,
      pricePerGram,
    });

    if (!basePriceAmount) {
      throw new PosTransactionPricingError(
        `${item.sku} belum bisa dihitung karena berat item atau Harga/Gram transaksi tidak valid.`,
      );
    }

    const finalPriceAmount = calculatePosFinalPrice({
      basePriceAmount,
      discountAmount: input.discountAmount,
      laborAmount: input.laborAmount,
      adjustmentAmount: input.adjustmentAmount,
    });

    if (!finalPriceAmount) {
      throw new PosTransactionPricingError(
        input.discountAmount > basePriceAmount
          ? `Diskon ${item.sku} tidak boleh lebih besar dari Harga Dasar.`
          : `Perhitungan harga ${item.sku} tidak valid. Periksa Harga/Gram, Diskon, Ongkos, dan Round.`,
      );
    }

    return {
      itemId: item.id,
      priceSource,
      activePricePerGram,
      pricePerGram,
      basePriceAmount,
      discountAmount: input.discountAmount,
      laborAmount: input.laborAmount,
      adjustmentAmount: input.adjustmentAmount,
      finalPriceAmount,
      rateChanged,
    };
  });
}
