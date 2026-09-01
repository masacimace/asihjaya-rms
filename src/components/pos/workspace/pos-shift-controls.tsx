"use client";

import {
  AlertTriangle,
  Clock3,
  LoaderCircle,
  RotateCcw,
  StopCircle,
  WalletCards,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  closePosShiftAction,
  openPosShiftAction,
  reopenPosShiftAction,
} from "@/app/actions/pos";
import {
  initialPosShiftActionState,
  type PosOperationalContext,
  type PosShiftActionState,
} from "@/features/pos/contracts";
import {
  formatCurrency,
  formatRupiahInput,
} from "@/features/pos/payment-draft";
import {
  formatPosShiftOpenedAt,
  getPosShiftCashReconciliation,
  type PosShiftVarianceTone,
} from "@/features/pos/shift-view-state";
import { cn } from "@/lib/utils";

const CASH_VARIANCE_QUICK_REASONS = ["Menggunakan kas cadangan toko."] as const;

const CONTINUE_SHIFT_QUICK_REASONS = [
  "Toko masih beroperasi.",
  "Shift tertutup terlalu cepat.",
  "Perlu melanjutkan transaksi.",
] as const;

const OTHER_REASON = "__other__";

function ActionMessage({ state }: { state: PosShiftActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      )}
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

function CurrencyFormInput({
  name,
  placeholder,
  className,
  onValueChange,
}: {
  name: string;
  placeholder: string;
  className?: string;
  onValueChange?: (numericValue: number | null) => void;
}) {
  const [displayValue, setDisplayValue] = useState("");

  function handleChange(value: string) {
    const nextDisplayValue = formatRupiahInput(value);
    const numericValue = nextDisplayValue.replace(/[^0-9]/g, "");

    setDisplayValue(nextDisplayValue);
    onValueChange?.(numericValue ? Number(numericValue) : null);
  }

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={displayValue.replace(/[^0-9]/g, "")}
      />
      <input
        value={displayValue}
        onChange={(event) => handleChange(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        className={className}
      />
    </>
  );
}

function OpenShiftSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Membuka shift...
        </>
      ) : (
        <>
          <Clock3 className="size-4" />
          Buka Shift
        </>
      )}
    </button>
  );
}

function ReopenShiftSubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Melanjutkan shift...
        </>
      ) : (
        <>
          <RotateCcw className="size-4" />
          Lanjutkan Shift Hari Ini
        </>
      )}
    </button>
  );
}

function CloseShiftSubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Menutup shift...
        </>
      ) : (
        <>
          <StopCircle className="size-4" />
          Closing Shift
        </>
      )}
    </button>
  );
}

