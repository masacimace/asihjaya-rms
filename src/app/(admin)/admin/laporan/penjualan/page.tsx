import {
  ArrowRight,
  BadgePercent,
  Banknote,
  CalendarDays,
  Download,
  Gem,
  LineChart,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBag,
  Store,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  parseReportSalesFilters,
  reportPaymentMethodOptions,
  reportPeriodOptions,
  reportSalesStatusOptions,
  type ReportPaymentMethod,
  type ReportSaleStatus,
  type ReportSalesData,
  type ReportSalesDailyPoint,
  type ReportSalesRow,
} from "@/features/reports/contracts";
import { getReportSalesData } from "@/features/reports/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const paymentMethodLabels: Record<ReportPaymentMethod, string> = {
  cash: "Cash",
  debit_card: "Debit Card",
  credit_card: "Credit Card",
  bank_transfer: "Transfer Bank",
  qris_manual: "QRIS Manual",
  qris_gateway: "QRIS Gateway",
  other: "Lainnya",
};

const saleStatusLabels: Record<ReportSaleStatus, string> = {
  draft: "Draft",
  awaiting_payment: "Menunggu bayar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  voided: "Void",
  partially_refunded: "Refund parsial",
  refunded: "Refund",
};

const saleStatusStyles: Record<ReportSaleStatus, string> = {
  draft: "border-neutral-200 bg-neutral-50 text-neutral-700",
  awaiting_payment: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-neutral-200 bg-neutral-100 text-neutral-600",
  voided: "border-red-200 bg-red-50 text-red-700",
  partially_refunded: "border-orange-200 bg-orange-50 text-orange-700",
  refunded: "border-purple-200 bg-purple-50 text-purple-700",
};

function formatMoney(value: number | string | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatGram(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDateTime(value: Date | null | undefined) {
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

function formatCompactMoney(value: number) {
  if (value <= 0) return "0";

  if (value >= 1_000_000_000) {
    return `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: value >= 10_000_000_000 ? 0 : 1,
    }).format(value / 1_000_000_000)}M`;
  }

  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: value >= 10_000_000 ? 0 : 1,
    }).format(value / 1_000_000)}Jt`;
  }

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value / 1_000)}Rb`;
}

function getSalesChartMax(points: ReportSalesDailyPoint[]) {
  const maxValue = Math.max(...points.map((point) => point.revenue), 0);

  if (maxValue <= 0) return 5_000_000;

  const step = maxValue >= 50_000_000 ? 10_000_000 : 5_000_000;

  return Math.ceil(maxValue / step) * step;
}

function buildSalesReportExportUrl({
  format,
  params,
}: {
  format: "csv" | "xlsx";
  params: Record<string, string | null | undefined>;
}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const basePath =
    format === "xlsx"
      ? "/admin/laporan/penjualan/export/xlsx"
      : "/admin/laporan/penjualan/export";
  const query = searchParams.toString();

  return query ? `${basePath}?${query}` : basePath;
}

