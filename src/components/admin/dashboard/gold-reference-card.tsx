"use client";

import { useSyncExternalStore, type ChangeEvent } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Clock3,
  Coins,
  Minus,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

import type {
  GoldReferenceResult,
  GoldReferenceSnapshot,
} from "@/server/integrations/gold-reference/emas-api";

const STORAGE_KEY = "asihjaya.gold-reference.selection.v1";
const STORAGE_EVENT = "asihjaya:gold-reference-selection";
let memoryReferenceKey: string | null = null;

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Waktu update tidak tersedia";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getFreshness(updatedAt: string | null) {
  if (!updatedAt) {
    return {
      label: "Waktu update tidak tersedia",
      className: "bg-neutral-100 text-neutral-600",
    };
  }

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return {
      label: "Update tersedia",
      className: "bg-neutral-100 text-neutral-600",
    };
  }

  const ageMs = Date.now() - date.getTime();
  const staleAfterMs = 36 * 60 * 60 * 1000;

  if (ageMs > staleAfterMs) {
    return {
      label: "Periksa freshness data",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Data terbaru",
    className: "bg-emerald-50 text-emerald-700",
  };
}

function formatComparisonLabel(value: string | null) {
  if (!value) return "dari data sebelumnya";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "dari data sebelumnya";

  const label = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);

  return `vs ${label}`;
}

function ChangeBadge({
  value,
  comparisonUpdatedAt,
}: {
  value: number | null;
  comparisonUpdatedAt: string | null;
}) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-500">
        <Minus className="size-3" />
        perubahan belum tersedia
      </span>
    );
  }

  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const className =
    value > 0
      ? "bg-emerald-50 text-emerald-700"
      : value < 0
        ? "bg-red-50 text-red-600"
        : "bg-neutral-100 text-neutral-600";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${className}`}
    >
      <Icon className="size-3" />
      {value > 0 ? "+" : ""}
      {formatMoney(value)} {formatComparisonLabel(comparisonUpdatedAt)}
    </span>
  );
}

function readStoredReferenceKey() {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) memoryReferenceKey = stored;
    return stored ?? memoryReferenceKey;
  } catch {
    return memoryReferenceKey;
  }
}

function subscribeStoredReferenceKey(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    memoryReferenceKey = event.newValue;
    onStoreChange();
  };
  const onLocalChange = () => onStoreChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(STORAGE_EVENT, onLocalChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STORAGE_EVENT, onLocalChange);
  };
}

function persistReferenceKey(referenceKey: string) {
  memoryReferenceKey = referenceKey;

  try {
    window.localStorage.setItem(STORAGE_KEY, referenceKey);
  } catch {
    // Browser storage is optional. Keep the in-memory selection as fallback.
  }

  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function findSelectedReference(
  references: GoldReferenceSnapshot[],
  storedReferenceKey: string | null,
  defaultReferenceKey: string,
) {
  return (
    references.find(
      (reference) => reference.referenceKey === storedReferenceKey,
    ) ??
    references.find(
      (reference) => reference.referenceKey === defaultReferenceKey,
    ) ??
    references[0]
  );
}

export function GoldReferenceCard({ result }: { result: GoldReferenceResult }) {
  const storedReferenceKey = useSyncExternalStore(
    subscribeStoredReferenceKey,
    readStoredReferenceKey,
    () => null,
  );

  if (result.status !== "ready") {
    const isNotConfigured = result.status === "not_configured";

    return (
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Coins className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-neutral-950">
                Referensi Harga Emas
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Referensi eksternal 1 gram sebagai acuan harga pasar dari
                berbagai brand dan sumber. Harga internal ASIHJAYA tidak
                berubah.
              </p>
            </div>
          </div>

          <div className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--muted)]">
            <WifiOff className="size-4" />
            {isNotConfigured
              ? "Integrasi belum diaktifkan"
              : "Referensi sementara tidak tersedia"}
          </div>
        </div>
      </section>
    );
  }

  const { data } = result;
  const selectedReference = findSelectedReference(
    data.references,
    storedReferenceKey,
    data.defaultReferenceKey,
  );

  if (!selectedReference) return null;

  const freshness = getFreshness(selectedReference.updatedAt);
  const spread =
    selectedReference.buybackPrice !== null
      ? selectedReference.sellPrice - selectedReference.buybackPrice
      : null;

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
      <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Coins className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-neutral-950">
                Referensi Harga Emas
              </h2>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${freshness.className}`}
              >
                {freshness.label}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {selectedReference.brand} · sumber {selectedReference.resource} ·{" "}
              {selectedReference.weightGrams} gram via {data.provider}. Gunakan
              sebagai referensi acuan harga pasar dari berbagai sumber.
            </p>
          </div>
        </div>

        <label className="min-w-0 lg:min-w-[240px]">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Sumber referensi
          </span>
          <span className="relative block">
            <select
              aria-label="Pilih referensi harga emas"
              className="h-10 w-full appearance-none rounded-xl border border-[var(--border)] bg-white py-2 pl-3 pr-9 text-sm font-semibold text-neutral-800 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              value={selectedReference.referenceKey}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                persistReferenceKey(event.target.value)
              }
            >
              {data.references.map((reference) => (
                <option
                  key={reference.referenceKey}
                  value={reference.referenceKey}
                >
                  {reference.brand} · {reference.resource}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          </span>
        </label>
      </div>

      <div className="grid border-t border-[var(--border)] md:grid-cols-3">
        <div className="min-w-0 border-b border-[var(--border)] p-4 md:border-b-0 md:border-r sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Harga Jual Referensi
          </p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-neutral-950">
            {formatMoney(selectedReference.sellPrice)}
          </p>
          <div className="mt-2">
            <ChangeBadge
              value={selectedReference.sellPriceChange}
              comparisonUpdatedAt={selectedReference.comparisonUpdatedAt}
            />
          </div>
        </div>

        <div className="min-w-0 border-b border-[var(--border)] p-4 md:border-b-0 md:border-r sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Harga Buyback Referensi
          </p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-neutral-950">
            {selectedReference.buybackPrice !== null
              ? formatMoney(selectedReference.buybackPrice)
              : "-"}
          </p>
          <div className="mt-2">
            <ChangeBadge
              value={selectedReference.buybackPriceChange}
              comparisonUpdatedAt={selectedReference.comparisonUpdatedAt}
            />
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Spread Referensi
          </p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-neutral-950">
            {spread !== null ? formatMoney(spread) : "-"}
          </p>
          <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">
            Selisih harga jual dan buyback referensi 1 gram.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)]/55 px-4 py-3 text-[11px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p>
          Referensi ini bersifat read-only, pricing internal tetap dikendalikan
          sistem dan kebijakan ASIHJAYA.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" />
            {formatDateTime(selectedReference.updatedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
            <ShieldCheck className="size-3.5" />
            Read-only
          </span>
        </div>
      </div>
    </section>
  );
}