export function PosContextNotice({
  context,
  canManageShifts,
  canContinueShift,
  onCloseShiftClick,
  isCloseShiftPanelOpen = false,
}: {
  context: PosOperationalContext;
  canManageShifts: boolean;
  canContinueShift: boolean;
  onCloseShiftClick?: () => void;
  isCloseShiftPanelOpen?: boolean;
}) {
  if (!context.outlet) {
    return (
      <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Outlet aktif tidak ditemukan. Hubungi manager/admin untuk mengatur akses
        outlet staff ini.
      </div>
    );
  }

  if (!context.register) {
    return (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Register aktif untuk {context.outlet.name} belum tersedia. POS bisa
        menampilkan katalog, tapi transaksi belum bisa diproses.
      </div>
    );
  }

  if (!context.activeShift) {
    if (context.reopenCandidate) {
      return (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Shift tanggal operasional {context.reopenCandidate.businessDate} sudah
          ditutup pada{" "}
          {formatPosShiftOpenedAt(context.reopenCandidate.closedAt)}. Checkout
          diblokir sampai shift hari ini dilanjutkan kembali.
          {canContinueShift
            ? " Gunakan menu Lanjutkan Shift Hari Ini di bawah."
            : " Hubungi staff yang memiliki akses pengelolaan shift."}
        </div>
      );
    }

    return (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Shift untuk register {context.register.name} belum aktif. Sales masih
        bisa melihat katalog, tetapi checkout akan diblokir sampai shift dibuka.
        {canManageShifts
          ? " Buka shift terlebih dahulu sebelum menerima pembayaran."
          : " Hubungi manager untuk membuka shift."}
      </div>
    );
  }

  const expectedCash =
    context.activeShift.expectedCash ?? context.activeShift.openingCash;

  return (
    <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600">
            <Clock3 className="size-4" />
          </div>

          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-950">
              Shift aktif · {context.register.name}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-emerald-800">
              <span>
                Jam buka: {formatPosShiftOpenedAt(context.activeShift.openedAt)}
              </span>
              <span>
                Saldo Cash: {formatCurrency(context.activeShift.openingCash)}
              </span>
              <span>Total Expected: {formatCurrency(expectedCash)}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            Katalog real-time
          </span>

          {canManageShifts ? (
            <button
              type="button"
              onClick={onCloseShiftClick}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition",
                isCloseShiftPanelOpen
                  ? "bg-black text-white hover:bg-black/80"
                  : "bg-red-600 text-white hover:bg-red-700",
              )}
            >
              <StopCircle className="size-3.5" />
              {isCloseShiftPanelOpen ? "Sembunyikan" : "Menu Shift"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PosOpenShiftCard({
  context,
}: {
  context: PosOperationalContext;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    openPosShiftAction,
    initialPosShiftActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  if (
    !context.outlet ||
    !context.register ||
    context.activeShift ||
    context.reopenCandidate
  ) {
    return null;
  }

  return (
    <section className="mb-4 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <WalletCards className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-neutral-950">Buka Shift POS</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Shift akan dibuka untuk {context.register.name} di{" "}
            {context.outlet.name}. Semua transaksi sales HP dan Mini PC akan
            masuk ke shift aktif ini.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="registerId" value={context.register.id} />

        <ActionMessage state={state} />

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Modal (Opening)
            </span>
            <CurrencyFormInput
              name="openingCash"
              placeholder="Contoh: 500.000"
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <FieldError message={state.fieldErrors?.openingCash} />
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Kosongkan jika tidak ada modal awal.
            </p>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Catatan (Opsional)
            </span>
            <input
              name="note"
              maxLength={240}
              placeholder="Contoh: Shift pagi outlet utama"
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <FieldError message={state.fieldErrors?.note} />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Setelah shift aktif, cart bisa dilanjutkan ke payment pada phase
            berikutnya.
          </p>
          <OpenShiftSubmitButton />
        </div>
      </form>
    </section>
  );
}

export function PosReopenShiftCard({
  context,
}: {
  context: PosOperationalContext;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    reopenPosShiftAction,
    initialPosShiftActionState,
  );
  const [reasonPreset, setReasonPreset] = useState<string>(
    CONTINUE_SHIFT_QUICK_REASONS[0],
  );
  const [otherReason, setOtherReason] = useState("");

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);

  const candidate = context.reopenCandidate;
  if (
    !context.outlet ||
    !context.register ||
    context.activeShift ||
    !candidate
  ) {
    return null;
  }

  const reason =
    reasonPreset === OTHER_REASON ? otherReason.trim() : reasonPreset;

  return (
    <section className="mb-4 rounded-2xl border border-amber-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
          <RotateCcw className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-neutral-950">
            Lanjutkan Shift Hari Ini
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Shift tanggal operasional {candidate.businessDate} sudah ditutup
            pada {formatPosShiftOpenedAt(candidate.closedAt)}. Jika toko masih
            beroperasi, lanjutkan shift yang sama tanpa membuat shift baru.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="shiftId" value={candidate.id} />
        <input type="hidden" name="reason" value={reason} />
        <ActionMessage state={state} />

        <div className="grid gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-xs text-amber-950 sm:grid-cols-3">
          <div>
            <span className="block text-[var(--muted)]">
              Posisi kas saat closing
            </span>
            <strong>{formatCurrency(candidate.expectedCash)}</strong>
          </div>
          <div>
            <span className="block text-[var(--muted)]">
              Kas fisik saat closing
            </span>
            <strong>{formatCurrency(candidate.actualCash)}</strong>
          </div>
          <div>
            <span className="block text-[var(--muted)]">Selisih Saldo</span>
            <strong>{formatCurrency(candidate.cashVariance)}</strong>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-neutral-800">
            Alasan melanjutkan shift
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Pilih alasan yang paling sesuai. Audit closing sebelumnya tetap
            tersimpan.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {CONTINUE_SHIFT_QUICK_REASONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setReasonPreset(option)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left text-sm transition",
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
                "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                reasonPreset === OTHER_REASON
                  ? "border-amber-500 bg-amber-50 font-semibold text-amber-950"
                  : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50",
              )}
            >
              Lainnya
            </button>
          </div>

          {reasonPreset === OTHER_REASON ? (
            <textarea
              value={otherReason}
              onChange={(event) => setOtherReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Jelaskan alasan melanjutkan shift..."
              className="mt-3 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
            />
          ) : null}
          <FieldError message={state.fieldErrors?.reason} />
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-5 text-[var(--muted)]">
            Shift ID dan tanggal operasional tetap sama. Snapshot closing
            sebelumnya tetap diaudit sebagai superseded dan laporan final baru
            dibuat saat closing berikutnya.
          </p>
          <ReopenShiftSubmitButton disabled={reason.length < 5} />
        </div>
      </form>
    </section>
  );
}

function getVarianceClassName(tone: PosShiftVarianceTone) {
  switch (tone) {
    case "balanced":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "surplus":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "shortage":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-[var(--border)] bg-neutral-50 text-neutral-700";
  }
}

export function PosCloseShiftCard({
  context,
  onCancel,
}: {
  context: PosOperationalContext;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    closePosShiftAction,
    initialPosShiftActionState,
  );
  const [actualCashAmount, setActualCashAmount] = useState<number | null>(null);
  const [reasonPreset, setReasonPreset] = useState<string>("");
  const [otherReason, setOtherReason] = useState("");

  useEffect(() => {
    if (state.status === "success") {
      onCancel?.();
      router.refresh();
    }
  }, [onCancel, router, state.status]);

  if (!context.outlet || !context.register || !context.activeShift) {
    return null;
  }

  const expectedCash =
    context.activeShift.expectedCash ?? context.activeShift.openingCash;
  const reconciliation = getPosShiftCashReconciliation({
    expectedCash,
    actualCashAmount,
  });
  const isNegativeExpected = reconciliation.expectedCashAmount < 0;
  const hasVariance =
    reconciliation.cashVarianceAmount !== null &&
    reconciliation.cashVarianceAmount !== 0;
  const varianceReason =
    reasonPreset === OTHER_REASON ? otherReason.trim() : reasonPreset;
  const canClose =
    actualCashAmount !== null && (!hasVariance || varianceReason.length >= 5);

  function handleActualCashChange(value: number | null) {
    setActualCashAmount(value);
    setReasonPreset("");
    setOtherReason("");
  }

  return (
    <section className="mb-4 rounded-2xl border border-red-100 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
          <StopCircle className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-neutral-950">Closing Shift POS</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Rekonsiliasi kas untuk {context.register.name}. Input kas fisik
            sesuai uang yang benar-benar ada di drawer.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="shiftId" value={context.activeShift.id} />
        <input type="hidden" name="registerId" value={context.register.id} />
        <input type="hidden" name="varianceReason" value={varianceReason} />

        <ActionMessage state={state} />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nominal Expected
            </span>
            <CurrencyFormInput
              name="actualCash"
              placeholder="Contoh: 2.500.000"
              onValueChange={handleActualCashChange}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <FieldError message={state.fieldErrors?.actualCash} />
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Jangan memasukkan nominal kas sistem sebagai uang fisik.
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
                        "rounded-xl border px-3 py-2 text-left text-xs transition",
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
                      "rounded-xl border px-3 py-2 text-left text-xs transition",
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
                    className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  />
                ) : null}
                {!varianceReason ? (
                  <p className="mt-1.5 text-xs text-amber-700">
                    Pilih satu penjelasan sebelum closing.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-3 text-xs text-[var(--muted)]">
                Tidak perlu catatan jika kas fisik sama dengan posisi kas
                sistem.
              </p>
            )}
            <FieldError message={state.fieldErrors?.varianceReason} />
          </div>
        </div>

        <div
          className={cn(
            "grid gap-3 rounded-2xl border p-3 text-sm sm:grid-cols-3",
            getVarianceClassName(reconciliation.tone),
          )}
        >
          <div>
            <p className="text-[10px] !font-medium uppercase text-current/60">
              Nominal Expected
            </p>
            <p className="mt-1 !font-medium text-neutral-950">
              {formatCurrency(reconciliation.expectedCashAmount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-current/60">
              Saldo Cash (Opening / Closing)
            </p>
            <p className="mt-1 !font-medium text-neutral-950">
              {actualCashAmount === null
                ? "-----"
                : formatCurrency(actualCashAmount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] !font-medium uppercase text-current/60">
              Selisih Saldo (Closing)
            </p>
            <p className="mt-1 !font-medium text-neutral-950">
              {reconciliation.cashVarianceLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Posisi kas sistem dihitung dari modal awal, cash sale, kas
            masuk/keluar, refund, dan payout cash seperti Buyback.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:w-auto"
              >
                Batal
              </button>
            ) : null}
            <CloseShiftSubmitButton disabled={!canClose} />
          </div>
        </div>
      </form>
    </section>
  );
}
