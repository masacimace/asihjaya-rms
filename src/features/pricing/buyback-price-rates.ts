import { and, asc, desc, eq, gt, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db";
import {
  metalBuybackPriceRates,
  metalPurities,
  metals,
} from "@/db/schema";
import { normalizePurityKey } from "@/features/pricing/metal-price-rates";

export type ActiveBuybackPriceRate = {
  metalPurityId: string;
  purityPercent: string;
  purityKey: string;
  purityCode: string;
  purityName: string;
  ratePerGram: string;
  effectiveFrom: Date;
};

export async function getActiveGoldBuybackPriceRates({
  organizationId,
  at = new Date(),
}: {
  organizationId: string;
  at?: Date;
}): Promise<ActiveBuybackPriceRate[]> {
  const rows = await db
    .select({
      metalPurityId: metalPurities.id,
      purityPercent: metalPurities.purityPercentage,
      purityCode: metalPurities.code,
      purityName: metalPurities.displayName,
      ratePerGram: metalBuybackPriceRates.ratePerGram,
      effectiveFrom: metalBuybackPriceRates.effectiveFrom,
    })
    .from(metalBuybackPriceRates)
    .innerJoin(
      metalPurities,
      eq(metalBuybackPriceRates.metalPurityId, metalPurities.id),
    )
    .innerJoin(metals, eq(metalPurities.metalId, metals.id))
    .where(
      and(
        eq(metals.organizationId, organizationId),
        eq(metals.code, "GOLD"),
        eq(metals.isActive, true),
        eq(metalPurities.isActive, true),
        lte(metalBuybackPriceRates.effectiveFrom, at),
        or(
          isNull(metalBuybackPriceRates.effectiveUntil),
          gt(metalBuybackPriceRates.effectiveUntil, at),
        ),
      ),
    )
    .orderBy(desc(metalBuybackPriceRates.effectiveFrom));

  const seen = new Set<string>();
  const result: ActiveBuybackPriceRate[] = [];

  for (const row of rows) {
    const purityKey = normalizePurityKey(row.purityPercent);
    if (!purityKey || seen.has(purityKey)) continue;

    seen.add(purityKey);
    result.push({ ...row, purityKey });
  }

  return result.sort((left, right) => Number(left.purityKey) - Number(right.purityKey));
}

export async function getActiveGoldBuybackPriceRateMap(
  organizationId: string,
) {
  const rates = await getActiveGoldBuybackPriceRates({ organizationId });
  return new Map(rates.map((rate) => [rate.purityKey, rate]));
}

export type BuybackPriceRateSettingRow = {
  purityKey: string;
  ratePerGram: string | null;
  effectiveFrom: Date | null;
};

export async function getBuybackPriceRateSettingsData(organizationId: string) {
  const [activeRates, purityRows] = await Promise.all([
    getActiveGoldBuybackPriceRates({ organizationId }),
    db
      .select({ purityPercent: metalPurities.purityPercentage })
      .from(metalPurities)
      .innerJoin(metals, eq(metalPurities.metalId, metals.id))
      .where(
        and(
          eq(metals.organizationId, organizationId),
          eq(metals.code, "GOLD"),
          eq(metals.isActive, true),
          eq(metalPurities.isActive, true),
        ),
      )
      .orderBy(asc(metalPurities.purityPercentage)),
  ]);

  const rows = new Map<string, BuybackPriceRateSettingRow>();

  for (const rate of activeRates) {
    rows.set(rate.purityKey, {
      purityKey: rate.purityKey,
      ratePerGram: rate.ratePerGram,
      effectiveFrom: rate.effectiveFrom,
    });
  }

  for (const purity of purityRows) {
    const purityKey = normalizePurityKey(purity.purityPercent);
    if (!purityKey || rows.has(purityKey)) continue;

    rows.set(purityKey, {
      purityKey,
      ratePerGram: null,
      effectiveFrom: null,
    });
  }

  return Array.from(rows.values()).sort(
    (left, right) => Number(left.purityKey) - Number(right.purityKey),
  );
}
