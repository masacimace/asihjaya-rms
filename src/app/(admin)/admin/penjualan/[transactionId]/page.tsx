import type { ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Printer,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  type AdminPaymentMethod,
  type AdminSalePrintStatus,
  type AdminSaleStatus,
  type AdminSaleTimelineEvent,
} from "@/features/sales/admin-contracts";
import { getAdminSaleDetailData } from "@/features/sales/admin-queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function getTimelineToneClass(tone: AdminSaleTimelineEvent["tone"]) {
  if (tone === "success") {
    return "bg-emerald-500";
  }

  if (tone === "warning") {
    return "bg-amber-500";
  }

  if (tone === "danger") {
    return "bg-red-500";
  }

  return "bg-neutral-400";
}

function formatMoney(value: number | string | null) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
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

function formatDateOnly(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatDecimal(value: string | null, suffix: string) {
  if (!value) {
    return "-";
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(numberValue)}${suffix}`;
}


function buildDownloadHref(href: string) {
  return `${href}?download=1`;
}

function DocumentActionLink({
  href,
  icon,
  label,
  description,
  download,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  description: string;
  download?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      download={download}
      className="flex min-h-16 min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-left transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-neutral-950">
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">
          {description}
        </span>
      </span>
    </a>
  );
}

function DisabledDocumentAction({
  icon,
  label,
  description,
}: {
  icon: ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      disabled
      className="flex min-h-16 w-full cursor-not-allowed items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50 px-4 py-3 text-left text-neutral-400"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs leading-5">
          {description}
        </span>
      </span>
    </button>
  );
}

function DetailSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-medium text-neutral-950">{value}</div>
    </div>
  );
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;

  if (!UUID_PATTERN.test(transactionId)) {
    notFound();
  }

  const auth = await requirePermission("sales.view");
  const sale = await getAdminSaleDetailData({ auth, saleId: transactionId });

  if (!sale) {
    notFound();
  }

  const latestPrintJob = sale.hardwareJobs[0] ?? null;
  const printStatus = latestPrintJob?.status ?? "not_queued";

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 space-y-5 overflow-x-hidden sm:space-y-6">
      <nav className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/admin/penjualan"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-[var(--accent)]"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Riwayat Penjualan
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
              getSaleStatusClass(sale.status),
            )}
          >
            {saleStatusLabels[sale.status]}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
              getPrintStatusClass(printStatus),
            )}
          >
            <Printer className="size-3.5" />
            {printStatusLabels[printStatus]}
          </span>
        </div>
      </nav>

      <header className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-6">
        <p className="text-sm font-medium text-[var(--accent)]">
          Detail Transaksi POS
        </p>
        <div className="mt-2 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-all font-mono text-xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              {sale.invoiceNumber}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Audit lengkap transaksi dari item terjual, customer, pembayaran,
              outlet/register, kasir, status dokumen, sampai timeline operasional.
            </p>
          </div>
          <div className="w-full rounded-2xl bg-neutral-950 px-4 py-4 text-white sm:w-auto sm:px-5">
            <p className="text-xs font-medium uppercase tracking-wide text-white/60">
              Total Transaksi
            </p>
            <p className="mt-1 break-words text-xl font-semibold text-white sm:text-2xl">
              {formatMoney(sale.totalAmount)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6">
        <main className="min-w-0 space-y-5 sm:space-y-6">
          <DetailSection
            title="Ringkasan Transaksi"
            description="Informasi utama transaksi POS dan konteks operasionalnya."
            icon={<ReceiptText className="size-5" />}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KeyValue label="Tanggal transaksi" value={formatDateTime(sale.completedAt ?? sale.createdAt)} />
              <KeyValue label="Kasir" value={sale.cashier.name} />
              <KeyValue label="Outlet" value={sale.outlet.name} />
              <KeyValue label="Register" value={`${sale.register.code} • ${sale.register.name}`} />
              <KeyValue label="Shift" value={sale.shift.id ? sale.shift.id.slice(0, 8) : "-"} />
              <KeyValue label="Status shift" value={sale.shift.status ?? "-"} />
              <KeyValue label="Dibuat" value={formatDateTime(sale.createdAt)} />
              <KeyValue label="Selesai" value={formatDateTime(sale.completedAt)} />
            </div>
          </DetailSection>

          <DetailSection
            title="Item Terjual"
            description="Detail item fisik jewelry yang tercatat pada transaksi ini."
            icon={<ShoppingBag className="size-5" />}
          >
            <div className="w-full max-w-full overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full min-w-[760px] text-left text-sm text-neutral-600">
                <thead className="bg-neutral-50/80 text-xs text-neutral-500">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">Item</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium">SKU / Barcode</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium">Berat</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium">Kadar</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Harga</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Diskon</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sale.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-neutral-950">
                          {item.productName}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {item.categoryName}
                          {item.size ? ` • Size ${item.size}` : ""}
                          {item.gemstone ? ` • ${item.gemstone}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-mono font-medium text-neutral-950">
                          {item.sku}
                        </p>
                        <p className="mt-1 font-mono text-xs text-neutral-500">
                          {item.barcode}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center align-top">
                        {formatDecimal(item.weightGram, "g")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center align-top">
                        {formatDecimal(item.purityPercent, "%")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right align-top">
                        {formatMoney(item.listPriceAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right align-top text-red-600">
                        {Number(item.discountAmount) > 0 ? formatMoney(item.discountAmount) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right align-top font-semibold text-neutral-950">
                        {formatMoney(item.finalPriceAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailSection>

          <DetailSection
            title="Payment Breakdown"
            description="Metode bayar, status, referensi provider, uang diterima, dan kembalian."
            icon={<WalletCards className="size-5" />}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {sale.payments.length > 0 ? (
                sale.payments.map((payment) => (
                  <article
                    key={payment.id}
                    className="rounded-2xl border border-[var(--border)] bg-neutral-50/60 p-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-neutral-950">
                          {paymentMethodLabels[payment.method]}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Provider: {payment.provider}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          payment.status === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {payment.status}
                      </span>
                    </div>
                    <p className="mt-4 text-xl font-semibold text-neutral-950">
                      {formatMoney(payment.amount)}
                    </p>
                    <div className="mt-4 grid gap-2 text-xs text-neutral-600">
                      <div className="flex justify-between gap-4">
                        <span>Paid at</span>
                        <span className="font-medium text-neutral-900">
                          {formatDateTime(payment.paidAt)}
                        </span>
                      </div>
                      {payment.receivedAmount !== null ? (
                        <div className="flex justify-between gap-4">
                          <span>Uang diterima</span>
                          <span className="font-medium text-neutral-900">
                            {formatMoney(payment.receivedAmount)}
                          </span>
                        </div>
                      ) : null}
                      {payment.changeAmount !== null ? (
                        <div className="flex justify-between gap-4">
                          <span>Kembalian</span>
                          <span className="font-medium text-neutral-900">
                            {formatMoney(payment.changeAmount)}
                          </span>
                        </div>
                      ) : null}
                      {payment.providerReference ? (
                        <div className="flex justify-between gap-4">
                          <span>Referensi</span>
                          <span className="min-w-0 break-all text-right font-mono font-medium text-neutral-900">
                            {payment.providerReference}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">
                  Belum ada payment yang tercatat untuk transaksi ini.
                </p>
              )}
            </div>
          </DetailSection>

          <DetailSection
            title="Customer"
            description="Data customer yang terhubung ke transaksi."
            icon={<UserRound className="size-5" />}
          >
            {sale.customer ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KeyValue label="Nama" value={sale.customer.name} />
                <KeyValue label="Kode" value={sale.customer.code ?? "-"} />
                <KeyValue label="Telepon" value={sale.customer.phone ?? "-"} />
                <KeyValue label="Email" value={sale.customer.email ?? "-"} />
                <div className="sm:col-span-2 lg:col-span-4">
                  <KeyValue label="Alamat" value={sale.customer.address ?? "-"} />
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <Link
                    href={`/admin/pelanggan/${sale.customer.id}`}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                  >
                    Lihat detail customer
                    <ExternalLink className="size-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">
                Transaksi ini tercatat sebagai walk-in customer.
              </p>
            )}
          </DetailSection>

          <DetailSection
            title="Receipt / Certificate"
            description="Status dokumen A5 dan job print receipt certificate."
            icon={<FileText className="size-5" />}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <KeyValue
                label="Status dokumen"
                value={sale.receiptCertificate.isReady ? "Ready" : "Belum ready"}
              />
              <KeyValue label="Verification URL" value={sale.receiptCertificate.verificationUrl ? "Aktif" : "Belum tersedia"} />
              <KeyValue label="Last print status" value={printStatusLabels[printStatus]} />
            </div>

            {sale.receiptCertificate.verificationUrl ? (
              <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Public verification URL
                </p>
                <p className="mt-1 break-all font-mono text-xs leading-5 text-neutral-700">
                  {sale.receiptCertificate.verificationUrl}
                </p>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {sale.receiptCertificate.isReady ? (
                <>
                  <DocumentActionLink
                    href={sale.receiptCertificate.htmlHref}
                    icon={<Eye className="size-4" />}
                    label="Preview dokumen"
                    description="Buka layout HTML A5 untuk pengecekan cepat sebelum cetak."
                  />
                  <DocumentActionLink
                    href={buildDownloadHref(sale.receiptCertificate.downloadHref)}
                    icon={<Download className="size-4" />}
                    label="Download PDF"
                    description="Unduh nota/certificate A5 transaksi ini sebagai file PDF."
                    download={`${sale.invoiceNumber}-nota-certificate-a5.pdf`}
                  />
                </>
              ) : (
                <>
                  <DisabledDocumentAction
                    icon={<Eye className="size-4" />}
                    label="Preview belum tersedia"
                    description="Dokumen aktif setelah transaksi berstatus selesai."
                  />
                  <DisabledDocumentAction
                    icon={<Download className="size-4" />}
                    label="Download belum tersedia"
                    description="PDF belum bisa dibuat untuk transaksi yang belum selesai."
                  />
                </>
              )}
            </div>

            <div className="mt-3 rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <Printer className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                <p className="text-xs leading-5 text-[var(--muted)]">
                  Reprint ke hardware printer tetap masuk subfase R3B berikutnya.
                  Di tahap ini admin sudah bisa preview dan download dokumen manual.
                </p>
              </div>
            </div>
          </DetailSection>

          <DetailSection
            title="Audit Timeline"
            description="Timeline ringkas dari event transaksi, pembayaran, completion, dan print job."
            icon={<ShieldCheck className="size-5" />}
          >
            <ol className="space-y-4">
              {sale.timeline.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "mt-1 size-2.5 rounded-full",
                        getTimelineToneClass(event.tone),
                      )}
                    />
                    <span className="mt-1 h-full w-px bg-[var(--border)]" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-semibold text-neutral-950">
                      {event.label}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {event.description}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            {sale.auditLogs.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-[var(--border)] p-4">
                <p className="text-sm font-semibold text-neutral-950">
                  Audit log terkait
                </p>
                <div className="mt-3 space-y-3">
                  {sale.auditLogs.map((log) => (
                    <div key={log.id} className="text-sm">
                      <p className="font-medium text-neutral-950">
                        {log.action} • {log.entityType}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatDateTime(log.createdAt)} oleh {log.actorName ?? "System"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </DetailSection>
        </main>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Invoice
                </p>
                <p className="mt-1 break-all font-mono text-base font-semibold text-neutral-950 sm:text-lg">
                  {sale.invoiceNumber}
                </p>
              </div>
              <BadgeCheck className="size-5 text-[var(--accent)]" />
            </div>

            <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">Subtotal</span>
                <span className="font-medium text-neutral-950">
                  {formatMoney(sale.subtotalAmount)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">Diskon</span>
                <span className="font-medium text-red-600">
                  {formatMoney(sale.discountAmount)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">Biaya tambahan</span>
                <span className="font-medium text-neutral-950">
                  {formatMoney(sale.additionalFeeAmount)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-[var(--border)] pt-3 text-base">
                <span className="font-semibold text-neutral-950">Total</span>
                <span className="font-semibold text-neutral-950">
                  {formatMoney(sale.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[var(--muted)]">Terbayar</span>
                <span className="font-medium text-emerald-700">
                  {formatMoney(sale.paidAmount)}
                </span>
              </div>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-neutral-950">
              Operasional
            </h2>
            <div className="mt-4 space-y-4">
              <KeyValue label="Outlet" value={sale.outlet.name} />
              <KeyValue label="Register" value={`${sale.register.code} • ${sale.register.name}`} />
              <KeyValue label="Kasir" value={sale.cashier.name} />
              <KeyValue label="Tanggal" value={formatDateOnly(sale.completedAt ?? sale.createdAt)} />
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-neutral-950">
              Print Jobs
            </h2>
            {sale.hardwareJobs.length > 0 ? (
              <div className="mt-4 space-y-3">
                {sale.hardwareJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-xl border border-[var(--border)] p-3 text-sm"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-neutral-950">
                          {job.jobType.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Attempt {job.attempts}/{job.maxAttempts}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          getPrintStatusClass(job.status),
                        )}
                      >
                        {printStatusLabels[job.status]}
                      </span>
                    </div>
                    {job.error ? (
                      <p className="mt-2 text-xs text-red-600">{job.error}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                Belum ada print job untuk transaksi ini.
              </p>
            )}
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-neutral-950">
              Aksi Sensitif
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Void/refund dan reprint aktif penuh akan masuk subfase R3B/R3C
              setelah audit dan approval guard siap.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-xl bg-neutral-200 px-4 text-sm font-medium text-neutral-500"
            >
              Void / Refund R3C
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
