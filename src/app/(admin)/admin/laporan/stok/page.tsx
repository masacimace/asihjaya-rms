import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  History,
  Layers3,
  Package,
  RotateCcw,
  Search,
  Store,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  parseReportStockFilters,
  reportPeriodOptions,
  reportStockMovementOptions,
  type ReportInventoryMovementType,
  type ReportSlowMovingStockRow,
  type ReportStockData,
  type ReportStockMovementRow,
  type ReportStockProductPerformanceRow,
  type ReportStockTrendPoint,
} from "@/features/reports/contracts";
import { getReportStockData } from "@/features/reports/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Laporan Stok",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const movementTypeLabels: Record<ReportInventoryMovementType, string> = {
  goods_receipt: "Barang masuk",
  migration_opening: "Saldo awal migrasi",
  buyback: "Buyback masuk",
  sale: "Terjual",
  sale_return: "Retur penjualan",
  transfer_out: "Transfer keluar",
  transfer_in: "Transfer masuk",
  reservation: "Reservasi",
  reservation_release: "Lepas reservasi",
  adjustment: "Adjustment",
  damaged: "Rusak",
  lost: "Hilang",
  repair_out: "Keluar repair",
  repair_in: "Masuk repair",
  reversal: "Reversal/Void",
};

const movementTypeStyles: Record<ReportInventoryMovementType, string> = {
  goods_receipt: "border-emerald-200 bg-emerald-50 text-emerald-700",
  migration_opening: "border-teal-200 bg-teal-50 text-teal-700",
  buyback: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sale: "border-red-200 bg-red-50 text-red-700",
  sale_return: "border-blue-200 bg-blue-50 text-blue-700",
  transfer_out: "border-orange-200 bg-orange-50 text-orange-700",
  transfer_in: "border-sky-200 bg-sky-50 text-sky-700",
  reservation: "border-amber-200 bg-amber-50 text-amber-700",
  reservation_release: "border-lime-200 bg-lime-50 text-lime-700",
  adjustment: "border-purple-200 bg-purple-50 text-purple-700",
  damaged: "border-rose-200 bg-rose-50 text-rose-700",
  lost: "border-neutral-300 bg-neutral-100 text-neutral-700",
  repair_out: "border-indigo-200 bg-indigo-50 text-indigo-700",
  repair_in: "border-cyan-200 bg-cyan-50 text-cyan-700",
  reversal: "border-violet-200 bg-violet-50 text-violet-700",
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

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: value >= 10_000_000 ? 0 : 1,
    }).format(value / 1_000_000)}Jt`;
  }

  if (value >= 1_000) {
    return `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: value >= 10_000 ? 0 : 1,
    }).format(value / 1_000)}Rb`;
  }

  return formatInteger(value);
}

function getTrendMax(points: ReportStockTrendPoint[]) {
  const maxValue = Math.max(
    ...points.map((point) =>
      Math.max(point.stockInCount, point.stockOutCount, point.returnCount),
    ),
    0,
  );

  return Math.max(maxValue, 4);
}

function buildStockReportUrl(
  params: Record<string, string | null | undefined>,
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });

  const query = searchParams.toString();

  return query ? `/admin/laporan/stok?${query}` : "/admin/laporan/stok";
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
        "min-w-0 overflow-hidden rounded-2xl border p-5",
        tone === "dark"
          ? "border-neutral-800 bg-neutral-950 text-white"
          : "border-[var(--border)] bg-white text-neutral-950",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
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

function StockReportFilter({ data }: { data: ReportStockData }) {
  const activeFilterCount = [
    data.filters.query || null,
    data.filters.outletId,
    data.filters.movementType !== "all" ? data.filters.movementType : null,
    data.filters.range !== "today" ? data.filters.range : null,
  ].filter(Boolean).length;

  const movementLabel =
    reportStockMovementOptions.find(
      (option) => option.value === data.filters.movementType,
    )?.label ?? "Semua movement";

  return (
    <details className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-neutral-50 text-neutral-600">
          <Search className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-950">
              Filter laporan stok
            </p>
            {activeFilterCount > 0 ? (
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                {activeFilterCount} filter aktif
              </span>
            ) : (
              <span className="inline-flex rounded-full border border-[var(--border)] bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
                Opsional
              </span>
            )}
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              {data.period.label}
            </span>
          </div>

          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
            {data.selectedOutlet?.name ?? "Semua outlet"} · {movementLabel}.
            Buka untuk mencari atau mengubah filter.
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-semibold text-neutral-500 sm:inline group-open:hidden">
            Buka filter
          </span>
          <span className="hidden text-xs font-semibold text-neutral-500 sm:group-open:inline">
            Tutup filter
          </span>
          <ChevronDown className="size-4 text-neutral-500 transition-transform duration-200 group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-[var(--border)] p-4 sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[1.35fr_0.85fr_0.85fr_0.85fr_auto] lg:items-end">
          <label className="grid min-w-0 gap-1.5 text-sm font-medium text-neutral-700">
            <span>Cari stok</span>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                name="q"
                defaultValue={data.filters.query}
                placeholder="SKU, barcode, produk, outlet, invoice..."
                className="h-11 w-full min-w-0 rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
              />
            </div>
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-neutral-700">
            <span>Periode</span>
            <select
              name="range"
              defaultValue={data.filters.range}
              className="h-11 min-w-0 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
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
              className="h-11 min-w-0 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
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
            <span>Tipe movement</span>
            <select
              name="movementType"
              defaultValue={data.filters.movementType}
              className="h-11 min-w-0 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
            >
              {reportStockMovementOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <button className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 lg:flex-none">
              Terapkan
            </button>
            {activeFilterCount > 0 ? (
              <Link
                href="/admin/laporan/stok"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Reset
              </Link>
            ) : null}
          </div>
        </form>
      </div>
    </details>
  );
}

function StockTrendChart({ points }: { points: ReportStockTrendPoint[] }) {
  const maxValue = getTrendMax(points);

  return (
    <section className="min-w-0 self-start rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            <TrendingUp className="size-3.5" /> Tren mutasi
          </span>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">
            Pergerakan harian
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Barang masuk, keluar, dan kembali pada periode laporan.
          </p>
        </div>
        <div className="shrink-0 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
          <p className="text-xs font-semibold text-[var(--muted)]">
            Puncak mutasi
          </p>
          <p className="mt-1 font-semibold text-neutral-950">
            {formatInteger(maxValue)} movement
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto pb-3 [scrollbar-width:thin]">
        <div
          className="grid min-w-max gap-3"
          style={{
            gridTemplateColumns: `repeat(${points.length}, minmax(74px, 1fr))`,
          }}
        >
          {points.map((point) => {
            const inHeight = Math.max((point.stockInCount / maxValue) * 132, 8);
            const outHeight = Math.max(
              (point.stockOutCount / maxValue) * 132,
              8,
            );
            const returnHeight = Math.max(
              (point.returnCount / maxValue) * 132,
              8,
            );

            return (
              <div key={point.key} className="min-w-[74px]">
                <div className="flex h-40 items-end justify-center gap-1 rounded-2xl border border-neutral-100 bg-neutral-50 px-2 py-3">
                  <div
                    className="w-3 rounded-full bg-emerald-500"
                    style={{ height: `${inHeight}px` }}
                    title={`Masuk ${point.stockInCount}`}
                  />
                  <div
                    className="w-3 rounded-full bg-neutral-950"
                    style={{ height: `${outHeight}px` }}
                    title={`Keluar ${point.stockOutCount}`}
                  />
                  <div
                    className="w-3 rounded-full bg-blue-500"
                    style={{ height: `${returnHeight}px` }}
                    title={`Kembali ${point.returnCount}`}
                  />
                </div>
                <div className="mt-3 text-center">
                  <p className="text-xs font-semibold text-neutral-900">
                    {formatInteger(
                      point.stockInCount +
                        point.stockOutCount +
                        point.returnCount,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {point.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" /> Masuk
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-neutral-950" /> Keluar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-blue-500" /> Kembali
        </span>
        <span className="sm:hidden">Geser grafik ke kiri atau kanan.</span>
      </div>
    </section>
  );
}

function StockSnapshot({ data }: { data: ReportStockData }) {
  const cards = [
    {
      label: "Movement periode",
      value: formatInteger(data.summary.movementCount),
      helper: "mengikuti filter periode dan outlet",
      icon: <History className="size-5" />,
    },
    {
      label: "Barang masuk",
      value: formatInteger(data.summary.stockInCount),
      helper: "receipt, retur, transfer masuk",
      icon: <ArrowUpRight className="size-5" />,
    },
    {
      label: "Barang keluar",
      value: formatInteger(data.summary.stockOutCount),
      helper: "sale, transfer keluar, rusak/hilang",
      icon: <ArrowDownRight className="size-5" />,
    },
    {
      label: "Kembali/reversal",
      value: formatInteger(data.summary.returnCount),
      helper: "void/refund dan retur penjualan",
      icon: <RotateCcw className="size-5" />,
    },
    {
      label: "Adjustment risiko",
      value: formatInteger(data.summary.adjustmentCount),
      helper: "adjustment, rusak, dan hilang",
      icon: <AlertTriangle className="size-5" />,
    },
  ];

  return (
    <section className="min-w-0 self-start rounded-2xl border border-[var(--border)] bg-white p-5">
      <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
        <Package className="size-3.5" /> Snapshot stok
      </span>
      <h2 className="mt-4 text-lg font-semibold text-neutral-950">
        Kualitas mutasi
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Ringkasan keluar-masuk item fisik berdasarkan inventory ledger.
      </p>

      <div className="mt-5 h-[16rem] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--muted)]">
                {card.label}
              </p>
              <p className="mt-2 text-xl font-semibold text-neutral-950">
                {card.value}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                {card.helper}
              </p>
            </div>
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-neutral-500">
              {card.icon}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-5 text-center">
      <div className="mx-auto grid size-10 place-items-center rounded-xl bg-white text-neutral-400">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-neutral-950">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
        {description}
      </p>
    </div>
  );
}

function InsightCard({
  badge,
  title,
  description,
  children,
}: {
  badge: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="min-w-0">
        {badge}
        <h3 className="mt-3 text-base font-semibold text-neutral-950">
          {title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
          {description}
        </p>
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {children}
      </div>
    </article>
  );
}

function FastMovingCompactList({
  products,
}: {
  products: ReportStockProductPerformanceRow[];
}) {
  if (products.length === 0) {
    return (
      <EmptyState
        icon={<TrendingUp className="size-5" />}
        title="Belum ada produk terjual"
        description="Data fast moving akan muncul setelah ada transaksi selesai."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {products.map((product, index) => (
        <div
          key={product.productId}
          className="min-w-0 overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 p-3"
        >
          <div className="flex min-w-0 flex-col gap-2 min-[430px]:flex-row min-[430px]:items-start min-[430px]:justify-between xl:flex-col 2xl:flex-row">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-emerald-700">
                #{index + 1} · {product.productCode}
              </p>
              <p className="mt-1 line-clamp-2 break-words text-sm font-semibold text-neutral-950">
                {product.productName}
              </p>
              <p className="mt-1 truncate text-[11px] text-[var(--muted)]">
                {product.categoryName}
              </p>
            </div>
            <div className="shrink-0 text-left min-[430px]:text-right xl:text-left 2xl:text-right">
              <p className="text-base font-semibold text-neutral-950">
                {formatInteger(product.soldCount)}
              </p>
              <p className="text-[11px] text-[var(--muted)]">terjual</p>
            </div>
          </div>

          <p className="mt-2 break-words text-[11px] leading-5 text-[var(--muted)]">
            {formatGram(product.soldWeightGram)} g ·{" "}
            {formatMoney(product.revenue)} · sisa{" "}
            {formatInteger(product.availableCount)} item
          </p>
        </div>
      ))}
    </div>
  );
}

function SlowMovingCompactList({
  items,
}: {
  items: ReportSlowMovingStockRow[];
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<TrendingDown className="size-5" />}
        title="Belum ada slow moving"
        description="Item tersedia akan muncul saat inventaris sudah aktif."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <Link
          key={item.itemId}
          href={`/admin/inventaris/item/${item.itemId}`}
          className="block min-w-0 overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 p-3 transition hover:border-[var(--accent)]/40 hover:bg-white"
        >
          <div className="flex min-w-0 flex-col gap-2 min-[430px]:flex-row min-[430px]:items-start min-[430px]:justify-between xl:flex-col 2xl:flex-row">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-[var(--accent)]">
                {item.sku}
              </p>
              <p className="mt-1 line-clamp-2 break-words text-sm font-semibold text-neutral-950">
                {item.productName}
              </p>
              <p className="mt-1 truncate text-[11px] text-[var(--muted)]">
                {item.outletName ?? "Tanpa outlet"} · masuk{" "}
                {formatShortDate(item.createdAt)}
              </p>
            </div>

            <span className="w-fit shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {formatInteger(item.stockAgeDays)} hari
            </span>
          </div>

          <p className="mt-2 break-words text-[11px] leading-5 text-[var(--muted)]">
            {formatGram(item.weightGram)} g · {formatMoney(item.sellingAmount)}{" "}
            · {item.barcode}
          </p>
        </Link>
      ))}
    </div>
  );
}

function StockInsights({ data }: { data: ReportStockData }) {
  const maxOutletItems = Math.max(
    ...data.outletStock.map((row) => row.availableItemCount),
    1,
  );
  const maxCategoryItems = Math.max(
    ...data.categoryStock.map((row) => row.itemCount),
    1,
  );

  return (
    <section
      data-stock-insights-layout="responsive-four-card-grid"
      className="rounded-3xl border border-[var(--border)] bg-white p-3 sm:p-4"
    >
      <div className="px-1 pb-4">
        <h2 className="mt-1 text-lg font-semibold text-neutral-950">
          Insight inventory utama
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
          Distribusi, komposisi, dan indikator pergerakan item dalam satu
          tampilan ringkas.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 [&>article]:md:h-[30rem]">
        <InsightCard
          badge={
            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
              <Store className="size-3.5" /> Stok per outlet
            </span>
          }
          title="Distribusi stok tersedia"
          description="Sebaran item available berdasarkan outlet aktif."
        >
          {data.outletStock.length === 0 ? (
            <EmptyState
              icon={<Store className="size-5" />}
              title="Belum ada stok tersedia"
              description="Distribusi akan muncul setelah item tersedia di outlet."
            />
          ) : (
            <div className="space-y-3">
              {data.outletStock.map((row) => (
                <div key={row.outletId} className="min-w-0">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-neutral-950">
                        {row.outletName}
                      </p>
                      <p className="text-[11px] text-[var(--muted)]">
                        {row.outletCode}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-neutral-950">
                      {formatInteger(row.availableItemCount)} item
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-neutral-950"
                      style={{
                        width: `${Math.max(
                          (row.availableItemCount / maxOutletItems) * 100,
                          4,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 break-words text-[11px] leading-5 text-[var(--muted)]">
                    {formatGram(row.availableWeightGram)} g · modal{" "}
                    {formatMoney(row.availableCostValue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </InsightCard>

        <InsightCard
          badge={
            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
              <Layers3 className="size-3.5" /> Kategori
            </span>
          }
          title="Komposisi kategori stok"
          description="Komposisi item available berdasarkan kategori produk."
        >
          {data.categoryStock.length === 0 ? (
            <EmptyState
              icon={<Layers3 className="size-5" />}
              title="Belum ada kategori stok"
              description="Komposisi kategori akan muncul dari item available."
            />
          ) : (
            <div className="space-y-3">
              {data.categoryStock.map((row) => (
                <div key={row.categoryId} className="min-w-0">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-xs font-semibold text-neutral-950">
                      {row.categoryName}
                    </p>
                    <p className="shrink-0 text-xs font-semibold text-neutral-950">
                      {formatInteger(row.itemCount)} item
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{
                        width: `${Math.max(
                          (row.itemCount / maxCategoryItems) * 100,
                          4,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 break-words text-[11px] leading-5 text-[var(--muted)]">
                    {formatGram(row.weightGram)} g · modal{" "}
                    {formatMoney(row.costValue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </InsightCard>

        <InsightCard
          badge={
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <TrendingUp className="size-3.5" /> Fast moving
            </span>
          }
          title="Produk paling cepat bergerak"
          description="Diurutkan dari jumlah item terjual pada periode laporan."
        >
          <FastMovingCompactList products={data.fastMovingProducts} />
        </InsightCard>

        <InsightCard
          badge={
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              <TrendingDown className="size-3.5" /> Slow moving
            </span>
          }
          title="Item tersedia paling lama"
          description="Kandidat item yang perlu dipantau atau dipindah outlet."
        >
          <SlowMovingCompactList items={data.slowMovingItems} />
        </InsightCard>
      </div>
    </section>
  );
}

function MovementCompactRow({
  movement,
}: {
  movement: ReportStockMovementRow;
}) {
  const targetOutlet =
    movement.toOutletName ?? movement.currentOutletName ?? "-";

  return (
    <article
      data-stock-movement-layout="compact-row-card"
      className="min-w-0 overflow-hidden rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm shadow-neutral-950/[0.02]"
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)]">
            {formatDateTime(movement.occurredAt)}
          </p>
          <Link
            href={`/admin/inventaris/item/${movement.itemId}`}
            className="mt-1 block min-w-0 line-clamp-2 break-words text-sm font-semibold text-neutral-950 transition hover:text-[var(--accent)]"
          >
            {movement.productName}
          </Link>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {movement.sku} · {movement.categoryName}
          </p>
        </div>

        <span
          className={cn(
            "inline-flex w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
            movementTypeStyles[movement.movementType],
          )}
        >
          {movementTypeLabels[movement.movementType]}
        </span>
      </div>

      <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl bg-neutral-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Arah outlet
          </p>
          <p className="mt-1.5 truncate text-xs font-semibold text-neutral-800">
            {movement.fromOutletName ?? "-"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
            → {targetOutlet}
          </p>
        </div>

        <div className="min-w-0 rounded-xl bg-neutral-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Gramasi
          </p>
          <p className="mt-1.5 text-xs font-semibold text-neutral-800">
            {formatGram(movement.weightGram)} g
          </p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
            {formatMoney(movement.sellingAmount)}
          </p>
        </div>

        <div className="min-w-0 rounded-xl bg-neutral-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Operator
          </p>
          <p className="mt-1.5 truncate text-xs font-semibold text-neutral-800">
            {movement.performerName}
          </p>
        </div>

        <div className="min-w-0 rounded-xl bg-neutral-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Referensi
          </p>
          {movement.invoiceNumber && movement.referenceId ? (
            <Link
              href={`/admin/penjualan/${movement.referenceId}`}
              className="mt-1.5 inline-flex max-w-full items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              <span className="truncate">{movement.invoiceNumber}</span>
              <ArrowRight className="size-3 shrink-0" />
            </Link>
          ) : (
            <p className="mt-1.5 truncate text-xs font-semibold text-neutral-800">
              {movement.referenceType ?? "-"}
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 line-clamp-2 break-words text-xs leading-5 text-[var(--muted)]">
        {movement.reason ?? "Tanpa catatan movement."}
      </p>
    </article>
  );
}

function MovementHistory({
  movements,
  refreshHref,
}: {
  movements: ReportStockMovementRow[];
  refreshHref: string;
}) {
  return (
    <details
      data-stock-history-layout="collapsed-compact-history"
      className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-neutral-50 text-neutral-600">
          <History className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-neutral-950">
              Riwayat pergerakan stok
            </p>
            <span className="inline-flex rounded-full border border-[var(--border)] bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
              {formatInteger(movements.length)} movement
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
            Maksimal 80 movement terbaru sesuai filter. Buka untuk melihat
            detail ledger stok.
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-semibold text-neutral-500 sm:inline group-open:hidden">
            Buka riwayat
          </span>
          <span className="hidden text-xs font-semibold text-neutral-500 sm:group-open:inline">
            Tutup riwayat
          </span>
          <ChevronDown className="size-4 text-neutral-500 transition-transform duration-200 group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-[var(--border)] bg-neutral-50/40 p-3 sm:p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Compact ledger berdasarkan filter laporan aktif.
          </p>
        </div>

        {movements.length === 0 ? (
          <EmptyState
            icon={<History className="size-5" />}
            title="Belum ada movement"
            description="Ubah filter untuk melihat movement stok pada periode lain."
          />
        ) : (
          <div className="max-h-[46rem] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {movements.map((movement) => (
              <MovementCompactRow key={movement.id} movement={movement} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export default async function LaporanStokPage({ searchParams }: PageProps) {
  const auth = await requirePermission("reports.view");
  const resolvedSearchParams = await searchParams;
  const filters = parseReportStockFilters(resolvedSearchParams);
  const data = await getReportStockData(auth, filters);

  const refreshHref = buildStockReportUrl({
    range: data.filters.range,
    outletId: data.filters.outletId ?? undefined,
    movementType:
      data.filters.movementType === "all"
        ? undefined
        : data.filters.movementType,
    q: data.filters.query || undefined,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              <Package className="size-3.5" /> Ringkasan Inventory Movement
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Laporan Pergerakan Stok
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Analisa stok jewelry serialized berdasarkan ledger inventory,
              penjualan, retur, void, dan penerimaan barang.
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
            <div className="inline-flex min-w-0 items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <CalendarDays className="size-4 shrink-0 text-[var(--accent)]" />
              <span className="truncate">{data.period.label}</span>
            </div>
            <div className="inline-flex min-w-0 items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <Store className="size-4 shrink-0 text-[var(--accent)]" />
              <span className="truncate">
                {data.selectedOutlet?.name ?? "Semua outlet"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <StockReportFilter data={data} />

      <section className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.75fr)]">
        <StockTrendChart points={data.movementTrend} />
        <StockSnapshot data={data} />
      </section>

      <StockInsights data={data} />

      <MovementHistory movements={data.movements} refreshHref={refreshHref} />
    </div>
  );
}
