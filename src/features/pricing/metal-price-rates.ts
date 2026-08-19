import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { metalPriceRates, metalPurities, metals, productItems } from "@/db/schema";

export type ActiveMetalPriceRate = {
  metalPurityId: string;
  purityPercent: string;
  purityKey: string;
  purityCode: string;
  purityName: string;
  ratePerGram: string;
  effectiveFrom: Date;
};

export function normalizePurityKey(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(String(value).replace(",", "."));

  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 100) {
    return null;
  }

  return numeric.toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function calculateJewelryBasePrice({
  weightGram,
  ratePerGram,
}: {
  weightGram: string | null | undefined;
  ratePerGram: string | null | undefined;
}): number | null {
  if (!weightGram || !ratePerGram) {
    return null;
  }

  const normalizedWeight = weightGram.replace(",", ".");

  if (!/^\d+(?:\.\d{1,3})?$/.test(normalizedWeight) || !/^\d+$/.test(ratePerGram)) {
    return null;
  }

  const [wholeWeight = "0", decimalWeight = ""] = normalizedWeight.split(".");
  const weightMilli = BigInt(wholeWeight) * BigInt(1000) + BigInt(decimalWeight.padEnd(3, "0"));
  const rate = BigInt(ratePerGram);

  if (weightMilli <= BigInt(0) || rate <= BigInt(0)) {
    return null;
  }

  const roundedAmount = (weightMilli * rate + BigInt(500)) / BigInt(1000);

  if (roundedAmount > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }

  return Number(roundedAmount);
}

export async function getActiveGoldPriceRates({
  organizationId,
  at = new Date(),
}: {
  organizationId: string;
  at?: Date;
}): Promise<ActiveMetalPriceRate[]> {
  const rows = await db
    .select({
      metalPurityId: metalPurities.id,
      purityPercent: metalPurities.purityPercentage,
      purityCode: metalPurities.code,
      purityName: metalPurities.displayName,
      ratePerGram: metalPriceRates.ratePerGram,
      effectiveFrom: metalPriceRates.effectiveFrom,
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
        or(isNull(metalPriceRates.effectiveUntil), gt(metalPriceRates.effectiveUntil, at)),
      ),
    )
    .orderBy(desc(metalPriceRates.effectiveFrom));

  const seen = new Set<string>();
  const result: ActiveMetalPriceRate[] = [];

  for (const row of rows) {
    const purityKey = normalizePurityKey(row.purityPercent);

    if (!purityKey || seen.has(purityKey)) {
      continue;
    }

    seen.add(purityKey);
    result.push({
      ...row,
      purityKey,
    });
  }

  return result.sort((left, right) => Number(left.purityKey) - Number(right.purityKey));
}

export async function getActiveGoldPriceRateMap(organizationId: string) {
  const rates = await getActiveGoldPriceRates({ organizationId });

  return new Map(rates.map((rate) => [rate.purityKey, rate]));
}

export type MetalPriceRateSettingRow = {
  purityKey: string;
  ratePerGram: string | null;
  effectiveFrom: Date | null;
  itemCount: number;
};

export async function getMetalPriceRateSettingsData(organizationId: string) {
  const [activeRates, itemPurityRows] = await Promise.all([
    getActiveGoldPriceRates({ organizationId }),
    db
      .select({
        purityPercent: productItems.purityPercent,
        itemCount: sql<number>`count(*)::int`,
      })
      .from(productItems)
      .where(
        and(
          eq(productItems.organizationId, organizationId),
          eq(productItems.isActive, true),
          sql`${productItems.purityPercent} is not null`,
        ),
      )
      .groupBy(productItems.purityPercent),
  ]);

  const rows = new Map<string, MetalPriceRateSettingRow>();

  for (const rate of activeRates) {
    rows.set(rate.purityKey, {
      purityKey: rate.purityKey,
      ratePerGram: rate.ratePerGram,
      effectiveFrom: rate.effectiveFrom,
      itemCount: 0,
    });
  }

  for (const itemPurity of itemPurityRows) {
    const purityKey = normalizePurityKey(itemPurity.purityPercent);
    if (!purityKey) continue;

    const existing = rows.get(purityKey);
    rows.set(purityKey, {
      purityKey,
      ratePerGram: existing?.ratePerGram ?? null,
      effectiveFrom: existing?.effectiveFrom ?? null,
      itemCount: Number(itemPurity.itemCount ?? 0),
    });
  }

  return Array.from(rows.values()).sort(
    (left, right) => Number(left.purityKey) - Number(right.purityKey),
  );
}
