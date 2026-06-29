"use client";

import {
  AlertTriangle,
  CircleDollarSign,
  MapPin,
  PackageCheck,
  Save,
  Scale,
  Tag,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateProductItemAction } from "@/app/actions/product-items";
import { SingleImageInput } from "@/components/media/single-image-input";
import {
  initialProductItemActionState,
  type ProductItemActionState,
} from "@/features/inventory/product-item-contracts";
import type { ProductItemOutletOption } from "@/features/inventory/product-item-queries";
import { ArchiveRestoreButtons } from "./archive-restore-buttons";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function ActionMessage({ state }: { state: ProductItemActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={
        state.status === "success"
          ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      }
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
  if (!value) {
    return "";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(BigInt(value));
}

function MoneyInput({
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
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

function SubmitButtons({ showActivate, itemId, isActive }: { showActivate: boolean; itemId: string; isActive: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <ArchiveRestoreButtons itemId={itemId} isActive={isActive} />
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
        type="submit"
        name="submitIntent"
        value="save"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
      >
        <Save className="size-4" />
        {pending ? "Menyimpan..." : "Simpan Perubahan"}
      </button>

      {showActivate ? (
        <button
          type="submit"
          name="submitIntent"
          value="available"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60 [&_svg]:!text-white"
        >
          <PackageCheck className="size-4" />
          {pending ? "Menyimpan..." : "Simpan dan Jadikan Tersedia"}
        </button>
      ) : null}
      </div>
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
  const [costAmount, setCostAmount] = useState(item.costAmount ?? "");
  const [sellingAmount, setSellingAmount] = useState(item.sellingAmount ?? "");
  const [pricePerGram, setPricePerGram] = useState(item.pricePerGram ?? "");
  const [deductionPerGram, setDeductionPerGram] = useState(
    item.deductionPerGram ?? "",
  );
  const action = updateProductItemAction.bind(null, item.id);
  const [state, formAction] = useActionState(
    action,
    initialProductItemActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  const isDraft = item.availability === "draft";
  const canActivate =
    isDraft &&
    item.productStatus === "active" &&
    outlets.length > 0 &&
    (canManagePricing || Boolean(item.sellingAmount));

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Tag className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">Identitas Item</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              SKU, barcode, dan Product tidak dapat diubah setelah item dibuat.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama item di POS
            </span>
            <input
              name="displayName"
              maxLength={220}
              defaultValue={item.displayName ?? ""}
              className={inputClassName}
              placeholder={`Opsional, contoh: ${item.productName} ${item.weightGram ?? ""}g`}
            />
            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Jika dikosongkan, POS tetap memakai nama Master Product.
            </p>
            <FieldError message={state.fieldErrors?.displayName} />
          </label>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-neutral-50 p-4">
            <dt className="text-xs text-[var(--muted)]">SKU</dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-neutral-950">
              {item.sku}
            </dd>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4">
            <dt className="text-xs text-[var(--muted)]">Barcode</dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-neutral-950">
              {item.barcode}
            </dd>
          </div>
          <div className="rounded-xl bg-neutral-50 p-4 sm:col-span-2">
            <dt className="text-xs text-[var(--muted)]">Product</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-950">
              {item.productName} · {item.productCode}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            <Scale className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">
              Detail Product Fisik
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Lengkapi data aktual dari barang fisik yang diterima.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Berat aktual (gram)
            </span>
            <input
              name="weightGram"
              inputMode="decimal"
              defaultValue={item.weightGram ?? ""}
              className={inputClassName}
              placeholder="Contoh: 2,780"
            />
            <FieldError message={state.fieldErrors?.weightGram} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Ukuran aktual
            </span>
            <input
              name="size"
              maxLength={64}
              defaultValue={item.size ?? ""}
              className={inputClassName}
              placeholder="Opsional"
            />
            <FieldError message={state.fieldErrors?.size} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Warna aktual
            </span>
            <input
              name="color"
              maxLength={64}
              defaultValue={item.color ?? ""}
              className={inputClassName}
              placeholder="Opsional"
            />
            <FieldError message={state.fieldErrors?.color} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Batu aktual
            </span>
            <input
              name="gemstone"
              maxLength={160}
              defaultValue={item.gemstone ?? ""}
              className={inputClassName}
              placeholder="Opsional"
            />
            <FieldError message={state.fieldErrors?.gemstone} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kadar tukar (%)
            </span>
            <input
              name="exchangePurityPercent"
              inputMode="decimal"
              defaultValue={item.exchangePurityPercent ?? ""}
              className={inputClassName}
              placeholder="Opsional"
            />
            <FieldError message={state.fieldErrors?.exchangePurityPercent} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kondisi
            </span>

            {item.availability === "available" ? (
              <>
                <input type="hidden" name="condition" value={item.condition} />

                <div
                  className={`${inputClassName} flex items-center bg-neutral-50 text-neutral-600`}
                >
                  Baik
                </div>

                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                  Perubahan kondisi item Tersedia dilakukan melalui workflow
                  inventaris.
                </p>
              </>
            ) : (
              <select
                name="condition"
                defaultValue={item.condition}
                className={inputClassName}
              >
                <option value="good">Baru</option>
                <option value="damaged">Bekas</option>
              </select>
            )}

            <FieldError message={state.fieldErrors?.condition} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <SingleImageInput
          label="Foto Item Fisik"
          initialImageUrl={item.imageUrl}
          description="Gunakan satu foto aktual dari angle yang paling jelas. Foto wajib untuk status Tersedia."
        />
        <FieldError message={state.fieldErrors?.image} />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            <CircleDollarSign className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">Harga Aktual</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Nilai Rupiah disimpan tanpa titik, tetapi ditampilkan dengan
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
              error={state.fieldErrors?.pricePerGram}
            />
            <MoneyInput
              name="deductionPerGram"
              label="Potongan per gram"
              value={deductionPerGram}
              onChange={setDeductionPerGram}
              placeholder="0"
              error={state.fieldErrors?.deductionPerGram}
            />
            <MoneyInput
              name="costAmount"
              label="Harga modal"
              value={costAmount}
              onChange={setCostAmount}
              placeholder="3.500.000"
              error={state.fieldErrors?.costAmount}
            />
            <MoneyInput
              name="sellingAmount"
              label="Harga label final"
              value={sellingAmount}
              onChange={setSellingAmount}
              placeholder="5.050.000"
              error={state.fieldErrors?.sellingAmount}
            />
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs leading-5">
              Akun ini tidak memiliki pricing.manage. Nilai harga existing
              dipertahankan dan tidak dapat diubah dari form ini.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            <MapPin className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">Penempatan Stok</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Outlet item Tersedia hanya dapat dipindahkan melalui transfer.
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
                <div
                  className={`${inputClassName} flex items-center bg-neutral-50 text-neutral-600`}
                >
                  {item.outletName ?? "Belum ditempatkan"}
                </div>
              </>
            ) : (
              <select
                name="currentOutletId"
                defaultValue={item.currentOutletId ?? ""}
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
            <span className="mb-2 block font-medium text-neutral-800">
              Kode lokasi Etalase / Rak (opsional)
            </span>
            <input
              name="locationCode"
              maxLength={80}
              defaultValue={item.locationCode ?? ""}
              className={inputClassName}
              placeholder="Contoh: ETALASE-A-03"
            />
            <FieldError message={state.fieldErrors?.locationCode} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Catatan internal
            </span>
            <textarea
              name="internalNotes"
              rows={4}
              maxLength={4000}
              defaultValue={item.internalNotes ?? ""}
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder="Catatan penerimaan atau informasi internal lainnya"
            />
            <FieldError message={state.fieldErrors?.internalNotes} />
          </label>
        </div>
      </section>

      {!canActivate && isDraft ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs leading-5">
            Aktivasi membutuhkan Product aktif, outlet yang dapat diakses, harga
            label, foto aktual, berat, serta kondisi Baik.
          </p>
        </div>
      ) : null}

      <FieldError message={state.fieldErrors?.submitIntent} />
      <SubmitButtons showActivate={canActivate} itemId={item.id} isActive={item.isActive} />
    </form>
  );
}
