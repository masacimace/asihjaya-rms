import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  Download,
  Filter,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import {
  adminPaymentMethods,
  adminSaleStatuses,
  adminSalesDateRanges,
  parseAdminSalesFilters,
  type AdminPaymentMethod,
  type AdminSalePrintStatus,
  type AdminSaleStatus,
  type AdminSalesDateRange,
  type AdminSalesFilters,
} from "@/features/sales/admin-contracts";
import { getAdminSalesListData } from "@/features/sales/admin-queries";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/lib/auth/session";

export const runtime = "nodejs";

const saleStatusLabels: Record<AdminSaleStatus, string> = {
  draft: "Draft",
  awaiting_payment: "Menunggu Bayar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  voided: "Void",
  partially_refunded: "Refund Parsial",
  refunded: "Refund",
};

const paymentMethodLabels: Record<AdminPaymentMethod, string> = {
  cash: "Cash",
  debit_card: "Debit",
  credit_card: "Credit",
  bank_transfer: "Transfer",
  qris_manual: "QRIS Manual",
  qris_gateway: "QRIS Gateway",
  other: "Lainnya",
};

const dateRangeLabels: Record<AdminSalesDateRange, string> = {
  today: "Hari ini",
  yesterday: "Kemarin",
  last7: "7 hari terakhir",
  last30: "30 hari terakhir",
  thisMonth: "Bulan ini",
  all: "Semua waktu",
};

const printStatusLabels: Record<AdminSalePrintStatus, string> = {
  not_queued: "Belum dicetak",
  pending: "Print pending",
  claimed: "Diklaim agent",
  printing: "Sedang print",
  completed: "Print selesai",
  failed: "Print gagal",
  cancelled: "Print batal",
};

function getSaleStatusClass(status: AdminSaleStatus) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "awaiting_payment" || status === "partially_refunded") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "voided" || status === "refunded") {
    return "bg-red-50 text-red-700";
  }

  return "bg-neutral-100 text-neutral-600";
}

function getPrintStatusClass(status: AdminSalePrintStatus) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "failed") {
    return "bg-red-50 text-red-700";
  }

  if (status === "pending" || status === "claimed" || status === "printing") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-neutral-100 text-neutral-600";
}

function formatMoney(value: number | string | null) {
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

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function buildAdminSalesListUrl(page: number, filters: AdminSalesFilters) {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.outletId) params.set("outletId", filters.outletId);
  if (filters.status) params.set("status", filters.status);
  if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
  if (filters.dateRange !== "today") params.set("range", filters.dateRange);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();

  return query ? `/admin/penjualan?${query}` : "/admin/penjualan";
}

function getPaymentMethodLabel(methods: AdminPaymentMethod[]) {
  if (methods.length === 0) {
    return "Belum bayar";
  }

  if (methods.length === 1) {
    return paymentMethodLabels[methods[0] ?? "other"];
  }

  return `Split: ${methods.map((method) => paymentMethodLabels[method]).join(" + ")}`;
}

