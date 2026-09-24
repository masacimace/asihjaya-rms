import { randomUUID } from "node:crypto";

import Link from "next/link";
import {
  ChevronDown,
  Clock3,
  FileText,
  ImageIcon,
  Package,
  Printer,
  ReceiptText,
  Search,
  ShoppingBag,
  Store,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import type {
  PosTransactionDetailData,
  PosTransactionListData,
  PosTransactionListItem,
  PosTransactionRange,
} from "@/features/pos/contracts";
import { reprintPosReceiptCertificateAction } from "@/app/actions/pos";
import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";
import { SalesTrendChart } from "@/components/admin/dashboard/sales-trend-chart";
import { ImageLightbox } from "@/components/media/image-lightbox";
import { PrintJobAutoRefresh } from "@/components/pos/print-job-auto-refresh";
import { getPosMediaUrl } from "@/features/pos/catalog-state";
import { getPosTransactionDetailData } from "@/features/pos/queries";
import { getPosTransactionHistoryPageData } from "@/features/pos/transaction-history-pagination";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Transaksi POS",
};

export const runtime = "nodejs";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type PosTransactionFeedbackType = "success" | "error" | "info";

const rangeLabels: Record<PosTransactionRange, string> = {
  today: "Hari ini",
  "7d": "7 hari",
  "30d": "30 hari",
  all: "Semua",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  qris_manual: "QRIS",
  qris_gateway: "QRIS Gateway",
  debit_card: "Debit",
  credit_card: "Credit",
  bank_transfer: "Transfer",
  other: "Lainnya",
};

const hardwareJobStatusLabels: Record<string, string> = {
  pending: "Menunggu",
  claimed: "Diambil agent",
  processing: "Diproses",
  printing: "Printing",
  submitted: "Dikirim ke spooler",
  completed: "Selesai",
  failed: "Gagal",
  unknown_outcome: "Hasil belum pasti",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
};

const activeHardwareJobStatuses = new Set([
  "pending",
  "claimed",
  "processing",
  "printing",
  "submitted",
]);

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

function normalizeRange(value?: string): PosTransactionRange {
  if (value === "7d" || value === "30d" || value === "all") {
    return value;
  }

  return "today";
}

function normalizeFeedbackType(value?: string): PosTransactionFeedbackType {
  if (value === "success" || value === "error") {
    return value;
  }

  return "info";
}

