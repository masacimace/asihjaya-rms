"use client";

import { ChevronRight, ShoppingBag, X } from "lucide-react";
import type { ReactNode } from "react";

import { formatCurrency } from "@/features/pos/payment-draft";

export type PosPanelMode = "cart" | "payment" | "success";

type PosMobileSidePanelProps = {
  isOpen: boolean;
  mode: PosPanelMode;
  itemCount: number;
  totalAmount: number;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
};

function getPanelTitle(mode: PosPanelMode) {
  if (mode === "success") {
    return "Transaksi Berhasil";
  }

  if (mode === "payment") {
    return "Pembayaran Manual";
  }

  return "Keranjang Penjualan";
}

function getPanelDescription(mode: PosPanelMode) {
  if (mode === "success") {
    return "Transaksi sudah tersimpan.";
  }

  if (mode === "payment") {
    return "Selesaikan payment dan simpan transaksi.";
  }

  return "Periksa item sebelum pembayaran.";
}

export function PosMobileSidePanel({
  isOpen,
  mode,
  itemCount,
  totalAmount,
  onOpen,
  onClose,
  children,
}: PosMobileSidePanelProps) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="fixed bottom-[124px] left-4 right-4 z-30 flex h-16 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 text-left shadow-[0_12px_32px_rgba(0,0,0,0.14)] lg:hidden"
      >
        <div className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <ShoppingBag className="size-5" />

          <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-white">
            {itemCount}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--muted)]">
            {itemCount > 0
              ? `${itemCount} item di keranjang`
              : "Penjualan Saat Ini"}
          </p>

          <p className="mt-0.5 truncate text-sm font-semibold text-neutral-950">
            {formatCurrency(totalAmount)}
          </p>
        </div>

        <ChevronRight className="size-5 shrink-0 text-neutral-400" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white lg:hidden">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur">
            <div>
              <p className="font-semibold text-neutral-950">
                {getPanelTitle(mode)}
              </p>

              <p className="text-xs text-[var(--muted)]">
                {getPanelDescription(mode)}
              </p>
            </div>

            <button
              type="button"
              aria-label="Tutup keranjang"
              onClick={onClose}
              className="grid size-10 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100"
            >
              <X className="size-5" />
            </button>
          </header>

          {children}
        </div>
      ) : null}
    </>
  );
}
