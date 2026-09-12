import {
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Coins,
  Minus,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

import type { GoldReferenceResult } from "@/server/integrations/gold-reference/emas-api";

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

export function GoldReferenceCard({ result }: { result: GoldReferenceResult }) {
  if (result.status !== "ready") {
    const isNotConfigured = result.status === "not_configured";

    return (
      <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Coins className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-neutral-950">
                  Referensi Harga Emas
                </h2>
                <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">
                  Eksternal
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                ANTAM 1 gram · source resmi ANTAM via Emas API ID. Referensi ini
                tidak mengubah Harga / Gram ASIHJAYA.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--muted)]">
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
  const freshness = getFreshness(data.updatedAt);
  const spread =
    data.buybackPrice !== null ? data.sellPrice - data.buybackPrice : null;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
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
              <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">
                ANTAM {data.weightGrams} gram
              </span>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${freshness.className}`}
              >
                {freshness.label}
              </span>
            </div>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Source resmi ANTAM ({data.resource}) via {data.provider}. Hanya
              sebagai referensi pasar dan tidak mengubah Harga / Gram ASIHJAYA.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5">
            <Clock3 className="size-3.5" />
            {formatDateTime(data.updatedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            Read-only
          </span>
        </div>
      </div>

      <div className="grid border-t border-[var(--border)] sm:grid-cols-3">
        <div className="min-w-0 border-b border-[var(--border)] p-4 sm:border-b-0 sm:border-r sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Harga Jual Referensi
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
            {formatMoney(data.sellPrice)}
          </p>
          <div className="mt-2">
            <ChangeBadge
              value={data.sellPriceChange}
              comparisonUpdatedAt={data.comparisonUpdatedAt}
            />
          </div>
        </div>

        <div className="min-w-0 border-b border-[var(--border)] p-4 sm:border-b-0 sm:border-r sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Harga Buyback Referensi
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
            {data.buybackPrice !== null ? formatMoney(data.buybackPrice) : "-"}
          </p>
          <div className="mt-2">
            <ChangeBadge
              value={data.buybackPriceChange}
              comparisonUpdatedAt={data.comparisonUpdatedAt}
            />
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Spread Referensi
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
            {spread !== null ? formatMoney(spread) : "-"}
          </p>
          <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">
            Selisih harga jual dan buyback ANTAM 1 gram pada data referensi.
          </p>
        </div>
      </div>
    </section>
  );
}
