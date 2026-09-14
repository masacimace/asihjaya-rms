"use client";

import { useState } from "react";

import { BuybackPriceRateForm } from "@/components/pricing/buyback-price-rate-form";
import { MetalPriceRateForm } from "@/components/pricing/metal-price-rate-form";
import type { BuybackPriceRateSettingRow } from "@/features/pricing/buyback-price-rates";
import type { MetalPriceRateSettingRow } from "@/features/pricing/metal-price-rates";
import { cn } from "@/lib/utils";

type PriceRateTab = "sale" | "buyback";

export function MetalPriceRateSettingsTabs({
  saleRows,
  buybackRows,
}: {
  saleRows: MetalPriceRateSettingRow[];
  buybackRows: BuybackPriceRateSettingRow[];
}) {
  const [activeTab, setActiveTab] = useState<PriceRateTab>("sale");

  return (
    <div className="space-y-4">
      <div className="inline-flex w-full rounded-2xl border border-[var(--border)] bg-neutral-100 p-1 sm:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("sale")}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:min-w-36",
            activeTab === "sale"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800",
          )}
        >
          Rate Jual
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("buyback")}
          className={cn(
            "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:min-w-36",
            activeTab === "buyback"
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800",
          )}
        >
          Rate Buyback
        </button>
      </div>

      <div className={activeTab === "sale" ? "block" : "hidden"}>
        <MetalPriceRateForm rows={saleRows} />
      </div>
      <div className={activeTab === "buyback" ? "block" : "hidden"}>
        <BuybackPriceRateForm rows={buybackRows} />
      </div>
    </div>
  );
}
