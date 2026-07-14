import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  Filter,
  FileUp,
  Sparkles,
  ReceiptText,
  Search,
  SearchX,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  parseReconciliationFilters,
  type ReconciliationFilters,
  type ReconciliationListRow,
  type ReconciliationPaymentMethod,
  type ReconciliationStatus,
} from "@/features/reconciliation/contracts";
import { getReconciliationListData } from "@/features/reconciliation/queries";
import { hasPermission, requirePermission } from "@/lib/auth/session";
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

const rangeLabels: Record<ReconciliationFilters["range"], string> = {
  today: "Hari ini",
  yesterday: "Kemarin",
  "7d": "7 hari",
  "30d": "30 hari",
  all: "Semua periode",
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

function getStatusMeta(status: ReconciliationStatus) {
  if (status === "reconciled") {
    return {
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "pending_settlement") {
    return {
      icon: Clock3,
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  if (status === "mismatch") {
    return {
      icon: AlertTriangle,
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }
  if (status === "not_found") {
    return {
      icon: SearchX,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (status === "waived") {
    return {
      icon: ShieldCheck,
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }
  return {
    icon: Clock3,
    className: "border-neutral-200 bg-neutral-50 text-neutral-700",
  };
}

function StatusBadge({ status }: { status: ReconciliationStatus }) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        meta.className,
      )}
    >
      <Icon className="size-3" />
      {statusLabels[status]}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  tone: "neutral" | "blue" | "emerald" | "red";
}) {
  const toneClass = {
    neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
  }[tone];

  return (
    <article className="rounded-3xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {title}
          </p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-neutral-950">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl ring-1",
            toneClass,
          )}
        >
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </article>
  );
}

function buildUrl(page: number, filters: ReconciliationFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.outletId) params.set("outletId", filters.outletId);
  if (filters.profileId) params.set("profileId", filters.profileId);
  if (filters.method) params.set("method", filters.method);
  if (filters.status !== "unreconciled") params.set("status", filters.status);
  if (filters.range !== "30d") params.set("range", filters.range);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query
    ? `/admin/keuangan/rekonsiliasi?${query}`
    : "/admin/keuangan/rekonsiliasi";
}

function MobileRow({ row }: { row: ReconciliationListRow }) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusBadge status={row.settlementStatus} />
          <Link
            href={`/admin/penjualan/${row.saleId}`}
            className="mt-3 block truncate text-sm font-semibold text-neutral-950 hover:text-[var(--accent)]"
          >
            {row.invoiceNumber}
          </Link>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatDateTime(row.paidAt)} · {row.cashierName}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-neutral-950">
          {formatMoney(row.amount)}
        </p>
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-600">
        <div className="flex justify-between gap-3">
          <span>Metode</span>
          <span className="text-right font-semibold text-neutral-900">
            {methodLabels[row.method]}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Profile</span>
          <span className="text-right font-semibold text-neutral-900">
            {row.profileName ?? row.provider}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Reference</span>
          <span className="max-w-[60%] truncate text-right font-semibold text-neutral-900">
            {row.providerReference ?? "-"}
          </span>
        </div>
        {row.settlementStatus === "mismatch" ? (
          <div className="flex justify-between gap-3 text-red-700">
            <span>Selisih</span>
            <span className="font-semibold">
              {formatMoney(row.differenceAmount)}
            </span>
          </div>
        ) : null}
      </div>

      <Link
        href={`/admin/keuangan/rekonsiliasi/${row.paymentId}`}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800"
      >
        {row.settlementStatus === "unreconciled"
          ? "Periksa payment"
          : "Buka detail"}
        <ArrowRight className="size-4" />
      </Link>
    </article>
  );
}

