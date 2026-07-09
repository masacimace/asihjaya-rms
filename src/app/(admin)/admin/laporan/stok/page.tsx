import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  Download,
  Gem,
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const movementTypeLabels: Record<ReportInventoryMovementType, string> = {
  goods_receipt: "Barang masuk",
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
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();

  return query ? `/admin/laporan/stok?${query}` : "/admin/laporan/stok";
}

function buildStockReportExportUrl({
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
      ? "/admin/laporan/stok/export/xlsx"
      : "/admin/laporan/stok/export";
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

function StockReportFilter({ data }: { data: ReportStockData }) {
  return (
    <form className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.85fr_0.85fr_0.85fr_auto] lg:items-end">
        <label className="grid gap-1.5 text-sm font-medium text-neutral-700">
          <span>Cari stok</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              name="q"
              defaultValue={data.filters.query}
              placeholder="SKU, barcode, produk, outlet, invoice..."
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
          <span>Tipe movement</span>
          <select
            name="movementType"
            defaultValue={data.filters.movementType}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
          >
            {reportStockMovementOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button className="inline-flex h-11 items-center justify-center rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800">
          Terapkan
        </button>
      </div>
    </form>
  );
}

function StockTrendChart({ points }: { points: ReportStockTrendPoint[] }) {
  const maxValue = getTrendMax(points);

  return (
    <section className="self-start rounded-2xl border border-[var(--border)] bg-white p-5 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            <BarChartIcon /> Tren mutasi
          </span>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">
            Pergerakan harian
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Barang masuk, keluar, dan kembali pada periode laporan.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
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

function BarChartIcon() {
  return <TrendingUp className="size-3.5" />;
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
    <section className="self-start rounded-2xl border border-[var(--border)] bg-white p-5 min-w-0">
      <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
        <Package className="size-3.5" /> Snapshot stok
      </span>
      <h2 className="mt-4 text-lg font-semibold text-neutral-950">
        Kualitas mutasi
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Ringkasan keluar-masuk item fisik berdasarkan inventory ledger.
      </p>

      <div className="mt-5 max-h-[16rem] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
          >
            <div>
              <p className="text-xs font-semibold text-[var(--muted)]">
                {card.label}
              </p>
              <p className="mt-2 text-xl font-semibold text-neutral-950">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">{card.helper}</p>
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

function FastMovingList({
  products,
}: {
  products: ReportStockProductPerformanceRow[];
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <TrendingUp className="size-3.5" /> Fast moving
          </span>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">
            Produk paling cepat bergerak
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Diurutkan dari jumlah item terjual pada periode laporan.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {products.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="size-5" />}
            title="Belum ada produk terjual"
            description="Data fast moving akan muncul setelah ada transaksi selesai pada periode ini."
          />
        ) : (
          products.map((product, index) => (
            <div
              key={product.productId}
              className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--accent)]">
                    #{index + 1} · {product.productCode}
                  </p>
                  <p className="mt-1 truncate font-semibold text-neutral-950">
                    {product.productName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {product.categoryName} · tersedia{" "}
                    {formatInteger(product.availableCount)} item
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-neutral-950">
                    {formatInteger(product.soldCount)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">terjual</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <MetricPill
                  label="Gramasi"
                  value={`${formatGram(product.soldWeightGram)} g`}
                />
                <MetricPill
                  label="Revenue"
                  value={formatMoney(product.revenue)}
                />
                <MetricPill
                  label="Sisa"
                  value={`${formatInteger(product.availableCount)} item`}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SlowMovingList({ items }: { items: ReportSlowMovingStockRow[] }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        <TrendingDown className="size-3.5" /> Slow moving
      </span>
      <h2 className="mt-4 text-lg font-semibold text-neutral-950">
        Item tersedia paling lama
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Kandidat item yang perlu dipantau, dipromosikan, atau dipindah outlet.
      </p>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <EmptyState
            icon={<TrendingDown className="size-5" />}
            title="Belum ada slow moving"
            description="Item tersedia akan muncul di sini saat inventaris sudah aktif."
          />
        ) : (
          items.map((item) => (
            <Link
              key={item.itemId}
              href={`/admin/inventaris/item/${item.itemId}`}
              className="block rounded-2xl border border-neutral-100 bg-neutral-50 p-4 transition hover:border-[var(--accent)]/40 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--accent)]">
                    {item.sku}
                  </p>
                  <p className="mt-1 truncate font-semibold text-neutral-950">
                    {item.productName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item.outletName ?? "Tanpa outlet"} · masuk{" "}
                    {formatShortDate(item.createdAt)}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-right">
                  <p className="font-semibold text-amber-800">
                    {formatInteger(item.stockAgeDays)} hari
                  </p>
                  <p className="text-[11px] text-amber-700">tersedia</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                <MetricPill label="Barcode" value={item.barcode} />
                <MetricPill
                  label="Gramasi"
                  value={`${formatGram(item.weightGram)} g`}
                />
                <MetricPill
                  label="Harga label"
                  value={formatMoney(item.sellingAmount)}
                />
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 truncate font-semibold text-neutral-950">{value}</p>
    </div>
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
    <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-neutral-400">
        {icon}
      </div>
      <p className="mt-3 font-semibold text-neutral-950">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
}

function StockDistribution({ data }: { data: ReportStockData }) {
  const maxOutletItems = Math.max(
    ...data.outletStock.map((row) => row.availableItemCount),
    1,
  );
  const maxCategoryItems = Math.max(
    ...data.categoryStock.map((row) => row.itemCount),
    1,
  );

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
          <Store className="size-3.5" /> Stok per outlet
        </span>
        <h2 className="mt-4 text-lg font-semibold text-neutral-950">
          Distribusi stok tersedia
        </h2>
        <div className="mt-5 space-y-4">
          {data.outletStock.length === 0 ? (
            <EmptyState
              icon={<Store className="size-5" />}
              title="Belum ada stok tersedia"
              description="Distribusi outlet akan muncul setelah item tersedia di outlet."
            />
          ) : (
            data.outletStock.map((row) => (
              <div key={row.outletId}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-950">
                      {row.outletName}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {row.outletCode}
                    </p>
                  </div>
                  <p className="font-semibold text-neutral-950">
                    {formatInteger(row.availableItemCount)} item
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-neutral-950"
                    style={{
                      width: `${Math.max((row.availableItemCount / maxOutletItems) * 100, 4)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {formatGram(row.availableWeightGram)} g · modal{" "}
                  {formatMoney(row.availableCostValue)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
          <Layers3 className="size-3.5" /> Kategori
        </span>
        <h2 className="mt-4 text-lg font-semibold text-neutral-950">
          Komposisi kategori stok
        </h2>
        <div className="mt-5 space-y-4">
          {data.categoryStock.length === 0 ? (
            <EmptyState
              icon={<Layers3 className="size-5" />}
              title="Belum ada kategori stok"
              description="Komposisi kategori akan muncul dari item available."
            />
          ) : (
            data.categoryStock.map((row) => (
              <div key={row.categoryId}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <p className="truncate font-semibold text-neutral-950">
                    {row.categoryName}
                  </p>
                  <p className="font-semibold text-neutral-950">
                    {formatInteger(row.itemCount)} item
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{
                      width: `${Math.max((row.itemCount / maxCategoryItems) * 100, 4)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {formatGram(row.weightGram)} g · modal{" "}
                  {formatMoney(row.costValue)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function MovementTable({ movements }: { movements: ReportStockMovementRow[] }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
            <History className="size-3.5" /> Ledger stok
          </span>
          <h2 className="mt-4 text-lg font-semibold text-neutral-950">
            Riwayat pergerakan stok
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Maksimal 80 movement terbaru sesuai filter laporan.
          </p>
        </div>
      </div>

      <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-neutral-100 lg:block">
        <table className="min-w-full divide-y divide-neutral-100 text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Movement</th>
              <th className="px-4 py-3">Arah outlet</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Gramasi</th>
              <th className="px-4 py-3">Operator</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {movements.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-[var(--muted)]"
                >
                  Belum ada movement sesuai filter.
                </td>
              </tr>
            ) : (
              movements.map((movement) => (
                <tr key={movement.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-4 text-neutral-700">
                    {formatDateTime(movement.occurredAt)}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/inventaris/item/${movement.itemId}`}
                      className="font-semibold text-neutral-950 hover:text-[var(--accent)]"
                    >
                      {movement.productName}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {movement.sku} · {movement.categoryName}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                        movementTypeStyles[movement.movementType],
                      )}
                    >
                      {movementTypeLabels[movement.movementType]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-neutral-700">
                    <p>{movement.fromOutletName ?? "-"}</p>
                    <p className="text-xs text-[var(--muted)]">
                      →{" "}
                      {movement.toOutletName ??
                        movement.currentOutletName ??
                        "-"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-neutral-700">
                    {movement.invoiceNumber ? (
                      <Link
                        href={`/admin/penjualan/${movement.referenceId}`}
                        className="font-semibold text-[var(--accent)] hover:underline"
                      >
                        {movement.invoiceNumber}
                      </Link>
                    ) : (
                      <span>{movement.referenceType ?? "-"}</span>
                    )}
                    <p className="mt-1 max-w-[16rem] truncate text-xs text-[var(--muted)]">
                      {movement.reason ?? "Tanpa catatan"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-neutral-950">
                    {formatGram(movement.weightGram)} g
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-neutral-700">
                    {movement.performerName}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 space-y-3 lg:hidden">
        {movements.length === 0 ? (
          <EmptyState
            icon={<History className="size-5" />}
            title="Belum ada movement"
            description="Ubah filter untuk melihat movement stok pada periode lain."
          />
        ) : (
          movements.map((movement) => (
            <article
              key={movement.id}
              className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--muted)]">
                    {formatDateTime(movement.occurredAt)}
                  </p>
                  <Link
                    href={`/admin/inventaris/item/${movement.itemId}`}
                    className="mt-1 block truncate font-semibold text-neutral-950 hover:text-[var(--accent)]"
                  >
                    {movement.productName}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {movement.sku} · {movement.categoryName}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
                    movementTypeStyles[movement.movementType],
                  )}
                >
                  {movementTypeLabels[movement.movementType]}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <MetricPill
                  label="Outlet"
                  value={`${movement.fromOutletName ?? "-"} → ${movement.toOutletName ?? movement.currentOutletName ?? "-"}`}
                />
                <MetricPill
                  label="Gramasi"
                  value={`${formatGram(movement.weightGram)} g`}
                />
                <MetricPill label="Operator" value={movement.performerName} />
                <MetricPill
                  label="Ref"
                  value={
                    movement.invoiceNumber ?? movement.referenceType ?? "-"
                  }
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                {movement.reason ?? "Tanpa catatan movement."}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default async function LaporanStokPage({ searchParams }: PageProps) {
  const auth = await requirePermission("reports.view");
  const resolvedSearchParams = await searchParams;
  const filters = parseReportStockFilters(resolvedSearchParams);
  const data = await getReportStockData(auth, filters);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
              <Package className="size-3.5" /> Real-data inventory movement
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Laporan Pergerakan Stok
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Analisa stok jewelry serialized berdasarkan ledger inventory,
              penjualan, retur, void, dan penerimaan barang.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <CalendarDays className="size-4 text-[var(--accent)]" />
              {data.period.label}
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <Store className="size-4 text-[var(--accent)]" />
              {data.selectedOutlet?.name ?? "Semua outlet"}
            </div>
            <Link
              href={buildStockReportExportUrl({
                format: "csv",
                params: {
                  range: data.filters.range,
                  outletId: data.filters.outletId,
                  q: data.filters.query,
                  movementType:
                    data.filters.movementType === "all"
                      ? null
                      : data.filters.movementType,
                },
              })}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              <Download className="size-4" /> CSV
            </Link>
            <Link
              href={buildStockReportExportUrl({
                format: "xlsx",
                params: {
                  range: data.filters.range,
                  outletId: data.filters.outletId,
                  q: data.filters.query,
                  movementType:
                    data.filters.movementType === "all"
                      ? null
                      : data.filters.movementType,
                },
              })}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              <Download className="size-4" /> XLSX
            </Link>
          </div>
        </div>
      </section>

      <StockReportFilter data={data} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Stok tersedia"
          value={`${formatInteger(data.summary.availableItemCount)} item`}
          helper={`${formatGram(data.summary.availableWeightGram)} gram aktif di outlet`}
          icon={<Boxes className="size-5" />}
          tone="dark"
        />
        <StatCard
          title="Nilai inventory"
          value={formatCompactNumber(data.summary.availableCostValue)}
          helper="estimasi berdasarkan harga modal item tersedia"
          icon={<Gem className="size-5" />}
          tone="default"
        />
        <StatCard
          title="Item terjual"
          value={formatInteger(data.summary.saleCount)}
          helper="movement sale pada periode laporan"
          icon={<ArrowDownRight className="size-5" />}
          tone="danger"
        />
        <StatCard
          title="Item kembali"
          value={formatInteger(data.summary.returnCount)}
          helper="sale return/reversal dari void atau refund"
          icon={<RotateCcw className="size-5" />}
          tone="success"
        />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.75fr)]">
        <StockTrendChart points={data.movementTrend} />
        <StockSnapshot data={data} />
      </section>

      <StockDistribution data={data} />

      <section className="grid gap-4 xl:grid-cols-2">
        <FastMovingList products={data.fastMovingProducts} />
        <SlowMovingList items={data.slowMovingItems} />
      </section>

      <MovementTable movements={data.movements} />

      <div className="flex justify-end">
        <Link
          href={buildStockReportUrl({
            range: data.filters.range,
            outletId: data.filters.outletId ?? undefined,
            movementType:
              data.filters.movementType === "all"
                ? undefined
                : data.filters.movementType,
            q: data.filters.query || undefined,
          })}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
        >
          Refresh laporan <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
