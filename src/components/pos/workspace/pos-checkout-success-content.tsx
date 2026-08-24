"use client";

import {
  CheckCircle2,
  ChevronRight,
  FileText,
  ShoppingBag,
} from "lucide-react";

import type { PosCheckoutSaleResult } from "@/features/pos/contracts";
import { getPosCheckoutReceiptViewState } from "@/features/pos/checkout-result-state";
import { formatCurrency } from "@/features/pos/payment-draft";

type PosCheckoutSuccessContentProps = {
  sale: PosCheckoutSaleResult;
  onStartNewTransaction: () => void;
};

export function PosCheckoutSuccessContent({
  sale,
  onStartNewTransaction,
}: PosCheckoutSuccessContentProps) {
  const receiptView = getPosCheckoutReceiptViewState(sale);

  return (
    <div className="flex min-h-full flex-col bg-white p-4 sm:p-5">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <div className="grid size-14 place-items-center rounded-2xl bg-white text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>

        <p className="mt-5 text-xs font-semibold uppercase text-emerald-700">
          Transaksi Berhasil
        </p>
        <h2 className="mt-2 text-xl font-semibold text-neutral-950">
          {sale.invoiceNumber}
        </h2>
        <p className="mt-2 text-sm leading-6 text-emerald-800">
          Transaksi POS sudah tersimpan, payment tercatat, dan item otomatis
          berubah menjadi terjual.
        </p>
      </div>

      <div className="mt-4 rounded-3xl border border-[var(--border)] bg-white p-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-[var(--muted)]">Total transaksi</span>
          <span className="text-lg font-semibold text-neutral-950">
            {formatCurrency(sale.totalAmount)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 text-sm">
          <div className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-3 text-neutral-700">
            <FileText className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
            <div>
              <p className="font-medium text-neutral-900">
                Nota/certificate masuk antrean print
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Dokumen sudah dibuat dari data transaksi real
                {receiptView.hasPrintJob
                  ? " dan dikirim ke Hardware Hub untuk silent print."
                  : ". PDF tetap bisa dibuka manual dari tombol di bawah."}
              </p>
              {receiptView.printJobShortId ? (
                <p className="mt-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
                  Job print: {receiptView.printJobShortId}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-3 text-neutral-700">
            <ShoppingBag className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
            <div>
              <p className="font-medium text-neutral-900">
                Stok sudah diperbarui
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Item yang terjual tidak akan muncul lagi sebagai stok available
                di POS.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-[var(--border)] pt-4">
        <button
          type="button"
          onClick={onStartNewTransaction}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 font-semibold text-white transition hover:bg-[var(--accent)]/90"
        >
          Transaksi Baru
          <ChevronRight className="size-4" />
        </button>

        <div className="mt-3 grid gap-2 sm:grid-cols-1">
          <a
            href={receiptView.href}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 bg-black/90 !text-white text-sm font-medium text-neutral-700 transition hover:bg-black/80"
          >
            Download Receipt Nota
          </a>
        </div>

        <p className="mt-3 text-center text-[11px] leading-5 text-[var(--muted)]">
          Jika Document Printer belum dikonfigurasi di Hardware Hub, job print
          akan terlihat failed di dashboard hardware dan PDF tetap bisa dibuka
          manual.
        </p>
      </div>
    </div>
  );
}