function buildTransactionsHref({
  query,
  range,
  detailId,
  shiftId,
  page,
}: {
  query: string;
  range: PosTransactionRange;
  detailId?: string | null;
  shiftId?: string | null;
  page?: number | null;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (range !== "today") {
    params.set("range", range);
  }

  if (detailId) {
    params.set("detail", detailId);
  }

  if (shiftId) {
    params.set("shift", shiftId);
  }

  if (page && page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();

  return `/pos/transaksi${queryString ? `?${queryString}` : ""}`;
}

function formatMoney(value: string | number | null) {
  const parsedValue = typeof value === "number" ? value : Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(parsedValue) ? parsedValue : 0);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function getPosSalesChartInsights(
  analytics: PosTransactionListData["analytics"],
) {
  const totalRevenue = analytics.totalAmount;
  const averageRevenue =
    analytics.trend.length > 0
      ? Math.round(
          analytics.trend.reduce((total, point) => total + point.revenue, 0) /
            analytics.trend.length,
        )
      : 0;

  return {
    totalRevenue,
    averageRevenue,
    hasRevenue: totalRevenue > 0,
  };
}

function formatTransactionDate(value: Date | null) {
  if (!value) {
    return "Belum selesai";
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

function formatShiftOpenedAt(value: Date | null) {
  if (!value) {
    return "Data shift tidak ditemukan";
  }

  return `Dibuka ${new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value)}`;
}

function formatItemSpec(value: string | null, suffix: string) {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(parsedValue)} ${suffix}`;
}

function getPaymentMethodSummary(transaction: PosTransactionListItem) {
  const methods = [
    ...(transaction.customerDepositUsedAmount > 0 ? ["Dana Titip"] : []),
    ...transaction.payments.map(
      (payment) => paymentMethodLabels[payment.method] ?? payment.method,
    ),
  ];

  return methods.length > 0 ? methods.join(" + ") : "Belum ada payment";
}

function getPaymentStatusLabel(
  transaction: Pick<PosTransactionListItem, "paymentStatus">,
) {
  if (transaction.paymentStatus === "paid") {
    return "Lunas";
  }

  if (transaction.paymentStatus === "partial") {
    return "Sebagian";
  }

  return "Belum lunas";
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--muted)]">{title}</p>
          <p className="mt-2 truncate text-md font-semibold text-neutral-950 sm:text-xl">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{helper}</p>
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </div>
      </div>
    </article>
  );
}

function PaymentStatusPill({
  transaction,
}: {
  transaction: Pick<PosTransactionListItem, "paymentStatus">;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        transaction.paymentStatus === "paid"
          ? "bg-emerald-50 text-emerald-700"
          : transaction.paymentStatus === "partial"
            ? "bg-amber-50 text-amber-700"
            : "bg-neutral-100 text-neutral-600",
      )}
    >
      {getPaymentStatusLabel(transaction)}
    </span>
  );
}

function HardwareJobStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "completed"
          ? "bg-emerald-50 text-emerald-700"
          : status === "failed" || status === "cancelled"
            ? "bg-red-50 text-red-700"
            : "bg-amber-50 text-amber-700",
      )}
    >
      {hardwareJobStatusLabels[status] ?? status}
    </span>
  );
}

function TransactionProductImage({
  imageKey,
  alt,
  className,
}: {
  imageKey: string | null;
  alt: string;
  className?: string;
}) {
  const imageUrl = getPosMediaUrl(imageKey);

  if (!imageUrl) {
    return (
      <div
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--border)] bg-neutral-50",
          className,
        )}
      >
        <ImageIcon className="size-5 text-neutral-300" />
      </div>
    );
  }

  return (
    <ImageLightbox
      src={imageUrl}
      alt={alt}
      caption={alt}
      triggerClassName={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--border)] bg-neutral-50",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={alt} className="size-full object-cover" />
    </ImageLightbox>
  );
}

function TransactionImagesPreview({
  transaction,
  variant = "desktop",
}: {
  transaction: PosTransactionListItem;
  variant?: "mobile" | "desktop";
}) {
  const previewItems = transaction.items.slice(0, 3);
  const hiddenCount = Math.max(
    transaction.items.length - previewItems.length,
    0,
  );
  const isMobile = variant === "mobile";
  const imageSizeClass = isMobile
    ? previewItems.length <= 1
      ? "size-28"
      : previewItems.length === 2
        ? "size-24"
        : "size-20"
    : "size-18";

  if (previewItems.length === 0) {
    return (
      <TransactionProductImage
        imageKey={null}
        alt="Foto produk belum tersedia"
        className={isMobile ? "size-28" : "size-18"}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center",
        isMobile
          ? "w-full justify-center gap-2"
          : "min-w-[104px] justify-start gap-2",
      )}
    >
      {previewItems.map((item) => (
        <TransactionProductImage
          key={item.productItemId}
          imageKey={item.imageKey}
          alt={`Foto ${item.productName}`}
          className={imageSizeClass}
        />
      ))}
      {hiddenCount > 0 ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center bg-neutral-100 font-semibold text-neutral-600",
            isMobile
              ? "size-10 rounded-xl text-xs"
              : "size-9 rounded-lg text-[10px]",
          )}
        >
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function TransactionItemsPreview({
  transaction,
}: {
  transaction: PosTransactionListItem;
}) {
  const previewItems = transaction.items.slice(0, 3);
  const hiddenCount = Math.max(
    transaction.items.length - previewItems.length,
    0,
  );

  if (transaction.items.length === 0) {
    return (
      <span className="text-xs text-[var(--muted)]">Item belum terbaca</span>
    );
  }

  return (
    <div className="space-y-1">
      {previewItems.map((item) => (
        <p
          key={item.productItemId}
          className="truncate text-xs text-neutral-700"
        >
          <span className="font-semibold text-neutral-900">{item.sku}</span> ·{" "}
          {item.productName}
        </p>
      ))}
      {hiddenCount > 0 ? (
        <p className="text-xs text-[var(--muted)]">+{hiddenCount} item lain</p>
      ) : null}
    </div>
  );
}

function TransactionFeedbackNotice({
  type,
  message,
}: {
  type: PosTransactionFeedbackType;
  message: string;
}) {
  return (
    <section
      className={cn(
        "mt-5 rounded-2xl border p-4 text-sm leading-6",
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : type === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {message}
    </section>
  );
}

function TransactionCard({
  transaction,
  detailHref,
  isSelected,
}: {
  transaction: PosTransactionListItem;
  detailHref: string;
  isSelected: boolean;
}) {
  return (
    <article
      data-transaction-layout="compact-row-card"
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border bg-white p-4 transition sm:p-5",
        isSelected
          ? "border-[var(--accent)] bg-[var(--accent-soft)]/25 ring-2 ring-[var(--accent-soft)]"
          : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20",
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-950 sm:text-base">
            {transaction.invoiceNumber}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {formatTransactionDate(
              transaction.completedAt ?? transaction.createdAt,
            )}{" "}
            · {transaction.registerName} · {transaction.cashierName}
          </p>
        </div>
        <PaymentStatusPill transaction={transaction} />
      </div>

      <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[180px_minmax(0,1fr)_minmax(240px,0.8fr)]">
        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Foto produk
          </p>
          <div className="mt-3 min-w-0 overflow-hidden">
            <TransactionImagesPreview transaction={transaction} />
          </div>
          <p className="mt-3 text-xs font-semibold text-neutral-800">
            {formatInteger(transaction.totalItems)} item
          </p>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <UserRound className="size-3.5" />
              Customer
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-neutral-950">
              {transaction.customerName ?? "Customer umum"}
            </p>
            <p className="mt-1 truncate text-xs text-[var(--muted)]">
              {transaction.customerCode ??
                transaction.customerPhone ??
                "Tanpa data customer"}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Item transaksi
            </p>
            <TransactionItemsPreview transaction={transaction} />
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Payment & total
          </p>
          <div className="mt-2">
            <PaymentStatusPill transaction={transaction} />
          </div>
          <p className="mt-2 break-words text-xs leading-5 text-[var(--muted)]">
            {getPaymentMethodSummary(transaction)}
          </p>
          <p className="mt-1 text-xs font-medium text-neutral-700">
            Terbayar {formatMoney(transaction.paidAmount)}
          </p>
          <div className="mt-3 border-t border-neutral-200 pt-3">
            <p className="text-lg font-semibold text-neutral-950">
              {formatMoney(transaction.totalAmount)}
            </p>
            {Number(transaction.discountAmount) > 0 ? (
              <p className="mt-1 text-xs text-red-600">
                Diskon {formatMoney(transaction.discountAmount)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
        <Link
          href={detailHref}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition",
            isSelected
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border-[var(--border)] bg-white text-neutral-700 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20",
          )}
        >
          <Package className="size-3.5" />
          Detail
        </Link>
        <a
          href={`/api/sales/${transaction.id}/receipt-certificate`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
        >
          <FileText className="size-3.5" />
          Lihat Invoice
        </a>
      </div>
    </article>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <h3 className="font-semibold text-neutral-950">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TransactionDetailPanel({
  detail,
  closeHref,
  reprintReturnHref,
}: {
  detail: PosTransactionDetailData;
  closeHref: string;
  reprintReturnHref: string;
}) {
  const hasActivePrintJob = detail.hardwareJobs.some((job) =>
    activeHardwareJobStatuses.has(job.status),
  );

  return (
    <section
      id="detail-transaksi"
      className="mt-5 overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--border)] bg-neutral-50 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">
            Detail Transaksi
          </p>
          <h2 className="mt-2 text-xl font-semibold text-neutral-950">
            {detail.invoiceNumber}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {formatTransactionDate(detail.completedAt ?? detail.createdAt)} ·{" "}
            {detail.registerName} · {detail.cashierName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PaymentStatusPill transaction={detail} />
          <a
            href={`/api/sales/${detail.id}/receipt-certificate`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <FileText className="size-3.5" />
            Lihat Invoice
          </a>
          <Link
            href={closeHref}
            className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-white text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-950"
            aria-label="Tutup detail transaksi"
          >
            <X className="size-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-5">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Subtotal"
              value={formatMoney(detail.subtotalAmount)}
              helper="Nilai item sebelum penyesuaian."
              icon={<ShoppingBag className="size-5" />}
            />
            <SummaryCard
              title="Diskon"
              value={formatMoney(detail.discountAmount)}
              helper={detail.discountReason ?? "Tidak ada alasan diskon."}
              icon={<ReceiptText className="size-5" />}
            />
            <SummaryCard
              title="Total"
              value={formatMoney(detail.totalAmount)}
              helper="Total final transaksi."
              icon={<WalletCards className="size-5" />}
            />
            <SummaryCard
              title="Terbayar"
              value={formatMoney(detail.paidAmount)}
              helper={getPaymentStatusLabel(detail)}
              icon={<Clock3 className="size-5" />}
            />
          </div>

          <DetailSection title="Item Terjual">
            <div className="space-y-3">
              {detail.items.map((item) => {
                const specs = [
                  formatItemSpec(item.weightGram, "gr"),
                  item.exchangePurityPercent
                    ? `Kadar ${formatItemSpec(item.exchangePurityPercent, "%")}`
                    : item.purityPercent
                      ? `Kadar ${formatItemSpec(item.purityPercent, "%")}`
                      : null,
                  item.size ? `Uk. ${item.size}` : null,
                  item.color,
                  item.gemstone,
                ].filter((spec): spec is string => Boolean(spec));

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-[var(--border)] p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <TransactionProductImage
                          imageKey={item.imageKey}
                          alt={`Foto ${item.productName}`}
                          className="size-20 sm:size-24"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-950">
                            {item.productName}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {item.sku} · {item.barcode}
                            {item.serialNumber
                              ? ` · SN ${item.serialNumber}`
                              : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">
                              {item.categoryName}
                            </span>
                            {specs.map((spec) => (
                              <span
                                key={spec}
                                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-neutral-700"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-semibold text-neutral-950">
                          {formatMoney(item.finalPriceAmount)}
                        </p>
                        {Number(item.discountAmount) > 0 ? (
                          <p className="mt-1 text-xs text-red-600">
                            Diskon {formatMoney(item.discountAmount)}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Harga list {formatMoney(item.listPriceAmount)}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </DetailSection>

          <DetailSection title="Payment">
            <div className="space-y-3">
              {detail.payments.length === 0 &&
              detail.customerDepositUsedAmount <= 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Belum ada payment.
                </p>
              ) : (
                <>
                  {detail.customerDepositUsedAmount > 0 ? (
                    <article className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-neutral-950">
                            Dana Titip
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Saldo Dana Titip customer digunakan untuk transaksi
                            ini.
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-semibold text-neutral-950">
                            {formatMoney(detail.customerDepositUsedAmount)}
                          </p>
                          <p className="mt-1 text-xs font-medium text-amber-700">
                            Dari saldo customer
                          </p>
                        </div>
                      </div>
                    </article>
                  ) : null}

                  {detail.payments.map((payment) => (
                    <article
                      key={payment.id}
                      className="rounded-2xl border border-[var(--border)] p-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-neutral-950">
                            {paymentMethodLabels[payment.method] ??
                              payment.method}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {payment.provider}
                            {payment.providerReference
                              ? ` · Ref ${payment.providerReference}`
                              : ""}
                          </p>
                          {payment.note ? (
                            <p className="mt-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                              {payment.note}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-semibold text-neutral-950">
                            {formatMoney(payment.amount)}
                          </p>
                          {payment.receivedAmount ? (
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              Diterima {formatMoney(payment.receivedAmount)}
                            </p>
                          ) : null}
                          {payment.changeAmount ? (
                            <p className="mt-1 text-xs text-emerald-700">
                              Kembalian {formatMoney(payment.changeAmount)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </>
              )}
            </div>
          </DetailSection>
        </div>

        <aside className="space-y-4">
          <DetailSection title="Customer">
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 size-5 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-neutral-950">
                  {detail.customer?.name ?? "Customer umum"}
                </p>
                {detail.customer ? (
                  <div className="mt-2 space-y-1 text-xs leading-5 text-[var(--muted)]">
                    <p>Kode: {detail.customer.code}</p>
                    {detail.customer.phone ? (
                      <p>Telepon: {detail.customer.phone}</p>
                    ) : null}
                    {detail.customer.email ? (
                      <p>Email: {detail.customer.email}</p>
                    ) : null}
                    {detail.customer.address ? (
                      <p>Alamat: {detail.customer.address}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    Transaksi ini belum dikaitkan ke data pelanggan.
                  </p>
                )}
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Dokumen & Print Job">
            <div className="space-y-3">
              <a
                href={`/api/sales/${detail.id}/receipt-certificate`}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                <FileText className="size-4" />
                Lihat Invoice
              </a>

              <form action={reprintPosReceiptCertificateAction}>
                <input type="hidden" name="saleId" value={detail.id} />
                <input type="hidden" name="requestId" value={randomUUID()} />
                <input
                  type="hidden"
                  name="returnTo"
                  value={reprintReturnHref}
                />
                <button
                  type="submit"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold !text-white transition hover:bg-black/80"
                >
                  <Printer className="size-4" />
                  Cetak Ulang Invoice
                </button>
              </form>

              <PrintJobAutoRefresh enabled={hasActivePrintJob} />

              {detail.hardwareJobs.length === 0 ? (
                <p className="rounded-2xl bg-neutral-50 p-3 text-xs leading-5 text-[var(--muted)]">
                  Belum ada hardware job yang terhubung ke transaksi ini.
                </p>
              ) : (
                detail.hardwareJobs.map((job) => (
                  <article
                    key={job.id}
                    className="rounded-2xl border border-[var(--border)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                          <Printer className="size-4 text-[var(--accent)]" />
                          {job.jobType}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {job.deviceType} · attempt {job.attempts}/
                          {job.maxAttempts}
                        </p>
                      </div>
                      <HardwareJobStatusPill status={job.status} />
                    </div>
                    {job.error ? (
                      <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                        {job.error}
                      </p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </DetailSection>

          <DetailSection title="Meta Operasional">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase text-[var(--muted)]">Outlet</p>
                <p className="mt-1 font-medium text-neutral-950">
                  {detail.outletName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-[var(--muted)]">
                  Register
                </p>
                <p className="mt-1 font-medium text-neutral-950">
                  {detail.registerName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-[var(--muted)]">Cashier</p>
                <p className="mt-1 font-medium text-neutral-950">
                  {detail.cashierName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-[var(--muted)]">Shift</p>
                <p className="mt-1 font-medium text-neutral-950">
                  {formatShiftOpenedAt(detail.shiftOpenedAt)}
                </p>
              </div>
              {detail.notes ? (
                <div>
                  <p className="text-xs uppercase text-[var(--muted)]">
                    Catatan
                  </p>
                  <p className="mt-1 rounded-xl bg-neutral-50 p-3 text-neutral-700">
                    {detail.notes}
                  </p>
                </div>
              ) : null}
            </div>
          </DetailSection>
        </aside>
      </div>
    </section>
  );
}

export default async function PosTransactionsPage({ searchParams }: PageProps) {
  const auth = await requirePermission("pos.access");
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getSearchParam(resolvedSearchParams, "q")?.trim() ?? "";
  const range = normalizeRange(getSearchParam(resolvedSearchParams, "range"));
  const detailId = getSearchParam(resolvedSearchParams, "detail")?.trim() ?? "";
  const shiftId = getSearchParam(resolvedSearchParams, "shift")?.trim() ?? "";
  const rawPage = Number.parseInt(
    getSearchParam(resolvedSearchParams, "page") ?? "1",
    10,
  );
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const feedbackMessage =
    getSearchParam(resolvedSearchParams, "feedbackMessage")?.trim() ?? "";
  const feedbackType = normalizeFeedbackType(
    getSearchParam(resolvedSearchParams, "feedbackType"),
  );
  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  const [data, selectedTransactionDetail] = await Promise.all([
    getPosTransactionHistoryPageData({
      organizationId: auth.organization.id,
      outletId: primaryOutlet?.id,
      query,
      range,
      shiftId,
      timeZone: auth.organization.timezone,
      page,
    }),
    detailId
      ? getPosTransactionDetailData({
          organizationId: auth.organization.id,
          outletId: primaryOutlet?.id,
          saleId: detailId,
        })
      : Promise.resolve(null),
  ]);
  const detailCloseHref = buildTransactionsHref({
    query: data.query,
    range: data.range,
    shiftId: data.shiftId,
    page: data.pagination.page,
  });
  const detailCurrentHref = buildTransactionsHref({
    query: data.query,
    range: data.range,
    detailId,
    shiftId: data.shiftId,
    page: data.pagination.page,
  });
  const activeFilterCount = [
    data.query || null,
    data.range !== "today" ? data.range : null,
    data.shiftId,
  ].filter(Boolean).length;
  const firstRow =
    data.pagination.total === 0
      ? 0
      : (data.pagination.page - 1) * data.pagination.pageSize + 1;
  const lastRow = Math.min(
    data.pagination.page * data.pagination.pageSize,
    data.pagination.total,
  );
  const isOutletOnline = data.outlet?.hardwareStatus === "online";
  const salesChartInsights = getPosSalesChartInsights(data.analytics);

  return (
    <PosPageContainer>
      <PosPageHeader
        eyebrow="Riwayat POS"
        title="Daftar Transaksi"
        description="Periksa invoice, customer, item, pembayaran, dan buka ulang dokumen transaksi dari outlet aktif."
        icon={<ReceiptText className="size-5 sm:size-6" />}
        actions={
          <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Store className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                    Outlet
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      isOutletOnline
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isOutletOnline ? "bg-emerald-500" : "bg-red-500",
                      )}
                    />
                    {isOutletOnline ? "Online" : "Offline"}
                  </span>
                </div>
                <p className="mt-1 truncate font-semibold text-neutral-950">
                  {data.outlet?.name ?? "Outlet belum tersedia"}
                </p>
              </div>
            </div>
          </div>
        }
      />

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-neutral-950">
              Ringkasan Penjualan
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {data.analytics.chartDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data.shiftId ? (
              <span className="inline-flex h-9 items-center rounded-lg bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--accent)]">
                Filter shift aktif
              </span>
            ) : null}
            <span className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-neutral-600">
              {rangeLabels[data.range]}
            </span>
            <span className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-neutral-600">
              {data.analytics.chartBucketLabel}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total penjualan",
              value: formatMoney(data.analytics.totalAmount),
              description: rangeLabels[data.range],
            },
            {
              label: "Transaksi",
              value: formatInteger(data.analytics.totalTransactions),
              description: "Transaksi selesai",
            },
            {
              label: "Item terjual",
              value: formatInteger(data.analytics.totalItems),
              description: "Item fisik terjual",
            },
            {
              label: "Rata-rata / transaksi",
              value: formatMoney(data.analytics.averageTransaction),
              description: "Nilai rata-rata transaksi selesai",
            },
          ].map((insight) => (
            <div
              key={insight.label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/70 p-3"
            >
              <p className="text-[11px] text-[var(--muted)]">{insight.label}</p>
              <p className="mt-1 truncate text-sm font-semibold text-neutral-950">
                {insight.value}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                {insight.description}
              </p>
            </div>
          ))}
        </div>

        <SalesTrendChart
          points={data.analytics.trend}
          averageRevenue={salesChartInsights.averageRevenue}
          hasRevenue={salesChartInsights.hasRevenue}
          bestLabel={data.analytics.bestLabel}
        />

        {data.query ? (
          <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
            Ringkasan tetap mengikuti periode
            {data.shiftId ? " dan shift aktif" : ""}; pencarian hanya memfilter
            daftar transaksi di bawah.
          </p>
        ) : null}
      </section>

      <details className="group mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-neutral-50 text-neutral-600">
            <Search className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-neutral-950">
                Filter transaksi
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
                {rangeLabels[data.range]}
              </span>
              {data.shiftId ? (
                <span className="inline-flex rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                  Shift aktif
                </span>
              ) : null}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
              {data.query
                ? `Pencarian “${data.query}”. Buka untuk mengubah kata kunci atau periode.`
                : "Buka untuk mencari invoice, customer, SKU, barcode, nama item, atau mengubah periode."}
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
          <form className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-neutral-700">
              <span>Cari transaksi</span>
              <div className="flex h-11 min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 transition focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
                <Search className="size-4 shrink-0 text-neutral-400" />
                <input
                  type="search"
                  name="q"
                  defaultValue={data.query}
                  placeholder="Invoice, customer, SKU, barcode, nama item..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
                />
              </div>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-neutral-700">
              <span>Periode</span>
              <select
                name="range"
                defaultValue={data.range}
                className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
              >
                {(Object.keys(rangeLabels) as PosTransactionRange[]).map(
                  (rangeValue) => (
                    <option key={rangeValue} value={rangeValue}>
                      {rangeLabels[rangeValue]}
                    </option>
                  ),
                )}
              </select>
            </label>

            {data.shiftId ? (
              <input type="hidden" name="shift" value={data.shiftId} />
            ) : null}

            <div className="flex gap-2">
              {activeFilterCount > 0 ? (
                <Link
                  href="/pos/transaksi"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Reset
                </Link>
              ) : null}
              <button
                type="submit"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-neutral-950 px-5 text-sm font-semibold !text-white transition hover:bg-neutral-800 lg:flex-none"
              >
                Terapkan
              </button>
            </div>
          </form>

          {data.shiftId ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-xs text-[var(--muted)]">
              <span>Filter shift aktif sedang digunakan.</span>
              <Link
                href={buildTransactionsHref({
                  query: data.query,
                  range: data.range,
                })}
                className="font-semibold text-[var(--accent)] hover:underline"
              >
                Hapus filter shift
              </Link>
            </div>
          ) : null}
        </div>
      </details>

      {feedbackMessage ? (
        <TransactionFeedbackNotice
          type={feedbackType}
          message={feedbackMessage}
        />
      ) : null}

      {selectedTransactionDetail ? (
        <TransactionDetailPanel
          detail={selectedTransactionDetail}
          closeHref={detailCloseHref}
          reprintReturnHref={detailCurrentHref}
        />
      ) : detailId ? (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          Detail transaksi tidak ditemukan untuk outlet aktif ini, atau
          transaksi sudah tidak termasuk status completed.
        </section>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="min-w-0">
            <h2 className="font-semibold text-neutral-950">
              Riwayat transaksi
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Invoice, customer, item, payment, dan total dalam compact row-card
              tanpa horizontal scroll.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">
            {formatInteger(data.pagination.total)} transaksi
          </span>
        </div>

        {data.transactions.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ReceiptText className="size-7" />
              </div>
              <h3 className="mt-4 font-semibold text-neutral-950">
                Transaksi belum ditemukan
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                Belum ada transaksi completed untuk filter ini. Coba ubah
                periode atau kata kunci pencarian.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 p-3 sm:p-4">
            {data.transactions.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                detailHref={buildTransactionsHref({
                  query: data.query,
                  range: data.range,
                  detailId: transaction.id,
                  shiftId: data.shiftId,
                  page: data.pagination.page,
                })}
                isSelected={transaction.id === detailId}
              />
            ))}
          </div>
        )}

        {data.pagination.total > 0 ? (
          <div className="border-t border-[var(--border)] p-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[var(--muted)]">
                Menampilkan {firstRow}–{lastRow} dari {data.pagination.total}{" "}
                transaksi · Halaman {data.pagination.page} dari{" "}
                {data.pagination.pageCount}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <Link
                  href={buildTransactionsHref({
                    query: data.query,
                    range: data.range,
                    shiftId: data.shiftId,
                    page: Math.max(1, data.pagination.page - 1),
                  })}
                  aria-disabled={data.pagination.page <= 1}
                  className={cn(
                    "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition",
                    data.pagination.page <= 1
                      ? "pointer-events-none opacity-40"
                      : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20",
                  )}
                >
                  ← Sebelumnya
                </Link>
                <Link
                  href={buildTransactionsHref({
                    query: data.query,
                    range: data.range,
                    shiftId: data.shiftId,
                    page: Math.min(
                      data.pagination.pageCount,
                      data.pagination.page + 1,
                    ),
                  })}
                  aria-disabled={
                    data.pagination.page >= data.pagination.pageCount
                  }
                  className={cn(
                    "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition",
                    data.pagination.page >= data.pagination.pageCount
                      ? "pointer-events-none opacity-40"
                      : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20",
                  )}
                >
                  Berikutnya →
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </PosPageContainer>
  );
}
