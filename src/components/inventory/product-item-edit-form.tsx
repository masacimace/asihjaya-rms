"use client";

import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  Barcode,
  Box,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  ImageIcon,
  Info,
  LockKeyhole,
  MapPin,
  NotebookPen,
  PackageCheck,
  Save,
  Scale,
  Store,
  Tag,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateProductItemAction } from "@/app/actions/product-items";
import {
  SingleImageInput,
  type SingleImageInputState,
} from "@/components/media/single-image-input";
import {
  initialProductItemActionState,
  type ProductItemActionState,
} from "@/features/inventory/product-item-contracts";
import type { ProductItemOutletOption } from "@/features/inventory/product-item-queries";
import { ArchiveRestoreButtons } from "./archive-restore-buttons";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500 disabled:opacity-80";

const textareaClassName =
  "w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500 disabled:opacity-80";

function ActionMessage({ state }: { state: ProductItemActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {state.status === "success" ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{state.message}</span>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1.5 text-xs text-red-600">{message}</p>
  ) : null;
}

function normalizeRupiahDigits(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 18)
    .replace(/^0+(?=\d)/, "");
}

function formatRupiahDigits(value: string): string {
  if (!value) {
    return "";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(BigInt(value));
}

function displayMoney(value: string) {
  return value ? `Rp${formatRupiahDigits(value)}` : "Belum diisi";
}

function normalized(value: string) {
  return value.trim();
}

function hasPositiveDecimal(value: string) {
  const normalizedValue = value.trim().replace(",", ".");
  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) && numericValue > 0;
}

function hasPositiveMoney(value: string) {
  return /[1-9]/.test(value);
}

function getConditionLabel(
  value: EditableItem["condition"],
) {
  const labels: Record<EditableItem["condition"], string> = {
    good: "Baru",
    damaged: "Bekas",
    lost: "Hilang",
    returned: "Retur",
  };

  return labels[value];
}

function MoneyInput({
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
  disabled,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-medium text-neutral-800">{label}</span>
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-500">
          Rp
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={formatRupiahDigits(value)}
          disabled={disabled}
          onChange={(event) =>
            onChange(normalizeRupiahDigits(event.target.value))
          }
          className={`${inputClassName} pl-11 tabular-nums`}
          placeholder={placeholder}
        />
      </div>
      <FieldError message={error} />
    </label>
  );
}

function SubmitButtons({
  isDraft,
  isDirty,
  activationReady,
  isItemActive,
}: {
  isDraft: boolean;
  isDirty: boolean;
  activationReady: boolean;
  isItemActive: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <button
        type="submit"
        name="submitIntent"
        value="save"
        disabled={pending || !isDirty || !isItemActive}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="size-4" />
        {pending ? "Menyimpan..." : "Simpan Perubahan"}
      </button>

      {isDraft ? (
        <button
          type="submit"
          name="submitIntent"
          value="available"
          disabled={pending || !activationReady || !isItemActive}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:!text-white"
        >
          <PackageCheck className="size-4" />
          {pending ? "Mengaktifkan..." : "Simpan dan Jadikan Tersedia"}
        </button>
      ) : null}
    </div>
  );
}

type EditableItem = {
  id: string;
  sku: string;
  barcode: string;
  displayName: string | null;
  weightGram: string | null;
  exchangePurityPercent: string | null;
  size: string | null;
  color: string | null;
  gemstone: string | null;
  costAmount: string | null;
  sellingAmount: string | null;
  pricePerGram: string | null;
  deductionPerGram: string | null;
  availability: "draft" | "available" | "reserved" | "sold";
  condition: "good" | "damaged" | "lost" | "returned";
  currentOutletId: string | null;
  outletName: string | null;
  locationCode: string | null;
  imageUrl: string | null;
  internalNotes: string | null;
  productName: string;
  productCode: string;
  productStatus: "draft" | "active" | "inactive";
  isActive: boolean;
};

