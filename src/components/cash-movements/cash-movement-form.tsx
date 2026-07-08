"use client";

import { Banknote, PlusCircle } from "lucide-react";
import { useActionState } from "react";

import { createAdminCashMovementAction } from "@/app/actions/cash-movements";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import {
  initialAdminCashMovementActionState,
  type AdminCashMovementActionState,
  type AdminCashMovementActiveShift,
} from "@/features/cash-movements/contracts";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

const textareaClassName =
  "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm leading-6 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

function formatMoney(value: string | number | null) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function ActionMessage({ state }: { state: AdminCashMovementActionState }) {
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

export function CashMovementForm({
  activeShifts,
}: {
  activeShifts: AdminCashMovementActiveShift[];
}) {
  const [state, formAction] = useActionState(
    createAdminCashMovementAction,
    initialAdminCashMovementActionState,
  );
  const hasActiveShift = activeShifts.length > 0;

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white shadow-sm shadow-neutral-950/[0.03]">
      <div className="border-b border-[var(--border)] bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800 p-5 text-white">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10">
            <Banknote className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Petty Cash
            </p>
            <h2 className="mt-1 text-lg font-semibold">Catat Kas Baru</h2>
            <p className="mt-1 text-sm leading-6 text-white/65">
              Masukkan kas masuk/keluar manual ke shift aktif outlet. Untuk
              setoran ke brankas, gunakan tipe kas keluar dengan catatan setoran.
            </p>
          </div>
        </div>
      </div>

      <form action={formAction} className="space-y-4 p-5">
        <ActionMessage state={state} />

        {!hasActiveShift ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            Belum ada shift aktif di outlet yang kamu akses. Buka shift POS dulu
            sebelum mencatat pergerakan kas manual.
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="mb-2 block font-medium text-neutral-800">
            Shift aktif
          </span>
          <select
            name="shiftId"
            disabled={!hasActiveShift}
            className={inputClassName}
            defaultValue={activeShifts[0]?.id ?? ""}
          >
            {activeShifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.outletName} · {shift.registerName} · Expected {formatMoney(shift.expectedCash)}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.shiftId} />
          {activeShifts[0] ? (
            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              Shift terbaru dibuka oleh {activeShifts[0].openedByName} pada {formatDateTime(activeShifts[0].openedAt)}.
            </p>
          ) : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Tipe movement
            </span>
            <select
              name="type"
              disabled={!hasActiveShift}
              className={inputClassName}
              defaultValue="cash_out"
            >
              <option value="cash_in">Kas masuk</option>
              <option value="cash_out">Kas keluar</option>
            </select>
            <FieldError message={state.fieldErrors?.type} />
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nominal
            </span>
            <input
              name="amount"
              inputMode="numeric"
              autoComplete="off"
              disabled={!hasActiveShift}
              className={inputClassName}
              placeholder="Contoh: 150000"
            />
            <FieldError message={state.fieldErrors?.amount} />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-2 block font-medium text-neutral-800">
            Catatan / alasan
          </span>
          <textarea
            name="reason"
            rows={4}
            maxLength={500}
            disabled={!hasActiveShift}
            className={textareaClassName}
            placeholder="Contoh: Bayar uang kebersihan pasar / setoran kas ke brankas"
          />
          <FieldError message={state.fieldErrors?.reason} />
        </label>

        <FormSubmitButton
          pendingText="Mencatat kas..."
          className="w-full disabled:cursor-not-allowed"
        >
          <PlusCircle className="size-4" />
          Catat Pergerakan Kas
        </FormSubmitButton>
      </form>
    </section>
  );
}