function StatCard({
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
  tone?: "default" | "success" | "warning" | "danger" | "dark";
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border p-5",
        tone === "dark"
          ? "border-neutral-800 bg-neutral-950 text-white"
          : "border-[var(--border)] bg-white text-neutral-950",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              tone === "dark" ? "text-white/55" : "text-[var(--muted)]",
            )}
          >
            {title}
          </p>
          <p className="mt-3 truncate text-2xl font-semibold tracking-tight">
            {value}
          </p>
          <p
            className={cn(
              "mt-2 text-xs leading-5",
              tone === "dark" ? "text-white/55" : "text-[var(--muted)]",
            )}
          >
            {helper}
          </p>
        </div>
        <div
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            tone === "dark" && "bg-white/10 text-white",
            tone === "success" && "bg-emerald-50 text-emerald-600",
            tone === "warning" && "bg-amber-50 text-amber-600",
            tone === "danger" && "bg-red-50 text-red-600",
            tone === "default" &&
              "bg-[var(--accent-soft)] text-[var(--accent)]",
          )}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function SalesReportFilter({ data }: { data: ReportSalesData }) {
  return (
    <form className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr] lg:items-end">
        <label className="grid gap-1.5 text-sm font-medium text-neutral-700">
          <span>Cari transaksi</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              name="q"
              defaultValue={data.filters.query}
              placeholder="Invoice, pelanggan, kasir, outlet..."
              className="h-11 w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
            />
          </div>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-neutral-700">
          <span>Periode</span>
          <select
            name="range"
            defaultValue={data.filters.range}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
          >
            {reportPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-neutral-700">
          <span>Outlet</span>
          <select
            name="outletId"
            defaultValue={data.filters.outletId ?? "all"}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
          >
            <option value="all">Semua outlet</option>
            {data.outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name} ({outlet.code})
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-neutral-700">
          <span>Status</span>
          <select
            name="status"
            defaultValue={data.filters.status}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
          >
            {reportSalesStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-neutral-700">
          <span>Pembayaran</span>
          <select
            name="paymentMethod"
            defaultValue={data.filters.paymentMethod}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
          >
            {reportPaymentMethodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-[var(--muted)]">
          KPI utama dihitung dari transaksi selesai pada periode ini. Filter
          status dipakai untuk daftar transaksi dan breakdown status.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href="/admin/laporan/penjualan"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Reset
          </Link>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            <CalendarDays className="size-4" />
            Terapkan Filter
          </button>
        </div>
      </div>
    </form>
  );
}

function SalesTrendChart({ points }: { points: ReportSalesDailyPoint[] }) {
  const maxValue = getSalesChartMax(points);
  const totalRevenue = points.reduce(
    (total, point) => total + point.revenue,
    0,
  );
  const totalTransactions = points.reduce(
    (total, point) => total + point.transactionCount,
    0,
  );
  const bestPoint = points.reduce<ReportSalesDailyPoint | null>(
    (best, point) => {
      if (!best || point.revenue > best.revenue) return point;

      return best;
    },
    null,
  );

  return (
    <section className="min-w-0 self-start overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            <LineChart className="size-3.5" />
            Tren penjualan
          </div>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">
            Omzet harian
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Total {formatMoney(totalRevenue)} dari{" "}
            {formatInteger(totalTransactions)} nota selesai.
          </p>
        </div>
        <div className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm sm:w-auto sm:min-w-32">
          <p className="text-xs font-medium text-[var(--muted)]">
            Hari terbaik
          </p>
          <p className="mt-1 font-semibold text-neutral-950">
            {bestPoint?.label ?? "-"} ·{" "}
            {formatCompactMoney(bestPoint?.revenue ?? 0)}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-3">
        <div className="overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:thin]">
          <div className="flex min-h-[244px] min-w-max items-end gap-3 px-1 sm:min-w-full sm:justify-between">
            {points.map((point) => {
              const height =
                point.revenue > 0 && maxValue > 0
                  ? Math.max(10, Math.round((point.revenue / maxValue) * 100))
                  : 6;

              return (
                <div
                  key={point.key}
                  className="flex w-20 shrink-0 flex-col justify-end gap-3 sm:w-24"
                >
                  <div className="flex h-40 items-end rounded-2xl border border-neutral-100 bg-white p-2 sm:h-44">
                    <div
                      className={cn(
                        "w-full rounded-xl transition",
                        point.revenue > 0 ? "bg-neutral-950" : "bg-neutral-200",
                      )}
                      style={{ height: `${height}%` }}
                      title={`${point.label}: ${formatMoney(point.revenue)}`}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-neutral-700">
                      {formatCompactMoney(point.revenue)}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {point.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="border-t border-neutral-100 pt-3 text-xs text-[var(--muted)] sm:hidden">
          Geser grafik ke kiri atau kanan untuk melihat semua hari pada periode
          laporan.
        </p>
      </div>
    </section>
  );
}

function PaymentBreakdown({ data }: { data: ReportSalesData }) {
  const maxAmount = Math.max(
    ...data.paymentBreakdown.map((payment) => payment.amount),
    0,
  );

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <WalletCards className="size-3.5" />
        Metode bayar
      </div>
      <h2 className="mt-4 text-lg font-semibold text-neutral-950">
        Breakdown pembayaran
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Distribusi transaksi selesai berdasarkan payment method.
      </p>

      <div className="mt-6 space-y-4">
        {data.paymentBreakdown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-[var(--muted)]">
            Belum ada pembayaran paid pada periode ini.
          </p>
        ) : (
          data.paymentBreakdown.map((payment) => {
            const width =
              maxAmount > 0
                ? Math.max(8, Math.round((payment.amount / maxAmount) * 100))
                : 0;

            return (
              <div
                key={payment.method}
                className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">
                      {paymentMethodLabels[payment.method]}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {formatInteger(payment.transactionCount)} payment ·{" "}
                      {payment.percentage.toFixed(1)}%
                    </p>
                  </div>
                  <p className="text-right text-sm font-semibold text-neutral-950">
                    {formatMoney(payment.amount)}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function StatusBreakdown({ data }: { data: ReportSalesData }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        <ReceiptText className="size-3.5" />
        Status transaksi
      </div>
      <h2 className="mt-4 text-lg font-semibold text-neutral-950">
        Komposisi status
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Semua aktivitas transaksi pada periode laporan.
      </p>

      <div className="mt-6 space-y-3">
        {data.statusBreakdown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-[var(--muted)]">
            Belum ada aktivitas transaksi pada periode ini.
          </p>
        ) : (
          data.statusBreakdown.map((row) => (
            <div
              key={row.status}
              className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
            >
              <div>
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                    saleStatusStyles[row.status],
                  )}
                >
                  {saleStatusLabels[row.status]}
                </span>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {formatInteger(row.transactionCount)} nota
                </p>
              </div>
              <p className="text-right text-sm font-semibold text-neutral-950">
                {formatMoney(row.amount)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function OutletLeaderboard({ data }: { data: ReportSalesData }) {
  const maxRevenue = Math.max(
    ...data.topOutlets.map((outlet) => outlet.revenue),
    0,
  );

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
        <Store className="size-3.5" />
        Outlet
      </div>
      <h2 className="mt-4 text-lg font-semibold text-neutral-950">
        Leaderboard penjualan
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Outlet dengan omzet selesai tertinggi pada periode ini.
      </p>

      <div className="mt-6 space-y-4">
        {data.topOutlets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-[var(--muted)]">
            Belum ada transaksi selesai pada periode ini.
          </p>
        ) : (
          data.topOutlets.map((outlet, index) => {
            const width =
              maxRevenue > 0
                ? Math.max(8, Math.round((outlet.revenue / maxRevenue) * 100))
                : 0;

            return (
              <div
                key={outlet.outletId}
                className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">
                      #{index + 1} {outlet.outletName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {outlet.outletCode} ·{" "}
                      {formatInteger(outlet.transactionCount)} nota ·{" "}
                      {formatInteger(outlet.itemSold)} item
                    </p>
                  </div>
                  <p className="text-right text-sm font-semibold text-neutral-950">
                    {formatMoney(outlet.revenue)}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-neutral-950"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function PaymentPills({ methods }: { methods: ReportPaymentMethod[] }) {
  if (methods.length === 0) {
    return <span className="text-xs text-[var(--muted)]">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {methods.map((method) => (
        <span
          key={method}
          className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700"
        >
          {paymentMethodLabels[method]}
        </span>
      ))}
    </div>
  );
}

function SalesTable({ rows }: { rows: ReportSalesRow[] }) {
  const shouldScroll = rows.length >= 5;
  const desktopGridColumns =
    "grid-cols-[minmax(190px,1.25fr)_minmax(135px,0.95fr)_minmax(145px,1fr)_minmax(135px,1fr)_minmax(90px,0.7fr)_minmax(175px,1.1fr)_minmax(105px,0.75fr)_minmax(130px,0.9fr)_minmax(120px,0.85fr)]";

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
      <div className="flex flex-col gap-3 border-b border-neutral-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">
            Daftar transaksi laporan
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Maksimal 50 transaksi terbaru sesuai filter laporan.
          </p>
        </div>
        <Link
          href="/admin/penjualan"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Buka modul penjualan
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="hidden lg:block">
        <div className="overflow-x-auto">
          <div className="min-w-[1320px]">
            <div
              className={cn(
                "grid gap-x-4 border-b border-neutral-100 bg-neutral-50 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500",
                desktopGridColumns,
              )}
            >
              <div>Invoice</div>
              <div>Waktu</div>
              <div>Outlet</div>
              <div>Pelanggan</div>
              <div>Item</div>
              <div>Pembayaran</div>
              <div>Status</div>
              <div className="text-right">Total</div>
              <div className="text-right">Laba</div>
            </div>

            <div
              className={cn(
                shouldScroll &&
                  "max-h-[420px] overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable] [scrollbar-width:thin]",
              )}
            >
              {rows.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-[var(--muted)]">
                  Tidak ada transaksi yang cocok dengan filter laporan.
                </div>
              ) : (
                rows.map((sale) => (
                  <div
                    key={sale.id}
                    className={cn(
                      "grid items-start gap-x-4 border-b border-neutral-100 px-5 py-4 text-sm transition last:border-b-0 hover:bg-neutral-50/70",
                      desktopGridColumns,
                    )}
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/penjualan/${sale.id}`}
                        className="block truncate font-semibold text-neutral-950 hover:text-[var(--accent)]"
                      >
                        {sale.invoiceNumber}
                      </Link>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        {sale.cashierName}
                      </p>
                    </div>
                    <div className="text-neutral-600">
                      {formatDateTime(
                        sale.completedAt ?? sale.cancelledAt ?? sale.createdAt,
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-800">
                        {sale.outletName}
                      </p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        {sale.outletCode}
                      </p>
                    </div>
                    <div className="min-w-0 text-neutral-600">
                      <p className="truncate">
                        {sale.customerName ?? "Walk-in"}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-800">
                        {formatInteger(sale.itemCount)} item
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatGram(sale.weightSoldGram)} gr
                      </p>
                    </div>
                    <div className="min-w-0">
                      <PaymentPills methods={sale.paymentMethods} />
                    </div>
                    <div>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                          saleStatusStyles[sale.status],
                        )}
                      >
                        {saleStatusLabels[sale.status]}
                      </span>
                    </div>
                    <div className="text-right font-semibold text-neutral-950">
                      {formatMoney(sale.totalAmount)}
                      {sale.discountAmount > 0 ? (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          Disc {formatMoney(sale.discountAmount)}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right font-semibold text-neutral-950">
                      {formatMoney(sale.grossProfit)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        {shouldScroll ? (
          <p className="border-t border-neutral-100 px-5 py-3 text-xs text-[var(--muted)]">
            Scroll daftar untuk melihat transaksi laporan lainnya.
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "lg:hidden",
          shouldScroll &&
            "max-h-[680px] overflow-y-auto overscroll-y-contain [scrollbar-width:thin]",
        )}
      >
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--muted)]">
            Tidak ada transaksi yang cocok dengan filter laporan.
          </p>
        ) : (
          rows.map((sale) => (
            <Link
              key={sale.id}
              href={`/admin/penjualan/${sale.id}`}
              className="block border-b border-neutral-100 p-4 transition last:border-b-0 active:bg-neutral-50"
            >
              <article className="rounded-2xl border border-neutral-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-950">
                      {sale.invoiceNumber}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {formatDateTime(
                        sale.completedAt ?? sale.cancelledAt ?? sale.createdAt,
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
                      saleStatusStyles[sale.status],
                    )}
                  >
                    {saleStatusLabels[sale.status]}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
                    <p className="text-xs font-medium text-[var(--muted)]">
                      Total
                    </p>
                    <p className="mt-1 text-base font-semibold text-neutral-950">
                      {formatMoney(sale.totalAmount)}
                    </p>
                    {sale.discountAmount > 0 ? (
                      <p className="mt-1 text-[11px] font-semibold text-red-600">
                        Disc {formatMoney(sale.discountAmount)}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
                    <p className="text-xs font-medium text-[var(--muted)]">
                      Laba
                    </p>
                    <p className="mt-1 text-base font-semibold text-neutral-950">
                      {formatMoney(sale.grossProfit)}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      estimasi
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-2 border-t border-neutral-100 pt-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-xs font-medium text-[var(--muted)]">
                      Outlet
                    </dt>
                    <dd className="min-w-0 text-right font-medium text-neutral-900">
                      <span className="block truncate">{sale.outletName}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-normal uppercase tracking-wide text-[var(--muted)]">
                        {sale.outletCode}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-xs font-medium text-[var(--muted)]">
                      Pelanggan
                    </dt>
                    <dd className="min-w-0 text-right font-medium text-neutral-900">
                      <span className="block truncate">
                        {sale.customerName ?? "Walk-in"}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-xs font-medium text-[var(--muted)]">
                      Item
                    </dt>
                    <dd className="min-w-0 text-right font-medium text-neutral-900">
                      {formatInteger(sale.itemCount)} item ·{" "}
                      {formatGram(sale.weightSoldGram)} gr
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="shrink-0 text-xs font-medium text-[var(--muted)]">
                      Kasir
                    </dt>
                    <dd className="min-w-0 text-right font-medium text-neutral-900">
                      <span className="block truncate">{sale.cashierName}</span>
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex items-start justify-between gap-3 border-t border-neutral-100 pt-3">
                  <p className="shrink-0 text-xs font-medium text-[var(--muted)]">
                    Pembayaran
                  </p>
                  <div className="min-w-0">
                    <PaymentPills methods={sale.paymentMethods} />
                  </div>
                </div>
              </article>
            </Link>
          ))
        )}
      </div>
      {shouldScroll ? (
        <p className="border-t border-neutral-100 px-5 py-3 text-xs text-[var(--muted)] lg:hidden">
          Scroll daftar untuk melihat transaksi laporan lainnya.
        </p>
      ) : null}
    </section>
  );
}

export default async function LaporanPenjualanPage({
  searchParams,
}: PageProps) {
  const auth = await requirePermission("reports.view");
  const params = await searchParams;
  const filters = parseReportSalesFilters(params);
  const data = await getReportSalesData(auth, filters);

  const collectionRate =
    data.summary.grossRevenue > 0
      ? (data.summary.cashRevenue / data.summary.grossRevenue) * 100
      : 0;
  const snapshotMetrics = [
    {
      label: "Semua transaksi di tabel",
      value: formatInteger(data.summary.allTransactionCount),
      helper: "mengikuti filter status/search",
      icon: ReceiptText,
    },
    {
      label: "Cash revenue",
      value: formatMoney(data.summary.cashRevenue),
      helper: `${collectionRate.toFixed(1)}% dari omzet selesai`,
      icon: WalletCards,
    },
    {
      label: "Non-cash revenue",
      value: formatMoney(data.summary.nonCashRevenue),
      helper: "transfer, EDC, QRIS, dan lainnya",
      icon: Banknote,
    },
    {
      label: "Void/refund impact",
      value: formatMoney(data.summary.voidRefundImpact),
      helper: `${formatInteger(data.summary.voidRefundCount)} nota reversal`,
      icon: RotateCcw,
    },
    {
      label: "Rata-rata transaksi",
      value: formatMoney(data.summary.averageTransactionAmount),
      helper: "per nota selesai pada periode ini",
      icon: LineChart,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              <ReceiptText className="size-3.5" />
              Ringkasan Sales Report
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Laporan Penjualan
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Analisa omzet, metode bayar, performa outlet, diskon, laba kotor,
              dan transaksi void/refund. Halaman ini bersifat read-only; aksi
              operasional tetap berada di modul penjualan.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Link
                href={buildSalesReportExportUrl({
                  format: "csv",
                  params: {
                    range: data.filters.range,
                    outletId: data.filters.outletId,
                    q: data.filters.query,
                    status:
                      data.filters.status === "all"
                        ? null
                        : data.filters.status,
                    paymentMethod:
                      data.filters.paymentMethod === "all"
                        ? null
                        : data.filters.paymentMethod,
                  },
                })}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-black px-4 text-sm font-semibold !text-white"
              >
                <Download className="size-4" />
                Export CSV
              </Link>
              <Link
                href={buildSalesReportExportUrl({
                  format: "xlsx",
                  params: {
                    range: data.filters.range,
                    outletId: data.filters.outletId,
                    q: data.filters.query,
                    status:
                      data.filters.status === "all"
                        ? null
                        : data.filters.status,
                    paymentMethod:
                      data.filters.paymentMethod === "all"
                        ? null
                        : data.filters.paymentMethod,
                  },
                })}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-black px-4 text-sm font-semibold !text-white"
              >
                <Download className="size-4" />
                Export XLSX
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 border-t border-neutral-100 pt-5 text-sm sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs font-medium text-[var(--muted)]">
              Periode aktif
            </p>
            <p className="mt-2 font-semibold text-neutral-950">
              {data.period.label}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {data.period.description}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs font-medium text-[var(--muted)]">Outlet</p>
            <p className="mt-2 font-semibold text-neutral-950">
              {data.selectedOutlet
                ? data.selectedOutlet.name
                : "Semua outlet akses saya"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {data.selectedOutlet
                ? data.selectedOutlet.code
                : `${formatInteger(data.outlets.length)} outlet`}
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs font-medium text-[var(--muted)]">
              Filter aktif
            </p>
            <p className="mt-2 font-semibold text-neutral-950">
              {data.filters.status === "all"
                ? "Semua status"
                : saleStatusLabels[data.filters.status]}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {data.filters.paymentMethod === "all"
                ? "Semua metode bayar"
                : paymentMethodLabels[data.filters.paymentMethod]}
            </p>
          </div>
        </div>
      </section>

      <SalesReportFilter data={data} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Omzet selesai"
          value={formatMoney(data.summary.grossRevenue)}
          helper={`${formatInteger(data.summary.completedTransactionCount)} nota selesai pada periode ini`}
          icon={<TrendingUp className="size-5" />}
          tone="dark"
        />
        <StatCard
          title="Item & gramasi"
          value={`${formatInteger(data.summary.itemSold)} item`}
          helper={`${formatGram(data.summary.weightSoldGram)} gram terjual`}
          icon={<Gem className="size-5" />}
          tone="warning"
        />
        <StatCard
          title="Laba kotor estimasi"
          value={formatMoney(data.summary.grossProfit)}
          helper={`Rata-rata nota ${formatMoney(data.summary.averageTransactionAmount)}`}
          icon={<Banknote className="size-5" />}
          tone="success"
        />
        <StatCard
          title="Diskon & reversal"
          value={formatMoney(data.summary.discountAmount)}
          helper={`${formatInteger(data.summary.voidRefundCount)} void/refund · impact ${formatMoney(data.summary.voidRefundImpact)}`}
          icon={<BadgePercent className="size-5" />}
          tone="danger"
        />
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <SalesTrendChart points={data.dailySales} />
        <section className="min-w-0 self-start rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
            <ShoppingBag className="size-3.5" />
            Snapshot sales
          </div>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">
                Kualitas transaksi
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Ringkasan cash/non-cash dan aktivitas transaksi.
              </p>
            </div>
          </div>

          <div className="mt-6 max-h-[292px] overflow-y-auto overscroll-y-contain pr-1 [scrollbar-width:thin]">
            <div className="grid gap-3">
              {snapshotMetrics.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)]">
                          {item.label}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-neutral-950">
                          {item.value}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {item.helper}
                        </p>
                      </div>
                      <span className="grid size-10 place-items-center rounded-xl bg-white text-neutral-500">
                        <Icon className="size-5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <PaymentBreakdown data={data} />
        <StatusBreakdown data={data} />
        <OutletLeaderboard data={data} />
      </div>

      <SalesTable rows={data.sales} />
    </div>
  );
}
