"use client";

import {
  AlertTriangle,
  Calculator,
  CircleDollarSign,
  Gem,
  ImageIcon,
  MapPin,
  PackageCheck,
  Save,
  Scale,
  Tag,
} from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { createProductItemAction } from "@/app/actions/product-items";
import { SingleImageInput } from "@/components/media/single-image-input";
import {
  initialProductItemActionState,
  type ProductItemActionState,
} from "@/features/inventory/product-item-contracts";
import type { ProductItemOutletOption } from "@/features/inventory/product-item-queries";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function ActionMessage({ state }: { state: ProductItemActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

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
  if (!message) {
    return null;
  }

  return <p className="mt-1.5 text-xs text-red-600">{message}</p>;
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

function formatMoney(value: number | string | null): string {
  if (value === null || value === "") {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
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

function SubmitButtons({ canMakeAvailable }: { canMakeAvailable: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        type="submit"
        name="submitIntent"
        value="draft"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
      >
        <Save className="size-4" />
        {pending ? "Menyimpan..." : "Simpan sebagai Draft"}
      </button>

      {canMakeAvailable ? (
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
  );
}

export function ProductItemForm({
  product,
  outlets,
  canManagePricing,
}: {
  product: {
    id: string;
    code: string;
    name: string;
    status: "draft" | "active" | "inactive";
  };
  outlets: ProductItemOutletOption[];
  canManagePricing: boolean;
}) {
  const [weightGram, setWeightGram] = useState("");
  const [pricePerGram, setPricePerGram] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [sellingAmount, setSellingAmount] = useState("");
  const [deductionPerGram, setDeductionPerGram] = useState("");

  const action = createProductItemAction.bind(null, product.id);
  const [state, formAction] = useActionState(
    action,
    initialProductItemActionState,
  );

  const recommendedPrice = useMemo(() => {
    const weight = Number(weightGram.replace(",", "."));
    const rate = Number(pricePerGram || "0");

    if (!Number.isFinite(weight) || weight <= 0 || rate <= 0) {
      return null;
    }

    return Math.round(weight * rate);
  }, [pricePerGram, weightGram]);

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Gem className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">Master Product</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {product.code} · {product.name}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            <Tag className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">
              Identitas & Detail Fisik
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              SKU dan barcode dibuat otomatis setelah item disimpan.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama item di POS
            </span>
            <input
              name="displayName"
              maxLength={220}
              className={inputClassName}
              placeholder={`Opsional, contoh: ${product.name} 2.75g Size 17`}
            />
            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Jika dikosongkan, POS tetap memakai nama Master Product.
            </p>
            <FieldError message={state.fieldErrors?.displayName} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Berat aktual (gram)
            </span>
            <div className="relative">
              <Scale className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                name="weightGram"
                inputMode="decimal"
                value={weightGram}
                onChange={(event) => setWeightGram(event.target.value)}
                className={`${inputClassName} pl-10`}
                placeholder="2,750"
              />
            </div>
            <FieldError message={state.fieldErrors?.weightGram} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kadar (%)
            </span>
            <input
              name="purityPercent"
              inputMode="decimal"
              className={inputClassName}
              placeholder="Contoh: 75.5"
            />
            <FieldError message={state.fieldErrors?.purityPercent} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Ukuran
            </span>
            <input
              name="size"
              maxLength={64}
              className={inputClassName}
              placeholder="Contoh: 17"
            />
            <FieldError message={state.fieldErrors?.size} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Warna
            </span>
            <input
              name="color"
              maxLength={64}
              className={inputClassName}
              placeholder="Kuning, putih, rose gold"
            />
            <FieldError message={state.fieldErrors?.color} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Batu
            </span>
            <input
              name="gemstone"
              maxLength={160}
              className={inputClassName}
              placeholder="Zircon, berlian, ruby, atau tanpa batu"
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
              className={inputClassName}
              placeholder="Opsional"
            />
            <FieldError message={state.fieldErrors?.exchangePurityPercent} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kondisi awal
            </span>
            <select
              name="condition"
              defaultValue="good"
              className={inputClassName}
            >
              <option value="good">Baru</option>
              <option value="damaged">Bekas</option>
            </select>
            <FieldError message={state.fieldErrors?.condition} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <SingleImageInput
          label="Foto Item Fisik"
          description="Gunakan satu foto aktual dari angle yang paling jelas. Foto wajib sebelum item dijadikan Tersedia."
        />
        <FieldError message={state.fieldErrors?.image} />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            <Calculator className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">Harga Aktual</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Setiap item memiliki harga sendiri. Harga label wajib diisi
              sebelum item dijadikan Tersedia.
            </p>
          </div>
        </div>

        {canManagePricing ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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

            {recommendedPrice !== null ? (
              <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-[var(--muted)]">
                      Estimasi (berat × harga per gram)
                    </p>
                    <p className="mt-1 text-xl font-semibold text-neutral-950">
                      {formatMoney(recommendedPrice)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSellingAmount(String(recommendedPrice))}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <CircleDollarSign className="size-4" />
                    Gunakan sebagai harga label
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="text-xs leading-5">
              Akun ini tidak memiliki permission pricing.manage. Item tetap
              dapat disimpan sebagai Draft, lalu harga dilengkapi oleh admin
              pricing pada tahap pengelolaan berikutnya.
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
              Outlet wajib ketika item langsung dijadikan Tersedia.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Outlet awal
            </span>
            <select
              name="currentOutletId"
              defaultValue=""
              className={inputClassName}
            >
              <option value="">Belum ditempatkan</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name} · {outlet.code}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.currentOutletId} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode lokasi Etalase / Rak (opsional)
            </span>
            <input
              name="locationCode"
              maxLength={80}
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
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder="Catatan penerimaan, kondisi khusus, atau informasi internal lainnya"
            />
            <FieldError message={state.fieldErrors?.internalNotes} />
          </label>
        </div>
      </section>

      {product.status !== "active" ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs leading-5">
            Produk masih Draft. Item dapat disimpan sebagai Draft, tetapi belum
            dapat dijadikan Tersedia sampai Produk berstatus Aktif.
          </p>
        </div>
      ) : null}

      {outlets.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <ImageIcon className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs leading-5">
            Akun ini belum memiliki outlet aktif. Item hanya dapat disimpan
            sebagai Draft sampai penugasan outlet tersedia.
          </p>
        </div>
      ) : null}

      <FieldError message={state.fieldErrors?.submitIntent} />

      <SubmitButtons
        canMakeAvailable={
          canManagePricing && product.status === "active" && outlets.length > 0
        }
      />
    </form>
  );
}
