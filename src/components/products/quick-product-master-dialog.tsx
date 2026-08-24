"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useEffect } from "react";

import { quickCreateProductMasterAction } from "@/app/actions/product-masters";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import {
  initialQuickProductMasterActionState,
} from "@/features/products/product-master-contracts";
import type { ProductMasterOption } from "@/features/products/product-master-queries";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1.5 text-xs text-red-600">{message}</p>
  ) : null;
}

export function QuickProductMasterDialog({
  open,
  categoryId,
  categoryLabel,
  onClose,
  onCreated,
  creationSource = "admin",
}: {
  open: boolean;
  categoryId: string;
  categoryLabel: string;
  onClose: () => void;
  onCreated: (master: ProductMasterOption) => void;
  creationSource?: "admin" | "pos";
}) {
  const [state, formAction] = useActionState(
    quickCreateProductMasterAction,
    initialQuickProductMasterActionState,
  );

  useEffect(() => {
    if (state.status !== "success" || !state.createdMaster) {
      return;
    }

    onCreated({
      ...state.createdMaster,
      status: "active",
    });
  }, [onCreated, state.createdMaster, state.status]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-product-master-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2
              id="quick-product-master-title"
              className="font-semibold text-neutral-950"
            >
              Tambah Product Master
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Kategori: {categoryLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        <form action={formAction} className="space-y-4 p-5">
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="creationSource" value={creationSource} />

          {state.status === "error" && state.message ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.message}
            </div>
          ) : null}

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Kode Product Master <span className="text-red-500">*</span>
            </span>
            <input
              name="code"
              required
              minLength={2}
              maxLength={64}
              autoCapitalize="characters"
              autoCorrect="off"
              className={inputClassName}
              placeholder="Contoh: GLG/01"
            />
            <FieldError message={state.fieldErrors?.code} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama Product Master <span className="text-red-500">*</span>
            </span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={200}
              className={inputClassName}
              placeholder="Contoh: Gelang Rantai 16K"
            />
            <FieldError message={state.fieldErrors?.name} />
          </label>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              Batal
            </button>
            <FormSubmitButton pendingText="Menyimpan...">
              <Plus className="size-4" />
              Simpan
            </FormSubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
