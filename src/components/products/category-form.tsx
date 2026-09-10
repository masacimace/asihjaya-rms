"use client";

import { Archive, CircleDot, Save, Shapes } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

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

const textareaClassName =
  "min-h-28 w-full resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm leading-6 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

type ParentCategoryOption = {
  id: string;
  code: string;
  name: string;
  displayOrder?: number;
  isActive: boolean;
};

export type EditableCategoryData = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  activeProductCount?: number;
  parentCategoryId?: string | null;
  displayOrder?: number;
  parent?: ParentCategoryOption | null;
  productCount?: number;
  childCount?: number;
  activeChildCount?: number;
};

type CategoryFormProps = (
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      category: EditableCategoryData;
    }
) & {
  inlineSubmit?: boolean;
  onSuccess?: () => void;
};

function ActionMessage({ state }: { state: CategoryActionState }) {
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
    <p className="mt-1.5 text-xs leading-5 text-red-600">{message}</p>
  ) : null;
}

export function CategoryForm(props: CategoryFormProps) {
  const router = useRouter();
  const { onSuccess } = props;
  const [status, setStatus] = useState<"active" | "inactive">(
    props.mode === "edit" && !props.category.isActive ? "inactive" : "active",
  );

  const action =
    props.mode === "create"
      ? createProductCategoryAction
      : updateProductCategoryAction.bind(null, props.category.id);

  const [state, formAction] = useActionState(
    action,
    initialCategoryActionState,
  );

  useEffect(() => {
    if (state.status !== "success") return;

    router.refresh();
    onSuccess?.();
  }, [onSuccess, router, state.status]);

  const activeProductCount =
    props.mode === "edit" ? (props.category.activeProductCount ?? 0) : 0;

  return (
    <form action={formAction} className="space-y-5">
      {props.mode === "create" && props.inlineSubmit ? (
        <input type="hidden" name="responseMode" value="inline" />
      ) : null}

      <ActionMessage state={state} />

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-neutral-950">Data Kategori</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Kategori menggunakan daftar sederhana tanpa subkategori atau
              pengaturan urutan manual.
            </p>
          </div>

          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            {status === "active" ? (
              <CircleDot className="size-5" />
            ) : (
              <Archive className="size-5" />
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode Kategori <span className="text-red-500">*</span>
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
                placeholder="Contoh: RING"
              />
            ) : (
              <input
                value={props.category.code}
                readOnly
                className={`${inputClassName} cursor-not-allowed bg-neutral-50 font-mono text-neutral-500`}
              />
            )}

            <FieldError message={state.fieldErrors?.code} />
            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Kode menjadi identitas internal dan tidak dapat diubah setelah
              kategori dibuat.
            </p>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama Kategori <span className="text-red-500">*</span>
            </span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={props.mode === "edit" ? props.category.name : ""}
              className={inputClassName}
              placeholder="Contoh: Cincin"
            />
            <FieldError message={state.fieldErrors?.name} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Deskripsi <span className="font-normal text-[var(--muted)]">(opsional)</span>
            </span>
            <textarea
              name="description"
              maxLength={2000}
              defaultValue={
                props.mode === "edit" ? (props.category.description ?? "") : ""
              }
              className={textareaClassName}
              placeholder="Tambahkan catatan singkat tentang kategori ini."
            />
            <FieldError message={state.fieldErrors?.description} />
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-2 block font-medium text-neutral-800">
              Status
            </span>
            <select
              name="status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "active" | "inactive")
              }
              className={inputClassName}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <FieldError message={state.fieldErrors?.status} />
            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Kategori aktif dapat dipilih saat membuat Product Master.
              {props.mode === "edit" && activeProductCount > 0
                ? ` Kategori ini masih dipakai oleh ${activeProductCount} Product Master aktif sehingga tidak dapat dinonaktifkan sebelum relasinya dipindahkan.`
                : ""}
            </p>
          </label>
        </div>

        <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
          <FormSubmitButton
            pendingText={props.mode === "create" ? "Membuat..." : "Menyimpan..."}
          >
            {props.mode === "create" ? (
              <Shapes className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {props.mode === "create" ? "Simpan Kategori" : "Simpan Perubahan"}
          </FormSubmitButton>
        </div>
      </section>
    </form>
  );
}

export function CreateCategoryForm({
  inlineSubmit,
  onSuccess,
}: {
  parentOptions?: ParentCategoryOption[];
  defaultParentId?: string;
  inlineSubmit?: boolean;
  onSuccess?: () => void;
}) {
  return (
    <CategoryForm
      mode="create"
      inlineSubmit={inlineSubmit}
      onSuccess={onSuccess}
    />
  );
}

export function EditCategoryForm({
  category,
  inlineSubmit,
  onSuccess,
}: {
  category: EditableCategoryData;
  parentOptions?: ParentCategoryOption[];
  inlineSubmit?: boolean;
  onSuccess?: () => void;
}) {
  return (
    <CategoryForm
      mode="edit"
      category={category}
      inlineSubmit={inlineSubmit}
      onSuccess={onSuccess}
    />
  );
}
