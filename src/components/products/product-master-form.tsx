"use client";

import {
  AlertTriangle,
  Archive,
  CircleDot,
  FilePenLine,
  Gem,
  Save,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createProductMasterAction,
  updateProductMasterAction,
} from "@/app/actions/product-masters";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { SingleImageInput } from "@/components/media/single-image-input";
import {
  initialProductMasterActionState,
  type ProductMasterActionState,
} from "@/features/products/product-master-contracts";
import type { ProductMasterCategoryOption } from "@/features/products/product-master-queries";
import type { ProductStatus } from "@/features/products/contracts";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

const statusLabels: Record<ProductStatus, string> = {
  draft: "Draft",
  active: "Aktif",
  inactive: "Nonaktif",
};

type ProductMasterData = {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  brand: string | null;
  collection: string | null;
  description: string | null;
  status: ProductStatus;
  imageUrl: string | null;
};

type ProductMasterFormProps =
  | {
      mode: "create";
      categories: ProductMasterCategoryOption[];
    }
  | {
      mode: "edit";
      categories: ProductMasterCategoryOption[];
      product: ProductMasterData;
    };

function ActionMessage({ state }: { state: ProductMasterActionState }) {
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
  if (!message) {
    return null;
  }

  return <p className="mt-1.5 text-xs text-red-600">{message}</p>;
}

export function ProductMasterForm(props: ProductMasterFormProps) {
  const router = useRouter();
  const initialStatus: ProductStatus =
    props.mode === "edit" ? props.product.status : "draft";

  const [status, setStatus] = useState<ProductStatus>(initialStatus);

  const action =
    props.mode === "create"
      ? createProductMasterAction
      : updateProductMasterAction.bind(null, props.product.id);

  const [state, formAction] = useActionState(
    action,
    initialProductMasterActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  const statusOptions: ProductStatus[] =
    props.mode === "create"
      ? ["draft", "active"]
      : props.product.status === "active"
        ? ["active", "inactive"]
        : ["draft", "active", "inactive"];

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Gem className="size-5" />
          </div>

          <div>
            <h2 className="font-semibold text-neutral-950">
              Identitas Product
            </h2>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Product mewakili desain atau model utama. Kode menjadi identitas
              internal dan tidak dapat diubah setelah dibuat.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode unik
            </span>

            {props.mode === "create" ? (
              <input
                name="code"
                required
                minLength={2}
                maxLength={64}
                autoCapitalize="characters"
                autoCorrect="off"
                className={inputClassName}
                placeholder="Contoh: RING-AURELIA"
              />
            ) : (
              <input
                value={props.product.code}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.code} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama Product
            </span>

            <input
              name="name"
              required
              minLength={2}
              maxLength={200}
              defaultValue={props.mode === "edit" ? props.product.name : ""}
              className={inputClassName}
              placeholder="Cincin Solitaire Aurelia"
            />

            <FieldError message={state.fieldErrors?.name} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Kategori
            </span>

            <select
              name="categoryId"
              required
              defaultValue={
                props.mode === "edit" ? props.product.categoryId : ""
              }
              className={inputClassName}
            >
              <option value="">Pilih kategori Product</option>

              {props.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label} · {category.code}
                  {category.isActive ? "" : " (Nonaktif · kategori saat ini)"}
                </option>
              ))}
            </select>

            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Product baru dan Product aktif harus menggunakan kategori aktif.
            </p>

            <FieldError message={state.fieldErrors?.categoryId} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Brand
            </span>

            <input
              name="brand"
              maxLength={120}
              defaultValue={
                props.mode === "edit" ? (props.product.brand ?? "") : ""
              }
              className={inputClassName}
              placeholder="ASIHJAYA"
            />

            <FieldError message={state.fieldErrors?.brand} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Koleksi
            </span>

            <input
              name="collection"
              maxLength={120}
              defaultValue={
                props.mode === "edit" ? (props.product.collection ?? "") : ""
              }
              className={inputClassName}
              placeholder="Aurelia"
            />

            <FieldError message={state.fieldErrors?.collection} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Deskripsi
            </span>

            <textarea
              name="description"
              rows={5}
              maxLength={4000}
              defaultValue={
                props.mode === "edit" ? (props.product.description ?? "") : ""
              }
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder="Deskripsi desain, karakter Product, dan informasi katalog lainnya"
            />

            <FieldError message={state.fieldErrors?.description} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <SingleImageInput
          label="Master Product"
          initialImageUrl={
            props.mode === "edit" ? props.product.imageUrl : null
          }
          description="Gunakan satu foto katalog utama yang mewakili desain Product. Foto wajib sebelum Product diaktifkan."
        />
        <FieldError message={state.fieldErrors?.image} />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            {status === "active" ? (
              <CircleDot className="size-5" />
            ) : status === "inactive" ? (
              <Archive className="size-5" />
            ) : (
              <FilePenLine className="size-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-neutral-950">Status Product</h2>

            <label className="mt-4 block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Status operasional
              </span>

              <select
                name="status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ProductStatus)
                }
                className={inputClassName}
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {statusLabels[option]}
                  </option>
                ))}
              </select>

              <FieldError message={state.fieldErrors?.status} />
            </label>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-neutral-50 px-4 py-3 text-xs leading-5 text-[var(--muted)]">
              {status === "draft"
                ? "Draft digunakan saat informasi Product masih dipersiapkan dan belum siap dipakai untuk operasional baru."
                : status === "active"
                  ? "Product aktif dapat menerima spesifikasi dan item fisik baru."
                  : "Product nonaktif dipertahankan untuk histori, tetapi tidak digunakan untuk data operasional baru."}
            </div>

            {props.mode === "edit" &&
            props.product.status === "active" &&
            status === "inactive" ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  Penonaktifan akan ditolak apabila Product masih memiliki
                  spesifikasi aktif atau item operasional aktif berstatus draft,
                  tersedia, atau reserved.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <FormSubmitButton
          pendingText={
            props.mode === "create"
              ? "Membuat Product..."
              : "Menyimpan Product..."
          }
        >
          {props.mode === "create" ? (
            <Gem className="size-4" />
          ) : (
            <Save className="size-4" />
          )}

          {props.mode === "create" ? "Buat Product" : "Simpan Perubahan"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
