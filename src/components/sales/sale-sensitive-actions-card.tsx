"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, ShieldAlert, Undo2 } from "lucide-react";

import { executeSaleCorrectionAction } from "@/features/sales/admin-actions";
import type { AdminSaleStatus } from "@/features/sales/admin-contracts";
import {
  classifySaleCorrection,
  correctionReasonOptions,
  type CustomerPresenceAnswer,
  type DeliveryAnswer,
  type PaymentAnswer,
  type SaleCorrectionEligibility,
  type SaleCorrectionType,
} from "@/features/sales/correction-eligibility";
import { cn } from "@/lib/utils";

type SaleSensitiveCapabilities = Record<
  SaleCorrectionType,
  { canExecute: boolean }
>;

function ChoiceGroup<T extends string>({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-neutral-950">{label}</legend>
      <div className="mt-3 grid gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition",
              value === option.value
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-neutral-950"
                : "border-[var(--border)] bg-white hover:bg-neutral-50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 accent-[var(--accent)]"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CorrectionForm({
  saleId,
  invoiceNumber,
  returnTo,
  eligibility,
  capabilities,
}: {
  saleId: string;
  invoiceNumber: string;
  returnTo: string;
  eligibility: SaleCorrectionEligibility;
  capabilities: SaleSensitiveCapabilities;
}) {
  const [deliveryAnswer, setDeliveryAnswer] = useState<DeliveryAnswer>(
    eligibility.voidEligibleBySystem ? "not_delivered" : "delivered",
  );
  const [paymentAnswer, setPaymentAnswer] = useState<PaymentAnswer>("received");
  const [customerPresence, setCustomerPresence] =
    useState<CustomerPresenceAnswer>("present");
  const type = classifySaleCorrection({ eligibility, deliveryAnswer });
  const reasons = correctionReasonOptions[type];
  const [reasonCode, setReasonCode] = useState<string>(reasons[0]?.value ?? "other");

  const normalizedReasonCode = useMemo(() => {
    return reasons.some((reason) => reason.value === reasonCode)
      ? reasonCode
      : reasons[0]?.value ?? "other";
  }, [reasonCode, reasons]);

  const canExecute = capabilities[type].canExecute;

  return (
    <form action={executeSaleCorrectionAction} className="mt-4 grid gap-5">
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="deliveryAnswer" value={deliveryAnswer} />
      <input type="hidden" name="paymentAnswer" value={paymentAnswer} />
      <input type="hidden" name="customerPresence" value={customerPresence} />
      <input type="hidden" name="reasonCode" value={normalizedReasonCode} />

      <ChoiceGroup
        label="Apakah barang sudah diserahkan ke customer?"
        name="deliveryAnswerUi"
        value={deliveryAnswer}
        onChange={setDeliveryAnswer}
        options={[
          { value: "not_delivered", label: "Belum diserahkan" },
          { value: "delivered", label: "Sudah diserahkan" },
          { value: "unsure", label: "Tidak yakin" },
        ]}
      />

      <ChoiceGroup
        label="Bagaimana status pembayaran?"
        name="paymentAnswerUi"
        value={paymentAnswer}
        onChange={setPaymentAnswer}
        options={[
          { value: "received", label: "Pembayaran sudah diterima" },
          { value: "not_received", label: "Pembayaran belum diterima" },
          { value: "unsure", label: "Tidak yakin" },
        ]}
      />

      <ChoiceGroup
        label="Apakah customer masih berada di toko?"
        name="customerPresenceUi"
        value={customerPresence}
        onChange={setCustomerPresence}
        options={[
          { value: "present", label: "Masih di toko" },
          { value: "left", label: "Sudah meninggalkan toko" },
          { value: "unsure", label: "Tidak yakin" },
        ]}
      />

      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
        <p className="font-semibold text-neutral-950">
          Sistem akan memproses: {type === "void" ? "Pembatalan transaksi" : "Refund penuh"}
        </p>
        <p className="mt-1 text-xs leading-5 text-neutral-600">
          {type === "void"
            ? "Transaksi dibatalkan langsung dan stok dikembalikan secara atomik."
            : "Pembayaran direfund langsung. Barang tetap mengikuti workflow penerimaan dan pemeriksaan retur."}
        </p>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-neutral-950">
        Alasan koreksi
        <select
          value={normalizedReasonCode}
          onChange={(event) => setReasonCode(event.target.value)}
          className="h-11 rounded-2xl border border-[var(--border)] bg-white px-4 text-sm font-medium outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
        >
          {reasons.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-neutral-950">
        Catatan tambahan {normalizedReasonCode === "other" ? "(wajib)" : "(opsional)"}
        <textarea
          name="reasonDetails"
          minLength={normalizedReasonCode === "other" ? 8 : undefined}
          required={normalizedReasonCode === "other"}
          maxLength={1000}
          className="min-h-24 resize-y rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          placeholder="Tambahkan konteks bila diperlukan."
        />
      </label>

      <button
        type="submit"
        disabled={!canExecute}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
      >
        <ShieldAlert className="size-4" />
        {type === "void" ? "Batalkan transaksi sekarang" : "Proses refund sekarang"}
      </button>

      {!canExecute ? (
        <p className="text-center text-xs leading-5 text-amber-700">
          Akun ini tidak memiliki permission untuk menjalankan {type === "void" ? "void" : "refund"}.
        </p>
      ) : null}

      <p className="text-center text-xs leading-5 text-[var(--muted)]">
        Tidak ada approval lanjutan. Tindakan akan langsung dieksekusi dan tetap tercatat di audit log.
      </p>
    </form>
  );
}

export function SaleSensitiveActionsCard({
  saleId,
  invoiceNumber,
  saleStatus,
  returnTo,
  capabilities,
  eligibility,
  returnWorkflowHref,
}: {
  saleId: string;
  invoiceNumber: string;
  saleStatus: AdminSaleStatus;
  returnTo: string;
  capabilities: SaleSensitiveCapabilities;
  eligibility: SaleCorrectionEligibility;
  returnWorkflowHref: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <ShieldAlert className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-950">Koreksi transaksi</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Void dan refund sekarang dijalankan langsung berdasarkan permission user, tanpa approval user lain.
          </p>
        </div>
      </div>

      {saleStatus === "refunded" || saleStatus === "partially_refunded" ? (
        <Link
          href={returnWorkflowHref}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
        >
          Buka workflow retur
        </Link>
      ) : null}

      {saleStatus === "completed" && eligibility.canRequestCorrection ? (
        <>
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-700">
            <div className="flex items-start gap-2">
              {eligibility.voidEligibleBySystem ? (
                <RotateCcw className="mt-0.5 size-4 shrink-0" />
              ) : (
                <Undo2 className="mt-0.5 size-4 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-neutral-950">{eligibility.title}</p>
                <p className="mt-1">{eligibility.explanation}</p>
              </div>
            </div>
          </div>

          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              <ShieldAlert className="size-4" /> Proses koreksi transaksi
            </button>
          ) : (
            <CorrectionForm
              saleId={saleId}
              invoiceNumber={invoiceNumber}
              returnTo={returnTo}
              eligibility={eligibility}
              capabilities={capabilities}
            />
          )}
        </>
      ) : saleStatus === "completed" ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Koreksi tidak tersedia</p>
              <p className="mt-1">{eligibility.blockers[0] ?? "Status transaksi ini tidak dapat dikoreksi."}</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
