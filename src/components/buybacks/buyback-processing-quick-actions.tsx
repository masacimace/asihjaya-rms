"use client";

import { Sparkles, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ProcessingDrawer } from "@/components/buybacks/buyback-processing-workspace";
import type {
  BuybackProcessingQueueRow,
  BuybackProcessingRateOption,
} from "@/features/buybacks/processing-contracts";
import type {
  ProductMasterCategoryOption,
  ProductMasterOption,
} from "@/features/products/product-master-queries";
import type { ProductColorPresetOption } from "@/features/settings/product-color-presets";
import { cn } from "@/lib/utils";

export function BuybackProcessingQuickActions({
  rows,
  categories,
  productMasters,
  colorPresets,
  priceRates,
  canProcess,
  canPrintLabel,
  canViewInventory,
  variant = "desktop",
}: {
  rows: BuybackProcessingQueueRow[];
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  colorPresets: ProductColorPresetOption[];
  priceRates: BuybackProcessingRateOption[];
  canProcess: boolean;
  canPrintLabel: boolean;
  canViewInventory: boolean;
  variant?: "mobile" | "desktop";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<BuybackProcessingQueueRow | null>(
    null,
  );

  const pendingByType = useMemo(() => {
    const pending = rows
      .filter((row) => row.status === "pending")
      .slice()
      .sort((left, right) => left.lineNumber - right.lineNumber);

    return {
      cleaning: pending.filter((row) => row.processingType === "cleaning"),
      recondition: pending.filter(
        (row) => row.processingType === "recondition",
      ),
    };
  }, [rows]);

  if (
    pendingByType.cleaning.length === 0 &&
    pendingByType.recondition.length === 0
  ) {
    return null;
  }

  function openFirstPending(type: "cleaning" | "recondition") {
    const row = pendingByType[type][0];
    if (row) setSelected(row);
  }

  return (
    <>
      <div
        className={cn(
          variant === "mobile"
            ? "mt-4 grid gap-2 sm:grid-cols-1"
            : "min-w-[142px] grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-2",
        )}
      >
        {pendingByType.cleaning.length > 0 ? (
          <button
            type="button"
            disabled={!canProcess}
            onClick={() => openFirstPending("cleaning")}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 !font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40",
              variant === "mobile"
                ? "h-10 px-3 !text-xs"
                : "min-h-9 px-3 py-2 !text-xs",
            )}
          >
            <Sparkles className="size-3.5 shrink-0" />
            Proses Cuci
            {pendingByType.cleaning.length > 1
              ? ` (${pendingByType.cleaning.length})`
              : ""}
          </button>
        ) : null}

        {pendingByType.recondition.length > 0 ? (
          <button
            type="button"
            disabled={!canProcess}
            onClick={() => openFirstPending("recondition")}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 !font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40",
              variant === "mobile"
                ? "h-10 px-3 !text-xs"
                : "min-h-9 px-3 py-2 !text-xs",
            )}
          >
            <Wrench className="size-3.5 shrink-0" />
            Proses Rongsok
            {pendingByType.recondition.length > 1
              ? ` (${pendingByType.recondition.length})`
              : ""}
          </button>
        ) : null}
      </div>

      {selected ? (
        <ProcessingDrawer
          key={selected.id}
          row={selected}
          categories={categories}
          productMasters={productMasters}
          colorPresets={colorPresets}
          priceRates={priceRates}
          onClose={() => setSelected(null)}
          onCompleted={() => {
            router.refresh();
          }}
          canPrintLabel={canPrintLabel}
          canViewInventory={canViewInventory}
        />
      ) : null}
    </>
  );
}
