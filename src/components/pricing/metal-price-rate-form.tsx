"use client";

import { CircleDollarSign, Plus, Save } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { saveMetalPriceRatesAction } from "@/app/actions/metal-price-rates";
import {
  initialMetalPriceRateActionState,
} from "@/features/pricing/metal-price-rate-action-state";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import type { MetalPriceRateSettingRow } from "@/features/pricing/metal-price-rates";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function formatMoneyInput(value: string | null) {
  if (!value) return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("id-ID").format(numeric) : value;
}

function formatDate(value: Date | null) {
  if (!value) return "Belum ada harga aktif";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function MetalPriceRateForm({ rows }: { rows: MetalPriceRateSettingRow[] }) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    saveMetalPriceRatesAction,
    initialMetalPriceRateActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="space-y-5">
      {state.message ? (
        <div
          role="alert"
          className={
            state.status === "success"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {state.message}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <CircleDollarSign className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-950">Harga / Gram Aktif</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Satu harga berlaku untuk semua item dengan Kadar Persen yang sama. Perubahan harga lama tetap tersimpan sebagai histori.
              </p>
            </div>
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {rows.map((row) => {
              const fieldName = `ratePerGram:${row.purityKey}`;
              return (
                <div key={row.purityKey} className="grid gap-3 px-4 py-4 sm:grid-cols-[140px_minmax(0,1fr)_220px] sm:items-center sm:px-5">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">{row.purityKey}%</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{row.itemCount} item aktif</p>
                  </div>

                  <label className="block">
                    <span className="sr-only">Harga per gram kadar {row.purityKey}%</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-neutral-500">Rp</span>
                      <input
                        name={fieldName}
                        inputMode="numeric"
                        defaultValue={formatMoneyInput(row.ratePerGram)}
                        className={`${inputClassName} pl-10`}
                        placeholder="0"
                      />
                    </div>
                    {state.fieldErrors?.[fieldName] ? (
                      <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors[fieldName]}</p>
                    ) : null}
                  </label>

                  <p className="text-xs leading-5 text-[var(--muted)] sm:text-right">
                    {formatDate(row.effectiveFrom)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-[var(--muted)]">
            Belum ada kadar yang terdaftar. Tambahkan kadar pertama di bawah ini.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-[var(--accent)]" />
          <h2 className="font-semibold text-neutral-950">Tambah Kadar Baru</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          Gunakan ini jika kadar baru belum pernah muncul di inventaris, misalnya 30, 40, 70, 73, atau 75.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">Kadar Persen</span>
            <div className="relative">
              <input name="newPurityPercent" inputMode="decimal" className={`${inputClassName} pr-10`} placeholder="Contoh: 73" />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-neutral-500">%</span>
            </div>
            {state.fieldErrors?.newPurityPercent ? <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.newPurityPercent}</p> : null}
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">Harga / Gram</span>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-neutral-500">Rp</span>
              <input name="newRatePerGram" inputMode="numeric" className={`${inputClassName} pl-10`} placeholder="Contoh: 1010000" />
            </div>
            {state.fieldErrors?.newRatePerGram ? <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.newRatePerGram}</p> : null}
          </label>
        </div>
      </section>

      <div className="flex justify-end">
        <FormSubmitButton pendingText="Menyimpan Harga/Gram...">
          <Save className="size-4" />
          Simpan Harga / Gram
        </FormSubmitButton>
      </div>
    </form>
  );
}
