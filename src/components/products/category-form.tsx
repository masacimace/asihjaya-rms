"use client";

import { FolderTree, Save, Shapes } from "lucide-react";
import { useActionState } from "react";

import {
  createProductCategoryAction,
  updateProductCategoryAction,
} from "@/app/actions/product-categories";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import {
  initialCategoryActionState,
  type CategoryActionState,
} from "@/features/products/category-contracts";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

type CategoryData = {
  id: string;
  code: string;
  name: string;
  parentCategoryId: string | null;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
};

type ParentCategoryOption = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

function ActionMessage({ state }: { state: CategoryActionState }) {
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

type CategoryFormProps =
  | {
      mode: "create";
      parentOptions: ParentCategoryOption[];
      defaultParentId?: string;
    }
  | {
      mode: "edit";
      category: CategoryData;
      parentOptions: ParentCategoryOption[];
    };

export function CategoryForm(props: CategoryFormProps) {
  const action =
    props.mode === "create"
      ? createProductCategoryAction
      : updateProductCategoryAction.bind(null, props.category.id);

  const [state, formAction] = useActionState(
    action,
    initialCategoryActionState,
  );

  const defaultParentId =
    props.mode === "edit"
      ? (props.category.parentCategoryId ?? "")
      : (props.defaultParentId ?? "");

  return (
    <form action={formAction} className="space-y-6">
      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Shapes className="size-5" />
          </div>

          <div>
            <h2 className="font-semibold text-neutral-950">
              Informasi Kategori
            </h2>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Kode menjadi identitas internal kategori dan tidak dapat diubah
              setelah kategori dibuat.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode kategori
            </span>

            {props.mode === "create" ? (
              <input
                name="code"
                required
                minLength={2}
                maxLength={32}
                autoCapitalize="characters"
                autoCorrect="off"
                className={inputClassName}
                placeholder="Contoh: RING-WOMEN"
              />
            ) : (
              <input
                value={props.category.code}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.code} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama kategori
            </span>

            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={props.mode === "edit" ? props.category.name : ""}
              className={inputClassName}
              placeholder="Cincin Wanita"
            />

            <FieldError message={state.fieldErrors?.name} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kategori induk
            </span>

            <select
              name="parentCategoryId"
              defaultValue={defaultParentId}
              className={inputClassName}
            >
              <option value="">Tidak ada · kategori utama</option>

              {props.parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.code}
                  {option.isActive ? "" : " (Nonaktif)"}
                </option>
              ))}
            </select>

            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Hierarki dibatasi satu tingkat. Subkategori tidak dapat menjadi
              induk bagi kategori lain.
            </p>

            <FieldError message={state.fieldErrors?.parentCategoryId} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Urutan tampilan
            </span>

            <input
              type="number"
              name="displayOrder"
              required
              min={0}
              max={9999}
              step={1}
              defaultValue={
                props.mode === "edit" ? props.category.displayOrder : 0
              }
              className={inputClassName}
            />

            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Angka lebih kecil ditampilkan lebih dahulu.
            </p>

            <FieldError message={state.fieldErrors?.displayOrder} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Deskripsi
            </span>

            <textarea
              name="description"
              rows={4}
              maxLength={2000}
              defaultValue={
                props.mode === "edit" ? (props.category.description ?? "") : ""
              }
              className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder="Penjelasan singkat mengenai kategori produk"
            />

            <FieldError message={state.fieldErrors?.description} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            <FolderTree className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-neutral-950">
              Status Kategori
            </h2>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={
                  props.mode === "edit" ? props.category.isActive : true
                }
                className="mt-0.5 size-4 accent-[var(--accent)]"
              />

              <span>
                <span className="block text-sm font-medium text-neutral-900">
                  Kategori aktif
                </span>

                <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                  Kategori aktif dapat dipilih untuk produk baru. Kategori dengan
                  produk aktif atau subkategori aktif tidak dapat dinonaktifkan.
                </span>
              </span>
            </label>

            <FieldError message={state.fieldErrors?.isActive} />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <FormSubmitButton
          pendingText={
            props.mode === "create"
              ? "Membuat kategori..."
              : "Menyimpan kategori..."
          }
        >
          {props.mode === "create" ? (
            <Shapes className="size-4" />
          ) : (
            <Save className="size-4" />
          )}

          {props.mode === "create"
            ? "Buat Kategori"
            : "Simpan Perubahan"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
