"use client";

import {
  BadgeDollarSign,
  ChevronDown,
  CircleDollarSign,
  LockKeyhole,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  retireMetalPriceRateAction,
  saveMetalPriceRatesAction,
} from "@/app/actions/metal-price-rates";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import {
  initialMetalPriceRateActionState,
  type MetalPriceRateActionState,
} from "@/features/pricing/metal-price-rate-action-state";
import type { MetalPriceRateSettingRow } from "@/features/pricing/metal-price-rates";

const inputClassName =
  "h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function formatMoneyInput(value: string | null) {
  if (!value) return "";
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("id-ID").format(numeric)
    : value;
}

function formatDate(value: Date | null) {
  if (!value) return "Belum ada harga aktif";

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

export function MetalPriceRateForm({
  rows,
}: {
  rows: MetalPriceRateSettingRow[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [showAddRate, setShowAddRate] = useState(false);
  const [retireState, setRetireState] =
    useState<MetalPriceRateActionState | null>(null);
  const [retiringPurityKey, setRetiringPurityKey] = useState<string | null>(
    null,
  );
  const [isRetiring, startRetireTransition] = useTransition();
  const [state, formAction] = useActionState(
    saveMetalPriceRatesAction,
    initialMetalPriceRateActionState,
  );

  const activeRows = useMemo(
    () => rows.filter((row) => row.ratePerGram !== null),
    [rows],
  );
  const missingRows = useMemo(
    () => rows.filter((row) => row.ratePerGram === null && row.itemCount > 0),
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
  const filteredMissingRows = useMemo(
    () =>
      missingRows.filter((row) =>
        `${row.purityKey}%`.toLowerCase().includes(normalizedQuery),
      ),
    [missingRows, normalizedQuery],
  );

  useEffect(() => {
    if (state.status === "success") {
      setShowAddRate(false);
      router.refresh();
    }
  }, [router, state.status]);

  function handleRetire(row: MetalPriceRateSettingRow) {
    if (row.itemCount > 0 || !row.ratePerGram || isRetiring) return;

    const confirmed = window.confirm(
      `Hapus Rate Global ${row.purityKey}%?\n\nRate ini tidak dipakai item yang belum terjual. Histori harga tetap disimpan dan hanya rate aktif yang dihentikan.`,
    );

    if (!confirmed) return;

    setRetireState(null);
    setRetiringPurityKey(row.purityKey);
    startRetireTransition(async () => {
      const result = await retireMetalPriceRateAction(row.purityKey);
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
      <Feedback
        state={retireState ?? (state.status === "idle" ? null : state)}
      />

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <CircleDollarSign className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Rate Global Aktif
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">
                  Harga standar POS berdasarkan Kadar Persen. Daftar dibuat
                  ringkas agar update harian tetap cepat tanpa membuat halaman
                  memanjang.
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
              {showAddRate ? (
                <X className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {showAddRate ? "Tutup" : "Tambah Rate"}
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
              aria-label="Cari Kadar Persen"
            />
          </div>
        </div>

        {showAddRate ? (
          <div className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Plus className="size-4 text-[var(--accent)]" />
              <p className="text-sm font-semibold text-neutral-950">
                Tambah Rate Global
              </p>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Tambahkan hanya Kadar Persen yang memang digunakan bisnis.
              Kesalahan preset yang tidak digunakan item dapat dihapus kembali.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-800">
                  Kadar Persen
                </span>
                <div className="relative">
                  <input
                    name="newPurityPercent"
                    inputMode="decimal"
                    className={`${inputClassName} pr-9`}
                    placeholder="Contoh: 73"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-neutral-500">
                    %
                  </span>
                </div>
                {state.fieldErrors?.newPurityPercent ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.newPurityPercent}
                  </p>
                ) : null}
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-neutral-800">
                  Harga / Gram
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-neutral-500">
                    Rp
                  </span>
                  <input
                    name="newRatePerGram"
                    inputMode="numeric"
                    className={`${inputClassName} pl-10`}
                    placeholder="Contoh: 1010000"
                  />
                </div>
                {state.fieldErrors?.newRatePerGram ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.newRatePerGram}
                  </p>
                ) : null}
              </label>
            </div>
          </div>
        ) : null}

        <div className="hidden grid-cols-[90px_minmax(180px,1fr)_130px_180px_92px] items-center gap-3 border-b border-[var(--border)] bg-neutral-50 px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)] md:grid">
          <span>Kadar</span>
          <span>Harga / Gram</span>
          <span>Digunakan</span>
          <span>Diperbarui</span>
          <span className="text-right">Aksi</span>
        </div>

        {filteredActiveRows.length > 0 ? (
          <div className="scrollbar-clean max-h-[500px] divide-y divide-[var(--border)] overflow-y-auto overscroll-contain">
            {activeRows.map((row) => {
              const fieldName = `ratePerGram:${row.purityKey}`;
              const canRetire = row.itemCount === 0;
              const retiring =
                isRetiring && retiringPurityKey === row.purityKey;
              const matchesSearch = `${row.purityKey}%`
                .toLowerCase()
                .includes(normalizedQuery);

              return (
                <div
                  key={row.purityKey}
                  className={
                    matchesSearch
                      ? "grid gap-3 px-4 py-4 md:grid-cols-[90px_minmax(180px,1fr)_130px_180px_92px] md:items-center md:px-5"
                      : "hidden"
                  }
                >
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">
                      {row.purityKey}%
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)] md:hidden">
                      {row.itemCount} item belum terjual
                    </p>
                  </div>

                  <label className="block">
                    <span className="sr-only">
                      Harga per gram kadar {row.purityKey}%
                    </span>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-neutral-500">
                        Rp
                      </span>
                      <input
                        name={fieldName}
                        inputMode="numeric"
                        defaultValue={formatMoneyInput(row.ratePerGram)}
                        className={`${inputClassName} pl-10`}
                        placeholder="0"
                      />
                    </div>
                    {state.fieldErrors?.[fieldName] ? (
                      <p className="mt-1.5 text-xs text-red-600">
                        {state.fieldErrors[fieldName]}
                      </p>
                    ) : null}
                  </label>

                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-neutral-800">
                      {row.itemCount} item
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                      belum terjual
                    </p>
                  </div>

                  <p className="text-xs leading-5 text-[var(--muted)]">
                    {formatDate(row.effectiveFrom)}
                  </p>

                  <div className="flex items-center justify-end">
                    {canRetire ? (
                      <button
                        type="button"
                        onClick={() => handleRetire(row)}
                        disabled={retiring}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Hapus rate aktif. Histori rate tetap disimpan."
                      >
                        <Trash2 className="size-3.5" />
                        {retiring ? "..." : "Hapus"}
                      </button>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-400"
                        title="Rate masih dipakai item yang belum terjual"
                      >
                        <LockKeyhole className="size-3" />
                        Dipakai
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-[var(--muted)]">
            {activeRows.length === 0
              ? "Belum ada Rate Global aktif. Tambahkan rate pertama dari tombol di atas."
              : "Tidak ada Rate Global yang cocok dengan pencarian."}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[11px] leading-5 text-[var(--muted)]">
            Menghapus rate hanya menghentikan rate aktif. Histori harga
            sebelumnya tetap tersimpan untuk audit.
          </p>
          <FormSubmitButton pendingText="Menyimpan Harga/Gram...">
            <Save className="size-4" />
            Simpan Perubahan
          </FormSubmitButton>
        </div>
      </section>

      {missingRows.length > 0 ? (
        <details className="group overflow-hidden rounded-3xl border border-amber-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:content-none sm:p-5 [&::-webkit-details-marker]:hidden">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <BadgeDollarSign className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  Kadar Belum Memiliki Rate ({missingRows.length})
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Berasal dari item inventaris yang belum terjual, bukan preset
                  Rate Global.
                </p>
              </div>
            </div>
            <ChevronDown className="size-4 shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
          </summary>

          <div className="border-t border-amber-100 bg-amber-50/35 p-4 sm:p-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
              Jika kadar di bawah salah input, koreksi Kadar Persen pada item
              inventaris. Setelah tidak ada item belum-terjual yang memakai
              kadar tersebut, baris akan hilang otomatis.
            </div>

            {filteredMissingRows.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMissingRows.map((row) => (
                  <button
                    key={row.purityKey}
                    type="button"
                    onClick={() => {
                      setShowAddRate(true);
                      setQuery("");
                      window.setTimeout(() => {
                        const purityInput =
                          formRef.current?.elements.namedItem(
                            "newPurityPercent",
                          );
                        if (purityInput instanceof HTMLInputElement) {
                          purityInput.value = row.purityKey;
                          purityInput.focus();
                        }
                      }, 0);
                    }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">
                        {row.purityKey}%
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {row.itemCount} item belum terjual
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-semibold text-amber-700">
                      Atur Rate
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-center text-xs text-[var(--muted)]">
                Tidak ada kadar belum diatur yang cocok dengan pencarian.
              </p>
            )}
          </div>
        </details>
      ) : null}
    </form>
  );
}
