"use client";

import { ImageIcon, PackageCheck, Plus, Scale } from "lucide-react";
import { useActionState, useCallback, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { createProductItemAction } from "@/app/actions/product-items";
import { SingleImageInput } from "@/components/media/single-image-input";
import { QuickProductMasterDialog } from "@/components/products/quick-product-master-dialog";
import {
  initialProductItemActionState,
  type ProductItemActionState,
} from "@/features/inventory/product-item-contracts";
import type { ProductItemOutletOption } from "@/features/inventory/product-item-queries";
import type {
  ProductMasterCategoryOption,
  ProductMasterOption,
} from "@/features/products/product-master-queries";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500";

function ActionMessage({ state }: { state: ProductItemActionState }) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {state.message}
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
  if (!value) return "";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    BigInt(value),
  );
}

function formatMoney(value: number | string | null) {
  if (value === null || value === "") return "Belum diatur";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Belum diatur";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function normalizePurityKey(value: string) {
  if (!value.trim()) return null;
  const numeric = Number(value.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 100) return null;
  return numeric.toFixed(3).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}


function ProductSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold !text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:!text-white"
    >
      <PackageCheck className="size-4" />
      {pending ? "Menyimpan..." : "Simpan Produk"}
    </button>
  );
}

export type ProductItemPriceRateOption = {
  purityKey: string;
  ratePerGram: string;
};

