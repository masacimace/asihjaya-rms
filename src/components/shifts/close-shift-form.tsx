"use client";

import { StopCircle } from "lucide-react";
import { useState } from "react";

import { closeShiftFromDashboardAction } from "@/app/actions/shifts";

function normalizeCashInput(value: string) {
  const numericValue = value.replace(/[^0-9]/g, "");

  if (!numericValue) {
    return "";
  }

  return numericValue.replace(/^0+(?=\d)/, "");
}

function formatIdrInput(value: string) {
  const numericValue = normalizeCashInput(value);

  if (!numericValue) {
    return "";
  }

  const parsedValue = Number(numericValue);

  if (!Number.isSafeInteger(parsedValue)) {
    return numericValue;
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(parsedValue);
}

type CloseShiftFormProps = {
  shiftId: string;
  expectedCashLabel: string;
};

export function CloseShiftForm({
  shiftId,
  expectedCashLabel,
}: CloseShiftFormProps) {
  const [actualCash, setActualCash] = useState("");

  return (
    <form
      action={closeShiftFromDashboardAction}
      className="mt-5 rounded-2xl border border-red-100 bg-red-50/50 p-4"
    >
      <input type="hidden" name="shiftId" value={shiftId} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-start">
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-neutral-800">
            Kas fisik aktual
          </span>
          <input
            name="actualCash"
            value={actualCash}
            onChange={(event) => setActualCash(formatIdrInput(event.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Contoh: 1.000.000"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Expected: {expectedCashLabel}
          </p>
        </label>

        <label className="block text-sm">
          <span className="mb-2 block font-medium text-neutral-800">
            Catatan selisih
          </span>
          <input
            name="varianceReason"
            maxLength={500}
            placeholder="Wajib jika kas fisik berbeda dari expected cash"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          />
        </label>

        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 lg:mt-7"
        >
          <StopCircle className="size-4" />
          Tutup Shift
        </button>
      </div>
    </form>
  );
}