export default async function PenjualanListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requirePermission("sales.view");
  const filters = parseAdminSalesFilters(await searchParams);
  const data = await getAdminSalesListData(auth, filters);
  const isFiltered = Boolean(
    filters.search ||
      filters.outletId ||
      filters.status ||
      filters.paymentMethod ||
      filters.dateRange !== "today",
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">
            Sales Audit Center
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Riwayat Penjualan
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Pantau transaksi POS real dari outlet yang bisa kamu akses, termasuk
            customer, kasir, item terjual, metode pembayaran, dan status dokumen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildAdminSalesListUrl(data.page, data.filters)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Link>
          <button
            type="button"
            disabled
            className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-neutral-50 px-4 text-sm font-medium text-neutral-400"
            title="Masuk scope ADMIN-R3B"
          >
            <Download className="size-4" />
            Export R3B
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <ReceiptText className="size-5 text-[var(--accent)]" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {formatMoney(data.summary.totalAmount)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Total penjualan {data.period.label.toLowerCase()}
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <ShoppingBag className="size-5 text-violet-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {formatInteger(data.summary.totalTransactions)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Transaksi cocok filter
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <WalletCards className="size-5 text-blue-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {formatMoney(data.summary.averageTransactionAmount)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Rata-rata transaksi
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Store className="size-5 text-emerald-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {formatMoney(data.summary.cashAmount)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Pembayaran cash</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <CreditCard className="size-5 text-amber-600" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {formatMoney(data.summary.nonCashAmount)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Non-cash payment</p>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <form className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_180px_180px_190px_170px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)]">
            <Search className="size-4 shrink-0 text-neutral-400" />
            <input
              name="q"
              type="search"
              defaultValue={filters.search}
              placeholder="Cari invoice, customer, SKU, barcode, kasir..."
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
            />
          </label>

          <select
            name="range"
            defaultValue={filters.dateRange}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            {adminSalesDateRanges.map((range) => (
              <option key={range} value={range}>
                {dateRangeLabels[range]}
              </option>
            ))}
          </select>

          <select
            name="outletId"
            defaultValue={filters.outletId ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua outlet</option>
            {data.outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>

          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua status</option>
            {adminSaleStatuses.map((status) => (
              <option key={status} value={status}>
                {saleStatusLabels[status]}
              </option>
            ))}
          </select>

          <select
            name="paymentMethod"
            defaultValue={filters.paymentMethod ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua payment</option>
            {adminPaymentMethods.map((method) => (
              <option key={method} value={method}>
                {paymentMethodLabels[method]}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Filter className="size-4" />
              Terapkan
            </button>
            {isFiltered ? (
              <Link
                href="/admin/penjualan"
                className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
              >
                Reset
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-2 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-950">
              Transaksi POS Real Data
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {formatInteger(data.total)} transaksi ditemukan, {formatInteger(data.summary.totalItems)} item terjual.
            </p>
          </div>
          <p className="inline-flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            <CalendarDays className="size-4" />
            Periode: {data.period.label}
          </p>
        </div>

        {data.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-neutral-600">
              <thead className="border-b border-[var(--border)] bg-neutral-50/70 text-xs text-neutral-500">
                <tr>
                  <th className="whitespace-nowrap px-5 py-4 font-medium">
                    Invoice & Waktu
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 font-medium">
                    Customer
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 font-medium">
                    Outlet & Kasir
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 font-medium">
                    Item
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 font-medium">
                    Payment
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 text-right font-medium">
                    Total
                  </th>
                  <th className="whitespace-nowrap px-5 py-4 font-medium">
                    Status
                  </th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.rows.map((sale) => (
                  <tr key={sale.id} className="transition-colors hover:bg-neutral-50/60">
                    <td className="whitespace-nowrap px-5 py-4 align-top">
                      <p className="font-mono text-sm font-semibold text-neutral-950">
                        {sale.invoiceNumber}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatDateTime(sale.completedAt ?? sale.createdAt)}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-neutral-950">
                        {sale.customerName ?? "Walk-in Customer"}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {sale.customerCode ?? sale.customerPhone ?? "Tanpa data customer"}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-neutral-950">
                        {sale.outletName}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {sale.registerName} • {sale.cashierName}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-neutral-950">
                        {sale.totalItems} item
                      </p>
                      <p className="mt-1 max-w-[220px] truncate text-xs text-neutral-500">
                        {sale.items[0]?.productName ?? "Item belum tercatat"}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                        {getPaymentMethodLabel(sale.paymentMethods)}
                      </span>
                      <p className="mt-1 text-xs text-neutral-500">
                        Dibayar {formatMoney(sale.paidAmount)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right align-top">
                      <p className="font-semibold text-neutral-950">
                        {formatMoney(sale.totalAmount)}
                      </p>
                      {Number(sale.discountAmount) > 0 ? (
                        <p className="mt-1 text-xs text-red-600">
                          Diskon {formatMoney(sale.discountAmount)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col items-start gap-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            getSaleStatusClass(sale.status),
                          )}
                        >
                          {saleStatusLabels[sale.status]}
                        </span>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
                            getPrintStatusClass(sale.printStatus),
                          )}
                        >
                          <Printer className="mr-1 size-3" />
                          {printStatusLabels[sale.printStatus]}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      <Link
                        href={`/admin/penjualan/${sale.id}`}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                      >
                        Detail
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-500">
              <ReceiptText className="size-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-neutral-950">
              {isFiltered ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi"}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              {isFiltered
                ? "Coba ubah keyword pencarian, periode tanggal, outlet, status, atau payment method."
                : "Transaksi POS yang berhasil checkout akan muncul otomatis di halaman ini."}
            </p>
          </div>
        )}
      </section>

      {data.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3">
          <Link
            href={buildAdminSalesListUrl(Math.max(1, data.page - 1), data.filters)}
            aria-disabled={data.page <= 1}
            className={cn(
              "flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition",
              data.page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-neutral-100",
            )}
          >
            Sebelumnya
          </Link>

          <p className="text-sm text-[var(--muted)]">
            Halaman {data.page} dari {data.pageCount}
          </p>

          <Link
            href={buildAdminSalesListUrl(Math.min(data.pageCount, data.page + 1), data.filters)}
            aria-disabled={data.page >= data.pageCount}
            className={cn(
              "flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition",
              data.page >= data.pageCount ? "pointer-events-none opacity-40" : "hover:bg-neutral-100",
            )}
          >
            Berikutnya
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
