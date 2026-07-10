import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Download,
  Filter,
  MonitorUp,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
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
  type AdminSaleListRow,
} from "@/features/sales/admin-contracts";
import { getAdminSalesListData } from "@/features/sales/admin-queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

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
  printing: "Sedang print",
  completed: "Print selesai",
  failed: "Print gagal",
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

  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "pending" || status === "claimed" || status === "printing") {
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

function PaymentStatusSummary({ sale }: { sale: AdminSaleListRow }) {
  const paymentDisplay = getPaymentDisplay(sale);

  return (
    <div className="min-w-0">
      <span
        className={cn(
          "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
          getPaymentDisplayClass(paymentDisplay.tone),
        )}
      >
        {paymentDisplay.label}
      </span>
      <p className="mt-2 text-xs text-neutral-500">
        {paymentDisplay.description}
      </p>
    </div>
  );
}

function PaymentAmountCard({ sale }: { sale: AdminSaleListRow }) {
  const paymentDisplay = getPaymentDisplay(sale);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs font-medium text-neutral-500">
        {paymentDisplay.amountLabel}
      </p>
      <p className="mt-1 text-sm font-semibold text-neutral-950">
        {formatMoney(paymentDisplay.amount)}
      </p>
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

function buildAdminSalesCsvExportUrl(filters: AdminSalesFilters) {
  const params = buildAdminSalesQueryParams(filters);
  const query = params.toString();

  return query ? `/admin/penjualan/export?${query}` : "/admin/penjualan/export";
}

function buildAdminSalesXlsxExportUrl(filters: AdminSalesFilters) {
  const params = buildAdminSalesQueryParams(filters);
  const query = params.toString();

  return query
    ? `/admin/penjualan/export/xlsx?${query}`
    : "/admin/penjualan/export/xlsx";
}

function PaymentBadges({ methods }: { methods: AdminPaymentMethod[] }) {
  if (methods.length === 0) {
    return (
      <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-500">
        Belum bayar
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
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
  const voidRefundRows = data.rows.filter(
    (sale) =>
      sale.status === "voided" ||
      sale.status === "refunded" ||
      sale.status === "partially_refunded",
  ).length;
  const failedPrintRows = data.rows.filter(
    (sale) => sale.printStatus === "failed",
  ).length;

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
                <p className="text-xs font-medium text-neutral-500">
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
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
                <ReceiptText className="size-5" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={buildAdminSalesListUrl(data.page, data.filters)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                <RefreshCw className="size-4" />
                Refresh
              </Link>
              <Link
                href="/pos"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-950 bg-neutral-950 px-3 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <MonitorUp className="size-4" />
                Buka POS
              </Link>
              <a
                href={buildAdminSalesCsvExportUrl(data.filters)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                <Download className="size-4" />
                CSV
              </a>
              <a
                href={buildAdminSalesXlsxExportUrl(data.filters)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                <Download className="size-4" />
                XLSX
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
              <p className="mt-2 text-lg font-semibold text-neutral-950 sm:text-2xl">
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
              <p className="mt-2 text-lg font-semibold text-neutral-950 sm:text-2xl">
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
              <p className="mt-2 text-lg font-semibold text-neutral-950 sm:text-2xl">
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
              <p className="mt-2 text-lg font-semibold text-neutral-950 sm:text-2xl">
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

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">
              Filter transaksi
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Cari invoice, customer, SKU, barcode, kasir, outlet, atau
              referensi pembayaran.
            </p>
          </div>
          {isFiltered ? (
            <Link
              href="/admin/penjualan"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              Reset filter
            </Link>
          ) : null}
        </div>

        <form className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_170px_180px_190px_170px_auto]">
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

          <button
            type="submit"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
          >
            <Filter className="size-4" />
            Terapkan
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">
              Daftar transaksi POS
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {formatInteger(data.total)} transaksi ditemukan ·{" "}
              {formatInteger(data.summary.totalItems)} item terjual.
            </p>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600">
            <CalendarDays className="size-4" />
            Periode: {data.period.label}
          </p>
        </div>

        {data.rows.length > 0 ? (
          <>
            <div className="hidden lg:block">
              <div className="grid grid-cols-[minmax(230px,1.1fr)_minmax(170px,0.85fr)_minmax(190px,0.95fr)_minmax(110px,0.55fr)_minmax(180px,0.85fr)_minmax(150px,0.65fr)_minmax(130px,0.45fr)_104px] gap-5 border-b border-[var(--border)] bg-neutral-50/70 px-5 py-3 text-xs font-medium text-neutral-500">
                <span>Invoice</span>
                <span>Customer</span>
                <span>Outlet & kasir</span>
                <span>Item</span>
                <span>Pembayaran</span>
                <span className="pr-2 text-right">Total</span>
                <span className="text-center">Status</span>
                <span className="text-right">Aksi</span>
              </div>
              <div className="max-h-[680px] overflow-y-auto">
                {data.rows.map((sale) => (
                  <div
                    key={sale.id}
                    className="grid grid-cols-[minmax(230px,1.1fr)_minmax(170px,0.85fr)_minmax(190px,0.95fr)_minmax(110px,0.55fr)_minmax(180px,0.85fr)_minmax(150px,0.65fr)_minmax(130px,0.45fr)_104px] gap-5 border-b border-[var(--border)] px-5 py-4 text-sm text-neutral-600 transition hover:bg-neutral-50/70 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold text-neutral-950">
                        {sale.invoiceNumber}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatDateTime(sale.completedAt ?? sale.createdAt)}
                      </p>
                      <span
                        className={cn(
                          "mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                          getPrintStatusClass(sale.printStatus),
                        )}
                      >
                        <Printer className="mr-1 size-3" />
                        {printStatusLabels[sale.printStatus]}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-950">
                        {sale.customerName ?? "Walk-in Customer"}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {sale.customerCode ??
                          sale.customerPhone ??
                          "Tanpa data customer"}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-950">
                        {sale.outletName}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {sale.registerName} · {sale.cashierName}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-neutral-950">
                        {sale.totalItems} item
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {sale.items[0]?.productName ?? "Item belum tercatat"}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <PaymentStatusSummary sale={sale} />
                      {sale.paymentMethods.length > 0 ? (
                        <div className="mt-2">
                          <PaymentBadges methods={sale.paymentMethods} />
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 pr-2 text-right">
                      <p className="font-semibold text-neutral-950">
                        {formatMoney(sale.totalAmount)}
                      </p>
                      {Number(sale.discountAmount) > 0 ? (
                        <p className="mt-1 text-xs text-red-600">
                          Diskon {formatMoney(sale.discountAmount)}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex min-w-0 items-start justify-center">
                      <span
                        className={cn(
                          "inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
                          getSaleStatusClass(sale.status),
                        )}
                      >
                        {saleStatusLabels[sale.status]}
                      </span>
                    </div>

                    <div className="text-right">
                      <Link
                        href={`/admin/penjualan/${sale.id}`}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                      >
                        Detail
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {data.rows.map((sale) => (
                <Link
                  key={sale.id}
                  href={`/admin/penjualan/${sale.id}`}
                  className="rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold text-neutral-950">
                        {sale.invoiceNumber}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatDateTime(sale.completedAt ?? sale.createdAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                        getSaleStatusClass(sale.status),
                      )}
                    >
                      {saleStatusLabels[sale.status]}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                      <p className="text-xs font-medium text-neutral-500">
                        Total
                      </p>
                      <p className="mt-1 text-sm font-semibold text-neutral-950">
                        {formatMoney(sale.totalAmount)}
                      </p>
                    </div>
                    <PaymentAmountCard sale={sale} />
                  </div>

                  <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-xs text-neutral-600">
                    <div className="flex justify-between gap-3">
                      <span className="text-neutral-500">Customer</span>
                      <span className="min-w-0 truncate text-right font-medium text-neutral-800">
                        {sale.customerName ?? "Walk-in Customer"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-neutral-500">Outlet</span>
                      <span className="min-w-0 truncate text-right font-medium text-neutral-800">
                        {sale.outletName}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-neutral-500">Kasir</span>
                      <span className="min-w-0 truncate text-right font-medium text-neutral-800">
                        {sale.cashierName}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-neutral-500">Item</span>
                      <span className="min-w-0 truncate text-right font-medium text-neutral-800">
                        {sale.totalItems} item ·{" "}
                        {sale.items[0]?.productName ?? "Item belum tercatat"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    <PaymentStatusSummary sale={sale} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {sale.paymentMethods.length > 0 ? (
                        <PaymentBadges methods={sale.paymentMethods} />
                      ) : (
                        <span className="text-xs text-neutral-500">
                          Tanpa metode pembayaran
                        </span>
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                          getPrintStatusClass(sale.printStatus),
                        )}
                      >
                        <Printer className="mr-1 size-3" />
                        {printStatusLabels[sale.printStatus]}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
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
      </section>

      {data.pageCount > 1 ? (
        <nav className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={buildAdminSalesListUrl(
              Math.max(1, data.page - 1),
              data.filters,
            )}
            aria-disabled={data.page <= 1}
            className={cn(
              "flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition",
              data.page <= 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-neutral-100",
            )}
          >
            Sebelumnya
          </Link>

          <p className="text-center text-sm text-[var(--muted)]">
            Halaman {data.page} dari {data.pageCount}
          </p>

          <Link
            href={buildAdminSalesListUrl(
              Math.min(data.pageCount, data.page + 1),
              data.filters,
            )}
            aria-disabled={data.page >= data.pageCount}
            className={cn(
              "flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition",
              data.page >= data.pageCount
                ? "pointer-events-none opacity-40"
                : "hover:bg-neutral-100",
            )}
          >
            Berikutnya
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
