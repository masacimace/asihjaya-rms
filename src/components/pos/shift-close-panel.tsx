"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  StopCircle,
} from "lucide-react";

import { closePosShiftAction } from "@/app/actions/pos";
import { initialPosShiftActionState } from "@/features/pos/contracts";
import { cn } from "@/lib/utils";

type ShiftClosePanelProps = {
  shiftId: string;
  registerId: string;
  registerName: string;
  expectedCash: string | number | null;
};

function formatMoney(value: string | number | null) {
  const parsedValue = typeof value === "number" ? value : Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(parsedValue) ? parsedValue : 0);
}

function formatRupiahInput(value: string) {
  const numericValue = value.replace(/[^0-9]/g, "");

  if (!numericValue) {
    return "";
  }

  return new Intl.NumberFormat("id-ID").format(Number(numericValue));
}

function parseAmount(value: string | number | null) {
  const parsedValue = typeof value === "number" ? value : Number(value ?? 0);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatVarianceAmount(value: number) {
  if (value === 0) {
    return "Sesuai";
  }

  const prefix = value > 0 ? "+" : "-";

  return `${prefix}${formatMoney(Math.abs(value))}`;
}

function getVarianceLabel(value: number | null) {
  if (value === null) {
    return "Belum dihitung";
  }

  if (value === 0) {
    return "Kas sesuai";
  }

  return value > 0 ? "Kas lebih" : "Kas kurang";
}

function getVarianceHelper(value: number | null) {
  if (value === null) {
    return "Isi total uang fisik closing untuk melihat selisih kas.";
  }

  if (value === 0) {
    return "Jumlah uang fisik sesuai dengan expected cash sistem.";
  }

  if (value > 0) {
    return "Ada uang fisik lebih dari expected cash. Catatan selisih wajib diisi.";
  }

  return "Ada uang fisik kurang dari expected cash. Catatan selisih wajib diisi.";
}

function CloseShiftSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <StopCircle className="size-4" />
      )}
      {pending ? "Menutup shift..." : "Konfirmasi tutup shift"}
    </button>
  );
}

export function ShiftClosePanel({
  shiftId,
  registerId,
  registerName,
  expectedCash,
}: ShiftClosePanelProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    closePosShiftAction,
    initialPosShiftActionState,
  );
  const [actualCashInput, setActualCashInput] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const actualCashAmount = actualCashInput
    ? Number(actualCashInput.replace(/[^0-9]/g, ""))
    : null;
  const expectedCashAmount = parseAmount(expectedCash);
  const cashVarianceAmount =
    actualCashAmount === null ? null : actualCashAmount - expectedCashAmount;
  const hasCashVariance =
    cashVarianceAmount !== null && cashVarianceAmount !== 0;
  const isReadyToReview =
    actualCashAmount !== null &&
    (!hasCashVariance || varianceReason.trim().length > 0);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  function handleActualCashChange(value: string) {
    setActualCashInput(formatRupiahInput(value));
    setIsReviewing(false);
  }

  function handleVarianceReasonChange(value: string) {
    setVarianceReason(value);
    setIsReviewing(false);
  }

  function handleReviewClick() {
    if (!isReadyToReview) {
      return;
    }

    setIsReviewing(true);
  }

  return (
    <section className="rounded-2xl border border-red-100 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
          <StopCircle className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-950">Tutup Shift</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Rekonsiliasi kas untuk {registerName}. Expected cash sistem saat ini{" "}
            <span className="font-semibold text-neutral-800">
              {formatMoney(expectedCash)}
            </span>
            .
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="shiftId" value={shiftId} />
        <input type="hidden" name="registerId" value={registerId} />
        <input
          type="hidden"
          name="actualCash"
          value={actualCashInput.replace(/[^0-9]/g, "")}
        />

        {state.message ? (
          <p
            className={cn(
              "rounded-2xl px-3 py-2 text-xs leading-5",
              state.status === "success"
                ? "bg-emerald-50 text-emerald-700"
                : state.status === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-neutral-50 text-[var(--muted)]",
            )}
          >
            {state.message}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Expected Cash
            </span>
            <input
              inputMode="numeric"
              value={actualCashInput}
              onChange={(event) => handleActualCashChange(event.target.value)}
              placeholder="Contoh: 2.500.000"
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            {state.fieldErrors?.actualCash ? (
              <p className="mt-1.5 text-xs text-red-600">
                {state.fieldErrors.actualCash}
              </p>
            ) : null}
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Input total uang cash yang benar-benar ada di laci kas.
            </p>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Alasan / Catatan Selisih
            </span>
            <textarea
              name="varianceReason"
              value={varianceReason}
              onChange={(event) =>
                handleVarianceReasonChange(event.target.value)
              }
              maxLength={500}
              rows={4}
              placeholder="Wajib diisi jika kas kurang / lebih"
              className="min-h-24 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            {state.fieldErrors?.varianceReason ? (
              <p className="mt-1.5 text-xs text-red-600">
                {state.fieldErrors.varianceReason}
              </p>
            ) : null}
            {hasCashVariance && !varianceReason.trim() ? (
              <p className="mt-1.5 text-xs text-amber-700">
                Catatan wajib diisi karena ada selisih kas.
              </p>
            ) : null}
          </label>
        </div>

        <div
          className={cn(
            "grid gap-3 rounded-2xl border p-3 text-sm sm:grid-cols-3",
            cashVarianceAmount === null
              ? "border-[var(--border)] bg-neutral-50 text-neutral-700"
              : cashVarianceAmount === 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : cashVarianceAmount > 0
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          <div>
            <p className="text-[10px] font-semibold uppercase text-current/60">
              Expected Cash
            </p>
            <p className="mt-1 font-semibold text-neutral-950">
              {formatMoney(expectedCashAmount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-current/60">
              Total (Closing)
            </p>
            <p className="mt-1 font-semibold text-neutral-950">
              {actualCashAmount === null
                ? "Belum diisi"
                : formatMoney(actualCashAmount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-current/60">
              Selisih Uang
            </p>
            <p className="mt-1 font-semibold text-neutral-950">
              {cashVarianceAmount === null
                ? "Belum dihitung"
                : formatVarianceAmount(cashVarianceAmount)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl",
                cashVarianceAmount === null
                  ? "bg-white text-neutral-500"
                  : cashVarianceAmount === 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700",
              )}
            >
              {cashVarianceAmount === null ? (
                <ClipboardCheck className="size-4" />
              ) : cashVarianceAmount === 0 ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-950">
                {getVarianceLabel(cashVarianceAmount)}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                {getVarianceHelper(cashVarianceAmount)}
              </p>
            </div>
          </div>
        </div>

        {isReviewing ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  Review terakhir sebelum shift ditutup
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Pastikan uang fisik sudah dihitung ulang. Setelah
                  dikonfirmasi, checkout POS akan diblokir sampai shift baru
                  dibuka.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Setelah shift ditutup, checkout POS akan diblokir sampai shift baru
            dibuka.
          </p>

          {isReviewing ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <CloseShiftSubmitButton />
              <button
                type="button"
                onClick={() => setIsReviewing(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Ubah data
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!isReadyToReview}
              onClick={handleReviewClick}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardCheck className="size-4" />
              Review penutupan shift
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