export function ProductItemForm({
  categories,
  productMasters: initialProductMasters,
  outlets,
  priceRates,
  initialProductMasterId,
  canCreateProductMaster,
}: {
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  outlets: ProductItemOutletOption[];
  priceRates: ProductItemPriceRateOption[];
  initialProductMasterId?: string;
  canCreateProductMaster: boolean;
}) {
  const initialMaster = initialProductMasterId
    ? initialProductMasters.find((master) => master.id === initialProductMasterId)
    : undefined;

  const [productMasters, setProductMasters] = useState(initialProductMasters);
  const [categoryId, setCategoryId] = useState(initialMaster?.categoryId ?? "");
  const [productMasterId, setProductMasterId] = useState(
    initialMaster?.id ?? "",
  );
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [purityPercent, setPurityPercent] = useState("");
  const [weightGram, setWeightGram] = useState("");
  const [deductionPerGram, setDeductionPerGram] = useState("0");

  const [state, formAction] = useActionState(
    createProductItemAction,
    initialProductItemActionState,
  );

  const filteredMasters = useMemo(
    () => productMasters.filter((master) => master.categoryId === categoryId),
    [categoryId, productMasters],
  );

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const rateMap = useMemo(
    () => new Map(priceRates.map((rate) => [rate.purityKey, rate.ratePerGram])),
    [priceRates],
  );
  const purityKey = normalizePurityKey(purityPercent);
  const activeRate = purityKey ? rateMap.get(purityKey) ?? null : null;
  const estimatedBasePrice = useMemo(() => {
    const weight = Number(weightGram.replace(",", "."));
    const rate = Number(activeRate ?? "0");
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(rate) || rate <= 0) {
      return null;
    }
    return Math.round(weight * rate);
  }, [activeRate, weightGram]);

  const handleQuickCreated = useCallback((master: ProductMasterOption) => {
    setProductMasters((current) =>
      current.some((entry) => entry.id === master.id) ? current : [...current, master],
    );
    setCategoryId(master.categoryId);
    setProductMasterId(master.id);
    setQuickCreateOpen(false);
  }, []);

  const defaultOutletId = outlets.length === 1 ? outlets[0]?.id ?? "" : "";

  return (
    <>
      <form action={formAction} className="space-y-5">
        <ActionMessage state={state} />

        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div>
            <h2 className="font-semibold text-neutral-950">Identitas Produk</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Pilih kategori dan Product Master. Jika belum tersedia, buat langsung dari tombol + tanpa meninggalkan form.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Kategori <span className="text-red-500">*</span>
              </span>
              <select
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setProductMasterId("");
                }}
                className={inputClassName}
                required
              >
                <option value="">Pilih kategori</option>
                {categories
                  .filter((category) => category.isActive)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
              </select>
            </label>

            <div className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Product Master <span className="text-red-500">*</span>
              </span>
              <div className="flex gap-2">
                <select
                  name="productMasterId"
                  value={productMasterId}
                  onChange={(event) => setProductMasterId(event.target.value)}
                  disabled={!categoryId}
                  required
                  className={`${inputClassName} min-w-0 flex-1`}
                >
                  <option value="">
                    {categoryId
                      ? filteredMasters.length > 0
                        ? "Pilih Product Master"
                        : "Belum ada Product Master"
                      : "Pilih kategori terlebih dahulu"}
                  </option>
                  {filteredMasters.map((master) => (
                    <option key={master.id} value={master.id}>
                      {master.code} — {master.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setQuickCreateOpen(true)}
                  disabled={!categoryId || !canCreateProductMaster}
                  className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--accent)] bg-white text-[var(--accent)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-neutral-300"
                  aria-label="Tambah Product Master"
                  title={canCreateProductMaster ? "Tambah Product Master" : "Tidak memiliki permission membuat Product Master"}
                >
                  <Plus className="size-5" />
                </button>
              </div>
              <FieldError message={state.fieldErrors?.productMasterId} />
            </div>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">Kode Produk</span>
              <input
                value="Dibuat otomatis setelah disimpan"
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 text-neutral-500`}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Nama Produk <span className="text-red-500">*</span>
              </span>
              <input
                name="displayName"
                required
                minLength={2}
                maxLength={220}
                className={inputClassName}
                placeholder="Nama produk per SKU"
              />
              <FieldError message={state.fieldErrors?.displayName} />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div>
            <h2 className="font-semibold text-neutral-950">Detail Fisik & Harga / Gram</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Harga / Gram otomatis mengikuti Kadar Persen aktif. Harga jual final baru dihitung saat transaksi POS.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Kadar Persen <span className="text-red-500">*</span>
              </span>
              <div className="relative">
                <input
                  name="purityPercent"
                  required
                  inputMode="decimal"
                  value={purityPercent}
                  onChange={(event) => setPurityPercent(event.target.value)}
                  className={`${inputClassName} pr-10`}
                  placeholder="Contoh: 40"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-neutral-500">%</span>
              </div>
              <FieldError message={state.fieldErrors?.purityPercent} />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Kadar Tukaran <span className="text-red-500">*</span>
              </span>
              <input
                name="exchangePurityPercent"
                required
                inputMode="decimal"
                className={inputClassName}
                placeholder="Contoh: 35"
              />
              <FieldError message={state.fieldErrors?.exchangePurityPercent} />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">Harga / Gram</span>
              <input
                value={activeRate ? formatMoney(activeRate) : "Belum diatur untuk kadar ini"}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-semibold`}
              />
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                {activeRate
                  ? "Mengikuti Harga / Gram Aktif dan tidak disimpan sebagai harga jual final."
                  : "Produk tetap boleh dibuat. Atur rate kadar ini dari Pengaturan → Harga / Gram Aktif sebelum transaksi."}
              </p>
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Potongan / Gram <span className="text-red-500">*</span>
              </span>
              <input type="hidden" name="deductionPerGram" value={deductionPerGram} />
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-neutral-500">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRupiahDigits(deductionPerGram)}
                  onChange={(event) => setDeductionPerGram(normalizeRupiahDigits(event.target.value) || "0")}
                  className={`${inputClassName} pl-11`}
                  placeholder="0"
                />
              </div>
              <FieldError message={state.fieldErrors?.deductionPerGram} />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Berat <span className="text-red-500">*</span>
              </span>
              <div className="relative">
                <Scale className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  name="weightGram"
                  required
                  inputMode="decimal"
                  value={weightGram}
                  onChange={(event) => setWeightGram(event.target.value)}
                  className={`${inputClassName} pl-10 pr-12`}
                  placeholder="Contoh: 3,05"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-500">gr</span>
              </div>
              <FieldError message={state.fieldErrors?.weightGram} />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Warna <span className="text-red-500">*</span>
              </span>
              <input
                name="color"
                required
                maxLength={64}
                className={inputClassName}
                placeholder="Contoh: Poles, Kombinasi, Kuning"
              />
              <FieldError message={state.fieldErrors?.color} />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Kondisi <span className="text-red-500">*</span>
              </span>
              <select name="condition" defaultValue="good" className={inputClassName}>
                <option value="good">Baru</option>
                <option value="used">Bekas</option>
              </select>
              <FieldError message={state.fieldErrors?.condition} />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Outlet <span className="text-red-500">*</span>
              </span>
              <select
                name="currentOutletId"
                required
                defaultValue={defaultOutletId}
                className={inputClassName}
              >
                <option value="">Pilih outlet</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} · {outlet.code}
                  </option>
                ))}
              </select>
              <FieldError message={state.fieldErrors?.currentOutletId} />
            </label>
          </div>

          {estimatedBasePrice !== null ? (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <p className="text-xs text-[var(--muted)]">Estimasi harga dasar saat ini</p>
              <p className="mt-1 text-lg font-semibold text-neutral-950">
                {formatMoney(estimatedBasePrice)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Berat × Harga / Gram aktif. Ini bukan harga final transaksi.
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <SingleImageInput
            name="image"
            label="Foto Produk Fisik"
            description="Foto bersifat opsional. Produk tetap dapat aktif jika foto belum tersedia dan bisa dilengkapi kemudian."
          />
          <FieldError message={state.fieldErrors?.image} />
        </section>

        <input type="hidden" name="submitIntent" value="available" />
        <input type="hidden" name="internalNotes" value="" />

        {outlets.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <ImageIcon className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs leading-5">
              Akun ini belum mempunyai outlet aktif. Tambahkan akses outlet sebelum membuat produk fisik.
            </p>
          </div>
        ) : null}

        <FieldError message={state.fieldErrors?.submitIntent} />

        <div className="flex justify-end">
          <ProductSubmitButton disabled={outlets.length === 0} />
        </div>
      </form>

      <QuickProductMasterDialog
        key={`${categoryId}:${quickCreateOpen ? "open" : "closed"}`}
        open={quickCreateOpen && canCreateProductMaster}
        categoryId={categoryId}
        categoryLabel={selectedCategory?.label ?? "Kategori belum dipilih"}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={handleQuickCreated}
      />
    </>
  );
}
