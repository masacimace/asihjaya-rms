import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileImage,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PaymentReconciliationForm } from "@/components/reconciliation/payment-reconciliation-form";
import type {
  ReconciliationPaymentMethod,
  ReconciliationStatus,
} from "@/features/reconciliation/contracts";
import { getReconciliationDetailData } from "@/features/reconciliation/queries";
import {
  hasPermission,
  requirePermission,
} from "@/lib/auth/session";
import { getPaymentEvidenceUrl } from "@/lib/storage/payment-evidence-storage";
import { getReconciliationEvidenceUrl } from "@/lib/storage/reconciliation-evidence-storage";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const methodLabels: Record<ReconciliationPaymentMethod, string> = {
  qris_manual: "QRIS Manual",
  debit_card: "Debit EDC",
  credit_card: "Credit EDC",
  bank_transfer: "Bank Transfer",
  qris_gateway: "QRIS Gateway",
  other: "Lainnya",
};

const statusLabels: Record<ReconciliationStatus, string> = {
  unreconciled: "Belum direkonsiliasi",
  pending_settlement: "Menunggu settlement",
  reconciled: "Direkonsiliasi",
  mismatch: "Mismatch",
  not_found: "Tidak ditemukan",
  waived: "Dikecualikan",
};

function formatMoney(value: number | string | null) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

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

function FlashMessage({
  type,
  message,
}: {
  type?: string;
  message?: string;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-3xl border px-5 py-4 text-sm font-medium",
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {message}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-neutral-100 py-3 last:border-0 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="break-words text-sm font-semibold text-neutral-900">
        {value}
      </span>
    </div>
  );
}

export default async function PaymentReconciliationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requirePermission("payments.reconciliation.view");
  const [{ paymentId }, query] = await Promise.all([params, searchParams]);
  const data = await getReconciliationDetailData(auth, paymentId);
  if (!data) notFound();

  const canManage = hasPermission(auth, "payments.reconciliation.manage");
  const canResolve = hasPermission(auth, "payments.reconciliation.resolve");
  const paymentEvidenceUrl = getPaymentEvidenceUrl(data.evidenceKey);
  const reconciliationEvidenceUrl = getReconciliationEvidenceUrl(
    data.reconciliationEvidenceKey,
  );
  const amount = Number(data.amount);
  const gross = data.settlementGrossAmount
    ? Number(data.settlementGrossAmount)
    : null;
  const fee = data.feeAmount ? Number(data.feeAmount) : 0;
  const tax = data.taxAmount ? Number(data.taxAmount) : 0;
  const net = data.netSettlementAmount
    ? Number(data.netSettlementAmount)
    : null;
  const difference = data.differenceAmount
    ? Number(data.differenceAmount)
    : 0;

  return (
    <div className="space-y-6">
      <FlashMessage type={query.type} message={query.message} />

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href="/admin/keuangan/rekonsiliasi"
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke rekonsiliasi
        </Link>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <Landmark className="size-3.5" />
              Pemeriksaan payment
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              {data.invoiceNumber}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {methodLabels[data.method]} · {data.provider} · {data.outletName}
            </p>
          </div>
          <Link
            href={`/admin/penjualan/${data.saleId}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <ReceiptText className="size-4" />
            Detail transaksi
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <WalletCards className="size-5 text-[var(--accent)]" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Payment POS
          </p>
          <p className="mt-2 text-xl font-bold text-neutral-950">
            {formatMoney(amount)}
          </p>
        </article>
        <article className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <ShieldCheck className="size-5 text-blue-600" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Status
          </p>
          <p className="mt-2 text-lg font-bold text-neutral-950">
            {statusLabels[data.settlementStatus]}
          </p>
        </article>
        <article className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Net settlement
          </p>
          <p className="mt-2 text-xl font-bold text-neutral-950">
            {net == null ? "-" : formatMoney(net)}
          </p>
          {gross != null ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Gross {formatMoney(gross)} · fee {formatMoney(fee + tax)}
            </p>
          ) : null}
        </article>
        <article className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <Landmark className="size-5 text-red-600" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Selisih gross
          </p>
          <p
            className={cn(
              "mt-2 text-xl font-bold",
              difference === 0 ? "text-neutral-950" : "text-red-700",
            )}
          >
            {formatMoney(difference)}
          </p>
        </article>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
                <Store className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Informasi transaksi
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  Data yang tercatat ketika payment dibuat
                </p>
              </div>
            </div>
            <div className="mt-4">
              <InfoRow label="Outlet" value={`${data.outletName} · ${data.outletCode}`} />
              <InfoRow label="Register" value={data.registerName} />
              <InfoRow label="Cashier" value={data.cashierName} />
              <InfoRow label="Dibayar" value={formatDateTime(data.paidAt)} />
              <InfoRow label="Metode" value={methodLabels[data.method]} />
              <InfoRow label="Profile" value={data.profileName ?? data.provider} />
              <InfoRow label="Provider" value={data.provider} />
              <InfoRow label="Reference payment" value={data.providerReference ?? "-"} />
              <InfoRow label="Verifikasi" value={data.verificationSource ?? "-"} />
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
                <UserRound className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Audit rekonsiliasi
                </h2>
                <p className="text-xs text-[var(--muted)]">
                  Pelaksana dan hasil terakhir
                </p>
              </div>
            </div>
            <div className="mt-4">
              <InfoRow
                label="Diperiksa oleh"
                value={data.reconciledByName ?? "Belum diperiksa"}
              />
              <InfoRow
                label="Waktu pemeriksaan"
                value={formatDateTime(data.reconciledAt)}
              />
              <InfoRow
                label="Tanggal settlement"
                value={formatDateTime(data.settlementDate)}
              />
              <InfoRow
                label="Reference settlement"
                value={data.settlementReference ?? "-"}
              />
              {data.resolvedByName ? (
                <InfoRow label="Diselesaikan oleh" value={data.resolvedByName} />
              ) : null}
              {data.reconciliationNotes ? (
                <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Catatan
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-800">
                    {data.reconciliationNotes}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {paymentEvidenceUrl ? (
                <a
                  href={paymentEvidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <FileImage className="size-4" /> Bukti payment
                </a>
              ) : null}
              {reconciliationEvidenceUrl ? (
                <a
                  href={reconciliationEvidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <FileImage className="size-4" /> Bukti settlement
                </a>
              ) : null}
            </div>
          </section>
        </div>

        <div>
          {canManage ? (
            <PaymentReconciliationForm
              paymentId={data.paymentId}
              expectedAmount={amount}
              initialStatus={
                data.settlementStatus === "unreconciled"
                  ? "reconciled"
                  : data.settlementStatus
              }
              initialGrossAmount={gross}
              initialFeeAmount={fee}
              initialTaxAmount={tax}
              initialSettlementDate={data.settlementDate}
              initialSettlementReference={data.settlementReference}
              initialNotes={data.reconciliationNotes}
              existingEvidenceUrl={reconciliationEvidenceUrl}
              canResolve={canResolve}
            />
          ) : (
            <section className="rounded-3xl border border-[var(--border)] bg-white p-6 text-center">
              <ShieldCheck className="mx-auto size-10 text-neutral-300" />
              <h2 className="mt-4 font-semibold text-neutral-950">
                Akses lihat saja
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Akun ini dapat melihat hasil rekonsiliasi tetapi tidak dapat
                mengubah status payment.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