export default async function PaymentReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requirePermission("payments.reconciliation.view");
  const filters = parseReconciliationFilters(await searchParams);
  const data = await getReconciliationListData(auth, filters);
  const canImportSettlement = hasPermission(
    auth,
    "payments.reconciliation.import",
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:items-start lg:p-7">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>

            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Rekonsiliasi Pembayaran
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Cocokkan payment POS dengan mutasi bank, laporan merchant QRIS,
              dan batch terminal EDC. Omzet tetap memakai gross payment,
              sedangkan MDR dan pajak dicatat terpisah.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
              <Sparkles className="size-3.5 text-[var(--accent)]" />
              Status rekonsiliasi
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-950">
              {data.summary.unreconciledCount +
                data.summary.mismatchCount +
                data.summary.notFoundCount}{" "}
              payment perlu ditinjau
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {data.summary.reconciledCount} sudah direkonsiliasi dan{" "}
              {data.summary.pendingCount} masih menunggu settlement.
            </p>
            {canImportSettlement ? (
              <Link
                href="/admin/keuangan/rekonsiliasi/import"
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800"
              >
                <FileUp className="size-4" />
                Import settlement CSV
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Belum diperiksa"
          value={formatMoney(data.summary.unreconciledAmount)}
          description={`${data.summary.unreconciledCount} payment masih menunggu rekonsiliasi.`}
          icon={<Clock3 className="size-5" />}
          tone="neutral"
        />
        <SummaryCard
          title="Menunggu settlement"
          value={formatMoney(data.summary.pendingAmount)}
          description={`${data.summary.pendingCount} payment sudah ditemukan tetapi dananya belum settle.`}
          icon={<WalletCards className="size-5" />}
          tone="blue"
        />
        <SummaryCard
          title="Net direkonsiliasi"
          value={formatMoney(data.summary.reconciledNetAmount)}
          description={`Biaya/MDR tercatat ${formatMoney(data.summary.totalFeeAmount)}.`}
          icon={<CheckCircle2 className="size-5" />}
          tone="emerald"
        />
        <SummaryCard
          title="Selisih perlu tindakan"
          value={formatMoney(data.summary.mismatchAbsoluteAmount)}
          description={`${data.summary.mismatchCount} mismatch dan ${data.summary.notFoundCount} payment tidak ditemukan.`}
          icon={<AlertTriangle className="size-5" />}
          tone="red"
        />
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-neutral-950">
            Filter payment
          </h2>
        </div>
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-neutral-400" />
            <input
              name="q"
              defaultValue={filters.search}
              placeholder="Invoice, provider, reference..."
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
          </label>
          <select
            name="outletId"
            defaultValue={filters.outletId ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua outlet</option>
            {data.outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
          <select
            name="method"
            defaultValue={filters.method ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua metode</option>
            {Object.entries(methodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={filters.status}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value="all">Semua status</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="range"
            defaultValue={filters.range}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            {Object.entries(rangeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            name="profileId"
            defaultValue={filters.profileId ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)] md:col-span-2 xl:col-span-2"
          >
            <option value="">Semua profile pembayaran</option>
            {data.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} · {profile.provider}
              </option>
            ))}
          </select>
          <div className="flex gap-2 md:col-span-2 xl:col-span-4">
            <button
              type="submit"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Terapkan filter
            </button>
            <Link
              href="/admin/keuangan/rekonsiliasi"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 lg:px-6">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">
              Daftar payment
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {data.total} payment sesuai filter
            </p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
            <ReceiptText className="size-5" />
          </div>
        </div>

        {data.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Banknote className="mx-auto size-10 text-neutral-300" />
            <p className="mt-4 text-sm font-semibold text-neutral-800">
              Tidak ada payment ditemukan
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ubah filter atau pilih periode yang lebih panjang.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-4 lg:hidden">
              {data.rows.map((row) => (
                <MobileRow key={row.paymentId} row={row} />
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Transaksi</th>
                    <th className="px-5 py-3 font-semibold">Payment</th>
                    <th className="px-5 py-3 font-semibold">Nominal</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Settlement</th>
                    <th className="px-5 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {data.rows.map((row) => (
                    <tr
                      key={row.paymentId}
                      className="align-top hover:bg-neutral-50/70"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/penjualan/${row.saleId}`}
                          className="font-semibold text-neutral-950 hover:text-[var(--accent)]"
                        >
                          {row.invoiceNumber}
                        </Link>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {row.outletCode} · {row.registerName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatDateTime(row.paidAt)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-neutral-900">
                          {methodLabels[row.method]}
                        </p>
                        <p className="mt-1 max-w-56 truncate text-xs text-[var(--muted)]">
                          {row.profileName ?? row.provider}
                        </p>
                        <p className="mt-1 max-w-56 truncate font-mono text-xs text-neutral-500">
                          {row.providerReference ?? "-"}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-neutral-950">
                        {formatMoney(row.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={row.settlementStatus} />
                      </td>
                      <td className="px-5 py-4">
                        {row.settlementStatus === "reconciled" ? (
                          <div>
                            <p className="font-semibold text-neutral-900">
                              Net {formatMoney(row.netSettlementAmount)}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              Fee {formatMoney(row.feeAmount)}
                            </p>
                          </div>
                        ) : row.settlementStatus === "mismatch" ? (
                          <p className="font-semibold text-red-700">
                            Selisih {formatMoney(row.differenceAmount)}
                          </p>
                        ) : (
                          <span className="text-xs text-neutral-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/keuangan/rekonsiliasi/${row.paymentId}`}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
                        >
                          {row.settlementStatus === "unreconciled"
                            ? "Periksa"
                            : "Detail"}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--muted)]">
            Halaman {data.page} dari {data.pageCount}
          </p>
          <div className="flex gap-2">
            <Link
              href={buildUrl(Math.max(1, data.page - 1), filters)}
              aria-disabled={data.page <= 1}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold",
                data.page <= 1
                  ? "pointer-events-none text-neutral-300"
                  : "text-neutral-700 hover:bg-neutral-50",
              )}
            >
              <ArrowLeft className="size-4" /> Sebelumnya
            </Link>
            <Link
              href={buildUrl(Math.min(data.pageCount, data.page + 1), filters)}
              aria-disabled={data.page >= data.pageCount}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold",
                data.page >= data.pageCount
                  ? "pointer-events-none text-neutral-300"
                  : "text-neutral-700 hover:bg-neutral-50",
              )}
            >
              Berikutnya <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
