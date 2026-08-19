"use client";

import { Archive, CircleDot, FilePenLine, Save } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createProductMasterAction,
  updateProductMasterAction,
} from "@/app/actions/product-masters";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
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
  if (state.status === "idle" || !state.message) return null;

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

export function ProductMasterForm(props: ProductMasterFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ProductStatus>(
    props.mode === "edit" ? props.product.status : "active",
  );

  const action =
    props.mode === "create"
      ? createProductMasterAction
      : updateProductMasterAction.bind(null, props.product.id);

  const [state, formAction] = useActionState(
    action,
    initialProductMasterActionState,
  );

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);

  const statusOptions: ProductStatus[] =
    props.mode === "create"
      ? ["active", "draft"]
      : props.product.status === "active"
        ? ["active", "inactive"]
        : ["draft", "active", "inactive"];

  return (
    <form action={formAction} className="space-y-5">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-neutral-950">
              Data Product Master
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Product Master hanya menjadi pengelompokan barang fisik. Harga,
              berat, kadar, warna, kondisi, dan foto tetap milik item fisik.
            </p>
          </div>
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            {status === "active" ? (
              <CircleDot className="size-5" />
            ) : status === "inactive" ? (
              <Archive className="size-5" />
            ) : (
              <FilePenLine className="size-5" />
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kategori <span className="text-red-500">*</span>
            </span>
            <select
              name="categoryId"
              required
              defaultValue={
                props.mode === "edit" ? props.product.categoryId : ""
              }
              className={inputClassName}
            >
              <option value="">Pilih kategori</option>
              {props.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label} · {category.code}
                  {category.isActive ? "" : " (Nonaktif)"}
                </option>
              ))}
            </select>
            <FieldError message={state.fieldErrors?.categoryId} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode Product Master <span className="text-red-500">*</span>
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
                placeholder="Contoh: CIN/01"
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

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama Product Master <span className="text-red-500">*</span>
            </span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={200}
              defaultValue={props.mode === "edit" ? props.product.name : ""}
              className={inputClassName}
              placeholder="Contoh: Cincin COR 16K"
            />
            <FieldError message={state.fieldErrors?.name} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Status
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
            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Master Aktif tersedia pada dropdown saat staff membuat produk
              fisik. Master Nonaktif tetap dipertahankan untuk histori.
            </p>
          </label>
        </div>

        <input type="hidden" name="brand" value="" />
        <input type="hidden" name="collection" value="" />
        <input type="hidden" name="description" value="" />

        <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
          <FormSubmitButton
            pendingText={
              props.mode === "create" ? "Membuat..." : "Menyimpan..."
            }
          >
            <Save className="size-4" />
            {props.mode === "create" ? "Simpan Product Master" : "Simpan Perubahan"}
          </FormSubmitButton>
        </div>
      </section>
    </form>
  );
}
