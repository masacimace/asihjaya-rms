import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  ImageIcon,
  MonitorUp,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import {
  activeAdminPaymentMethodOptions,
  adminSaleStatuses,
  adminSalesDateRanges,
  parseAdminSalesFilters,
  type AdminPaymentMethod,
  type AdminSaleListRow,
  type AdminSalePrintStatus,
  type AdminSaleStatus,
  type AdminSalesDateRange,
  type AdminSalesFilters,
} from "@/features/sales/admin-contracts";
import { getAdminSaleListImagePreviews } from "@/features/sales/admin-sale-list-images";
import { getAdminSalesListData } from "@/features/sales/admin-queries";
import { requirePermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Riwayat Penjualan",
};

export const runtime = "nodejs";

const saleStatusLabels: Record<AdminSaleStatus, string> = {
  draft: "Draft",
  awaiting_payment: "Menunggu bayar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  voided: "Void",
  partially_refunded: "Refund parsial",
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
  processing: "Sedang diproses",
  printing: "Sedang print",
  submitted: "Dikirim ke spooler",
  completed: "Print selesai",
  failed: "Print gagal",
  unknown_outcome: "Hasil print belum pasti",
  expired: "Print kedaluwarsa",
  cancelled: "Print batal",
};

function getSaleStatusClass(status: AdminSaleStatus) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "awaiting_payment" || status === "partially_refunded") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "voided" || status === "refunded" || status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

function getPrintStatusClass(status: AdminSalePrintStatus) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "failed" || status === "unknown_outcome") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    status === "pending" ||
    status === "claimed" ||
    status === "processing" ||
    status === "printing" ||
    status === "submitted"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-600";
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

function getNumericAmount(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
  }

  return 0;
}

type PaymentDisplayTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "refund";

type PaymentDisplay = {
  label: string;
  description: string;
  amountLabel: string;
  amount: number;
  tone: PaymentDisplayTone;
};

function getPaymentDisplay(
  sale: Pick<
    AdminSaleListRow,
    "status" | "totalAmount" | "paidAmount" | "refundedAmount"
  >,
): PaymentDisplay {
  const totalAmount = getNumericAmount(sale.totalAmount);
  const paidAmount = getNumericAmount(sale.paidAmount);
  const refundedAmount = getNumericAmount(sale.refundedAmount);
  const reversalAmount = refundedAmount > 0 ? refundedAmount : totalAmount;

  if (sale.status === "voided") {
    return {
      label: "Dibatalkan",
      description:
        reversalAmount > 0
          ? `Reversal ${formatMoney(reversalAmount)}`
          : "Pembayaran direversal",
      amountLabel: "Reversal",
      amount: reversalAmount,
      tone: "danger",
    };
  }

  if (sale.status === "refunded") {
    return {
      label: "Refund penuh",
      description:
        reversalAmount > 0
          ? `Dikembalikan ${formatMoney(reversalAmount)}`
          : "Dana dikembalikan",
      amountLabel: "Refund",
      amount: reversalAmount,
      tone: "refund",
    };
  }

  if (sale.status === "partially_refunded") {
    return {
      label: "Refund parsial",
      description:
        refundedAmount > 0
          ? `Dikembalikan ${formatMoney(refundedAmount)}`
          : "Sebagian dana dikembalikan",
      amountLabel: "Refund",
      amount: refundedAmount,
      tone: "warning",
    };
  }

  if (paidAmount >= totalAmount && totalAmount > 0) {
    return {
      label: "Lunas",
      description: `Dibayar ${formatMoney(paidAmount)}`,
      amountLabel: "Dibayar",
      amount: paidAmount,
      tone: "success",
    };
  }

  if (paidAmount > 0) {
    return {
      label: "Parsial",
      description: `Dibayar ${formatMoney(paidAmount)} dari ${formatMoney(totalAmount)}`,
      amountLabel: "Dibayar",
      amount: paidAmount,
      tone: "warning",
    };
  }

  return {
    label: "Belum bayar",
    description: "Dibayar Rp 0",
    amountLabel: "Dibayar",
    amount: 0,
    tone: "neutral",
  };
}

function getPaymentDisplayClass(tone: PaymentDisplayTone) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "danger") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (tone === "refund") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

