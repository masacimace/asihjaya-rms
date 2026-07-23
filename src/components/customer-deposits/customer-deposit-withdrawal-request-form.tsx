"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

type CustomerDepositWithdrawalRequestFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  customerId: string;
  outletId: string;
  maxAmount: number;
  title?: string;
};

function formatRupiahDigits(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

  if (!digits) {
    return {
      digits: "",
      formatted: "",
    };
  }

  return {
    digits,
    formatted: digits.replace(/\B(?=(\d{3})+(?!\d))/g, "."),
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
    >
      {pending ? "Mengajukan..." : "Ajukan"}
    </button>
  );
}

export function CustomerDepositWithdrawalRequestForm({
  action,
  customerId,
  maxAmount,
  outletId,
  title = "Ajukan tarik tunai",
}: CustomerDepositWithdrawalRequestFormProps) {
  const [amountInput, setAmountInput] = useState("");
  const amount = Number(amountInput || 0);
  const isAmountTooHigh = amount > maxAmount;
  const isAmountEmpty = amount <= 0;
  const isSubmitDisabled = isAmountEmpty || isAmountTooHigh;

  const helperText = useMemo(() => {
    if (isAmountTooHigh) {
      return `Nominal melebihi saldo outlet ini. Maksimal ${formatMoney(maxAmount)}.`;
    }

    if (amount > 0) {
      return `Nominal yang diajukan: ${formatMoney(amount)}.`;
    }

    return "Ketik nominal tanpa titik/koma, sistem akan memformat otomatis.";
  }, [amount, isAmountTooHigh, maxAmount]);

  return (
    <form
      action={action}
      className="mt-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 p-3"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="outletId" value={outletId} />
      <input type="hidden" name="amount" value={amountInput} />

      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="grid gap-1 text-xs font-semibold text-neutral-600">
          Nominal
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required
            value={amountInput ? formatRupiahDigits(amountInput).formatted : ""}
            onChange={(event) => {
              setAmountInput(formatRupiahDigits(event.target.value).digits);
            }}
            placeholder="Contoh: 50.000"
            aria-invalid={isAmountTooHigh}
            className="h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] aria-invalid:border-red-300 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-100"
          />
        </label>
        <SubmitButton disabled={isSubmitDisabled} />
      </div>
      <p
        className={`mt-1 text-xs leading-5 ${
          isAmountTooHigh ? "text-red-600" : "text-[var(--muted)]"
        }`}
      >
        {helperText}
      </p>
      <label className="mt-2 grid gap-1 text-xs font-semibold text-neutral-600">
        Alasan
        <textarea
          name="reason"
          minLength={5}
          maxLength={500}
          required
          placeholder="Contoh: Customer meminta pencairan saldo titipan."
          className="min-h-20 resize-y rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-neutral-950 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
        />
      </label>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
        Approval ini belum mengubah saldo. Saldo baru berkurang setelah approval
        disetujui dan dieksekusi.
      </p>
    </form>
  );
}
