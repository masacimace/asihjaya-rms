"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  Undo2,
  XCircle,
} from "lucide-react";

import {
  executeApprovedSaleRefundAction,
  executeApprovedSaleVoidAction,
  requestSaleVoidRefundApprovalAction,
} from "@/features/sales/admin-actions";
import type {
  AdminSaleSensitiveApproval,
  AdminSaleStatus,
} from "@/features/sales/admin-contracts";
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

type SensitiveActionCapability = {
  canRequest: boolean;
  canApprove: boolean;
  canExecute: boolean;
};

type SaleSensitiveCapabilities = Record<
  SaleCorrectionType,
  SensitiveActionCapability
>;

const approvalStatusLabels: Record<AdminSaleSensitiveApproval["status"], string> = {
  pending: "Menunggu persetujuan",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const executionStatusLabels: Record<
  NonNullable<AdminSaleSensitiveApproval["executionStatus"]>,
  string
> = {
  awaiting_r3c_2: "Menunggu diproses",
  void_executed: "Pembatalan transaksi selesai",
  refund_executed: "Pengembalian dana selesai",
  executing: "Sedang diproses",
  failed: "Proses gagal — dapat dicoba ulang",
  cancelled: "Proses dibatalkan",
};

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function getLatestActiveApproval(approvals: AdminSaleSensitiveApproval[]) {
  return (
    approvals.find(
      (approval) => approval.status === "pending" || approval.status === "approved",
    ) ?? approvals[0] ?? null
  );
}

function getApprovalType(approval: AdminSaleSensitiveApproval): SaleCorrectionType {
  return approval.type === "void_receipt" ? "void" : "refund";
}

function ApprovalStatusPanel({ approval }: { approval: AdminSaleSensitiveApproval }) {
  const approved = approval.status === "approved";
  const rejected = approval.status === "rejected";
  const Icon = approved ? CheckCircle2 : rejected ? XCircle : Clock3;
  const className = approved
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : rejected
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  const type = getApprovalType(approval);

  return (
    <div className={cn("rounded-2xl border p-4 text-sm", className)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{approvalStatusLabels[approval.status]}</p>
          <p className="mt-1 leading-5">
            {type === "void" ? "Pembatalan transaksi" : "Retur dan pengembalian dana"}
          </p>
          <p className="mt-2 text-xs leading-5 opacity-90">
            Diajukan oleh {approval.requestedByName} pada {formatDateTime(approval.createdAt)}.
          </p>
          {approval.approvedByName ? (
            <p className="text-xs leading-5 opacity-90">
              Diproses oleh {approval.approvedByName} pada {formatDateTime(approval.resolvedAt)}.
            </p>
          ) : null}
          {approval.executionStatus ? (
            <div className="mt-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs leading-5 text-neutral-700">
              <p className="font-semibold">{executionStatusLabels[approval.executionStatus]}</p>
              {approval.executionError ? <p>Kendala: {approval.executionError}</p> : null}
            </div>
          ) : null}
          {approval.responseNotes ? (
            <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-neutral-700">
              {approval.responseNotes}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ExecuteApprovedForm({
  type,
  saleId,
  returnTo,
  approval,
  canExecute,
}: {
  type: SaleCorrectionType;
  saleId: string;
  returnTo: string;
  approval: AdminSaleSensitiveApproval;
  canExecute: boolean;
}) {
  const executed =
    approval.executionStatus === (type === "void" ? "void_executed" : "refund_executed");
  const processing = approval.executionStatus === "executing";
  const action = type === "void" ? executeApprovedSaleVoidAction : executeApprovedSaleRefundAction;

  return (
    <form action={action} className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="approvalId" value={approval.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-100">
          <PlayCircle className="size-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-emerald-950">
            {type === "void" ? "Selesaikan pembatalan transaksi" : "Proses pengembalian dana"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            {type === "void"
              ? "Persetujuan sudah diberikan. Sistem akan membatalkan transaksi dan mencatat reversal secara atomik."
              : "Persetujuan sudah diberikan. Setelah dana dikembalikan, barang akan masuk workflow penerimaan dan pemeriksaan retur."}
          </p>
        </div>
      </div>
      <textarea
        name="executionNote"
        maxLength={1000}
        disabled={!canExecute || executed || processing}
        placeholder="Catatan tambahan (opsional)"
        className="mt-4 min-h-20 w-full resize-y rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-emerald-50"
      />
      <button
        type="submit"
        disabled={!canExecute || executed || processing}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-200 disabled:text-emerald-700"
      >
        <PlayCircle className="size-4" />
        {executed
          ? "Proses sudah selesai"
          : processing
            ? "Sedang diproses"
            : type === "void"
              ? "Batalkan transaksi sekarang"
              : "Proses pengembalian dana"}
      </button>
      {!canExecute ? (
        <p className="mt-2 text-center text-xs text-emerald-800">
          Akun ini tidak memiliki izin untuk menyelesaikan proses tersebut.
        </p>
      ) : null}
    </form>
  );
}

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

function CorrectionWizard({
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
  const [step, setStep] = useState(1);
  const [delivery, setDelivery] = useState<DeliveryAnswer>("unsure");
  const [payment, setPayment] = useState<PaymentAnswer>("received");
  const [customerPresence, setCustomerPresence] = useState<CustomerPresenceAnswer>("present");
  const type = classifySaleCorrection({ eligibility, deliveryAnswer: delivery });
  const [reasonByType, setReasonByType] = useState<Record<SaleCorrectionType, string>>({
    void: "",
    refund: "",
  });
  const reasonCode = reasonByType[type];
  const canRequest = capabilities[type].canRequest;
  const reasons = correctionReasonOptions[type];

  const impact = useMemo(
    () =>
      type === "void"
        ? [
            "Memerlukan persetujuan manager/owner.",
            "Transaksi dan pembayaran akan direversal secara tercatat.",
            "Barang tidak masuk proses pemeriksaan retur.",
          ]
        : [
            "Memerlukan persetujuan manager/owner.",
            "Dana dikembalikan sesuai metode pembayaran.",
            "Barang harus diterima dan diperiksa sebelum kembali dijual.",
          ],
    [type],
  );

  return (
    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-neutral-50/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Langkah {step} dari 3
          </p>
          <h3 className="mt-1 text-sm font-semibold text-neutral-950">
            {step === 1 ? "Kondisi transaksi" : step === 2 ? "Pilih alasan" : "Tinjau pengajuan"}
          </h3>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map((value) => (
            <span
              key={value}
              className={cn(
                "h-1.5 w-8 rounded-full",
                value <= step ? "bg-[var(--accent)]" : "bg-neutral-200",
              )}
            />
          ))}
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-5 space-y-5">
          <ChoiceGroup
            label="Apakah barang sudah diserahkan kepada customer?"
            name="deliveryAnswerUi"
            value={delivery}
            onChange={setDelivery}
            options={[
              { value: "not_delivered", label: "Belum diserahkan" },
              { value: "delivered", label: "Sudah diserahkan" },
              { value: "unsure", label: "Tidak yakin" },
            ]}
          />
          <ChoiceGroup
            label="Apakah pembayaran sudah diterima toko?"
            name="paymentAnswerUi"
            value={payment}
            onChange={setPayment}
            options={[
              { value: "received", label: "Sudah diterima" },
              { value: "not_received", label: "Belum diterima" },
              { value: "unsure", label: "Tidak yakin" },
            ]}
          />
          <ChoiceGroup
            label="Apakah customer masih berada di toko?"
            name="customerPresenceUi"
            value={customerPresence}
            onChange={setCustomerPresence}
            options={[
              { value: "present", label: "Ya" },
              { value: "left", label: "Tidak" },
              { value: "unsure", label: "Tidak yakin" },
            ]}
          />
          <div className={cn(
            "rounded-2xl border p-4",
            type === "void" ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50",
          )}>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Saran sistem</p>
            <p className="mt-1 font-semibold text-neutral-950">
              {type === "void" ? "Batalkan transaksi" : "Retur dan kembalikan dana"}
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-700">
              {type === "void"
                ? "Barang belum diserahkan dan transaksi masih memenuhi syarat pembatalan."
                : delivery === "delivered"
                  ? "Barang sudah diserahkan sehingga harus melalui proses retur dan pemeriksaan."
                  : "Untuk keamanan, kondisi yang tidak pasti atau tidak memenuhi syarat void diarahkan ke proses retur."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Lanjut pilih alasan <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-5">
          <ChoiceGroup
            label={type === "void" ? "Alasan pembatalan" : "Alasan retur"}
            name="reasonCodeUi"
            value={reasonCode}
            onChange={(value) => setReasonByType((current) => ({ ...current, [type]: value }))}
            options={reasons.map((reason) => ({ ...reason }))}
          />
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 text-sm font-semibold"
            >
              <ArrowLeft className="size-4" /> Kembali
            </button>
            <button
              type="button"
              disabled={!reasonCode}
              onClick={() => setStep(3)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white disabled:bg-neutral-200 disabled:text-neutral-500"
            >
              Tinjau <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <form action={requestSaleVoidRefundApprovalAction} className="mt-5 space-y-4">
          <input type="hidden" name="saleId" value={saleId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="deliveryAnswer" value={delivery} />
          <input type="hidden" name="paymentAnswer" value={payment} />
          <input type="hidden" name="customerPresence" value={customerPresence} />
          <input type="hidden" name="reasonCode" value={reasonCode} />
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4 text-sm">
            <dl className="space-y-3">
              <div><dt className="text-xs text-[var(--muted)]">Invoice</dt><dd className="mt-1 font-mono font-semibold">{invoiceNumber}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Tindakan</dt><dd className="mt-1 font-semibold">{type === "void" ? "Batalkan transaksi" : "Retur dan kembalikan dana"}</dd></div>
              <div><dt className="text-xs text-[var(--muted)]">Alasan</dt><dd className="mt-1">{reasons.find((reason) => reason.value === reasonCode)?.label}</dd></div>
            </dl>
            <ul className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted)]">
              {impact.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Catatan tambahan {reasonCode === "other" ? "(wajib)" : "(opsional)"}
          </label>
          <textarea
            name="reasonDetails"
            minLength={reasonCode === "other" ? 8 : undefined}
            required={reasonCode === "other"}
            maxLength={1000}
            placeholder="Tambahkan informasi penting untuk manager yang meninjau."
            className="min-h-24 w-full resize-y rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          />
          {!canRequest ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800">
              Akun ini tidak memiliki izin untuk mengajukan jenis koreksi yang direkomendasikan sistem.
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 text-sm font-semibold"
            >
              <ArrowLeft className="size-4" /> Kembali
            </button>
            <button
              type="submit"
              disabled={!canRequest}
              className="inline-flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-500"
            >
              <ShieldAlert className="size-4" /> Ajukan persetujuan
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function SaleSensitiveActionsCard({
  saleId,
  invoiceNumber,
  saleStatus,
  returnTo,
  approvals,
  capabilities,
  eligibility,
  returnWorkflowHref,
}: {
  saleId: string;
  invoiceNumber: string;
  saleStatus: AdminSaleStatus;
  returnTo: string;
  approvals: AdminSaleSensitiveApproval[];
  capabilities: SaleSensitiveCapabilities;
  eligibility: SaleCorrectionEligibility;
  returnWorkflowHref: string;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const approval = getLatestActiveApproval(approvals);
  const approvalType = approval ? getApprovalType(approval) : null;
  const executable = approval?.status === "approved" && saleStatus === "completed";

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <ShieldAlert className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-950">Koreksi Transaksi</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Gunakan untuk salah input, pembatalan customer, atau pengembalian barang. Sistem akan menentukan alur yang paling aman.
          </p>
        </div>
      </div>

      {approval ? (
        <div className="mt-4">
          <ApprovalStatusPanel approval={approval} />
          {executable && approvalType ? (
            <ExecuteApprovedForm
              type={approvalType}
              saleId={saleId}
              returnTo={returnTo}
              approval={approval}
              canExecute={capabilities[approvalType].canExecute}
            />
          ) : null}
          {approval.executionStatus === "refund_executed" ? (
            <Link
              href={returnWorkflowHref}
              className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 transition hover:bg-amber-100"
            >
              <ClipboardCheck className="size-5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Lanjutkan penerimaan barang</span>
                <span className="mt-1 block text-xs leading-5">Dana sudah diproses. Barang harus diterima dan diperiksa sebelum kembali dijual.</span>
              </span>
              <ChevronRight className="ml-auto size-4 shrink-0" />
            </Link>
          ) : null}
        </div>
      ) : eligibility.canRequestCorrection ? (
        <>
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-700">
            <div className="flex items-start gap-2">
              {eligibility.voidEligibleBySystem ? <RotateCcw className="mt-0.5 size-4 shrink-0" /> : <Undo2 className="mt-0.5 size-4 shrink-0" />}
              <div><p className="font-semibold text-neutral-950">{eligibility.title}</p><p className="mt-1">{eligibility.explanation}</p></div>
            </div>
          </div>
          {!wizardOpen ? (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              <ShieldAlert className="size-4" /> Ajukan koreksi transaksi
            </button>
          ) : (
            <CorrectionWizard
              saleId={saleId}
              invoiceNumber={invoiceNumber}
              returnTo={returnTo}
              eligibility={eligibility}
              capabilities={capabilities}
            />
          )}
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div><p className="font-semibold">Koreksi baru tidak tersedia</p><p className="mt-1">{eligibility.blockers[0] ?? "Status transaksi ini tidak dapat dikoreksi."}</p></div>
          </div>
        </div>
      )}
    </section>
  );
}
