"use client";

import { AlertTriangle, StopCircle } from "lucide-react";
import { useState } from "react";

import { closeShiftFromDashboardAction } from "@/app/actions/shifts";
import { cn } from "@/lib/utils";

const CASH_VARIANCE_QUICK_REASONS = [
  "Payout Buyback menggunakan kas di luar drawer.",
  "Menggunakan kas cadangan toko.",
  "Ada kas masuk atau keluar yang belum tercatat.",
  "Selisih hitung kas fisik.",
] as const;

const OTHER_REASON = "__other__";

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
  expectedCashAmount: number;
  expectedCashLabel: string;
};

export function CloseShiftForm({
  shiftId,
  expectedCashAmount,
  expectedCashLabel,
}: CloseShiftFormProps) {
  const [actualCash, setActualCash] = useState("");
  const [reasonPreset, setReasonPreset] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const actualCashAmount = actualCash ? Number(normalizeCashInput(actualCash)) : null;
  const variance = actualCashAmount === null ? null : actualCashAmount - expectedCashAmount;
  const hasVariance = variance !== null && variance !== 0;
  const isNegativeExpected = expectedCashAmount < 0;
  const varianceReason =
    reasonPreset === OTHER_REASON ? otherReason.trim() : reasonPreset;
  const canSubmit =
    actualCashAmount !== null && (!hasVariance || varianceReason.length >= 5);

  function handleActualCashChange(value: string) {
    setActualCash(formatIdrInput(value));
    setReasonPreset("");
    setOtherReason("");
  }

  return (
    <form
      action={closeShiftFromDashboardAction}
      className="mt-5 rounded-2xl border border-red-100 bg-red-50/50 p-4"
    >
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="varianceReason" value={varianceReason} />

      {isNegativeExpected ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Posisi kas sistem berada di bawah Rp0.</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Kas fisik tetap diinput sesuai uang yang benar-benar ada di drawer dan tidak dapat bernilai negatif.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] lg:items-start">
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-neutral-800">
            Kas fisik di drawer
          </span>
          <input
            name="actualCash"
            value={actualCash}
            onChange={(event) => handleActualCashChange(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Contoh: 1.000.000"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Posisi kas sistem: {expectedCashLabel}
          </p>
        </label>

        <div className="text-sm">
          <span className="mb-2 block font-medium text-neutral-800">
            {isNegativeExpected ? "Penjelasan posisi kas" : "Catatan selisih"}
            {hasVariance ? <span className="text-red-600"> *</span> : null}
          </span>
          {hasVariance ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {CASH_VARIANCE_QUICK_REASONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setReasonPreset(option)}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left text-xs transition",
                      reasonPreset === option
                        ? "border-amber-500 bg-amber-50 font-semibold text-amber-950"
                        : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50",
                    )}
                  >
                    {option}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setReasonPreset(OTHER_REASON)}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-left text-xs transition",
                    reasonPreset === OTHER_REASON
                      ? "border-amber-500 bg-amber-50 font-semibold text-amber-950"
                      : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  Lainnya
                </button>
              </div>
              {reasonPreset === OTHER_REASON ? (
                <input
                  value={otherReason}
                  onChange={(event) => setOtherReason(event.target.value)}
                  maxLength={500}
                  placeholder="Jelaskan selisih kas..."
                  className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-xs text-[var(--muted)]">
              Tidak perlu catatan jika kas fisik sama dengan posisi kas sistem.
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 lg:mt-7"
        >
          <StopCircle className="size-4" />
          Tutup Shift
        </button>
      </div>
    </form>
  );
}
