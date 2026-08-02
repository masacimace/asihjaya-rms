"use client";

import { Check, LoaderCircle, Mail, Phone, Plus, UserRound, X } from "lucide-react";

import type {
  PosCustomerOption,
  PosQuickCustomerActionResult,
} from "@/features/pos/contracts";
import {
  getCustomerCode,
  getCustomerContactLabel,
  type QuickCustomerFormState,
} from "@/features/pos/customer-state";
import { getQuickCustomerDialogState } from "@/features/pos/dialog-state";
import { cn } from "@/lib/utils";

export type PosQuickCustomerDialogProps = {
  form: QuickCustomerFormState;
  result: PosQuickCustomerActionResult | null;
  isPending: boolean;
  onChange: (field: keyof QuickCustomerFormState, value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onUseDuplicate: (customer: PosCustomerOption) => void;
};

export function PosQuickCustomerDialog({
  form,
  result,
  isPending,
  onChange,
  onCancel,
  onSubmit,
  onUseDuplicate,
}: PosQuickCustomerDialogProps) {
  const { fieldErrors, duplicateCustomer } =
    getQuickCustomerDialogState(result);

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Tutup form tambah customer"
        onClick={onCancel}
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
      />

      <section className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-white sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-y-0 sm:border-r-0">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-neutral-950">
                  Tambah customer cepat
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Customer langsung dipilih tanpa meninggalkan transaksi.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Tutup form tambah customer"
            onClick={onCancel}
            disabled={isPending}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] text-neutral-500 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-800">
                Nama lengkap <span className="text-red-600">*</span>
              </span>
              <div
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl border bg-white px-3 focus-within:ring-4",
                  fieldErrors?.fullName
                    ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-50"
                    : "border-[var(--border)] focus-within:border-[var(--accent)] focus-within:ring-[var(--accent-soft)]",
                )}
              >
                <UserRound className="size-4 shrink-0 text-neutral-400" />
                <input
                  autoFocus
                  value={form.fullName}
                  onChange={(event) => onChange("fullName", event.target.value)}
                  maxLength={180}
                  autoComplete="name"
                  placeholder="Contoh: Rosalia Manda"
                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
                />
              </div>
              {fieldErrors?.fullName ? (
                <p className="mt-1.5 text-xs text-red-600">
                  {fieldErrors.fullName}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-800">
                Nomor telepon <span className="text-red-600">*</span>
              </span>
              <div
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl border bg-white px-3 focus-within:ring-4",
                  fieldErrors?.phone
                    ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-50"
                    : "border-[var(--border)] focus-within:border-[var(--accent)] focus-within:ring-[var(--accent-soft)]",
                )}
              >
                <Phone className="size-4 shrink-0 text-neutral-400" />
                <input
                  value={form.phone}
                  onChange={(event) => onChange("phone", event.target.value)}
                  maxLength={32}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Contoh: 081234567890"
                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
                />
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                Dipakai untuk mencegah customer tercatat dua kali.
              </p>
              {fieldErrors?.phone ? (
                <p className="mt-1.5 text-xs text-red-600">
                  {fieldErrors.phone}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-800">
                Email <span className="text-[var(--muted)]">(opsional)</span>
              </span>
              <div
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl border bg-white px-3 focus-within:ring-4",
                  fieldErrors?.email
                    ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-50"
                    : "border-[var(--border)] focus-within:border-[var(--accent)] focus-within:ring-[var(--accent-soft)]",
                )}
              >
                <Mail className="size-4 shrink-0 text-neutral-400" />
                <input
                  value={form.email}
                  onChange={(event) => onChange("email", event.target.value)}
                  maxLength={254}
                  inputMode="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
                />
              </div>
              {fieldErrors?.email ? (
                <p className="mt-1.5 text-xs text-red-600">
                  {fieldErrors.email}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-800">
                Catatan singkat{" "}
                <span className="text-[var(--muted)]">(opsional)</span>
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => onChange("notes", event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Contoh: Customer baru dari kunjungan outlet."
                className="w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
            </label>

            {result ? (
              <div
                role="status"
                className={cn(
                  "rounded-2xl border p-3 text-sm leading-6",
                  result.status === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : result.status === "duplicate"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                )}
              >
                <p className="font-medium">{result.message}</p>

                {duplicateCustomer ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                        <UserRound className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-neutral-950">
                          {duplicateCustomer.fullName}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">
                          {getCustomerCode(duplicateCustomer)} ·{" "}
                          {getCustomerContactLabel(duplicateCustomer)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUseDuplicate(duplicateCustomer)}
                      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90"
                    >
                      <Check className="size-4" />
                      Gunakan customer ini
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <footer className="grid gap-2 border-t border-[var(--border)] bg-white p-4 sm:p-5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="flex h-11 items-center justify-center bg-black rounded-xl px-4 !text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-50"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 !text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:cursor-wait disabled:opacity-70"
            >
              {isPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Tambahkan customer
                </>
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