function SummaryRow({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd
        className={`max-w-[65%] break-words text-right text-xs font-medium text-neutral-900 ${
          monospace ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ChecklistItem({
  complete,
  label,
  detail,
}: {
  complete: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-3">
      {complete ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-neutral-300" />
      )}
      <div>
        <p className="text-xs font-semibold text-neutral-900">{label}</p>
        <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
          {detail}
        </p>
      </div>
    </div>
  );
}

export function ProductItemEditForm({
  item,
  outlets,
  canManagePricing,
}: {
  item: EditableItem;
  outlets: ProductItemOutletOption[];
  canManagePricing: boolean;
}) {
  const router = useRouter();
  const action = updateProductItemAction.bind(null, item.id);
  const [state, formAction] = useActionState(
    action,
    initialProductItemActionState,
  );

  const [displayName, setDisplayName] = useState(item.displayName ?? "");
  const [weightGram, setWeightGram] = useState(item.weightGram ?? "");
  const [exchangePurityPercent, setExchangePurityPercent] = useState(
    item.exchangePurityPercent ?? "",
  );
  const [size, setSize] = useState(item.size ?? "");
  const [color, setColor] = useState(item.color ?? "");
  const [gemstone, setGemstone] = useState(item.gemstone ?? "");
  const [condition, setCondition] = useState(item.condition);
  const [currentOutletId, setCurrentOutletId] = useState(
    item.currentOutletId ?? "",
  );
  const [locationCode, setLocationCode] = useState(item.locationCode ?? "");
  const [internalNotes, setInternalNotes] = useState(
    item.internalNotes ?? "",
  );
  const [costAmount, setCostAmount] = useState(item.costAmount ?? "");
  const [sellingAmount, setSellingAmount] = useState(item.sellingAmount ?? "");
  const [pricePerGram, setPricePerGram] = useState(item.pricePerGram ?? "");
  const [deductionPerGram, setDeductionPerGram] = useState(
    item.deductionPerGram ?? "",
  );
  const [imageState, setImageState] = useState<SingleImageInputState>({
    hasImage: Boolean(item.imageUrl),
    changed: false,
  });

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  const isDraft = item.availability === "draft";
  const formDisabled = !item.isActive;
  const selectedOutlet = outlets.find(
    (outlet) => outlet.id === currentOutletId,
  );
  const resolvedOutletName = isDraft
    ? selectedOutlet?.name ?? "Belum ditempatkan"
    : item.outletName ?? "Belum ditempatkan";

  const changedFields = [
    normalized(displayName) !== normalized(item.displayName ?? ""),
    normalized(weightGram) !== normalized(item.weightGram ?? ""),
    normalized(exchangePurityPercent) !==
      normalized(item.exchangePurityPercent ?? ""),
    normalized(size) !== normalized(item.size ?? ""),
    normalized(color) !== normalized(item.color ?? ""),
    normalized(gemstone) !== normalized(item.gemstone ?? ""),
    condition !== item.condition,
    currentOutletId !== (item.currentOutletId ?? ""),
    normalized(locationCode) !== normalized(item.locationCode ?? ""),
    normalized(internalNotes) !== normalized(item.internalNotes ?? ""),
    canManagePricing && costAmount !== (item.costAmount ?? ""),
    canManagePricing && sellingAmount !== (item.sellingAmount ?? ""),
    canManagePricing && pricePerGram !== (item.pricePerGram ?? ""),
    canManagePricing && deductionPerGram !== (item.deductionPerGram ?? ""),
    imageState.changed,
  ].filter(Boolean).length;

  const isDirty = changedFields > 0;
  const readinessItems = [
    {
      complete: item.productStatus === "active",
      label: "Master product aktif",
      detail: "Produk induk harus aktif sebelum item dapat dijual.",
    },
    {
      complete: Boolean(selectedOutlet),
      label: "Outlet awal dipilih",
      detail: "Item Tersedia harus memiliki outlet penempatan.",
    },
    {
      complete: hasPositiveDecimal(weightGram),
      label: "Berat aktual tersedia",
      detail: "Berat fisik digunakan untuk validasi dan transaksi.",
    },
    {
      complete: imageState.hasImage,
      label: "Foto aktual tersedia",
      detail: "Gunakan foto fisik item yang jelas dan representatif.",
    },
    {
      complete: hasPositiveMoney(sellingAmount),
      label: "Harga label tersedia",
      detail: canManagePricing
        ? "Harga label final harus lebih besar dari Rp0."
        : "Harga existing harus sudah tersedia pada item.",
    },
    {
      complete: condition === "good",
      label: "Kondisi barang Baik",
      detail: "Hanya item berkondisi Baik yang dapat langsung tersedia.",
    },
  ];
  const readinessCount = readinessItems.filter((entry) => entry.complete).length;
  const activationReady =
    isDraft && readinessCount === readinessItems.length && item.isActive;
  const readinessPercent = Math.round(
    (readinessCount / readinessItems.length) * 100,
  );

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      {!item.isActive ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
          <Archive className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Item sedang diarsipkan</p>
            <p className="mt-1 text-xs leading-5">
              Pulihkan item terlebih dahulu sebelum mengubah informasi, harga,
              foto, atau penempatannya.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Tag className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Identitas Item
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Atur nama operasional yang tampil di POS. SKU, barcode, dan
                  master product tetap permanen.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-4 font-medium text-neutral-800">
                  <span>Nama item di POS</span>
                  <span className="text-xs font-normal text-[var(--muted)]">
                    {displayName.length}/220
                  </span>
                </span>
                <input
                  name="displayName"
                  maxLength={220}
                  value={displayName}
                  disabled={formDisabled}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className={inputClassName}
                  placeholder={`Opsional, contoh: ${item.productName} ${item.weightGram ?? ""}g`}
                />
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Jika dikosongkan, POS memakai nama master product: {item.productName}.
                </p>
                <FieldError message={state.fieldErrors?.displayName} />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                  <Box className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--muted)]">Preview nama operasional</p>
                  <p className="mt-1 break-words text-sm font-semibold text-neutral-950">
                    {normalized(displayName) || item.productName}
                  </p>
                </div>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                <dt className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <Tag className="size-3.5" /> SKU permanen
                </dt>
                <dd className="mt-2 break-all font-mono text-sm font-semibold text-neutral-950">
                  {item.sku}
                </dd>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                <dt className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <Barcode className="size-3.5" /> Barcode
                </dt>
                <dd className="mt-2 break-all font-mono text-sm font-semibold text-neutral-950">
                  {item.barcode}
                </dd>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                <dt className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <LockKeyhole className="size-3.5" /> Master product
                </dt>
                <dd className="mt-2 text-sm font-semibold text-neutral-950">
                  {item.productName}
                </dd>
                <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                  {item.productCode}
                </p>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <Scale className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Spesifikasi Fisik
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Cocokkan setiap nilai dengan barang fisik yang sedang diperiksa.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Berat aktual
                </span>
                <div className="relative">
                  <input
                    name="weightGram"
                    inputMode="decimal"
                    value={weightGram}
                    disabled={formDisabled}
                    onChange={(event) => setWeightGram(event.target.value)}
                    className={`${inputClassName} pr-16`}
                    placeholder="Contoh: 2,780"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500">
                    gram
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  Maksimal 3 angka desimal.
                </p>
                <FieldError message={state.fieldErrors?.weightGram} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Kadar tukar
                </span>
                <div className="relative">
                  <input
                    name="exchangePurityPercent"
                    inputMode="decimal"
                    value={exchangePurityPercent}
                    disabled={formDisabled}
                    onChange={(event) =>
                      setExchangePurityPercent(event.target.value)
                    }
                    className={`${inputClassName} pr-12`}
                    placeholder="Opsional"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-500">
                    %
                  </span>
                </div>
                <FieldError message={state.fieldErrors?.exchangePurityPercent} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-4 font-medium text-neutral-800">
                  <span>Ukuran aktual</span>
                  <span className="text-xs font-normal text-[var(--muted)]">
                    {size.length}/64
                  </span>
                </span>
                <input
                  name="size"
                  maxLength={64}
                  value={size}
                  disabled={formDisabled}
                  onChange={(event) => setSize(event.target.value)}
                  className={inputClassName}
                  placeholder="Contoh: 17"
                />
                <FieldError message={state.fieldErrors?.size} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-4 font-medium text-neutral-800">
                  <span>Warna aktual</span>
                  <span className="text-xs font-normal text-[var(--muted)]">
                    {color.length}/64
                  </span>
                </span>
                <input
                  name="color"
                  maxLength={64}
                  value={color}
                  disabled={formDisabled}
                  onChange={(event) => setColor(event.target.value)}
                  className={inputClassName}
                  placeholder="Contoh: Yellow Gold"
                />
                <FieldError message={state.fieldErrors?.color} />
              </label>

              <label className="block text-sm sm:col-span-2">
                <span className="mb-2 flex items-center justify-between gap-4 font-medium text-neutral-800">
                  <span>Batu aktual</span>
                  <span className="text-xs font-normal text-[var(--muted)]">
                    {gemstone.length}/160
                  </span>
                </span>
                <input
                  name="gemstone"
                  maxLength={160}
                  value={gemstone}
                  disabled={formDisabled}
                  onChange={(event) => setGemstone(event.target.value)}
                  className={inputClassName}
                  placeholder="Contoh: Zircon putih 3 mm"
                />
                <FieldError message={state.fieldErrors?.gemstone} />
              </label>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-neutral-800">Kondisi</p>

              {item.availability === "available" ? (
                <>
                  <input type="hidden" name="condition" value={condition} />
                  <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
                    <LockKeyhole className="mt-0.5 size-4 shrink-0 text-neutral-500" />
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {getConditionLabel(condition)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                        Kondisi item Tersedia dikunci. Gunakan workflow adjustment
                        inventaris agar perubahan tercatat di histori.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      condition === "good"
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] bg-white hover:bg-neutral-50"
                    } ${formDisabled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name="condition"
                      value="good"
                      checked={condition === "good"}
                      disabled={formDisabled}
                      onChange={() => setCondition("good")}
                      className="sr-only"
                    />
                    <span className="flex items-start gap-3">
                      <BadgeCheck
                        className={`mt-0.5 size-5 shrink-0 ${
                          condition === "good"
                            ? "text-[var(--accent)]"
                            : "text-neutral-400"
                        }`}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-neutral-900">
                          Baru
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                          Kondisi baik dan dapat dipersiapkan untuk penjualan.
                        </span>
                      </span>
                    </span>
                  </label>

                  <label
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      condition === "damaged"
                        ? "border-amber-300 bg-amber-50"
                        : "border-[var(--border)] bg-white hover:bg-neutral-50"
                    } ${formDisabled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name="condition"
                      value="damaged"
                      checked={condition === "damaged"}
                      disabled={formDisabled}
                      onChange={() => setCondition("damaged")}
                      className="sr-only"
                    />
                    <span className="flex items-start gap-3">
                      <AlertTriangle
                        className={`mt-0.5 size-5 shrink-0 ${
                          condition === "damaged"
                            ? "text-amber-600"
                            : "text-neutral-400"
                        }`}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-neutral-900">
                          Bekas
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                          Memerlukan pemeriksaan sebelum dapat dijual.
                        </span>
                      </span>
                    </span>
                  </label>
                </div>
              )}

              <FieldError message={state.fieldErrors?.condition} />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <SingleImageInput
              label="Foto Item Aktual"
              initialImageUrl={item.imageUrl}
              disabled={formDisabled}
              description="Foto aktual membantu verifikasi barang, pencarian visual, dan menjadi syarat sebelum item berstatus Tersedia."
              onStateChange={setImageState}
            />
            <FieldError message={state.fieldErrors?.image} />

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-4 py-3">
                <p className="text-xs font-semibold text-neutral-900">Angle jelas</p>
                <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                  Pastikan bentuk utama item terlihat utuh.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-4 py-3">
                <p className="text-xs font-semibold text-neutral-900">Pencahayaan netral</p>
                <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                  Hindari pantulan berlebih dan bayangan gelap.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-4 py-3">
                <p className="text-xs font-semibold text-neutral-900">Latar sederhana</p>
                <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                  Gunakan latar yang tidak mengganggu detail produk.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <CircleDollarSign className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">Harga Aktual</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Nominal disimpan sebagai Rupiah bulat dan ditampilkan dengan
                  pemisah ribuan otomatis.
                </p>
              </div>
            </div>

            {canManagePricing ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <MoneyInput
                  name="pricePerGram"
                  label="Harga logam per gram"
                  value={pricePerGram}
                  onChange={setPricePerGram}
                  placeholder="1.250.000"
                  disabled={formDisabled}
                  error={state.fieldErrors?.pricePerGram}
                />
                <MoneyInput
                  name="deductionPerGram"
                  label="Potongan per gram"
                  value={deductionPerGram}
                  onChange={setDeductionPerGram}
                  placeholder="0"
                  disabled={formDisabled}
                  error={state.fieldErrors?.deductionPerGram}
                />
                <MoneyInput
                  name="costAmount"
                  label="Harga modal"
                  value={costAmount}
                  onChange={setCostAmount}
                  placeholder="3.500.000"
                  disabled={formDisabled}
                  error={state.fieldErrors?.costAmount}
                />
                <MoneyInput
                  name="sellingAmount"
                  label="Harga label final"
                  value={sellingAmount}
                  onChange={setSellingAmount}
                  placeholder="5.050.000"
                  disabled={formDisabled}
                  error={state.fieldErrors?.sellingAmount}
                />
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-800">
                <LockKeyhole className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Akses harga terbatas</p>
                  <p className="mt-1 text-xs leading-5">
                    Nilai harga existing dipertahankan. Perubahan harga memerlukan
                    permission <span className="font-mono">pricing.manage</span>.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
                <p className="text-xs text-[var(--muted)]">Harga label</p>
                <p className="mt-2 text-sm font-semibold text-neutral-950">
                  {displayMoney(sellingAmount)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
                <p className="text-xs text-[var(--muted)]">Harga modal</p>
                <p className="mt-2 text-sm font-semibold text-neutral-950">
                  {canManagePricing ? displayMoney(costAmount) : "Akses terbatas"}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
                <p className="text-xs text-[var(--muted)]">Harga per gram</p>
                <p className="mt-2 text-sm font-semibold text-neutral-950">
                  {displayMoney(pricePerGram)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
                <p className="text-xs text-[var(--muted)]">Potongan per gram</p>
                <p className="mt-2 text-sm font-semibold text-neutral-950">
                  {displayMoney(deductionPerGram)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <MapPin className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Penempatan Stok
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Item Draft dapat ditempatkan langsung. Item Tersedia berpindah
                  outlet melalui workflow transfer.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Outlet
                </span>
                {item.availability === "available" ? (
                  <>
                    <input
                      type="hidden"
                      name="currentOutletId"
                      value={item.currentOutletId ?? ""}
                    />
                    <div className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 text-sm text-neutral-700">
                      <Store className="size-4 shrink-0 text-neutral-500" />
                      <span>{item.outletName ?? "Belum ditempatkan"}</span>
                      <LockKeyhole className="ml-auto size-4 shrink-0 text-neutral-400" />
                    </div>
                  </>
                ) : (
                  <select
                    name="currentOutletId"
                    value={currentOutletId}
                    disabled={formDisabled}
                    onChange={(event) => setCurrentOutletId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="">Belum ditempatkan</option>
                    {outlets.map((outlet) => (
                      <option key={outlet.id} value={outlet.id}>
                        {outlet.name} · {outlet.code}
                      </option>
                    ))}
                  </select>
                )}
                <FieldError message={state.fieldErrors?.currentOutletId} />
              </label>

              <label className="block text-sm">
                <span className="mb-2 flex items-center justify-between gap-4 font-medium text-neutral-800">
                  <span>Kode etalase / rak</span>
                  <span className="text-xs font-normal text-[var(--muted)]">
                    {locationCode.length}/80
                  </span>
                </span>
                <input
                  name="locationCode"
                  maxLength={80}
                  value={locationCode}
                  disabled={formDisabled}
                  onChange={(event) => setLocationCode(event.target.value)}
                  className={inputClassName}
                  placeholder="Contoh: ETALASE-A-03"
                />
                <FieldError message={state.fieldErrors?.locationCode} />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
              <div className="flex items-start gap-3">
                <Store className="mt-0.5 size-5 shrink-0 text-[var(--accent)]" />
                <div>
                  <p className="text-sm font-semibold text-neutral-950">
                    {resolvedOutletName}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    {locationCode
                      ? `Lokasi fisik: ${locationCode}`
                      : "Kode etalase atau rak belum ditentukan."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
                <NotebookPen className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Catatan Internal
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Catat informasi pemeriksaan, penerimaan, atau karakteristik
                  khusus yang perlu diketahui tim internal.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm">
              <span className="mb-2 flex items-center justify-between gap-4 font-medium text-neutral-800">
                <span>Catatan item</span>
                <span className="text-xs font-normal text-[var(--muted)]">
                  {internalNotes.length}/4000
                </span>
              </span>
              <textarea
                name="internalNotes"
                rows={6}
                maxLength={4000}
                value={internalNotes}
                disabled={formDisabled}
                onChange={(event) => setInternalNotes(event.target.value)}
                className={textareaClassName}
                placeholder="Contoh: diterima dalam kondisi baik, perlu pemeriksaan ulang pengait sebelum display"
              />
              <FieldError message={state.fieldErrors?.internalNotes} />
            </label>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p className="text-xs leading-5">
                Catatan ini tidak ditampilkan di POS, nota transaksi, atau label
                pelanggan.
              </p>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-6">
          {isDraft ? (
            <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-[var(--accent)]">
                    Kesiapan Aktivasi
                  </p>
                  <h2 className="mt-1 font-semibold text-neutral-950">
                    Jadikan Item Tersedia
                  </h2>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    activationReady
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {readinessCount}/{readinessItems.length}
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-neutral-950 transition-all"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                {activationReady
                  ? "Semua persyaratan UI sudah lengkap. Server tetap melakukan validasi final."
                  : `${readinessItems.length - readinessCount} persyaratan masih perlu dilengkapi.`}
              </p>

              <div className="mt-4 space-y-2.5">
                {readinessItems.map((entry) => (
                  <ChecklistItem key={entry.label} {...entry} />
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <PackageCheck className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-neutral-950">
                    Item Sudah Tersedia
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Form ini hanya mengoreksi data yang tidak mengubah histori
                    pergerakan stok.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-xs leading-5 text-[var(--muted)]">
                <div className="flex items-start gap-2">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0" />
                  Outlet dikunci dan hanya dapat dipindahkan melalui transfer.
                </div>
                <div className="flex items-start gap-2">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0" />
                  Kondisi diubah melalui adjustment inventaris.
                </div>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[var(--accent)]">
                  Ringkasan Perubahan
                </p>
                <h2 className="mt-1 font-semibold text-neutral-950">
                  Snapshot Item
                </h2>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  isDirty
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {isDirty ? "Belum disimpan" : "Tersimpan"}
              </span>
            </div>

            <dl className="mt-4 divide-y divide-[var(--border)]">
              <SummaryRow
                label="Nama POS"
                value={normalized(displayName) || item.productName}
              />
              <SummaryRow label="SKU" value={item.sku} monospace />
              <SummaryRow
                label="Berat"
                value={weightGram ? `${weightGram} gram` : "Belum diisi"}
              />
              <SummaryRow
                label="Kondisi"
                value={getConditionLabel(condition)}
              />
              <SummaryRow label="Harga label" value={displayMoney(sellingAmount)} />
              <SummaryRow label="Outlet" value={resolvedOutletName} />
              <SummaryRow
                label="Lokasi"
                value={normalized(locationCode) || "Belum diisi"}
              />
              <SummaryRow
                label="Foto"
                value={imageState.hasImage ? "Tersedia" : "Belum tersedia"}
              />
              <SummaryRow
                label="Perubahan"
                value={
                  changedFields > 0
                    ? `${changedFields} field berubah`
                    : "Tidak ada perubahan"
                }
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <p className="text-xs font-medium text-[var(--accent)]">
              Pusat Aksi
            </p>
            <h2 className="mt-1 font-semibold text-neutral-950">
              Simpan Konfigurasi
            </h2>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              SKU, barcode, master product, dan histori inventaris tidak berubah.
            </p>

            <FieldError message={state.fieldErrors?.submitIntent} />

            <div className="mt-4">
              <SubmitButtons
                isDraft={isDraft}
                isDirty={isDirty}
                activationReady={activationReady}
                isItemActive={item.isActive}
              />
            </div>

            {!isDirty && item.isActive ? (
              <p className="mt-3 text-center text-[11px] leading-4 text-[var(--muted)]">
                Ubah minimal satu field untuk mengaktifkan tombol simpan.
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
                <Archive className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Pengelolaan Item
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Arsip tidak menghapus SKU, foto, harga, maupun histori item.
                </p>
              </div>
            </div>

            <div className="mt-4 [&_button]:w-full [&_button]:px-4">
              <ArchiveRestoreButtons
                itemId={item.id}
                isActive={item.isActive}
              />
            </div>
          </section>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 text-xs leading-5 text-[var(--muted)]">
            <div className="flex items-start gap-2">
              <ImageIcon className="mt-0.5 size-4 shrink-0" />
              Foto dan harga baru berlaku setelah server berhasil menyimpan
              perubahan.
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
