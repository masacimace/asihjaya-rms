"use client";

import { CircleDollarSign, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useActionState,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  retireBuybackPriceRateAction,
  saveBuybackPriceRatesAction,
} from "@/app/actions/buyback-price-rates";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { BuybackPriceRateSettingRow } from "@/features/pricing/buyback-price-rates";
import {
  initialMetalPriceRateActionState,
  type MetalPriceRateActionState,
} from "@/features/pricing/metal-price-rate-action-state";

const inputClassName =
  "h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function formatMoneyInput(value: string | null) {
  const digits = String(value ?? "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 18);

  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function handleMoneyInput(event: FormEvent<HTMLInputElement>) {
  event.currentTarget.value = formatMoneyInput(event.currentTarget.value);
}

function formatDate(value: Date | null) {
  if (!value) return "Belum ada rate aktif";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function Feedback({ state }: { state: MetalPriceRateActionState | null }) {
  if (!state?.message) return null;
  return (
    <div
      role="alert"
      className={
        state.status === "success"
          ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      }
    >
      {state.message}
    </div>
  );
}

export function BuybackPriceRateForm({ rows }: { rows: BuybackPriceRateSettingRow[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [showAddRate, setShowAddRate] = useState(false);
  const [retireState, setRetireState] = useState<MetalPriceRateActionState | null>(null);
  const [retiringPurityKey, setRetiringPurityKey] = useState<string | null>(null);
  const [isRetiring, startRetireTransition] = useTransition();
  const [state, formAction] = useActionState(
    async (previousState: MetalPriceRateActionState, formData: FormData) => {
      const result = await saveBuybackPriceRatesAction(previousState, formData);
      if (result.status === "success") {
        setShowAddRate(false);
        router.refresh();
      }
      return result;
    },
    initialMetalPriceRateActionState,
  );

  const activeRows = useMemo(
    () => rows.filter((row) => row.ratePerGram !== null),
    [rows],
  );
  const missingRows = useMemo(
    () => rows.filter((row) => row.ratePerGram === null),
    [rows],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredActiveRows = useMemo(
    () =>
      activeRows.filter((row) =>
        `${row.purityKey}%`.toLowerCase().includes(normalizedQuery),
      ),
    [activeRows, normalizedQuery],
  );

  function handleRetire(row: BuybackPriceRateSettingRow) {
    if (!row.ratePerGram || isRetiring) return;
    const confirmed = window.confirm(
      `Hentikan Rate Buyback ${row.purityKey}%?\n\nHistori rate tetap disimpan. Rate ini tidak lagi digunakan untuk rekomendasi transaksi Buyback baru.`,
    );
    if (!confirmed) return;

    setRetireState(null);
    setRetiringPurityKey(row.purityKey);
    startRetireTransition(async () => {
      const result = await retireBuybackPriceRateAction(row.purityKey);
      setRetireState(result);
      setRetiringPurityKey(null);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => setRetireState(null)}
      className="space-y-4"
    >
      <Feedback state={retireState ?? (state.status === "idle" ? null : state)} />

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <CircleDollarSign className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">Rate Buyback Aktif</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">
                  Rate akuisisi kembali berdasarkan Kadar Persen. Rate ini berdiri
                  sendiri dari Rate Jual dan akan menjadi referensi Buyback External.
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                    {activeRows.length} rate aktif
                  </span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                    {missingRows.length} kadar belum diatur
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddRate((current) => !current)}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {showAddRate ? <X className="size-4" /> : <Plus className="size-4" />}
              {showAddRate ? "Tutup" : "Tambah Rate Buyback"}
            </button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${inputClassName} pl-9`}
              placeholder="Cari Kadar Persen, contoh 30 atau 73..."
              aria-label="Cari Kadar Persen Rate Buyback"
            />
          </div>
        </div>

        {showAddRate ? (
          <div className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Plus className="size-4 text-[var(--accent)]" />
              <p className="text-sm font-semibold text-neutral-950">Tambah Rate Buyback</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Tambahkan kadar yang memang diterima untuk transaksi Buyback.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-800">Kadar Persen</span>
                <div className="relative">
                  <input
                    name="newBuybackPurityPercent"
                    inputMode="decimal"
                    className={`${inputClassName} pr-9`}
                    placeholder="Contoh: 73"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-neutral-500">%</span>
                </div>
                {state.fieldErrors?.newBuybackPurityPercent ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.newBuybackPurityPercent}
                  </p>
                ) : null}
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-800">Harga Buyback / Gram</span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-neutral-500">Rp</span>
                  <input
                    name="newBuybackRatePerGram"
                    inputMode="numeric"
                    onInput={handleMoneyInput}
                    className={`${inputClassName} pl-10`}
                    placeholder="Contoh: 850000"
                  />
                </div>
                {state.fieldErrors?.newBuybackRatePerGram ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.newBuybackRatePerGram}
                  </p>
                ) : null}
              </label>
            </div>
          </div>
        ) : null}

        <div className="hidden grid-cols-[100px_minmax(220px,1fr)_190px_110px] items-center gap-3 border-b border-[var(--border)] bg-neutral-50 px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)] md:grid">
          <span>Kadar</span>
          <span>Harga Buyback / Gram</span>
          <span>Diperbarui</span>
          <span className="text-right">Aksi</span>
        </div>

        {filteredActiveRows.length > 0 ? (
          <div className="min-w-0 divide-y divide-[var(--border)]">
            {activeRows.map((row) => {
              const fieldName = `buybackRatePerGram:${row.purityKey}`;
              const retiring = isRetiring && retiringPurityKey === row.purityKey;
              const matchesSearch = `${row.purityKey}%`
                .toLowerCase()
                .includes(normalizedQuery);

              return (
                <div
                  key={row.purityKey}
                  className={
                    matchesSearch
                      ? "grid gap-3 px-4 py-4 md:grid-cols-[100px_minmax(220px,1fr)_190px_110px] md:items-center md:px-5"
                      : "hidden"
                  }
                >
                  <p className="text-sm font-semibold text-neutral-950">{row.purityKey}%</p>

                  <label className="block">
                    <span className="sr-only">Rate Buyback per gram kadar {row.purityKey}%</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-neutral-500">Rp</span>
                      <input
                        name={fieldName}
                        inputMode="numeric"
                        onInput={handleMoneyInput}
                        defaultValue={formatMoneyInput(row.ratePerGram)}
                        className={`${inputClassName} pl-10`}
                        placeholder="0"
                      />
                    </div>
                    {state.fieldErrors?.[fieldName] ? (
                      <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors[fieldName]}</p>
                    ) : null}
                  </label>

                  <p className="text-xs leading-5 text-[var(--muted)]">{formatDate(row.effectiveFrom)}</p>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleRetire(row)}
                      disabled={retiring}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Hentikan rate aktif. Histori rate tetap disimpan."
                    >
                      <Trash2 className="size-3.5" />
                      {retiring ? "..." : "Hentikan"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-[var(--muted)]">
            {activeRows.length === 0
              ? "Belum ada Rate Buyback aktif. Tambahkan rate pertama dari tombol di atas."
              : "Tidak ada Rate Buyback yang cocok dengan pencarian."}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[11px] leading-5 text-[var(--muted)]">
            Menghentikan rate hanya menutup rate aktif. Histori Rate Buyback sebelumnya tetap tersimpan untuk audit.
          </p>
          <FormSubmitButton pendingText="Menyimpan Rate Buyback...">
            <Save className="size-4" />
            Simpan Perubahan
          </FormSubmitButton>
        </div>
      </section>

      {missingRows.length > 0 ? (
        <details className="group overflow-hidden rounded-3xl border border-amber-200 bg-white">
          <summary className="cursor-pointer list-none p-4 marker:content-none sm:p-5 [&::-webkit-details-marker]:hidden">
            <p className="text-sm font-semibold text-neutral-950">
              Kadar Belum Memiliki Rate Buyback ({missingRows.length})
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Kadar ini sudah ada pada master emas tetapi belum mempunyai Rate Buyback aktif.
            </p>
          </summary>
          <div className="flex flex-wrap gap-2 border-t border-amber-100 bg-amber-50/40 p-4 sm:p-5">
            {missingRows.map((row) => (
              <span
                key={row.purityKey}
                className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800"
              >
                {row.purityKey}%
              </span>
            ))}
          </div>
        </details>
      ) : null}
    </form>
  );
}
