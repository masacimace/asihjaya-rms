"use client";

import { LoaderCircle, Pause, X } from "lucide-react";

import type {
  PosAvailableItem,
  PosCustomerOption,
} from "@/features/pos/contracts";
import { formatCurrency } from "@/features/pos/payment-draft";

export type PosHoldCartDialogProps = {
  cartItems: PosAvailableItem[];
  totalAmount: number;
  selectedCustomer: PosCustomerOption | null;
  titleInput: string;
  noteInput: string;
  feedback: string | null;
  isPending: boolean;
  onTitleInputChange: (value: string) => void;
  onNoteInputChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function PosHoldCartDialog({
  cartItems,
  totalAmount,
  selectedCustomer,
  titleInput,
  noteInput,
  feedback,
  isPending,
  onTitleInputChange,
  onNoteInputChange,
  onCancel,
  onSubmit,
}: PosHoldCartDialogProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-stretch justify-center bg-black/35 backdrop-blur-sm sm:items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-hold-cart-title"
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl sm:border sm:border-[var(--border)] sm:shadow-2xl"
      >
        <header className="shrink-0 border-b border-[var(--border)] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">
                Hold Cart
              </p>
              <h2
                id="pos-hold-cart-title"
                className="mt-1 text-base font-semibold text-neutral-950 sm:text-lg"
              >
                Tahan transaksi ini?
              </h2>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)] sm:text-sm sm:leading-6">
                Item akan dikunci sementara dan tidak muncul di katalog POS
                sampai hold di-resume atau dibatalkan.
              </p>
            </div>

            <button
              type="button"
              aria-label="Tutup form hold cart"
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
              <span className="text-[var(--muted)]">Total sementara</span>
              <span className="font-semibold text-neutral-950">
                {formatCurrency(totalAmount)}
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
                Nama hold / catatan singkat
              </span>
              <input
                value={titleInput}
                onChange={(event) => onTitleInputChange(event.target.value)}
                maxLength={160}
                autoComplete="off"
                enterKeyHint="next"
                placeholder="Contoh: Bu Sari tunggu suami"
                className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                Opsional, tapi sangat membantu saat mencari transaksi ditahan.
              </p>
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Catatan internal
              </span>
              <textarea
                value={noteInput}
                onChange={(event) => onNoteInputChange(event.target.value)}
                maxLength={500}
                rows={3}
                enterKeyHint="done"
                placeholder="Contoh: Customer cek saldo, item jangan dijual dulu."
                className="w-full resize-none rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-3">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Item yang dikunci
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
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
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
            disabled={isPending}
            className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:opacity-70 sm:px-4 sm:text-sm"
          >
            {isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Menahan transaksi...
              </>
            ) : (
              <>
                <Pause className="size-4" />
                Simpan Hold
              </>
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
