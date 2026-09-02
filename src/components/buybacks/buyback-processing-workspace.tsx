"use client";

import {
  CheckCircle2,
  Clock3,
  ImagePlus,
  LoaderCircle,
  PackageCheck,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { completeBuybackProcessingAction } from "@/app/actions/buyback-processing";
import { QuickProductMasterDialog } from "@/components/products/quick-product-master-dialog";
import {
  initialBuybackProcessingActionState,
  type BuybackProcessingData,
  type BuybackProcessingQueueRow,
  type BuybackProcessingRateOption,
  type BuybackProcessingSubmitPayload,
} from "@/features/buybacks/processing-contracts";
import type {
  ProductMasterCategoryOption,
  ProductMasterOption,
} from "@/features/products/product-master-queries";
import { formatCurrency, formatRupiahInput } from "@/features/pos/payment-draft";
import { formatPosWeightInput } from "@/features/pos/transaction-pricing";
import { cn } from "@/lib/utils";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function processingLabel(type: BuybackProcessingQueueRow["processingType"]) {
  return type === "cleaning" ? "Cuci" : "Rongsok";
}

function normalizePurityKey(value: string) {
  const numeric = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 100) return null;
  return numeric
    .toFixed(3)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function weightDifference(before: string, after: string | null) {
  if (!after) return null;
  const difference = Number(after) - Number(before);
  if (!Number.isFinite(difference)) return null;
  const sign = difference > 0 ? "+" : "";
  return `${sign}${difference.toFixed(3)} gr`;
}

function ResultImageInput({
  error,
}: {
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  function clearPreview() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function changeImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    clearPreview();

    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
  }

  function removeImage() {
    clearPreview();
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-neutral-800">
          Foto Sesudah *
        </span>
        <span className="text-[11px] text-[var(--muted)]">
          JPG, PNG, WebP · maks 5 MB
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        name="resultImage"
        accept="image/jpeg,image/png,image/webp"
        onChange={changeImage}
        className="hidden"
      />
      <div
        className={cn(
          "grid gap-3 rounded-2xl border p-3 sm:grid-cols-[120px_minmax(0,1fr)]",
          error
            ? "border-red-200 bg-red-50/40"
            : "border-[var(--border)] bg-neutral-50",
        )}
      >
        <div className="aspect-square overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-white">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Preview foto hasil pemrosesan"
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center text-center text-neutral-400">
              <div>
                <ImagePlus className="mx-auto size-6" />
                <p className="mt-1 text-[10px]">Belum ada foto</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Foto ini menjadi foto Physical Item setelah proses selesai dan
            menjadi pembanding terhadap foto saat Buyback diterima.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700"
            >
              <ImagePlus className="size-4" />
              {previewUrl ? "Ganti Foto" : "Pilih Foto"}
            </button>
            {previewUrl ? (
              <button
                type="button"
                onClick={removeImage}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700"
              >
                <Trash2 className="size-4" />
                Hapus
              </button>
            ) : null}
          </div>
          {error ? (
            <p className="mt-2 text-xs font-medium text-red-700">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProcessingDialog({
  row,
  categories,
  productMasters,
  priceRates,
  onClose,
  onCompleted,
}: {
  row: BuybackProcessingQueueRow;
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  priceRates: BuybackProcessingRateOption[];
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const [state, formAction, isPending] = useActionState(
    completeBuybackProcessingAction,
    initialBuybackProcessingActionState,
  );
  const category = categories.find((item) => item.id === row.sourceCategoryId);
  const availableMasters = useMemo(
    () =>
      productMasters.filter(
        (master) =>
          master.status === "active" &&
          master.categoryId === row.sourceCategoryId,
      ),
    [productMasters, row.sourceCategoryId],
  );
  const initialMasterId =
    row.sourceProductMasterId &&
    availableMasters.some((master) => master.id === row.sourceProductMasterId)
      ? row.sourceProductMasterId
      : "";

  const [masterId, setMasterId] = useState(initialMasterId);
  const [displayName, setDisplayName] = useState(row.sourceDisplayName);
  const [weightGram, setWeightGram] = useState(row.sourceWeightGram);
  const [purityPercent, setPurityPercent] = useState(row.sourcePurityPercent);
  const [color, setColor] = useState(
    row.sourceColor === "-" ? "" : row.sourceColor,
  );
  const [pricePerGram, setPricePerGram] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [quickMasterOpen, setQuickMasterOpen] = useState(false);
  const [localMasters, setLocalMasters] =
    useState<ProductMasterOption[]>(availableMasters);

  const suggestedRate = useMemo(() => {
    const key = normalizePurityKey(purityPercent);
    if (!key) return null;
    return priceRates.find((rate) => rate.purityKey === key)?.ratePerGram ?? null;
  }, [priceRates, purityPercent]);

  useEffect(() => {
    if (!priceTouched) {
      setPricePerGram(
        suggestedRate ? formatRupiahInput(suggestedRate) : "",
      );
    }
  }, [priceTouched, suggestedRate]);

  useEffect(() => {
    if (state.status === "success") {
      onCompleted(state.message ?? "Pemrosesan Buyback selesai.");
    }
  }, [onCompleted, state.message, state.status]);

  const payload = useMemo<BuybackProcessingSubmitPayload>(
    () => ({
      processingId: row.id,
      productMasterId: masterId,
      displayName,
      weightGram,
      purityPercent,
      color,
      pricePerGram,
    }),
    [
      color,
      displayName,
      masterId,
      pricePerGram,
      purityPercent,
      row.id,
      weightGram,
    ],
  );

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/40 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buyback-processing-title"
    >
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                {processingLabel(row.processingType)}
              </span>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                {row.buybackNumber}
              </span>
            </div>
            <h2
              id="buyback-processing-title"
              className="mt-2 text-lg font-semibold text-neutral-950"
            >
              Proses {processingLabel(row.processingType)} Produk
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Catat hasil fisik final. Setelah disimpan, item langsung menjadi
              Tersedia dan dapat dijual di POS.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        <form action={formAction} className="space-y-5 p-5 sm:p-6">
          <input type="hidden" name="payload" value={JSON.stringify(payload)} />

          {state.status === "error" ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.message}
            </div>
          ) : null}

          <section className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-4">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Barang saat Buyback diterima
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
              <div className="aspect-square overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
                {row.beforeImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.beforeImageUrl}
                    alt={`Foto sebelum ${row.sourceDisplayName}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-xs text-[var(--muted)]">
                    Foto tidak tersedia
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-neutral-950">
                  {row.sourceDisplayName}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {row.sourceCategoryName} · {row.customerName}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[11px] text-[var(--muted)]">Berat Sebelum</p>
                    <p className="mt-1 text-sm font-semibold">
                      {row.sourceWeightGram} gr
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[11px] text-[var(--muted)]">Kadar</p>
                    <p className="mt-1 text-sm font-semibold">
                      {row.sourcePurityPercent}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[11px] text-[var(--muted)]">Warna</p>
                    <p className="mt-1 text-sm font-semibold">{row.sourceColor}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                Hasil setelah {processingLabel(row.processingType)}
              </p>
              <h3 className="mt-1 font-semibold text-neutral-950">
                Data Physical Item final
              </h3>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <span className="mb-2 block text-sm font-medium text-neutral-800">
                  Product Master *
                </span>
                <div className="flex gap-2">
                  <select
                    value={masterId}
                    onChange={(event) => setMasterId(event.target.value)}
                    className={cn(inputClassName, "min-w-0 flex-1")}
                  >
                    <option value="">Pilih Product Master</option>
                    {localMasters.map((master) => (
                      <option key={master.id} value={master.id}>
                        {master.code} · {master.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setQuickMasterOpen(true)}
                    disabled={!category}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-[var(--accent)] disabled:opacity-40"
                    title="Buat Product Master baru"
                  >
                    <Plus className="size-4" />
                    Buat Baru
                  </button>
                </div>
                {state.fieldErrors?.productMasterId ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.productMasterId}
                  </p>
                ) : null}
                <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                  Hanya Product Master pada kategori {row.sourceCategoryName}.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-800">
                  Nama Produk *
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={220}
                  className={inputClassName}
                />
                {state.fieldErrors?.displayName ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.displayName}
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-800">
                  Berat Sesudah (gr) *
                </span>
                <input
                  value={weightGram}
                  onChange={(event) =>
                    setWeightGram(formatPosWeightInput(event.target.value))
                  }
                  inputMode="decimal"
                  className={inputClassName}
                  placeholder="1,250"
                />
                {state.fieldErrors?.weightGram ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.weightGram}
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-800">
                  Kadar (%) *
                </span>
                <input
                  value={purityPercent}
                  onChange={(event) => {
                    setPurityPercent(formatPosWeightInput(event.target.value));
                    setPriceTouched(false);
                  }}
                  inputMode="decimal"
                  className={inputClassName}
                  placeholder="45"
                />
                {state.fieldErrors?.purityPercent ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.purityPercent}
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-800">
                  Warna *
                </span>
                <input
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  maxLength={64}
                  className={inputClassName}
                  placeholder="Kuning"
                />
                {state.fieldErrors?.color ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.color}
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-2 flex items-center justify-between gap-2 text-sm font-medium text-neutral-800">
                  <span>Harga / Gram Hasil *</span>
                  {suggestedRate ? (
                    <span className="text-[11px] font-normal text-emerald-700">
                      Global {formatCurrency(Number(suggestedRate))}
                    </span>
                  ) : (
                    <span className="text-[11px] font-normal text-amber-700">
                      Rate global belum tersedia
                    </span>
                  )}
                </span>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-semibold text-neutral-500">
                    Rp
                  </span>
                  <input
                    value={pricePerGram}
                    onChange={(event) => {
                      setPriceTouched(true);
                      setPricePerGram(formatRupiahInput(event.target.value));
                    }}
                    inputMode="numeric"
                    className={cn(inputClassName, "pl-9")}
                    placeholder="1.250.000"
                  />
                </div>
                {state.fieldErrors?.pricePerGram ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.pricePerGram}
                  </p>
                ) : null}
                <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                  Rate global otomatis disarankan. Nilai ini disimpan sebagai
                  snapshot hasil; pricing transaksi POS tetap memakai flow global
                  rate + override yang sudah ada.
                </p>
              </label>
            </div>
          </section>

          <ResultImageInput error={state.fieldErrors?.resultImage} />

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 disabled:opacity-50"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={
                isPending ||
                !masterId ||
                !displayName.trim() ||
                !weightGram ||
                !purityPercent ||
                !color.trim() ||
                !pricePerGram
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {isPending
                ? "Menyimpan hasil..."
                : `Selesaikan ${processingLabel(row.processingType)}`}
            </button>
          </div>
        </form>
      </div>

      {quickMasterOpen && category ? (
        <QuickProductMasterDialog
          open
          categoryId={category.id}
          categoryLabel={category.label}
          creationSource="buyback"
          onClose={() => setQuickMasterOpen(false)}
          onCreated={(master) => {
            setLocalMasters((current) => {
              const next = current.filter((item) => item.id !== master.id);
              return [...next, master].sort((left, right) =>
                left.name.localeCompare(right.name),
              );
            });
            setMasterId(master.id);
            setQuickMasterOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

export function BuybackProcessingWorkspace({
  data,
  categories,
  productMasters,
  priceRates,
  canProcess,
}: {
  data: BuybackProcessingData;
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  priceRates: BuybackProcessingRateOption[];
  canProcess: boolean;
}) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<
    "all" | BuybackProcessingQueueRow["processingType"]
  >("all");
  const [statusFilter, setStatusFilter] = useState<"pending" | "completed">(
    "pending",
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] =
    useState<BuybackProcessingQueueRow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return data.rows.filter((row) => {
      if (row.status !== statusFilter) return false;
      if (typeFilter !== "all" && row.processingType !== typeFilter) {
        return false;
      }
      if (!normalizedQuery) return true;

      return [
        row.buybackNumber,
        row.customerName,
        row.customerCode,
        row.sourceDisplayName,
        row.sourceSku,
        row.sourceBarcode,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [data.rows, query, statusFilter, typeFilter]);

  return (
    <>
      <div className="space-y-5">
        {feedback ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {feedback}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <Clock3 className="size-4" />
              Belum Diproses
            </div>
            <p className="mt-2 text-2xl font-bold text-neutral-950">
              {data.pendingCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <Sparkles className="size-4" />
              Antrian Cuci
            </div>
            <p className="mt-2 text-2xl font-bold text-neutral-950">
              {data.cleaningPendingCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <Wrench className="size-4" />
              Antrian Rongsok
            </div>
            <p className="mt-2 text-2xl font-bold text-neutral-950">
              {data.reconditionPendingCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <PackageCheck className="size-4" />
              Selesai
            </div>
            <p className="mt-2 text-2xl font-bold text-neutral-950">
              {data.completedCount}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white">
          <div className="space-y-4 border-b border-[var(--border)] p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Pemrosesan Cuci / Rongsok
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Satu langkah setelah pekerjaan fisik selesai. Submit hasil
                  langsung membuat item tersedia di POS.
                </p>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-neutral-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={cn(inputClassName, "pl-10")}
                  placeholder="Cari Buyback, customer, produk..."
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Semua"],
                  ["cleaning", "Cuci"],
                  ["recondition", "Rongsok"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTypeFilter(value)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-semibold",
                    typeFilter === value
                      ? "bg-neutral-950 text-white"
                      : "border border-[var(--border)] bg-white text-neutral-700",
                  )}
                >
                  {label}
                </button>
              ))}
              <span className="mx-1 hidden h-8 w-px bg-[var(--border)] sm:block" />
              {(
                [
                  ["pending", "Belum Diproses"],
                  ["completed", "Selesai"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-semibold",
                    statusFilter === value
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border border-[var(--border)] bg-white text-neutral-700",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--muted)]">
              Tidak ada item yang cocok dengan filter ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 sm:px-5">No. Buyback</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3">Proses</th>
                    <th className="px-4 py-3">Berat</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 sm:px-5">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-neutral-50/60">
                      <td className="px-4 py-4 sm:px-5">
                        <p className="font-semibold text-neutral-950">
                          {row.buybackNumber}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatDate(row.buybackCompletedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-neutral-900">
                          {row.customerName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {row.customerCode ?? "-"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[260px] truncate font-medium text-neutral-900">
                          {row.sourceDisplayName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {row.sourceCategoryName} · Kadar{" "}
                          {row.sourcePurityPercent}%
                        </p>
                        {row.status === "completed" && row.resultDisplayName ? (
                          <p className="mt-1 text-xs font-medium text-emerald-700">
                            Hasil: {row.resultDisplayName}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-semibold",
                            row.processingType === "cleaning"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-800",
                          )}
                        >
                          {processingLabel(row.processingType)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium">
                          {row.sourceWeightGram} gr
                          {row.resultWeightGram
                            ? ` → ${row.resultWeightGram} gr`
                            : ""}
                        </p>
                        {weightDifference(
                          row.sourceWeightGram,
                          row.resultWeightGram,
                        ) ? (
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Selisih{" "}
                            {weightDifference(
                              row.sourceWeightGram,
                              row.resultWeightGram,
                            )}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        {row.status === "pending" ? (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                            Belum Diproses
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Selesai
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 sm:px-5">
                        {row.status === "pending" ? (
                          <button
                            type="button"
                            disabled={!canProcess}
                            onClick={() => setSelected(row)}
                            className="inline-flex h-9 items-center gap-2 rounded-xl bg-neutral-950 px-3 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            {row.processingType === "cleaning" ? (
                              <Sparkles className="size-3.5" />
                            ) : (
                              <Wrench className="size-3.5" />
                            )}
                            Proses {processingLabel(row.processingType)}
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">
                            {formatDate(row.processedAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!canProcess ? (
            <div className="border-t border-[var(--border)] bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:px-5">
              Akun ini dapat melihat antrean, tetapi belum memiliki permission
              untuk menyelesaikan Buyback.
            </div>
          ) : null}
        </section>
      </div>

      {selected ? (
        <ProcessingDialog
          key={selected.id}
          row={selected}
          categories={categories}
          productMasters={productMasters}
          priceRates={priceRates}
          onClose={() => setSelected(null)}
          onCompleted={(message) => {
            setFeedback(message);
            setSelected(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
