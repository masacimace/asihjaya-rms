import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Landmark,
  Search,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  parseBankInflowFilters,
  type BankInflowFilters,
  type BankInflowMovement,
} from "@/features/bank-inflows/contracts";
import { getBankInflowReportData } from "@/features/bank-inflows/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Laporan Pemasukan Bank",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const dateRangeLabels = {
  today: "Hari ini",
  yesterday: "Kemarin",
  last7: "7 hari terakhir",
  last30: "30 hari terakhir",
  thisMonth: "Bulan ini",
  custom: "Custom",
} as const;

const methodLabels = {
  all: "Semua metode",
  debit_card: "EDC",
  bank_transfer: "Transfer Bank",
} as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

function buildQueryParams(filters: BankInflowFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.outletId) params.set("outletId", filters.outletId);
  if (filters.provider) params.set("provider", filters.provider);
  if (filters.method !== "all") params.set("method", filters.method);
  if (filters.dateRange !== "thisMonth") params.set("range", filters.dateRange);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  return params;
}

function buildListUrl(page: number, filters: BankInflowFilters) {
  const params = buildQueryParams(filters);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query
    ? `/admin/operasional/pemasukan-bank?${query}`
    : "/admin/operasional/pemasukan-bank";
}

function buildExportUrl(filters: BankInflowFilters) {
  const params = buildQueryParams(filters);
  const query = params.toString();
  return query
    ? `/admin/operasional/pemasukan-bank/export/xlsx?${query}`
    : "/admin/operasional/pemasukan-bank/export/xlsx";
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
  tone = "default",
}: {
  title: string;
  value: ReactNode;
  helper: string;
  icon: ReactNode;
  tone?: "default" | "success" | "danger" | "dark";
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5",
        tone === "dark"
          ? "border-neutral-800 bg-neutral-950 text-white"
          : "border-[var(--border)] bg-white text-neutral-950",
      )}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-medium",
              tone === "dark" ? "text-neutral-300" : "text-[var(--muted)]",
            )}
          >
            {title}
          </p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-tight">
            {value}
          </p>
          <p
            className={cn(
              "mt-2 text-xs leading-5",
              tone === "dark" ? "text-neutral-400" : "text-[var(--muted)]",
            )}
          >
            {helper}
          </p>
        </div>
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            tone === "success" && "bg-emerald-50 text-emerald-700",
            tone === "danger" && "bg-red-50 text-red-700",
            tone === "dark" && "bg-white/10 text-white",
            tone === "default" &&
              "bg-[var(--accent-soft)] text-[var(--accent)]",
          )}
        >
          {icon}
        </span>
      </div>
    </article>
  );
}

function MovementBadge({ row }: { row: BankInflowMovement }) {
  const isReceipt = row.kind === "receipt";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        isReceipt
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {isReceipt ? (
        <ArrowUpRight className="size-3.5" />
      ) : (
        <ArrowDownRight className="size-3.5" />
      )}
      {isReceipt ? "Penerimaan" : "Refund"}
    </span>
  );
}

