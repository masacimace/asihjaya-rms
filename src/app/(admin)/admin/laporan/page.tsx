import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  Banknote,
  Boxes,
  CalendarDays,
  Gem,
  Landmark,
  LineChart,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  reportPeriodOptions,
  parseReportSummaryFilters,
  type ReportComparisonMetric,
  type ReportPaymentMethod,
  type ReportSummaryData,
  type ReportTrendPoint,
} from "@/features/reports/contracts";
import { getReportSummaryData } from "@/features/reports/queries";
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

const saleStatusLabels: Record<
  ReportSummaryData["recentSales"][number]["status"],
  string
> = {
  draft: "Draft",
  awaiting_payment: "Menunggu Bayar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  voided: "Void",
  partially_refunded: "Refund Parsial",
  refunded: "Refund",
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

function buildReportUrl(params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();

  return query ? `/admin/laporan?${query}` : "/admin/laporan";
}

function getComparison(
  metric: ReportComparisonMetric,
  comparisonLabel: string,
) {
  const delta = metric.current - metric.previous;

  if (metric.previous === 0) {
    if (metric.current === 0) {
      return {
        tone: "neutral" as const,
        value: "0%",
        label: `belum ada data ${comparisonLabel.replace("dari ", "")}`,
      };
    }

    return {
      tone: "up" as const,
      value: "Baru",
      label: comparisonLabel,
    };
  }

  const percentage = (delta / metric.previous) * 100;

  if (Math.abs(percentage) < 0.1) {
    return {
      tone: "neutral" as const,
      value: "Stabil",
      label: comparisonLabel,
    };
  }

  return {
    tone: percentage > 0 ? ("up" as const) : ("down" as const),
    value: `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 1,
    }).format(Math.abs(percentage))}%`,
    label: comparisonLabel,
  };
}

function getChartMax(points: ReportTrendPoint[]) {
  const maxValue = Math.max(...points.map((point) => point.revenue), 0);

  if (maxValue <= 0) return 5_000_000;

  const step = maxValue >= 50_000_000 ? 10_000_000 : 5_000_000;

  return Math.ceil(maxValue / step) * step;
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

function MetricCard({
  title,
  value,
  helper,
  comparison,
  icon,
  tone = "default",
}: {
  title: string;
  value: ReactNode;
  helper: string;
  comparison?: ReturnType<typeof getComparison>;
  icon: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "dark";
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
      <div
        className={cn(
          "absolute -right-10 -top-12 size-28 rounded-full opacity-60 blur-3xl",
          tone === "success" && "bg-emerald-100",
          tone === "warning" && "bg-amber-100",
          tone === "danger" && "bg-red-100",
          tone === "dark" && "bg-white/20",
          tone === "default" && "bg-[var(--accent-soft)]",
        )}
      />
      <div className="relative flex items-start justify-between gap-4">
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

      {comparison ? (
        <div
          className={cn(
            "relative mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            comparison.tone === "up" && "bg-emerald-50 text-emerald-700",
            comparison.tone === "down" && "bg-red-50 text-red-700",
            comparison.tone === "neutral" && "bg-neutral-100 text-neutral-600",
          )}
        >
          {comparison.tone === "up" ? (
            <ArrowUpRight className="size-3" />
          ) : null}
          {comparison.tone === "down" ? (
            <ArrowDownRight className="size-3" />
          ) : null}
          {comparison.tone === "neutral" ? (
            <RefreshCw className="size-3" />
          ) : null}
          <span>{comparison.value}</span>
          <span className="font-medium opacity-70">{comparison.label}</span>
        </div>
      ) : null}
    </article>
  );
}

function ReportFilter({ data }: { data: ReportSummaryData }) {
  return (
    <form className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-end">
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
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href="/admin/laporan"
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

function SalesTrendChart({ points }: { points: ReportTrendPoint[] }) {
  const maxValue = getChartMax(points);
  const totalRevenue = points.reduce(
    (total, point) => total + point.revenue,
    0,
  );
  const bestPoint = points.reduce(
    (best, point) => (point.revenue > best.revenue ? point : best),
    points[0] ?? { key: "empty", label: "-", revenue: 0, transactionCount: 0 },
  );
  const shouldScroll = points.length > 6;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            <LineChart className="size-3.5" />
            Tren omzet
          </div>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">
            Penjualan bersih per hari
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Total {formatMoney(totalRevenue)} dari {points.length} bucket
            periode. Hari terbaik: {bestPoint.label}.
          </p>
        </div>
        <Link
          href="/admin/laporan/penjualan"
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Buka laporan penjualan
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {shouldScroll ? (
        <p className="mt-5 text-xs font-medium text-[var(--muted)] sm:hidden">
          Geser grafik ke kiri atau kanan untuk melihat semua periode.
        </p>
      ) : null}

      <div className="-mx-2 mt-6 max-w-full overflow-x-auto overscroll-x-contain px-2 pb-3">
        <div className="flex min-w-max items-end gap-3 border-b border-neutral-100 pb-2 sm:min-w-full">
          {points.map((point) => {
            const height = Math.max(
              10,
              Math.round((point.revenue / maxValue) * 132),
            );

            return (
              <div
                key={point.key}
                className="group flex w-16 shrink-0 flex-col items-center sm:w-auto sm:min-w-16 sm:flex-1"
              >
                <div className="relative flex h-40 w-full items-end justify-center overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 px-2 py-2">
                  <div className="pointer-events-none absolute left-1/2 top-2 z-10 w-max -translate-x-1/2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center text-xs opacity-0 transition group-hover:opacity-100">
                    <p className="font-semibold text-neutral-950">
                      {formatMoney(point.revenue)}
                    </p>
                    <p className="mt-0.5 text-neutral-500">
                      {formatInteger(point.transactionCount)} nota
                    </p>
                  </div>
                  <div
                    className={cn(
                      "w-full max-w-12 rounded-xl transition",
                      point.revenue > 0
                        ? "bg-[var(--accent)]"
                        : "bg-neutral-200",
                    )}
                    style={{ height }}
                  />
                </div>
                <p className="mt-3 text-center text-[11px] font-medium text-neutral-500">
                  {point.label}
                </p>
                <p className="mt-1 text-center text-[11px] font-semibold text-neutral-800">
                  {formatCompactMoney(point.revenue)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PaymentBreakdown({ data }: { data: ReportSummaryData }) {
  const total = data.paymentBreakdown.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <WalletCards className="size-3.5" />
            Pembayaran
          </div>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">
            Metode bayar
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Breakdown dari transaksi selesai.
          </p>
        </div>
        <p className="text-right text-sm font-semibold text-neutral-950">
          {formatMoney(total)}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {data.paymentBreakdown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-[var(--muted)]">
            Belum ada pembayaran pada periode ini.
          </p>
        ) : (
          data.paymentBreakdown.map((row) => {
            const percentage =
              total > 0 ? Math.round((row.amount / total) * 100) : 0;

            return (
              <div key={row.method}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {paymentMethodLabels[row.method]}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatInteger(row.transactionCount)} pembayaran
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-neutral-950">
                      {formatMoney(row.amount)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{percentage}%</p>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-neutral-950"
                    style={{ width: `${percentage}%` }}
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

function OutletPerformance({ data }: { data: ReportSummaryData }) {
  const maxRevenue = Math.max(
    ...data.outletPerformance.map((outlet) => outlet.revenue),
    0,
  );

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Store className="size-3.5" />
            Outlet
          </div>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">
            Performa outlet
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ranking omzet berdasarkan akses outlet user.
          </p>
        </div>
        <Link
          href="/admin/laporan/penjualan"
          className="text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Detail
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        {data.outletPerformance.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-[var(--muted)]">
            Belum ada transaksi selesai pada periode ini.
          </p>
        ) : (
          data.outletPerformance.map((outlet, index) => {
            const percentage =
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
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${percentage}%` }}
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

function OperationalSnapshot({ data }: { data: ReportSummaryData }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        <ShieldCheck className="size-3.5" />
        Kontrol operasional
      </div>
      <h2 className="mt-4 text-lg font-semibold text-neutral-950">
        Status hari ini
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Snapshot cepat dari shift, approval, stok, dan retur.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          {
            label: "Shift aktif",
            value: formatInteger(data.summary.activeShiftCount),
            icon: Landmark,
            href: "/admin/operasional/shift",
          },
          {
            label: "Approval pending",
            value: formatInteger(data.summary.pendingApprovalCount),
            icon: ShieldCheck,
            href: "/admin/operasional/approval",
          },
          {
            label: "Stok tersedia",
            value: formatInteger(data.summary.availableStockCount),
            icon: Boxes,
            href: "/admin/inventaris",
          },
          {
            label: "Item kembali",
            value: formatInteger(data.summary.stockReturnCount),
            icon: PackageCheck,
            href: "/admin/laporan/stok",
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="group rounded-2xl border border-neutral-100 bg-neutral-50 p-4 transition hover:border-neutral-200 hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[var(--muted)]">
                    {item.label}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-neutral-950">
                    {item.value}
                  </p>
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-white text-neutral-500 transition group-hover:text-neutral-950">
                  <Icon className="size-5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function CashSnapshot({ data }: { data: ReportSummaryData }) {
  const rows = [
    {
      label: "Cash sale",
      value: data.cashSnapshot.cashSales,
      tone: "text-emerald-700",
    },
    {
      label: "Refund cash",
      value: -data.cashSnapshot.cashRefunds,
      tone: "text-red-700",
    },
    {
      label: "Kas masuk manual",
      value: data.cashSnapshot.manualCashIn,
      tone: "text-emerald-700",
    },
    {
      label: "Kas keluar manual",
      value: -data.cashSnapshot.manualCashOut,
      tone: "text-red-700",
    },
    {
      label: "Koreksi closing",
      value: data.cashSnapshot.closingAdjustments,
      tone: "text-amber-700",
    },
  ];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
            <Banknote className="size-3.5" />
            Arus kas
          </div>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">
            Net cash movement
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Pergerakan kas pada periode terpilih.
          </p>
        </div>
        <p
          className={cn(
            "text-right text-sm font-semibold",
            data.cashSnapshot.netCashMovement >= 0
              ? "text-emerald-700"
              : "text-red-700",
          )}
        >
          {formatMoney(data.cashSnapshot.netCashMovement)}
        </p>
      </div>

      <div className="mt-6 divide-y divide-neutral-100 rounded-2xl border border-neutral-100 bg-neutral-50">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
          >
            <span className="text-[var(--muted)]">{row.label}</span>
            <span className={cn("font-semibold", row.tone)}>
              {formatMoney(row.value)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentSales({ data }: { data: ReportSummaryData }) {
  const shouldScroll = data.recentSales.length >= 5;
  const tableGridClass = "grid grid-cols-[1.25fr_0.9fr_1fr_1fr_0.75fr_0.85fr]";

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5 lg:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
            <ReceiptText className="size-3.5" />
            Transaksi terbaru
          </div>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">
            Aktivitas transaksi periode ini
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ringkasan cepat untuk membuka detail nota dari laporan.
          </p>
        </div>
        <Link
          href="/admin/penjualan"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline"
        >
          Buka penjualan
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {data.recentSales.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-[var(--muted)]">
          Belum ada transaksi pada periode ini.
        </div>
      ) : (
        <>
          {shouldScroll ? (
            <p className="mt-4 text-xs font-medium text-[var(--muted)]">
              Scroll daftar untuk melihat aktivitas transaksi lainnya.
            </p>
          ) : null}

          <div className="mt-3 hidden overflow-hidden rounded-2xl border border-neutral-100 lg:block">
            <div
              className={cn(
                tableGridClass,
                "border-b border-neutral-100 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500",
              )}
            >
              <div className="px-4 py-3 font-semibold">Invoice</div>
              <div className="px-4 py-3 font-semibold">Outlet</div>
              <div className="px-4 py-3 font-semibold">Pelanggan</div>
              <div className="px-4 py-3 font-semibold">Kasir</div>
              <div className="px-4 py-3 font-semibold">Status</div>
              <div className="px-4 py-3 text-right font-semibold">Total</div>
            </div>
            <div
              className={cn(
                "divide-y divide-neutral-100 bg-white",
                shouldScroll &&
                  "max-h-[24rem] overflow-y-auto overscroll-contain",
              )}
            >
              {data.recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className={cn(
                    tableGridClass,
                    "items-center text-sm transition hover:bg-neutral-50",
                  )}
                >
                  <div className="min-w-0 px-4 py-4">
                    <Link
                      href={`/admin/penjualan/${sale.id}`}
                      className="truncate font-semibold text-[var(--accent)] hover:underline"
                    >
                      {sale.invoiceNumber}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {formatDateTime(sale.completedAt ?? sale.createdAt)}
                    </p>
                  </div>
                  <div className="min-w-0 px-4 py-4 text-neutral-700">
                    <span className="block truncate">{sale.outletName}</span>
                  </div>
                  <div className="min-w-0 px-4 py-4 text-neutral-700">
                    <span className="block truncate">
                      {sale.customerName ?? "Walk-in"}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 text-neutral-700">
                    <span className="block truncate">{sale.cashierName}</span>
                  </div>
                  <div className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        sale.status === "completed" &&
                          "bg-emerald-50 text-emerald-700",
                        (sale.status === "voided" ||
                          sale.status === "refunded") &&
                          "bg-red-50 text-red-700",
                        sale.status !== "completed" &&
                          sale.status !== "voided" &&
                          sale.status !== "refunded" &&
                          "bg-neutral-100 text-neutral-600",
                      )}
                    >
                      {saleStatusLabels[sale.status]}
                    </span>
                  </div>
                  <div className="px-4 py-4 text-right font-semibold text-neutral-950">
                    {formatMoney(sale.totalAmount)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "mt-3 divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 lg:hidden",
              shouldScroll &&
                "max-h-[28rem] overflow-y-auto overscroll-contain",
            )}
          >
            {data.recentSales.map((sale) => (
              <Link
                key={sale.id}
                href={`/admin/penjualan/${sale.id}`}
                className="block bg-white p-4 transition hover:bg-neutral-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--accent)]">
                      {sale.invoiceNumber}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {sale.outletName} · {sale.customerName ?? "Walk-in"}
                    </p>
                  </div>
                  <p className="text-right text-sm font-semibold text-neutral-950">
                    {formatMoney(sale.totalAmount)}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                  <span>
                    {formatDateTime(sale.completedAt ?? sale.createdAt)}
                  </span>
                  <span>{saleStatusLabels[sale.status]}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default async function LaporanDashboardPage({
  searchParams,
}: PageProps) {
  const auth = await requirePermission("admin.access");
  const query = await searchParams;
  const filters = parseReportSummaryFilters(query);
  const data = await getReportSummaryData(auth, filters);

  const revenueComparison = getComparison(
    data.summary.revenue,
    data.period.comparisonLabel,
  );
  const transactionComparison = getComparison(
    data.summary.transactionCount,
    data.period.comparisonLabel,
  );
  const weightComparison = getComparison(
    data.summary.weightSoldGram,
    data.period.comparisonLabel,
  );
  const profitComparison = getComparison(
    data.summary.grossProfit,
    data.period.comparisonLabel,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                <TrendingUp className="size-3.5" />
                Ringkasan Laporan Outlet
              </span>
              <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                {data.period.label}
              </span>
              {data.selectedOutlet ? (
                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {data.selectedOutlet.name}
                </span>
              ) : null}
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Executive snapshot performa toko
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {data.period.description} Data di halaman ini hanya untuk analisa
              dan tidak memiliki aksi operasional seperti input kas, edit stok,
              atau void/refund transaksi.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Quick actions
            </p>
            <div className="mt-3 grid gap-2">
              <Link
                href={buildReportUrl({
                  range: "today",
                  outletId: data.filters.outletId,
                })}
                className="inline-flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:text-neutral-950"
              >
                Hari ini
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href={buildReportUrl({
                  range: "last7",
                  outletId: data.filters.outletId,
                })}
                className="inline-flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:text-neutral-950"
              >
                7 hari terakhir
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ReportFilter data={data} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Omzet bersih"
          value={formatMoney(data.summary.revenue.current)}
          helper={`${formatInteger(data.summary.transactionCount.current)} nota selesai`}
          comparison={revenueComparison}
          icon={<TrendingUp className="size-5" />}
          tone="dark"
        />
        <MetricCard
          title="Gramasi terjual"
          value={`${formatGram(data.summary.weightSoldGram.current)} gr`}
          helper={`${formatInteger(data.summary.itemSold.current)} item jewelry`}
          comparison={weightComparison}
          icon={<Gem className="size-5" />}
          tone="warning"
        />
        <MetricCard
          title="Laba kotor estimasi"
          value={formatMoney(data.summary.grossProfit.current)}
          helper="Berdasarkan final price - harga modal item"
          comparison={profitComparison}
          icon={<LineChart className="size-5" />}
          tone="success"
        />
        <MetricCard
          title="Rata-rata transaksi"
          value={formatMoney(data.summary.averageTransactionAmount.current)}
          helper={`Diskon periode: ${formatMoney(data.summary.discountAmount.current)}`}
          comparison={transactionComparison}
          icon={<ShoppingBag className="size-5" />}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Void/refund impact"
          value={formatMoney(data.summary.voidRefundImpact)}
          helper={`${formatInteger(data.summary.voidRefundCount)} transaksi sudah dibatalkan/refund`}
          icon={<TrendingDown className="size-5" />}
          tone="danger"
        />
        <MetricCard
          title="Total diskon"
          value={formatMoney(data.summary.discountAmount.current)}
          helper="Diskon approved dan tersimpan di transaksi"
          icon={<BadgePercent className="size-5" />}
        />
        <MetricCard
          title="Net cash movement"
          value={formatMoney(data.cashSnapshot.netCashMovement)}
          helper="Cash sale + kas masuk - refund/kas keluar"
          icon={<Banknote className="size-5" />}
          tone={data.cashSnapshot.netCashMovement < 0 ? "danger" : "success"}
        />
        <MetricCard
          title="Stok tersedia"
          value={formatInteger(data.summary.availableStockCount)}
          helper={`${formatInteger(data.summary.stockReturnCount)} item kembali pada periode ini`}
          icon={<Boxes className="size-5" />}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <SalesTrendChart points={data.salesTrend} />
        <PaymentBreakdown data={data} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <OutletPerformance data={data} />
        <OperationalSnapshot data={data} />
        <CashSnapshot data={data} />
      </div>

      <RecentSales data={data} />
    </div>
  );
}
