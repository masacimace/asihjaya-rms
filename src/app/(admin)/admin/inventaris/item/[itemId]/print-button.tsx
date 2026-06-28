"use client";

import { Barcode } from "lucide-react";
import { useState } from "react";

export function PrintLabelButton({
  item,
}: {
  item: {
    sku: string;
    productName: string;
    barcode: string;
    weightGram: string | null;
    purityPercent: string | null;
    exchangePurityPercent: string | null;
    size: string | null;
    color: string | null;
    gemstone: string | null;
    sellingAmount: string | null;
  };
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  async function handlePrint() {
    setIsPrinting(true);
    try {
      const response = await fetch("/api/print-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: item.sku,
          productName: item.productName,
          barcode: item.barcode,
          weightGram: item.weightGram,
          purityPercent: item.purityPercent,
          exchangePurityPercent: item.exchangePurityPercent,
          size: item.size,
          color: item.color,
          gemstone: item.gemstone,
          sellingAmount: item.sellingAmount,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to queue print job");
      }

      alert("Tugas cetak berhasil dikirim ke antrean toko!");
    } catch (error) {
      console.error(error);
      alert("Gagal mengirim tugas cetak.");
    } finally {
      setIsPrinting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={isPrinting}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 !text-sm !font-medium text-black transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
    >
      <Barcode className="size-4" />
      {isPrinting ? "Mengirim..." : "Cetak Label"}
    </button>
  );
}
