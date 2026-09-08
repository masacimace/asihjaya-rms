"use client";

import { BadgeDollarSign, X } from "lucide-react";
import { useEffect, useState } from "react";

import { MetalPriceRateForm } from "@/components/pricing/metal-price-rate-form";
import type { MetalPriceRateSettingRow } from "@/features/pricing/metal-price-rates";

export function MetalPriceRateDrawer({
  rows,
}: {
  rows: MetalPriceRateSettingRow[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-h-28 flex-col items-center justify-center rounded-xl border border-[var(--border)] p-3 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
      >
        <BadgeDollarSign className="size-5 text-[var(--accent)] transition-transform group-hover:scale-105" />
        <p className="mt-2 text-xs font-semibold text-neutral-900">
          Harga / Gram
        </p>
        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--muted)]">
          Update rate global harian
        </p>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] bg-black/35 md:flex md:justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="metal-price-rate-drawer-title"
        >
          <button
            type="button"
            aria-label="Tutup panel Harga / Gram"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
          />

          <aside className="relative z-[1] flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl md:w-[min(980px,calc(100vw-32px))] md:border-l md:border-[var(--border)]">
            <header className="shrink-0 border-b border-[var(--border)] bg-white px-4 py-4 sm:px-5 md:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <BadgeDollarSign className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h2
                      id="metal-price-rate-drawer-title"
                      className="text-lg font-semibold text-neutral-950"
                    >
                      Harga / Gram Global
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Update rate standar POS langsung dari Dashboard Admin.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
                  aria-label="Tutup"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-neutral-50/60 p-4 sm:p-5 md:p-6">
              <MetalPriceRateForm rows={rows} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
