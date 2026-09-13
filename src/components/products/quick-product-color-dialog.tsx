"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useEffect } from "react";

import { quickCreateProductColorPresetAction } from "@/app/actions/product-color-presets";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { initialQuickProductColorPresetActionState } from "@/features/settings/product-color-preset-contracts";
import type { ProductColorPresetOption } from "@/features/settings/product-color-presets";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mt-1.5 text-xs text-red-600">{message}</p>
  ) : null;
}

export function QuickProductColorDialog({
  open,
  onClose,
  onCreated,
  creationSource = "admin",
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (preset: ProductColorPresetOption) => void;
  creationSource?: "admin" | "pos" | "buyback";
}) {
  const [state, formAction] = useActionState(
    quickCreateProductColorPresetAction,
    initialQuickProductColorPresetActionState,
  );

  useEffect(() => {
    if (state.status !== "success" || !state.createdPreset) return;
    onCreated(state.createdPreset);
  }, [onCreated, state.createdPreset, state.status]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-product-color-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2
              id="quick-product-color-title"
              className="font-semibold text-neutral-950"
            >
              Tambah Warna
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Warna baru langsung aktif dan dipilih pada form.
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
          <input type="hidden" name="creationSource" value={creationSource} />

          {state.status === "error" && state.message ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.message}
            </div>
          ) : null}

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nama Warna <span className="text-red-500">*</span>
            </span>
            <input
              name="name"
              required
              maxLength={64}
              className={inputClassName}
              placeholder="Contoh: Kuning"
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
