"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileImage,
  SearchX,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import { savePaymentReconciliationAction } from "@/app/actions/payment-reconciliation";
import type { ReconciliationStatus } from "@/features/reconciliation/contracts";
import { cn } from "@/lib/utils";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";
const labelClassName = "mb-1.5 block text-xs font-semibold text-neutral-700";

function digitsOnly(value: string) {
  return value
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 15);
}

function formatDigits(value: string) {
  const digits = digitsOnly(value);
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function CurrencyField({
  name,
  label,
  value,
  onChange,
  required,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label>
      <span className={labelClassName}>{label}</span>
      <input type="hidden" name={name} value={digitsOnly(value)} />
      <input
        value={value}
        onChange={(event) => onChange(formatDigits(event.target.value))}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        placeholder="0"
        className={inputClassName}
      />
    </label>
  );
}

function getStatusMeta(status: ReconciliationStatus) {
  if (status === "reconciled") {
    return {
      label: "Direkonsiliasi",
      description:
        "Gross settlement cocok dengan payment POS. Biaya dan pajak dicatat terpisah.",
      icon: CheckCircle2,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (status === "pending_settlement") {
    return {
      label: "Menunggu settlement",
      description:
        "Reference sudah diperiksa, tetapi dana belum masuk atau belum dicairkan.",
      icon: Clock3,
      tone: "border-blue-200 bg-blue-50 text-blue-800",
    };
  }

  if (status === "mismatch") {
    return {
      label: "Nominal tidak cocok",
      description:
        "Ada selisih gross settlement terhadap nilai payment yang tercatat di POS.",
      icon: AlertTriangle,
      tone: "border-red-200 bg-red-50 text-red-800",
    };
  }

  if (status === "not_found") {
    return {
      label: "Tidak ditemukan",
      description:
        "Payment belum ditemukan pada mutasi, batch EDC, atau laporan merchant.",
      icon: SearchX,
      tone: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  return {
    label: "Dikecualikan",
    description:
      "Mismatch ditutup sebagai pengecualian dengan alasan dan audit resolver.",
    icon: ShieldCheck,
    tone: "border-violet-200 bg-violet-50 text-violet-800",
  };
}

function toDateInput(value: Date | null) {
  if (!value) return "";
  const shifted = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function PaymentReconciliationForm({
  paymentId,
  expectedAmount,
  initialStatus,
  initialGrossAmount,
  initialFeeAmount,
  initialTaxAmount,
  initialSettlementDate,
  initialSettlementReference,
  initialNotes,
  existingEvidenceUrl,
  canResolve,
}: {
  paymentId: string;
  expectedAmount: number;
  initialStatus: ReconciliationStatus;
  initialGrossAmount: number | null;
  initialFeeAmount: number;
  initialTaxAmount: number;
  initialSettlementDate: Date | null;
  initialSettlementReference: string | null;
  initialNotes: string | null;
  existingEvidenceUrl: string | null;
  canResolve: boolean;
}) {
  const [status, setStatus] = useState<ReconciliationStatus>(initialStatus);
  const [gross, setGross] = useState(
    initialGrossAmount == null
      ? formatDigits(String(expectedAmount))
      : formatDigits(String(initialGrossAmount)),
  );
  const [fee, setFee] = useState(formatDigits(String(initialFeeAmount)));
  const [tax, setTax] = useState(formatDigits(String(initialTaxAmount)));

  const grossNumber = Number(digitsOnly(gross) || 0);
  const feeNumber = Number(digitsOnly(fee) || 0);
  const taxNumber = Number(digitsOnly(tax) || 0);
  const netAmount = Math.max(0, grossNumber - feeNumber - taxNumber);
  const differenceAmount = grossNumber - expectedAmount;
  const needsAmounts = status === "reconciled" || status === "mismatch";
  const needsNotes =
    status === "mismatch" || status === "not_found" || status === "waived";
  const meta = getStatusMeta(status);
  const MetaIcon = meta.icon;

  const options = useMemo<
    Array<{
      value: ReconciliationStatus;
      label: string;
    }>
  >(() => {
    const exceptionIsLocked =
      !canResolve &&
      (initialStatus === "mismatch" ||
        initialStatus === "not_found" ||
        initialStatus === "waived");

    if (exceptionIsLocked) {
      return [
        {
          value: initialStatus,
          label: getStatusMeta(initialStatus).label,
        },
      ];
    }

    return [
      { value: "pending_settlement", label: "Menunggu settlement" },
      { value: "reconciled", label: "Direkonsiliasi" },
      { value: "mismatch", label: "Nominal tidak cocok" },
      { value: "not_found", label: "Tidak ditemukan" },
      ...(canResolve
        ? ([
            {
              value: "waived" as const,
              label: "Tutup sebagai pengecualian",
            },
          ] as const)
        : []),
    ];
  }, [canResolve, initialStatus]);

  return (
    <form action={savePaymentReconciliationAction} className="space-y-5">
      <input type="hidden" name="paymentId" value={paymentId} />

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-950">
              Hasil pemeriksaan finance
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Pilih status berdasarkan mutasi bank, laporan merchant, atau batch
              terminal EDC milik toko.
            </p>
          </div>
        </div>

        <label className="mt-5 block">
          <span className={labelClassName}>Status rekonsiliasi</span>
          <select
            name="status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ReconciliationStatus)
            }
            className={inputClassName}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className={cn("mt-4 rounded-2xl border p-4", meta.tone)}>
          <div className="flex items-start gap-3">
            <MetaIcon className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{meta.label}</p>
              <p className="mt-1 text-xs leading-5 opacity-90">
                {meta.description}
              </p>
            </div>
          </div>
        </div>
      </section>

      {needsAmounts ? (
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-neutral-950">
              Detail settlement
            </h2>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <CurrencyField
              name="settlementGrossAmount"
              label="Gross settlement"
              value={gross}
              onChange={setGross}
              required
            />
            <CurrencyField
              name="feeAmount"
              label="Biaya / MDR"
              value={fee}
              onChange={setFee}
            />
            <CurrencyField
              name="taxAmount"
              label="Pajak biaya"
              value={tax}
              onChange={setTax}
            />
            <label>
              <span className={labelClassName}>Tanggal settlement</span>
              <input
                type="date"
                name="settlementDate"
                required
                defaultValue={toDateInput(initialSettlementDate)}
                className={inputClassName}
              />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClassName}>Reference settlement</span>
              <input
                name="settlementReference"
                required
                maxLength={160}
                defaultValue={initialSettlementReference ?? ""}
                placeholder="Reference batch, mutasi, atau settlement provider"
                className={inputClassName}
              />
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-neutral-50 p-4">
              <p className="text-xs font-medium text-neutral-500">
                Payment POS
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950">
                {formatMoney(expectedAmount)}
              </p>
            </div>
            <div className="rounded-2xl bg-neutral-50 p-4">
              <p className="text-xs font-medium text-neutral-500">
                Net diterima
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-950">
                {formatMoney(netAmount)}
              </p>
            </div>
            <div
              className={cn(
                "rounded-2xl p-4",
                differenceAmount === 0 ? "bg-emerald-50" : "bg-red-50",
              )}
            >
              <p className="text-xs font-medium text-neutral-500">Selisih</p>
              <p
                className={cn(
                  "mt-1 text-sm font-semibold",
                  differenceAmount === 0 ? "text-emerald-700" : "text-red-700",
                )}
              >
                {formatMoney(differenceAmount)}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <input type="hidden" name="settlementGrossAmount" value="" />
      )}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <h2 className="text-base font-semibold text-neutral-950">
          Catatan dan bukti
        </h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          Bukti bersifat privat. Gunakan screenshot mutasi, laporan merchant,
          atau slip settlement—bukan data kartu customer.
        </p>

        <div className="mt-5 space-y-4">
          <label>
            <span className={labelClassName}>
              Catatan {needsNotes ? "(wajib)" : "(opsional)"}
            </span>
            <textarea
              name="notes"
              required={needsNotes}
              minLength={needsNotes ? 8 : undefined}
              maxLength={1200}
              defaultValue={initialNotes ?? ""}
              rows={4}
              placeholder="Tuliskan penyebab mismatch, pencarian yang sudah dilakukan, atau alasan pengecualian."
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
          </label>

          <label>
            <span className={labelClassName}>Bukti settlement (opsional)</span>
            <input
              type="file"
              name="evidence"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
            />
          </label>

          {existingEvidenceUrl ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <a
                href={existingEvidenceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
              >
                <FileImage className="size-4" />
                Buka bukti settlement tersimpan
              </a>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600">
                <input
                  type="checkbox"
                  name="removeEvidence"
                  className="size-4 accent-red-600"
                />
                Hapus bukti lama
              </label>
            </div>
          ) : null}
        </div>
      </section>

      <div className="sticky bottom-2 z-10 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          Simpan hasil rekonsiliasi
        </button>
      </div>
    </form>
  );
}