function PaymentBadges({
  customerDepositUsedAmount,
  methods,
}: {
  customerDepositUsedAmount: number;
  methods: AdminPaymentMethod[];
}) {
  if (methods.length === 0 && customerDepositUsedAmount <= 0) {
    return (
      <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-500">
        Belum bayar
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {customerDepositUsedAmount > 0 ? (
        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          Gunakan saldo
        </span>
      ) : null}
      {methods.slice(0, 3).map((method) => (
        <span
          key={method}
          className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
        >
          {paymentMethodLabels[method]}
        </span>
      ))}
      {methods.length > 3 ? (
        <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
          +{methods.length - 3}
        </span>
      ) : null}
    </div>
  );
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

function buildAdminSalesQueryParams(filters: AdminSalesFilters) {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.outletId) params.set("outletId", filters.outletId);
  if (filters.status) params.set("status", filters.status);
  if (filters.paymentMethod) params.set("paymentMethod", filters.paymentMethod);
  if (filters.dateRange !== "today") params.set("range", filters.dateRange);

  return params;
}

function buildAdminSalesListUrl(page: number, filters: AdminSalesFilters) {
  const params = buildAdminSalesQueryParams(filters);

  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/penjualan?${query}` : "/admin/penjualan";
}

function buildAdminSalesXlsxExportUrl(filters: AdminSalesFilters) {
  const params = buildAdminSalesQueryParams(filters);
  const query = params.toString();

  return query
    ? `/admin/penjualan/export/xlsx?${query}`
    : "/admin/penjualan/export/xlsx";
}

function getPaginationTokens(page: number, pageCount: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const visiblePages = new Set<number>([
    1,
    pageCount,
    page - 1,
    page,
    page + 1,
  ]);

  if (page <= 4) {
    [2, 3, 4, 5].forEach((value) => visiblePages.add(value));
  }

  if (page >= pageCount - 3) {
    [pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1].forEach(
      (value) => visiblePages.add(value),
    );
  }

  const pages = [...visiblePages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((left, right) => left - right);
  const tokens: Array<number | string> = [];

  pages.forEach((value, index) => {
    const previous = pages[index - 1];

    if (previous !== undefined) {
      const gap = value - previous;
      if (gap === 2) {
        tokens.push(previous + 1);
      } else if (gap > 2) {
        tokens.push(`ellipsis-${previous}-${value}`);
      }
    }

    tokens.push(value);
  });

  return tokens;
}

export default async function PenjualanListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requirePermission("sales.view");
  const filters = parseAdminSalesFilters(await searchParams);
  const data = await getAdminSalesListData(auth, filters);
  const imagePreviewsBySaleId = await getAdminSaleListImagePreviews({
    organizationId: auth.organization.id,
    saleIds: data.rows.map((sale) => sale.id),
    productItemIds: data.rows.flatMap((sale) =>
      sale.items.map((item) => item.productItemId),
    ),
  });
  const isFiltered = Boolean(
    filters.search ||
    filters.outletId ||
    filters.status ||
    filters.paymentMethod ||
    filters.dateRange !== "today",
  );
  const activeFilterCount = [
    filters.search || null,
    filters.outletId,
    filters.status,
    filters.paymentMethod,
    filters.dateRange !== "today" ? filters.dateRange : null,
  ].filter(Boolean).length;
  const voidRefundRows = data.rows.filter(
    (sale) =>
      sale.status === "voided" ||
      sale.status === "refunded" ||
      sale.status === "partially_refunded",
  ).length;
  const failedPrintRows = data.rows.filter(
    (sale) => sale.printStatus === "failed",
  ).length;
  const paginationTokens = getPaginationTokens(data.page, data.pageCount);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-4">
            <Link
              href="/admin"
              className="inline-flex h-10 items-center justify-center gap-2 bg-white px-4 text-sm font-medium text-neutral-700"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>

            <div>
              <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
                Daftar Penjualan
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Pantau transaksi POS, customer, kasir, metode pembayaran, status
                nota, print receipt, serta tindak lanjut void dan refund dari
                outlet yang bisa kamu akses.
              </p>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 xl:max-w-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
                  <CalendarDays className="size-3.5 text-[var(--accent)]" />
                  Periode aktif
                </p>
                <p className="mt-1 text-lg font-semibold text-neutral-950">
                  {data.period.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  {formatInteger(data.total)} transaksi cocok dengan filter saat
                  ini.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2">
              <Link
                href="/pos"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-950 bg-neutral-950 px-3 text-xs font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <MonitorUp className="size-4" />
                Buka POS
              </Link>
              <a
                href={buildAdminSalesXlsxExportUrl(data.filters)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                <Download className="size-4" />
                Export Excel
              </a>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--muted)]">
                Omzet transaksi
              </p>
              <p className="mt-2 text-sm font-semibold text-neutral-950 sm:text-2xl">
                {formatMoney(data.summary.totalAmount)}
              </p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
              <ReceiptText className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-neutral-500">
            Total nominal transaksi pada filter aktif.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--muted)]">
                Transaksi
              </p>
              <p className="mt-2 text-sm font-semibold text-neutral-950 sm:text-2xl">
                {formatInteger(data.summary.totalTransactions)}
              </p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700">
              <ShoppingBag className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-neutral-500">
            Nota POS yang cocok dengan filter halaman.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--muted)]">Dibayar</p>
              <p className="mt-2 text-sm font-semibold text-neutral-950 sm:text-2xl">
                {formatMoney(data.summary.paidAmount)}
              </p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
              <WalletCards className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-neutral-500">
            Cash {formatMoney(data.summary.cashAmount)} · Non-cash{" "}
            {formatMoney(data.summary.nonCashAmount)}
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--muted)]">
                Perlu perhatian
              </p>
              <p className="mt-2 text-sm font-semibold text-neutral-950 sm:text-2xl">
                {formatInteger(voidRefundRows + failedPrintRows)}
              </p>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-700">
              <RotateCcw className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-neutral-500">
            Void/refund atau print gagal pada halaman ini.
          </p>
        </article>
      </section>

      <details className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-neutral-50 text-neutral-600">
            <Filter className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-neutral-950">
                Filter transaksi
              </p>
              {isFiltered ? (
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
              {isFiltered
                ? `${formatInteger(data.total)} transaksi sesuai filter. Buka untuk mengubah pencarian, periode, outlet, status, atau metode pembayaran.`
                : "Buka untuk mencari invoice, customer, SKU, barcode, kasir, outlet, atau referensi pembayaran."}
            </p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden text-xs font-semibold text-neutral-500 sm:inline group-open:hidden">
              Buka filter
            </span>
            <span className="hidden text-xs font-semibold text-neutral-500 sm:group-open:inline">
              Tutup filter
            </span>
            <ChevronDown className="size-4 text-neutral-400 transition-transform group-open:rotate-180" />
          </div>
        </summary>

        <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 transition focus-within:border-[var(--accent)] focus-within:bg-white md:col-span-2 xl:col-span-2">
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
              className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
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
              className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
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
              className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
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
              className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
            >
              <option value="">Semua payment</option>
              {activeAdminPaymentMethodOptions.map((method) => (
                <option key={method} value={method}>
                  {paymentMethodLabels[method]}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:flex xl:justify-end">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <Filter className="size-4" />
                Terapkan
              </button>
              <Link
                href="/admin/penjualan"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 hover:text-neutral-950"
              >
                Reset
              </Link>
            </div>
          </form>
        </div>
      </details>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">
              Daftar transaksi POS
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {formatInteger(data.total)} transaksi ditemukan ·{" "}
              {formatInteger(data.summary.totalItems)} item terjual.
            </p>
          </div>
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600">
            <CalendarDays className="size-4" />
            Periode: {data.period.label}
          </p>
        </div>

        {data.rows.length > 0 ? (
          <div className="grid gap-3 p-3 sm:p-4">
            {data.rows.map((sale) => {
              const paymentDisplay = getPaymentDisplay(sale);
              const firstItem = sale.items[0];
              const otherItemCount = Math.max(0, sale.totalItems - 1);
              const imagePreviews = imagePreviewsBySaleId.get(sale.id) ?? [];
              const previewItems = sale.items.slice(0, 3).map((item) => ({
                ...item,
                imageKey:
                  imagePreviews.find(
                    (preview) => preview.productItemId === item.productItemId,
                  )?.imageKey ?? null,
              }));
              const hiddenThumbnailCount = Math.max(
                0,
                sale.totalItems - previewItems.length,
              );
              const customerReference =
                sale.customerCode ??
                sale.customerPhone ??
                "Tanpa data customer";

              return (
                <Link
                  key={sale.id}
                  href={`/admin/penjualan/${sale.id}`}
                  data-sales-layout="compact-transaction-row"
                  className="group block min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-3.5 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:p-4"
                >
                  <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold leading-5 text-neutral-950 transition group-hover:text-[var(--accent)] sm:break-normal sm:truncate">
                        {sale.invoiceNumber}
                      </p>
                      <p className="mt-0.5 text-[11px] text-neutral-500 sm:text-xs">
                        {formatDateTime(sale.completedAt ?? sale.createdAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          getSaleStatusClass(sale.status),
                        )}
                      >
                        {saleStatusLabels[sale.status]}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
                          getPrintStatusClass(sale.printStatus),
                        )}
                      >
                        <Printer className="mr-1 size-3 shrink-0" />
                        {printStatusLabels[sale.printStatus]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-x-4 gap-y-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2 lg:grid-cols-[minmax(230px,1.35fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(260px,1.4fr)_minmax(170px,0.9fr)_minmax(200px,1fr)_minmax(170px,0.85fr)_minmax(150px,0.75fr)]">
                    <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        Produk
                      </p>
                      <div className="mt-1.5 flex min-w-0 items-center gap-3">
                        <div className="flex shrink-0 items-center gap-1.5">
                          {previewItems.length > 0 ? (
                            previewItems.map((item) => {
                              const imageUrl = getImageUrl(item.imageKey);

                              return imageUrl ? (
                                <div
                                  key={item.productItemId}
                                  className="size-14 overflow-hidden rounded-lg border border-[var(--border)] bg-neutral-100 sm:size-16"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={imageUrl}
                                    alt={`Foto ${item.productName}`}
                                    className="size-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div
                                  key={item.productItemId}
                                  className="grid size-11 place-items-center rounded-lg border border-[var(--border)] bg-neutral-100 text-neutral-400 sm:size-12"
                                  aria-label={`Foto ${item.productName} belum tersedia`}
                                >
                                  <ImageIcon className="size-4" />
                                </div>
                              );
                            })
                          ) : (
                            <div className="grid size-11 place-items-center rounded-lg border border-[var(--border)] bg-neutral-100 text-neutral-400 sm:size-12">
                              <ImageIcon className="size-4" />
                            </div>
                          )}

                          {hiddenThumbnailCount > 0 ? (
                            <span className="grid size-9 place-items-center rounded-lg bg-neutral-100 text-[10px] font-semibold text-neutral-600">
                              +{formatInteger(hiddenThumbnailCount)}
                            </span>
                          ) : null}
                        </div>

                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-semibold text-neutral-950">
                            {firstItem?.productName ?? "Item belum tercatat"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                            {formatInteger(sale.totalItems)} item
                            {otherItemCount > 0
                              ? ` · +${formatInteger(otherItemCount)} item lainnya`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        Customer
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-neutral-950">
                        {sale.customerName ?? "Walk-in Customer"}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                        {customerReference}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        Outlet / Kasir
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-neutral-950">
                        {sale.outletName}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                        {sale.registerName} · {sale.cashierName}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        Payment
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            getPaymentDisplayClass(paymentDisplay.tone),
                          )}
                        >
                          {paymentDisplay.label}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-neutral-900">
                          {formatMoney(paymentDisplay.amount)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <PaymentBadges
                          customerDepositUsedAmount={
                            sale.customerDepositUsedAmount
                          }
                          methods={sale.paymentMethods}
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                        Total
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold tabular-nums text-[var(--accent)]">
                        {formatMoney(sale.totalAmount)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {Number(sale.discountAmount) > 0
                          ? `Diskon ${formatMoney(sale.discountAmount)}`
                          : "Tanpa diskon"}
                      </p>
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)]">
                        Detail transaksi
                        <ChevronRight className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="grid place-items-center px-6 py-16 text-center">
            <div className="grid size-14 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-500">
              <ReceiptText className="size-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-neutral-950">
              {isFiltered
                ? "Tidak ada transaksi yang cocok"
                : "Belum ada transaksi"}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              {isFiltered
                ? "Coba ubah keyword pencarian, periode tanggal, outlet, status, atau payment method."
                : "Transaksi POS yang berhasil checkout akan muncul otomatis di halaman ini."}
            </p>
          </div>
        )}

        {data.pageCount > 1 ? (
          <nav className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs text-[var(--muted)]">
                Halaman {data.page} dari {data.pageCount} ·{" "}
                {formatInteger(data.total)} transaksi
              </p>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Link
                    href={buildAdminSalesListUrl(
                      Math.max(1, data.page - 1),
                      data.filters,
                    )}
                    aria-disabled={data.page <= 1}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-neutral-900 transition",
                      data.page <= 1
                        ? "pointer-events-none opacity-40"
                        : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40",
                    )}
                  >
                    <ChevronLeft className="size-4" />
                    Sebelumnya
                  </Link>
                  <Link
                    href={buildAdminSalesListUrl(
                      Math.min(data.pageCount, data.page + 1),
                      data.filters,
                    )}
                    aria-disabled={data.page >= data.pageCount}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-neutral-900 transition",
                      data.page >= data.pageCount
                        ? "pointer-events-none opacity-40"
                        : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40",
                    )}
                  >
                    Berikutnya
                    <ChevronRight className="size-4" />
                  </Link>
                </div>

                <div className="hidden items-center gap-1 xl:flex">
                  {paginationTokens.map((token) =>
                    typeof token === "number" ? (
                      <Link
                        key={token}
                        href={buildAdminSalesListUrl(token, data.filters)}
                        aria-current={token === data.page ? "page" : undefined}
                        className={cn(
                          "grid size-10 place-items-center rounded-xl border text-sm font-semibold transition",
                          token === data.page
                            ? "border-neutral-950 bg-neutral-950 !text-white"
                            : "border-[var(--border)] bg-white text-neutral-700 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 hover:text-neutral-950",
                        )}
                      >
                        {token}
                      </Link>
                    ) : (
                      <span
                        key={token}
                        className="grid size-8 place-items-center text-sm text-[var(--muted)]"
                        aria-hidden="true"
                      >
                        …
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
