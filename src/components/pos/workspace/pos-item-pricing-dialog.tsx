"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgePercent,
  CircleDollarSign,
  Hammer,
  RotateCcw,
  Scale,
  X,
} from "lucide-react";

import { PosItemImage } from "@/components/pos/workspace/pos-item-image";
import type { PosAvailableItem, PosCartItem } from "@/features/pos/contracts";
import {
  buildPosCartItem,
  calculatePosBasePrice,
  formatPosWeightInput,
  getPosPriceSource,
  getPosWeightSource,
  normalizePosTransactionWeight,
} from "@/features/pos/transaction-pricing";
import {
  formatCurrency,
  formatRupiahInput,
  parsePaymentAmountInput,
} from "@/features/pos/payment-draft";
import { cn } from "@/lib/utils";

export type PosItemPricingDialogProps = {
  item: PosAvailableItem;
  existingItem?: PosCartItem | null;
  onCancel: () => void;
  onConfirm: (item: PosCartItem) => void;
};

export function PosItemPricingDialog({
  item,
  existingItem = null,
  onCancel,
  onConfirm,
}: PosItemPricingDialogProps) {
  const [transactionWeightInput, setTransactionWeightInput] = useState("");
  const [pricePerGramInput, setPricePerGramInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [laborInput, setLaborInput] = useState("");
  const [adjustmentInput, setAdjustmentInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const initialPricePerGram =
      existingItem?.pricePerGram ?? item.activePricePerGram ?? "";

    setTransactionWeightInput(
      formatPosWeightInput(existingItem?.transactionWeightGram ?? item.weightGram ?? ""),
    );
    setPricePerGramInput(
      Number(initialPricePerGram) > 0
        ? formatRupiahInput(initialPricePerGram)
        : "",
    );
    setDiscountInput(
      existingItem && Number(existingItem.discountAmount) > 0
        ? formatRupiahInput(existingItem.discountAmount)
        : "",
    );
    setLaborInput(
      existingItem && Number(existingItem.laborAmount) > 0
        ? formatRupiahInput(existingItem.laborAmount)
        : "",
    );
    setAdjustmentInput(
      existingItem && Number(existingItem.adjustmentAmount) > 0
        ? formatRupiahInput(existingItem.adjustmentAmount)
        : "",
    );
    setFeedback(null);
  }, [existingItem, item.activePricePerGram, item.id]);

  const transactionWeightGram = normalizePosTransactionWeight(transactionWeightInput);
  const transactionPricePerGram = parsePaymentAmountInput(pricePerGramInput);
  const transactionPricePerGramText =
    transactionPricePerGram > 0 ? String(transactionPricePerGram) : null;
  const discountAmount = parsePaymentAmountInput(discountInput);
  const laborAmount = parsePaymentAmountInput(laborInput);
  const adjustmentAmount = parsePaymentAmountInput(adjustmentInput);
  const weightSource = getPosWeightSource({
    storedWeightGram: item.weightGram,
    transactionWeightGram,
  });
  const priceSource = getPosPriceSource({
    activePricePerGram: item.activePricePerGram,
    transactionPricePerGram: transactionPricePerGramText,
  });
  const basePriceAmount = useMemo(
    () =>
      calculatePosBasePrice({
        weightGram: transactionWeightGram,
        pricePerGram: transactionPricePerGramText,
      }),
    [transactionWeightGram, transactionPricePerGramText],
  );
  const projectedFinalAmount = basePriceAmount
    ? basePriceAmount - discountAmount + laborAmount + adjustmentAmount
    : 0;
  const hasItemPricingData = Boolean(transactionWeightGram && item.purityPercent);
  const hasValidTransactionPrice = Boolean(
    hasItemPricingData && transactionPricePerGramText && basePriceAmount,
  );
  const activePricePerGram = Number(item.activePricePerGram ?? 0);
  const rateDifference =
    activePricePerGram > 0 && transactionPricePerGram > 0
      ? transactionPricePerGram - activePricePerGram
      : null;

  function useActiveRate() {
    if (!item.activePricePerGram) {
      return;
    }

    setPricePerGramInput(formatRupiahInput(item.activePricePerGram));
    setFeedback(null);
  }

  function submit() {
    const result = buildPosCartItem(item, {
      transactionWeightGram,
      priceSource,
      pricePerGram: transactionPricePerGramText,
      discountAmount,
      laborAmount,
      adjustmentAmount,
    });

    if (result.status === "error") {
      setFeedback(result.message);
      return;
    }

    onConfirm(result.item);
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-stretch justify-center bg-black/35 backdrop-blur-sm sm:items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-item-pricing-title"
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-3xl sm:border sm:border-[var(--border)]"
      >
        <header className="shrink-0 border-b border-[var(--border)] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--accent)]">
                Pricing Item
              </p>
              <h2
                id="pos-item-pricing-title"
                className="mt-1 text-base font-semibold text-neutral-950 sm:text-lg"
              >
                {existingItem ? "Edit item transaksi" : "Tambahkan produk"}
              </h2>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)] sm:text-sm sm:leading-6">
                Timbang ulang bila diperlukan, lalu atur Harga/Gram transaksi. Perubahan berat baru disimpan ke item setelah checkout berhasil.
              </p>
            </div>

            <button
              type="button"
              aria-label="Tutup pricing item"
              onClick={onCancel}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="scrollbar-clean min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="flex gap-4 rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-3">
            <PosItemImage
              item={item}
              alt={`${item.productName} ${item.sku}`}
              className="size-20 shrink-0 rounded-2xl"
              iconClassName="size-8"
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-neutral-950">
                {item.productName}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">
                {item.sku} · {item.barcode}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-neutral-700">
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[var(--border)]">
                  Kadar {item.purityPercent ?? "-"}%
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[var(--border)]">
                  {transactionWeightGram ?? item.weightGram ?? "-"} gr
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-[var(--border)]">
                  {item.color ?? "Warna -"}
                </span>
              </div>
            </div>
          </div>


          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label
                  htmlFor="pos-transaction-weight"
                  className="flex items-center gap-2 text-sm font-semibold text-neutral-900"
                >
                  <Scale className="size-4 text-[var(--accent)]" />
                  Berat Transaksi
                </label>
                <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                  Timbang ulang item sebelum dijual bila berat tersimpan perlu dikoreksi.
                </p>
              </div>
              <div className="text-right text-[11px] text-[var(--muted)]">
                <p>Berat tersimpan</p>
                <p className="mt-0.5 font-semibold text-neutral-800">
                  {item.weightGram ? `${item.weightGram} gr` : "Belum tersedia"}
                </p>
              </div>
            </div>

            <div className="relative mt-3">
              <input
                id="pos-transaction-weight"
                value={transactionWeightInput}
                onChange={(event) => {
                  setTransactionWeightInput(formatPosWeightInput(event.target.value));
                  setFeedback(null);
                }}
                inputMode="decimal"
                autoComplete="off"
                placeholder="Contoh: 2,150"
                className="h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 pr-12 text-base font-semibold text-neutral-950 outline-none transition placeholder:font-normal placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-[var(--muted)]">
                gr
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] leading-4">
              {transactionWeightGram ? (
                weightSource === "stored" ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                    Mengikuti berat tersimpan
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                    Ditimbang ulang
                  </span>
                )
              ) : null}
              {weightSource === "reweighed" && item.weightGram && transactionWeightGram ? (
                <span className="text-[var(--muted)]">
                  Sebelumnya {item.weightGram} gr
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
              <p className="text-xs text-[var(--muted)]">
                Harga Standar Kadar {item.purityPercent ?? "-"}%
              </p>
              <p className="mt-1 text-base font-semibold text-neutral-950">
                {item.activePricePerGram
                  ? `${formatCurrency(item.activePricePerGram)} / gr`
                  : "Belum diatur"}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                Default dari Pengaturan Harga / Gram.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-3">
              <p className="text-xs text-[var(--muted)]">Harga Dasar Transaksi</p>
              <p className="mt-1 text-base font-semibold text-neutral-950">
                {basePriceAmount ? formatCurrency(basePriceAmount) : "Belum tersedia"}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                Berat × Harga/Gram transaksi.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/35 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label
                  htmlFor="pos-transaction-price-per-gram"
                  className="flex items-center gap-2 text-sm font-semibold text-neutral-900"
                >
                  <CircleDollarSign className="size-4 text-[var(--accent)]" />
                  Harga / Gram Transaksi
                </label>
                <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                  Nilai ini hanya digunakan untuk item pada transaksi ini.
                </p>
              </div>

              {item.activePricePerGram && priceSource === "manual_override" ? (
                <button
                  type="button"
                  onClick={useActiveRate}
                  className="shrink-0 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  Gunakan standar
                </button>
              ) : null}
            </div>

            <input
              id="pos-transaction-price-per-gram"
              value={pricePerGramInput}
              onChange={(event) => {
                setPricePerGramInput(formatRupiahInput(event.target.value));
                setFeedback(null);
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              className="mt-3 h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base font-semibold text-neutral-950 outline-none transition placeholder:font-normal placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] leading-4">
              {priceSource === "global" && transactionPricePerGram > 0 ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  Mengikuti harga standar
                </span>
              ) : transactionPricePerGram > 0 ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                  Harga khusus transaksi
                </span>
              ) : null}

              {rateDifference !== null && rateDifference !== 0 ? (
                <span className="text-[var(--muted)]">
                  {rateDifference > 0 ? "+" : "-"}
                  {formatCurrency(Math.abs(rateDifference))} / gr dari standar
                </span>
              ) : null}
            </div>

            {!item.activePricePerGram ? (
              <p className="mt-2 text-xs leading-5 text-amber-700">
                Harga standar kadar ini belum diatur. Isi Harga/Gram transaksi di atas untuk melanjutkan penjualan; rate global tidak akan berubah.
              </p>
            ) : null}
          </div>

          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-3 text-xs leading-5 text-[var(--muted)]">
            Potongan/Gram: <span className="font-semibold text-neutral-800">{formatCurrency(item.deductionPerGram ?? 0)}</span>. Nilai ini tetap disimpan sebagai data item dan tidak masuk perhitungan harga jual.
          </div>

          {!hasItemPricingData ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              {!item.purityPercent
                ? "Kadar Persen item belum diisi. Lengkapi data produk sebelum transaksi."
                : "Isi Berat Transaksi hasil timbang sebelum melanjutkan."}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <MoneyField
              label="Diskon"
              icon={<BadgePercent className="size-4" />}
              value={discountInput}
              onChange={setDiscountInput}
              helper="Mengurangi harga item"
            />
            <MoneyField
              label="Ongkos"
              icon={<Hammer className="size-4" />}
              value={laborInput}
              onChange={setLaborInput}
              helper="Menambah harga item"
            />
            <MoneyField
              label="Round"
              icon={<RotateCcw className="size-4" />}
              value={adjustmentInput}
              onChange={setAdjustmentInput}
              helper="Penyesuaian akhir"
            />
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <CircleDollarSign className="size-4 text-[var(--accent)]" />
                Total Harga Item
              </div>
              <span
                className={cn(
                  "text-xl font-semibold",
                  projectedFinalAmount > 0 ? "text-neutral-950" : "text-red-600",
                )}
              >
                {formatCurrency(Math.max(projectedFinalAmount, 0))}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
              <span>Harga Dasar</span>
              <span className="text-right font-medium text-neutral-800">
                {formatCurrency(basePriceAmount ?? 0)}
              </span>
              <span>Diskon</span>
              <span className="text-right font-medium text-red-600">
                -{formatCurrency(discountAmount)}
              </span>
              <span>Ongkos + Round</span>
              <span className="text-right font-medium text-neutral-800">
                +{formatCurrency(laborAmount + adjustmentAmount)}
              </span>
            </div>
          </div>

          {feedback ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {feedback}
            </div>
          ) : null}
        </div>

        <footer className="grid shrink-0 grid-cols-[0.8fr_1.4fr] gap-2 border-t border-[var(--border)] px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!hasValidTransactionPrice || projectedFinalAmount <= 0}
            className="flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            {existingItem ? "Simpan Item" : "Tambahkan ke Keranjang"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function MoneyField({
  label,
  icon,
  value,
  onChange,
  helper,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  helper: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-800">
        <span className="text-[var(--accent)]">{icon}</span>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(formatRupiahInput(event.target.value))}
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-neutral-950 outline-none transition placeholder:font-normal placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
      />
      <p className="mt-1.5 text-[11px] leading-4 text-[var(--muted)]">{helper}</p>
    </label>
  );
}