export default async function BankInflowPage({ searchParams }: PageProps) {
  const auth = await requirePermission("admin.access");
  const parsedFilters = parseBankInflowFilters(await searchParams);
  const data = await getBankInflowReportData(auth, parsedFilters);
  const filters = data.filters;
  const currentOutlet = filters.outletId
    ? (data.outlets.find((outlet) => outlet.id === filters.outletId) ?? null)
    : null;

  const startItem = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const endItem = Math.min(data.page * data.pageSize, data.total);

  return (
    <div className="space-y-6 pb-10">
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
              Laporan Pemasukan Bank
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Rekonsiliasi penerimaan EDC dan Transfer Bank berdasarkan payment
              ledger, termasuk refund yang sudah dikonfirmasi.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
              <Landmark className="size-3.5 text-[var(--accent)]" />
              Pemasukan bank bersih
            </p>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold",
                data.summary.netAmount < 0
                  ? "text-red-700"
                  : "text-neutral-950",
              )}
            >
              {formatMoney(data.summary.netAmount)}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {formatInteger(data.summary.movementCount)} mutasi ·{" "}
              {data.period.label}
            </p>

            <Link
              href={buildExportUrl(filters)}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Download className="size-4" />
              Export XLSX
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Penerimaan Bank"
          value={formatMoney(data.summary.receiptAmount)}
          helper="Total EDC + Transfer yang benar-benar diterima."
          icon={<ArrowUpRight className="size-5" />}
          tone="success"
        />
        <SummaryCard
          title="Refund Bank"
          value={formatMoney(data.summary.refundAmount)}
          helper="Refund bank yang sudah confirmed pada periode aktif."
          icon={<ArrowDownRight className="size-5" />}
          tone="danger"
        />
        <SummaryCard
          title="Pemasukan Bank Bersih"
          value={formatMoney(data.summary.netAmount)}
          helper="Penerimaan bank dikurangi refund bank."
          icon={<Landmark className="size-5" />}
          tone="dark"
        />
        <SummaryCard
          title="Jumlah Mutasi"
          value={formatInteger(data.summary.movementCount)}
          helper="Jumlah entry penerimaan + refund sesuai filter."
          icon={<WalletCards className="size-5" />}
        />
      </section>

      <details className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 transition hover:bg-neutral-50 sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <CalendarDays className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold text-neutral-950">Filter Laporan</h2>
              <p className="mt-1 truncate text-xs leading-5 text-[var(--muted)]">
                Periode: {data.period.label} · Outlet:{" "}
                {currentOutlet
                  ? `${currentOutlet.code} — ${currentOutlet.name}`
                  : "Semua outlet"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-neutral-600">
            <span className="hidden sm:inline">Buka / tutup filter</span>
            <ChevronDown className="size-5 transition-transform duration-200 group-open:rotate-180" />
          </div>
        </summary>

        <div className="border-t border-[var(--border)] p-4 sm:p-5">
          <form
            method="get"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <label className="space-y-1.5 text-sm font-medium text-neutral-700 xl:col-span-2">
              <span>Pencarian</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  name="q"
                  defaultValue={filters.search}
                  placeholder="Invoice, customer, bank, referensi..."
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-neutral-400"
                />
              </div>
            </label>

            <label className="space-y-1.5 text-sm font-medium text-neutral-700">
              <span>Periode</span>
              <select
                name="range"
                defaultValue={filters.dateRange}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-neutral-400"
              >
                {Object.entries(dateRangeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm font-medium text-neutral-700">
              <span>Outlet</span>
              <select
                name="outletId"
                defaultValue={filters.outletId ?? ""}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-neutral-400"
              >
                <option value="">Semua outlet</option>
                {data.outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.code} — {outlet.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm font-medium text-neutral-700">
              <span>Bank / Provider</span>
              <select
                name="provider"
                defaultValue={filters.provider ?? ""}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-neutral-400"
              >
                <option value="">Semua bank</option>
                {data.providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm font-medium text-neutral-700">
              <span>Metode</span>
              <select
                name="method"
                defaultValue={filters.method}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-neutral-400"
              >
                {Object.entries(methodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm font-medium text-neutral-700">
              <span>Tanggal Mulai</span>
              <input
                type="date"
                name="startDate"
                defaultValue={data.period.startDate}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-neutral-400"
              />
            </label>

            <label className="space-y-1.5 text-sm font-medium text-neutral-700">
              <span>Tanggal Selesai</span>
              <input
                type="date"
                name="endDate"
                defaultValue={data.period.endDate}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-neutral-400"
              />
            </label>

            <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Terapkan Filter
              </button>
              <Link
                href="/admin/operasional/pemasukan-bank"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Reset
              </Link>
              <p className="text-xs text-[var(--muted)]">
                Tanggal Mulai/Selesai dipakai saat Periode = Custom.
              </p>
            </div>
          </form>
        </div>
      </details>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-semibold text-neutral-950">Ringkasan Bank</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            EDC dan Transfer menunjukkan penerimaan kotor. Refund dikurangkan
            untuk mendapatkan nilai bersih per bank.
          </p>
        </div>

        {data.bankSummary.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--muted)]">
            Belum ada mutasi bank pada filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Bank</th>
                  <th className="px-5 py-3 text-right font-semibold">EDC</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Transfer
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Penerimaan
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">Refund</th>
                  <th className="px-5 py-3 text-right font-semibold">Bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.bankSummary.map((bank) => (
                  <tr key={bank.provider} className="hover:bg-neutral-50/70">
                    <td className="px-5 py-4 font-semibold text-neutral-950">
                      {bank.provider}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {formatMoney(bank.edcAmount)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {formatMoney(bank.transferAmount)}
                    </td>
                    <td className="px-5 py-4 text-right font-medium tabular-nums text-emerald-700">
                      {formatMoney(bank.receiptAmount)}
                    </td>
                    <td className="px-5 py-4 text-right font-medium tabular-nums text-red-700">
                      {formatMoney(bank.refundAmount)}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-4 text-right font-semibold tabular-nums",
                        bank.netAmount < 0
                          ? "text-red-700"
                          : "text-neutral-950",
                      )}
                    >
                      {formatMoney(bank.netAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-2 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">
              Detail Mutasi Bank
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Menampilkan {formatInteger(startItem)}–{formatInteger(endItem)}{" "}
              dari {formatInteger(data.total)} mutasi.
            </p>
          </div>
          <Banknote className="size-5 text-neutral-400" />
        </div>

        {data.rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Landmark className="mx-auto size-9 text-neutral-300" />
            <p className="mt-3 text-sm font-semibold text-neutral-800">
              Tidak ada mutasi bank
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Coba ubah periode atau filter laporan.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1220px] w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Invoice</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Outlet</th>
                    <th className="px-4 py-3 font-semibold">Bank</th>
                    <th className="px-4 py-3 font-semibold">Metode</th>
                    <th className="px-4 py-3 font-semibold">Jenis</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Penerimaan
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Refund
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Bersih
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Referensi / Profil
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {data.rows.map((row) => {
                    const netAmount =
                      row.kind === "receipt" ? row.amount : -row.amount;
                    return (
                      <tr key={row.id} className="hover:bg-neutral-50/70">
                        <td className="whitespace-nowrap px-4 py-4 text-xs text-neutral-600">
                          {formatDateTime(
                            row.occurredAt,
                            auth.organization.timezone,
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/admin/penjualan/${row.saleId}`}
                            className="font-semibold text-neutral-950 hover:text-[var(--accent)] hover:underline"
                          >
                            {row.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-neutral-900">
                            {row.customerName ?? "Walk-in"}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {row.customerCode ?? row.customerPhone ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-neutral-900">
                            {row.outletName}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {row.outletCode}
                          </p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-neutral-950">
                          {row.provider}
                        </td>
                        <td className="px-4 py-4 text-neutral-700">
                          {row.method === "debit_card" ? "EDC" : "Transfer"}
                        </td>
                        <td className="px-4 py-4">
                          <MovementBadge row={row} />
                        </td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums text-emerald-700">
                          {row.kind === "receipt"
                            ? formatMoney(row.amount)
                            : "—"}
                        </td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums text-red-700">
                          {row.kind === "refund"
                            ? formatMoney(row.amount)
                            : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-4 text-right font-semibold tabular-nums",
                            netAmount < 0 ? "text-red-700" : "text-neutral-950",
                          )}
                        >
                          {formatMoney(netAmount)}
                        </td>
                        <td
                          className="max-w-48 truncate px-4 py-4 text-xs text-neutral-600"
                          title={row.providerReference ?? undefined}
                        >
                          {row.providerReference ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[var(--border)] lg:hidden">
              {data.rows.map((row) => {
                const netAmount =
                  row.kind === "receipt" ? row.amount : -row.amount;
                return (
                  <article key={row.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/admin/penjualan/${row.saleId}`}
                          className="truncate font-semibold text-[13px] text-neutral-950 hover:text-[var(--accent)]"
                        >
                          {row.invoiceNumber}
                        </Link>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatDateTime(
                            row.occurredAt,
                            auth.organization.timezone,
                          )}
                        </p>
                      </div>
                      <MovementBadge row={row} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-neutral-50 p-3 text-xs">
                      <div>
                        <p className="text-[var(--muted)]">Bank / Metode</p>
                        <p className="mt-1 font-semibold text-neutral-900">
                          {row.provider} ·{" "}
                          {row.method === "debit_card" ? "EDC" : "Transfer"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--muted)]">Bersih</p>
                        <p
                          className={cn(
                            "mt-1 font-semibold",
                            netAmount < 0 ? "text-red-700" : "text-emerald-700",
                          )}
                        >
                          {formatMoney(netAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--muted)]">Customer</p>
                        <p className="mt-1 font-semibold text-neutral-900">
                          {row.customerName ?? "Walk-in"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--muted)]">Outlet</p>
                        <p className="mt-1 font-semibold text-neutral-900">
                          {row.outletName}
                        </p>
                      </div>
                    </div>
                    {row.providerReference ? (
                      <p className="text-xs text-[var(--muted)]">
                        Ref: {row.providerReference}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--muted)]">
            Halaman {data.page} dari {data.pageCount}
          </p>
          <div className="flex items-center gap-2">
            {data.page > 1 ? (
              <Link
                href={buildListUrl(data.page - 1, filters)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                <ChevronLeft className="size-4" /> Sebelumnya
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-300">
                <ChevronLeft className="size-4" /> Sebelumnya
              </span>
            )}
            {data.page < data.pageCount ? (
              <Link
                href={buildListUrl(data.page + 1, filters)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Berikutnya <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-300">
                Berikutnya <ChevronRight className="size-4" />
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
