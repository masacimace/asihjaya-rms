"use client";

import { BadgePercent, LoaderCircle, X } from "lucide-react";

import type {
  PosAvailableItem,
  PosCustomerOption,
} from "@/features/pos/contracts";
import { getDiscountApprovalDialogState } from "@/features/pos/dialog-state";
import {
  formatCurrency,
  formatRupiahInput,
} from "@/features/pos/payment-draft";
import { cn } from "@/lib/utils";

export type PosDiscountApprovalDialogProps = {
  cartItems: PosAvailableItem[];
  subtotalAmount: number;
  selectedCustomer: PosCustomerOption | null;
  amountInput: string;
  reasonInput: string;
  feedback: string | null;
  isPending: boolean;
  onAmountInputChange: (value: string) => void;
  onReasonInputChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function PosDiscountApprovalDialog({
  cartItems,
  subtotalAmount,
  selectedCustomer,
  amountInput,
  reasonInput,
  feedback,
  isPending,
  onAmountInputChange,
  onReasonInputChange,
  onCancel,
  onSubmit,
}: PosDiscountApprovalDialogProps) {
  const { projectedTotalAmount, discountIsTooHigh } =
    getDiscountApprovalDialogState({
      subtotalAmount,
      amountInput,
    });

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/35 backdrop-blur-sm sm:items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-discount-title"
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl sm:border sm:border-[var(--border)]"
      >
        <header className="shrink-0 border-b border-[var(--border)] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--accent)]">
                Diskon POS
              </p>
              <h2
                id="pos-discount-title"
                className="mt-1 text-base font-semibold text-neutral-950 sm:text-lg"
              >
                Terapkan diskon transaksi
              </h2>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)] sm:text-sm sm:leading-6">
                Diskon akan langsung diterapkan ke transaksi tanpa approval.
              </p>
            </div>

            <button
              type="button"
              aria-label="Tutup form diskon"
              onClick={onCancel}
              disabled={isPending}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="scrollbar-clean min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">Subtotal cart</span>
              <span className="font-semibold text-neutral-950">
                {formatCurrency(subtotalAmount)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">Jumlah item</span>
              <span className="font-semibold text-neutral-950">
                {cartItems.length} item
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">Customer</span>
              <span className="truncate font-semibold text-neutral-950">
                {selectedCustomer?.fullName ?? "Walk-in customer"}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Nominal diskon
              </span>
              <input
                value={amountInput}
                onChange={(event) =>
                  onAmountInputChange(formatRupiahInput(event.target.value))
                }
                inputMode="numeric"
                autoComplete="off"
                placeholder="Contoh: 100.000"
                className={cn(
                  "h-12 w-full rounded-2xl border bg-white px-4 text-base font-semibold text-neutral-950 outline-none transition placeholder:text-sm placeholder:font-normal placeholder:text-neutral-400 focus:ring-4",
                  discountIsTooHigh
                    ? "border-red-300 focus:border-red-400 focus:ring-red-50"
                    : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent-soft)]",
                )}
              />
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                Total setelah diskon: {formatCurrency(projectedTotalAmount)}.
              </p>
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Catatan diskon (opsional)
              </span>
              <textarea
                value={reasonInput}
                onChange={(event) => onReasonInputChange(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Contoh: Customer langganan, pembelian ulang, sudah disetujui negosiasi harga."
                className="w-full resize-none rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                Boleh dikosongkan. Catatan disimpan bersama transaksi.
              </p>
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-3">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Item dalam transaksi
            </p>
            <div className="mt-3 space-y-2 sm:max-h-48 sm:overflow-y-auto sm:overscroll-contain sm:pr-1">
              {cartItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-950">
                      {index + 1}. {item.productName}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {item.sku} · {item.barcode}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-neutral-950">
                    {formatCurrency(item.sellingAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {feedback ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              {feedback}
            </div>
          ) : null}
        </div>

        <footer className="grid shrink-0 grid-cols-[0.85fr_1.4fr] gap-2 border-t border-[var(--border)] px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:grid-cols-[1fr_1.4fr] sm:p-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex h-11 min-w-0 items-center justify-center rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 sm:px-4 sm:text-sm"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || discountIsTooHigh}
            className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:cursor-wait disabled:opacity-70 sm:px-4 sm:text-sm"
          >
            {isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Menerapkan diskon...
              </>
            ) : (
              <>
                <BadgePercent className="size-4" />
                Terapkan Diskon
              </>
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
