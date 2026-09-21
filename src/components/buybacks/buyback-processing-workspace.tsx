"use client";

import {
  Camera,
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
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { completeBuybackProcessingAction } from "@/app/actions/buyback-processing";
import { CameraCaptureModal } from "@/components/media/camera-capture-modal";
import { ImageLightbox } from "@/components/media/image-lightbox";
import { QuickPriceRateControl } from "@/components/pricing/quick-price-rate-control";
import { QuickProductCategoryDialog } from "@/components/products/quick-product-category-dialog";
import { QuickProductColorDialog } from "@/components/products/quick-product-color-dialog";
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
import type { ProductColorPresetOption } from "@/features/settings/product-color-presets";
import {
  formatCurrency,
  formatRupiahInput,
} from "@/features/pos/payment-draft";
import { formatPosWeightInput } from "@/features/pos/transaction-pricing";
import { cn } from "@/lib/utils";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function processingLabel(type: BuybackProcessingQueueRow["processingType"]) {
  return type === "cleaning" ? "Cuci" : "Rongsok";
}

function normalizeColorKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("id-ID");
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

function ProcessingProductImage({
  src,
  alt,
  label,
  className,
}: {
  src: string | null;
  alt: string;
  label: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-[var(--border)] bg-neutral-50",
          className,
        )}
      >
        <div className="grid size-full place-items-center px-2 text-center text-neutral-400">
          <div>
            <Camera className="mx-auto size-5" />
            <p className="mt-1 text-[9px] font-medium">Belum ada foto</p>
          </div>
        </div>
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-neutral-950/75 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
          {label}
        </span>
      </div>
    );
  }

  return (
    <ImageLightbox
      src={src}
      alt={alt}
      caption={alt}
      triggerClassName={cn(
        "overflow-hidden rounded-xl border border-[var(--border)] bg-neutral-50",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="size-full object-cover" />
      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-neutral-950/75 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
        {label}
      </span>
    </ImageLightbox>
  );
}

function ResultImageInput({ error }: { error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

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

  function applySelectedFile(file: File) {
    clearPreview();

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
  }

  function changeImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      clearPreview();
      setPreviewUrl(null);
      return;
    }

    applySelectedFile(file);
  }

  function handleCameraCapture(file: File) {
    if (!inputRef.current) return;

    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
    applySelectedFile(file);
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
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700"
            >
              <Camera className="size-4" />
              Ambil Foto
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

      <CameraCaptureModal
        isOpen={isCameraOpen}
        title="Ambil Foto Setelah Pemrosesan"
        description="Pastikan kondisi akhir produk setelah Cuci/Rongsok terlihat jelas."
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}

export function ProcessingDrawer({
  row,
  categories,
  productMasters,
  colorPresets,
  priceRates,
  onClose,
  onCompleted,
}: {
  row: BuybackProcessingQueueRow;
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  colorPresets: ProductColorPresetOption[];
  priceRates: BuybackProcessingRateOption[];
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const [state, formAction, isPending] = useActionState(
    completeBuybackProcessingAction,
    initialBuybackProcessingActionState,
  );
  const router = useRouter();
  const initialMasterId =
    row.sourceProductMasterId &&
    productMasters.some(
      (master) =>
        master.id === row.sourceProductMasterId &&
        master.status === "active" &&
        master.categoryId === row.sourceCategoryId,
    )
      ? row.sourceProductMasterId
      : "";

  const [localCategories, setLocalCategories] = useState(categories);
  const [localMasters, setLocalMasters] = useState(productMasters);
  const [localColorPresets, setLocalColorPresets] = useState(colorPresets);
  const [categoryId, setCategoryId] = useState(row.sourceCategoryId);
  const [masterId, setMasterId] = useState(initialMasterId);
  const category = localCategories.find((item) => item.id === categoryId);
  const availableMasters = useMemo(
    () =>
      localMasters.filter(
        (master) =>
          master.status === "active" && master.categoryId === categoryId,
      ),
    [categoryId, localMasters],
  );
  const [displayName, setDisplayName] = useState(row.sourceDisplayName);
  const [weightGram, setWeightGram] = useState(row.sourceWeightGram);
  const [purityPercent, setPurityPercent] = useState(row.sourcePurityPercent);
  const [exchangePurityPercent, setExchangePurityPercent] = useState(
    row.sourceExchangePurityPercent ?? row.sourcePurityPercent,
  );
  const [exchangePurityTouched, setExchangePurityTouched] = useState(false);
  const initialColor = colorPresets.find(
    (preset) =>
      normalizeColorKey(preset.name) === normalizeColorKey(row.sourceColor),
  )?.name;
  const [color, setColor] = useState(initialColor ?? "");
  const [pricePerGramInput, setPricePerGramInput] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [deductionPerGram, setDeductionPerGram] = useState(() =>
    formatRupiahInput(row.sourceDeductionPerGram ?? "0"),
  );
  const [rateOverrides, setRateOverrides] = useState<Record<string, string>>({});
  const [quickMasterOpen, setQuickMasterOpen] = useState(false);
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [quickColorOpen, setQuickColorOpen] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const suggestedRate = useMemo(() => {
    const key = normalizePurityKey(purityPercent);
    if (!key) return null;
    return (
      rateOverrides[key] ??
      priceRates.find((rate) => rate.purityKey === key)?.ratePerGram ??
      null
    );
  }, [priceRates, purityPercent, rateOverrides]);

  const suggestedPricePerGram = suggestedRate
    ? formatRupiahInput(suggestedRate)
    : "";
  const pricePerGram = priceTouched ? pricePerGramInput : suggestedPricePerGram;

  useEffect(() => {
    if (state.status === "success") {
      onCompleted(state.message ?? "Pemrosesan Buyback selesai.");
    }
  }, [onCompleted, state.message, state.status]);

  const payload = useMemo<BuybackProcessingSubmitPayload>(
    () => ({
      processingId: row.id,
      categoryId,
      productMasterId: masterId,
      displayName,
      weightGram,
      purityPercent,
      exchangePurityPercent,
      color,
      pricePerGram,
      deductionPerGram,
    }),
    [
      categoryId,
      color,
      deductionPerGram,
      displayName,
      exchangePurityPercent,
      masterId,
      pricePerGram,
      purityPercent,
      row.id,
      weightGram,
    ],
  );

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/35 lg:flex lg:justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buyback-processing-title"
    >
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white lg:w-[min(720px,calc(100vw-48px))] lg:border-l lg:border-[var(--border)]">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-white px-4 py-4 sm:px-5 lg:px-6">
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

        <form
          action={formAction}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5 lg:p-6"
        >
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
              {row.beforeImageUrl ? (
                <ImageLightbox
                  src={row.beforeImageUrl}
                  alt={`Foto sebelum ${row.sourceDisplayName}`}
                  caption={`Foto saat Buyback diterima · ${row.sourceDisplayName}`}
                  triggerClassName="aspect-square overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.beforeImageUrl}
                    alt={`Foto sebelum ${row.sourceDisplayName}`}
                    className="size-full object-cover"
                  />
                </ImageLightbox>
              ) : (
                <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border border-[var(--border)] bg-white text-xs text-[var(--muted)]">
                  Foto tidak tersedia
                </div>
              )}
              <div>
                <h3 className="font-semibold text-neutral-950">
                  {row.sourceDisplayName}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {row.sourceCategoryName} · {row.customerName}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[11px] text-[var(--muted)]">
                      Berat Sebelum
                    </p>
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
                    <p className="mt-1 text-sm font-semibold">
                      {row.sourceColor}
                    </p>
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
                  Kategori *
                </span>
                <div className="flex gap-2">
                  <select
                    value={categoryId}
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setMasterId("");
                    }}
                    className={cn(inputClassName, "min-w-0 flex-1")}
                  >
                    <option value="">Pilih kategori hasil</option>
                    {localCategories
                      .filter((item) => item.isActive)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setQuickCategoryOpen(true)}
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--accent)] bg-white text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
                    aria-label="Tambah Kategori"
                    title="Tambah Kategori"
                  >
                    <Plus className="size-5" />
                  </button>
                </div>
                {state.fieldErrors?.categoryId ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.categoryId}
                  </p>
                ) : null}
              </div>

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
                    {availableMasters.map((master) => (
                      <option key={master.id} value={master.id}>
                        {master.code} · {master.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setQuickMasterOpen(true)}
                    disabled={!category}
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--accent)] bg-white text-[var(--accent)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-neutral-300"
                    aria-label="Tambah Product Master"
                    title={
                      category
                        ? "Tambah Product Master"
                        : "Pilih kategori terlebih dahulu"
                    }
                  >
                    <Plus className="size-5" />
                  </button>
                </div>
                {state.fieldErrors?.productMasterId ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.productMasterId}
                  </p>
                ) : null}
                <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                  Hanya Product Master pada kategori{" "}
                  {category?.label ?? "yang dipilih"}.
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
                    const nextValue = formatPosWeightInput(event.target.value);
                    setPurityPercent(nextValue);
                    if (!exchangePurityTouched) {
                      setExchangePurityPercent(nextValue);
                    }
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
                  Kadar Tukaran *
                </span>
                <input
                  value={exchangePurityPercent}
                  onChange={(event) => {
                    setExchangePurityTouched(true);
                    setExchangePurityPercent(
                      formatPosWeightInput(event.target.value),
                    );
                  }}
                  inputMode="decimal"
                  className={inputClassName}
                  placeholder="35"
                />
                {state.fieldErrors?.exchangePurityPercent ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.exchangePurityPercent}
                  </p>
                ) : null}
                <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                  Diprefill dari data sebelumnya atau Kadar hasil, lalu tetap
                  dapat disesuaikan sebelum item masuk inventory.
                </p>
              </label>

              <div className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-800">
                  Warna *
                </span>
                <div className="flex gap-2">
                  <select
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className={cn(inputClassName, "min-w-0 flex-1")}
                  >
                    <option value="">
                      {localColorPresets.length > 0
                        ? "Pilih warna hasil"
                        : "Belum ada preset warna aktif"}
                    </option>
                    {localColorPresets.map((preset) => (
                      <option key={preset.id} value={preset.name}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setQuickColorOpen(true)}
                    className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--accent)] bg-white text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
                    aria-label="Tambah Warna"
                    title="Tambah Warna"
                  >
                    <Plus className="size-5" />
                  </button>
                </div>
                {localColorPresets.length === 0 ? (
                  <p className="mt-1.5 text-xs leading-5 text-amber-700">
                    Gunakan tombol + untuk membuat warna tanpa meninggalkan
                    pemrosesan.
                  </p>
                ) : null}
                {state.fieldErrors?.color ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.color}
                  </p>
                ) : null}
              </div>

              <div className="block">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm font-medium text-neutral-800">
                  <span>Harga / Gram Hasil *</span>
                  <div className="flex items-center gap-2">
                    {suggestedRate ? (
                      <span className="text-[11px] font-normal text-emerald-700">
                        Global {formatCurrency(Number(suggestedRate))}
                      </span>
                    ) : (
                      <span className="text-[11px] font-normal text-amber-700">
                        Rate global belum tersedia
                      </span>
                    )}
                    <QuickPriceRateControl
                      kind="sale"
                      purityPercent={purityPercent}
                      ratePerGram={suggestedRate}
                      onSaved={({ purityKey, ratePerGram }) => {
                        setRateOverrides((current) => ({
                          ...current,
                          [purityKey]: ratePerGram,
                        }));
                        setPriceTouched(false);
                      }}
                    />
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-semibold text-neutral-500">
                    Rp
                  </span>
                  <input
                    value={pricePerGram}
                    onChange={(event) => {
                      setPriceTouched(true);
                      setPricePerGramInput(
                        formatRupiahInput(event.target.value),
                      );
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
                  Rate Jual Global otomatis disarankan. Input tetap boleh
                  dioverride sebagai snapshot hasil item; ikon edit di atas
                  mengubah Rate Jual Global untuk kadar ini.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-neutral-800">
                  Potongan / Gram *
                </span>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs font-semibold text-neutral-500">
                    Rp
                  </span>
                  <input
                    value={deductionPerGram}
                    onChange={(event) =>
                      setDeductionPerGram(
                        formatRupiahInput(event.target.value) || "0",
                      )
                    }
                    inputMode="numeric"
                    className={cn(inputClassName, "pl-9")}
                    placeholder="0"
                  />
                </div>
                {state.fieldErrors?.deductionPerGram ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.deductionPerGram}
                  </p>
                ) : null}
                <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                  Disimpan pada Physical Item final dan tidak mengubah harga
                  dasar hasil (Berat × Harga / Gram).
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
                !categoryId ||
                !masterId ||
                !displayName.trim() ||
                !weightGram ||
                !purityPercent ||
                !exchangePurityPercent ||
                !color.trim() ||
                !pricePerGram ||
                !deductionPerGram
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
      <QuickProductCategoryDialog
        key={`processing-category:${quickCategoryOpen ? "open" : "closed"}`}
        open={quickCategoryOpen}
        creationSource="buyback"
        onClose={() => setQuickCategoryOpen(false)}
        onCreated={(createdCategory) => {
          setLocalCategories((current) => {
            const next = current.filter(
              (item) => item.id !== createdCategory.id,
            );
            return [...next, createdCategory].sort((left, right) =>
              left.label.localeCompare(right.label, "id-ID"),
            );
          });
          setCategoryId(createdCategory.id);
          setMasterId("");
          setQuickCategoryOpen(false);
          router.refresh();
        }}
      />
      <QuickProductColorDialog
        key={`processing-color:${quickColorOpen ? "open" : "closed"}`}
        open={quickColorOpen}
        creationSource="buyback"
        onClose={() => setQuickColorOpen(false)}
        onCreated={(preset) => {
          setLocalColorPresets((current) => {
            const next = current.filter((item) => item.id !== preset.id);
            return [...next, preset].sort((left, right) =>
              left.name.localeCompare(right.name, "id-ID"),
            );
          });
          setColor(preset.name);
          setQuickColorOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

export function BuybackProcessingWorkspace({
  data,
  categories,
  productMasters,
  colorPresets,
  priceRates,
  canProcess,
}: {
  data: BuybackProcessingData;
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  colorPresets: ProductColorPresetOption[];
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
  const [selected, setSelected] = useState<BuybackProcessingQueueRow | null>(
    null,
  );
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

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                    "rounded-xl px-3 py-2 !text-xs !font-semibold",
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
                    "rounded-xl px-3 py-2 !text-xs !font-semibold",
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
            <>
              <div className="space-y-3 p-3 sm:p-4 md:hidden">
                {rows.map((row) => {
                  const difference = weightDifference(
                    row.sourceWeightGram,
                    row.resultWeightGram,
                  );

                  return (
                    <article
                      key={row.id}
                      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
                    >
                      <div className="p-3.5">
                        <div className="flex items-start gap-3">
                          <ProcessingProductImage
                            src={row.beforeImageUrl}
                            alt={`Foto ${row.sourceDisplayName} saat Buyback diterima`}
                            label="Foto masuk"
                            className="size-24 shrink-0 sm:size-28"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-[10px] font-semibold",
                                  row.processingType === "cleaning"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-amber-50 text-amber-800",
                                )}
                              >
                                {processingLabel(row.processingType)}
                              </span>
                              {row.status === "pending" ? (
                                <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
                                  Belum Diproses
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                  Selesai
                                </span>
                              )}
                            </div>

                            <p className="mt-2 truncate text-sm font-bold text-neutral-950">
                              {row.sourceDisplayName}
                            </p>
                            <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                              {row.sourceCategoryName} · Kadar{" "}
                              {row.sourcePurityPercent}% · {row.sourceColor}
                            </p>
                            {row.sourceSku ? (
                              <p className="mt-1 truncate text-[11px] font-medium text-neutral-500">
                                SKU {row.sourceSku}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-neutral-50 p-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              Buyback
                            </p>
                            <p className="mt-1 truncate text-xs font-semibold text-neutral-900">
                              {row.buybackNumber}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                              {formatDate(row.buybackCompletedAt)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              Customer
                            </p>
                            <p className="mt-1 truncate text-xs font-semibold text-neutral-900">
                              {row.customerName}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                              {row.customerCode ?? "-"}
                            </p>
                          </div>
                          <div className="col-span-2 border-t border-[var(--border)] pt-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                                  Berat
                                </p>
                                <p className="mt-1 text-xs font-semibold text-neutral-900">
                                  {row.sourceWeightGram} gr
                                  {row.resultWeightGram
                                    ? ` → ${row.resultWeightGram} gr`
                                    : ""}
                                </p>
                              </div>
                              {difference ? (
                                <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-neutral-600">
                                  Selisih {difference}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {row.status === "completed" && row.resultDisplayName ? (
                          <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5">
                            <ProcessingProductImage
                              src={row.resultImageUrl}
                              alt={`Foto hasil pemrosesan ${row.resultDisplayName}`}
                              label="Foto hasil"
                              className="size-16 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                Hasil Pemrosesan
                              </p>
                              <p className="mt-1 truncate text-xs font-semibold text-neutral-900">
                                {row.resultDisplayName}
                              </p>
                              <p className="mt-0.5 text-[10px] text-neutral-600">
                                Kadar Tukaran {row.resultExchangePurityPercent ?? "-"}
                                {row.resultExchangePurityPercent ? "%" : ""} · Potongan/Gr{" "}
                                {formatCurrency(
                                  Number(row.resultDeductionPerGram ?? 0),
                                )}
                              </p>
                              <p className="mt-0.5 text-[10px] text-neutral-500">
                                Selesai {formatDate(row.processedAt)}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {row.status === "pending" ? (
                        <div className="border-t border-[var(--border)] bg-neutral-50 p-3">
                          <button
                            type="button"
                            disabled={!canProcess}
                            onClick={() => setSelected(row)}
                            className={cn(
                              "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
                              row.processingType === "cleaning"
                                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                            )}
                          >
                            {row.processingType === "cleaning" ? (
                              <Sparkles className="size-4" />
                            ) : (
                              <Wrench className="size-4" />
                            )}
                            Proses {processingLabel(row.processingType)}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 sm:px-5">No. Buyback</th>
                      <th className="px-4 py-3">Foto</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Produk</th>
                      <th className="px-4 py-3">Proses</th>
                      <th className="whitespace-nowrap px-4 py-3">Berat</th>
                      <th className="whitespace-nowrap px-4 py-3">Status</th>
                      <th className="whitespace-nowrap px-4 py-3 sm:px-5">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="align-top hover:bg-neutral-50/60"
                      >
                        <td className="px-4 py-4 sm:px-5">
                          <p className="font-semibold text-neutral-950">
                            {row.buybackNumber}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {formatDate(row.buybackCompletedAt)}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <ProcessingProductImage
                            src={row.beforeImageUrl}
                            alt={`Foto ${row.sourceDisplayName} saat Buyback diterima`}
                            label="Masuk"
                            className="size-14 shrink-0"
                          />
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
                          <div className="min-w-[220px]">
                            <p className="max-w-[220px] truncate font-medium text-neutral-900">
                              {row.sourceDisplayName}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {row.sourceCategoryName} · Kadar{" "}
                              {row.sourcePurityPercent}%
                            </p>
                            {row.status === "completed" &&
                            row.resultDisplayName ? (
                              <>
                                <p className="mt-1 text-xs font-medium text-emerald-700">
                                  Hasil: {row.resultDisplayName}
                                </p>
                                <p className="mt-1 text-[11px] text-neutral-500">
                                  Tukaran {row.resultExchangePurityPercent ?? "-"}
                                  {row.resultExchangePurityPercent ? "%" : ""} · Pot/Gr{" "}
                                  {formatCurrency(
                                    Number(row.resultDeductionPerGram ?? 0),
                                  )}
                                </p>
                              </>
                            ) : null}
                          </div>
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
                          <p className="whitespace-nowrap font-medium">
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
                            <span className="inline-flex whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                              Belum Diproses
                            </span>
                          ) : (
                            <span className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
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
                              className={cn(
                                "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                                row.processingType === "cleaning"
                                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                  : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                              )}
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
            </>
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
        <ProcessingDrawer
          key={selected.id}
          row={selected}
          categories={categories}
          productMasters={productMasters}
          colorPresets={colorPresets}
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
