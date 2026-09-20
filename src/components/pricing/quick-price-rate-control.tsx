"use client";

import { LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  canManageQuickPriceRatesAction,
  saveQuickPriceRateAction,
  type QuickPriceRateKind,
} from "@/app/actions/quick-price-rates";
import { cn } from "@/lib/utils";

let pricingAccessPromise: Promise<boolean> | null = null;

function loadPricingAccess() {
  pricingAccessPromise ??= canManageQuickPriceRatesAction().catch(() => false);
  return pricingAccessPromise;
}

function normalizePurityKey(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const numeric = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 100) return null;
  return numeric
    .toFixed(3)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 18).replace(/^0+(?=\d)/, "");
}

function formatDigits(value: string) {
  if (!value) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    BigInt(value),
  );
}

function formatMoney(value: string | null | undefined) {
  if (!value) return "Belum diatur";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Belum diatur";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
}

export type QuickPriceRateSavedValue = {
  purityKey: string;
  ratePerGram: string;
};

export function QuickPriceRateControl({
  kind,
  purityPercent,
  ratePerGram,
  onSaved,
  disabled = false,
  className,
}: {
  kind: QuickPriceRateKind;
  purityPercent: string;
  ratePerGram: string | null;
  onSaved?: (value: QuickPriceRateSavedValue) => void;
  disabled?: boolean;
  className?: string;
}) {
  const purityKey = useMemo(
    () => normalizePurityKey(purityPercent),
    [purityPercent],
  );
  const [canManage, setCanManage] = useState(false);
  const [accessResolved, setAccessResolved] = useState(false);
  const [open, setOpen] = useState(false);
  const [rateInput, setRateInput] = useState(ratePerGram ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPricingAccess().then((allowed) => {
      if (cancelled) return;
      setCanManage(allowed);
      setAccessResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!accessResolved || !canManage) {
    return null;
  }

  const hasRate = Boolean(ratePerGram);
  const rateLabel = kind === "sale" ? "Rate Jual Global" : "Rate Buyback Global";
  const canOpen = Boolean(purityKey) && !disabled;

  function openDialog() {
    if (!canOpen) return;
    setRateInput(ratePerGram ?? "");
    setMessage(null);
    setOpen(true);
  }

  async function save() {
    if (!purityKey || isSaving) return;
    const normalizedRate = normalizeDigits(rateInput);
    if (!normalizedRate || normalizedRate === "0") {
      setMessage("Harga / Gram wajib lebih besar dari Rp0.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    const result = await saveQuickPriceRateAction({
      kind,
      purityPercent: purityKey,
      ratePerGram: normalizedRate,
    });
    setIsSaving(false);

    if (
      result.status === "success" &&
      result.purityKey &&
      result.ratePerGram
    ) {
      onSaved?.({
        purityKey: result.purityKey,
        ratePerGram: result.ratePerGram,
      });
      setOpen(false);
      return;
    }

    setMessage(result.message);
  }

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
            role="dialog"
            aria-modal="true"
            aria-label={`${hasRate ? "Ubah" : "Tambah"} ${rateLabel}`}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target && !isSaving) {
                setOpen(false);
              }
            }}
          >
            <div className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                    Dynamic Pricing
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-neutral-950">
                    {hasRate ? "Ubah" : "Tambah"} {rateLabel}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Kadar {purityKey}% · harga saat ini {formatMoney(ratePerGram)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isSaving}
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                  aria-label="Tutup"
                >
                  <X className="size-4" />
                </button>
              </div>

              <label className="mt-5 block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Harga / Gram Baru
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-neutral-500">
                    Rp
                  </span>
                  <input
                    autoFocus
                    value={formatDigits(rateInput)}
                    onChange={(event) =>
                      setRateInput(normalizeDigits(event.target.value))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void save();
                      }
                    }}
                    inputMode="numeric"
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-11 pr-3 text-sm font-semibold text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                    placeholder="850.000"
                  />
                </div>
              </label>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                {kind === "sale"
                  ? `Perubahan ini menjadi Rate Jual Global untuk semua produk dengan kadar ${purityKey}%. Histori rate lama tetap tersimpan.`
                  : `Perubahan ini menjadi Rate Buyback Global untuk rekomendasi buyback kadar ${purityKey}%. Total Buyback final tetap ditentukan staff.`}
              </div>

              {message ? (
                <p className="mt-3 text-sm font-medium text-red-700">{message}</p>
              ) : null}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isSaving}
                  className="h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={isSaving || !normalizeDigits(rateInput)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : hasRate ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {isSaving ? "Menyimpan..." : "Simpan Rate"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={!canOpen}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--accent)] bg-white text-[var(--accent)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-neutral-300",
          className,
        )}
        aria-label={
          purityKey
            ? `${hasRate ? "Ubah" : "Tambah"} ${rateLabel} kadar ${purityKey}%`
            : "Isi Kadar Persen terlebih dahulu"
        }
        title={
          purityKey
            ? `${hasRate ? "Ubah" : "Tambah"} ${rateLabel}`
            : "Isi Kadar Persen terlebih dahulu"
        }
      >
        {hasRate ? <Pencil className="size-4" /> : <Plus className="size-5" />}
      </button>
      {dialog}
    </>
  );
}
