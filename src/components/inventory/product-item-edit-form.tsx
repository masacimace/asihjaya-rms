"use client";

import { PackageCheck, Save, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateProductItemAction } from "@/app/actions/product-items";
import { SingleImageInput } from "@/components/media/single-image-input";
import {
  initialProductItemActionState,
  type ProductItemActionState,
} from "@/features/inventory/product-item-contracts";
import type { ProductItemOutletOption } from "@/features/inventory/product-item-queries";
import type { ProductItemPriceRateOption } from "./product-item-form";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500";

function ActionMessage({ state }: { state: ProductItemActionState }) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <div
      role="alert"
      className={`rounded-xl border px-4 py-3 text-sm ${
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
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

function SubmitButtons({ isDraft }: { isDraft: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="submit"
        name="submitIntent"
        value="save"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="size-4" />
        {pending ? "Menyimpan..." : "Simpan Perubahan"}
      </button>

      {isDraft ? (
        <button
          type="submit"
          name="submitIntent"
          value="available"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold !text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:!text-white"
        >
          <PackageCheck className="size-4" />
          {pending ? "Menyimpan..." : "Simpan & Jadikan Tersedia"}
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
  purityPercent: string | null;
  exchangePurityPercent: string | null;
  color: string | null;
  deductionPerGram: string | null;
  availability:
    | "draft"
    | "migration_hold"
    | "processing"
    | "available"
    | "reserved"
    | "inspection"
    | "sold";
  condition: "good" | "used" | "damaged" | "lost" | "returned";
  currentOutletId: string | null;
  outletName: string | null;
  imageUrl: string | null;
  productName: string;
  productCode: string;
  productStatus: "draft" | "active" | "inactive";
  isActive: boolean;
};

export function ProductItemEditForm({
  item,
  outlets,
  priceRates,
}: {
  item: EditableItem;
  outlets: ProductItemOutletOption[];
  priceRates: ProductItemPriceRateOption[];
}) {
  const router = useRouter();
  const action = updateProductItemAction.bind(null, item.id);
  const [state, formAction] = useActionState(
    action,
    initialProductItemActionState,
  );

  const [purityPercent, setPurityPercent] = useState(item.purityPercent ?? "");
  const [weightGram, setWeightGram] = useState(item.weightGram ?? "");
  const [deductionPerGram, setDeductionPerGram] = useState(
    item.deductionPerGram ?? "0",
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  const rateMap = useMemo(
    () => new Map(priceRates.map((rate) => [rate.purityKey, rate.ratePerGram])),
    [priceRates],
  );
  const purityKey = normalizePurityKey(purityPercent);
  const activeRate = purityKey ? rateMap.get(purityKey) ?? null : null;
  const estimatedBasePrice = useMemo(() => {
    const weight = Number(weightGram.replace(",", "."));
    const rate = Number(activeRate ?? "0");
    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      return null;
    }
    return Math.round(weight * rate);
  }, [activeRate, weightGram]);

  const isDraft = item.availability === "draft";
  const canEdit = item.isActive;

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div>
          <h2 className="font-semibold text-neutral-950">Identitas Produk</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            SKU, barcode, dan Product Master tetap terkunci agar histori inventaris tidak berubah.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">Product Master</span>
            <input
              value={`${item.productCode} — ${item.productName}`}
              readOnly
              className={`${inputClassName} cursor-not-allowed bg-neutral-50`}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">Kode / Barcode</span>
            <input
              value={`${item.sku} · ${item.barcode}`}
              readOnly
              className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono`}
            />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama Produk <span className="text-red-500">*</span>
            </span>
            <input
              name="displayName"
              defaultValue={item.displayName ?? ""}
              required
              minLength={2}
              maxLength={220}
              disabled={!canEdit}
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
            Harga / Gram mengikuti rate aktif berdasarkan Kadar Persen. Harga jual final tidak diedit dari inventaris.
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
                disabled={!canEdit}
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
              defaultValue={item.exchangePurityPercent ?? ""}
              disabled={!canEdit}
              className={inputClassName}
              placeholder="Contoh: 375"
            />
            <FieldError message={state.fieldErrors?.exchangePurityPercent} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">Harga / Gram Aktif</span>
            <input
              value={activeRate ? formatMoney(activeRate) : "Belum diatur untuk kadar ini"}
              readOnly
              className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-semibold`}
            />
            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              {activeRate
                ? "Rate ini otomatis dipakai sebagai dasar pricing."
                : "Item tetap dapat disimpan. Atur rate kadar ini sebelum transaksi POS."}
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
                onChange={(event) =>
                  setDeductionPerGram(
                    normalizeRupiahDigits(event.target.value) || "0",
                  )
                }
                disabled={!canEdit}
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
                disabled={!canEdit}
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
              defaultValue={item.color ?? ""}
              disabled={!canEdit}
              className={inputClassName}
              placeholder="Contoh: Poles, Kombinasi, Kuning"
            />
            <FieldError message={state.fieldErrors?.color} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kondisi <span className="text-red-500">*</span>
            </span>
            <select
              name="condition"
              defaultValue={item.condition}
              disabled={!canEdit}
              className={inputClassName}
            >
              <option value="good">Baru</option>
              <option value="used">Bekas</option>
              {item.condition === "damaged" || isDraft ? (
                <option value="damaged">Rusak</option>
              ) : null}
            </select>
            <FieldError message={state.fieldErrors?.condition} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Outlet <span className="text-red-500">*</span>
            </span>
            {isDraft ? (
              <select
                name="currentOutletId"
                defaultValue={item.currentOutletId ?? ""}
                required
                disabled={!canEdit}
                className={inputClassName}
              >
                <option value="">Pilih outlet</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} · {outlet.code}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input type="hidden" name="currentOutletId" value={item.currentOutletId ?? ""} />
                <input
                  value={item.outletName ?? "Belum ditempatkan"}
                  readOnly
                  className={`${inputClassName} cursor-not-allowed bg-neutral-50`}
                />
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  Perpindahan outlet tetap dilakukan melalui fitur transfer inventaris.
                </p>
              </>
            )}
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
              Berat × Harga / Gram aktif. Harga final baru ditentukan pada transaksi POS.
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <SingleImageInput
          name="image"
          initialImageUrl={item.imageUrl}
          label="Foto Produk Fisik"
          description="Foto bersifat opsional dan bisa dilengkapi atau diganti kapan saja."
          disabled={!canEdit}
        />
        <FieldError message={state.fieldErrors?.image} />
      </section>

      <FieldError message={state.fieldErrors?.submitIntent} />
      <SubmitButtons isDraft={isDraft} />
    </form>
  );
}
