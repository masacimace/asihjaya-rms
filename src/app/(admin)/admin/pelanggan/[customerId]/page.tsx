import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Edit2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import {
  type AdminCustomerDetailData,
  type AdminCustomerTransactionRow,
  isUuid,
} from "@/features/customers/contracts";
import { getAdminCustomerDetailData } from "@/features/customers/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saleStatusLabels: Record<AdminCustomerTransactionRow["status"], string> = {
  draft: "Draft",
  awaiting_payment: "Menunggu Bayar",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  voided: "Void",
  partially_refunded: "Refund Parsial",
  refunded: "Refund",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  debit_card: "Debit",
  credit_card: "Credit",
  bank_transfer: "Transfer",
  qris_manual: "QRIS Manual",
  qris_gateway: "QRIS Gateway",
  other: "Lainnya",
};

function getSaleStatusClass(status: AdminCustomerTransactionRow["status"]) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "awaiting_payment" || status === "partially_refunded") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "voided" || status === "refunded" || status === "cancelled") {
    return "bg-red-50 text-red-700";
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

function formatDate(value: Date | null) {
  if (!value) {
    return "Belum tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
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

function getCustomerInitials(name: string) {
  const words = name
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function buildWhatsAppHref(phone: string | null) {
  if (!phone) {
    return null;
  }

  let digits = phone.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  }

  if (!digits.startsWith("62")) {
    digits = `62${digits}`;
  }

  return `https://wa.me/${digits}`;
}

function getPaymentMethodLabel(methods: string[]) {
  if (methods.length === 0) {
    return "Belum bayar";
  }

  return methods
    .map((method) => paymentMethodLabels[method] ?? method)
    .join(" + ");
}

function SuccessNotice({ type }: { type?: string }) {
  if (type !== "created" && type !== "updated") {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      {type === "created"
        ? "Pelanggan berhasil dibuat."
        : "Profil pelanggan berhasil diperbarui."}
    </div>
  );
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
    <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {title}
          </p>
          <p className="mt-3 truncate text-2xl font-semibold text-neutral-950">
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

function CustomerProfileCard({ data }: { data: AdminCustomerDetailData }) {
  const { customer, summary } = data;
  const whatsappHref = buildWhatsAppHref(customer.phone);

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
      <div className="h-24 bg-gradient-to-r from-[var(--accent-soft)] via-white to-neutral-100" />
      <div className="-mt-12 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid size-24 shrink-0 place-items-center rounded-3xl border-4 border-white bg-[var(--accent)] text-2xl font-semibold text-white shadow-sm">
              {getCustomerInitials(customer.fullName)}
            </div>

            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                  {customer.fullName}
                </h1>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    customer.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-neutral-100 text-neutral-600",
                  )}
                >
                  {customer.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {customer.customerCode ?? "Tanpa kode customer"} · Bergabung {formatDate(customer.createdAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-neutral-600">
                {customer.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-4 text-neutral-400" />
                    {customer.phone}
                  </span>
                ) : null}
                {customer.email ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-4 text-neutral-400" />
                    {customer.email}
                  </span>
                ) : null}
                {customer.address ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <MapPin className="size-4 shrink-0 text-neutral-400" />
                    <span className="truncate">{customer.address}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <MessageCircle className="size-4" />
                Chat WhatsApp
              </a>
            ) : null}
            <Link
              href={`/admin/pelanggan/${customer.id}/edit`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Edit2 className="size-4" />
              Edit Profil
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl bg-neutral-50 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Sales terakhir
            </p>
            <p className="mt-1 font-medium text-neutral-950">
              {summary.lastCashierName ?? "Belum ada"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Outlet terakhir
            </p>
            <p className="mt-1 font-medium text-neutral-950">
              {summary.lastOutletName ?? "Belum ada"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Item terakhir
            </p>
            <p className="mt-1 truncate font-medium text-neutral-950">
              {summary.lastItemName ?? "Belum ada"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CustomerNotes({ notes }: { notes: string | null }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold text-neutral-950">Catatan Internal</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {notes?.trim()
              ? notes
              : "Belum ada catatan internal untuk pelanggan ini."}
          </p>
        </div>
      </div>
    </section>
  );
}

function TransactionMobileCard({
  transaction,
}: {
  transaction: AdminCustomerTransactionRow;
}) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/penjualan/${transaction.id}`}
            className="font-semibold text-neutral-950 hover:text-[var(--accent)]"
          >
            {transaction.invoiceNumber}
          </Link>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatDateTime(transaction.completedAt ?? transaction.createdAt)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
            getSaleStatusClass(transaction.status),
          )}
        >
          {saleStatusLabels[transaction.status]}
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-neutral-50 p-3">
        <p className="text-lg font-semibold text-neutral-950">
          {formatMoney(transaction.totalAmount)}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {formatInteger(transaction.totalItems)} item · {getPaymentMethodLabel(transaction.paymentMethods)}
        </p>
      </div>

      <div className="mt-4 space-y-1.5 text-xs leading-5 text-[var(--muted)]">
        <p>
          {transaction.outletName} · {transaction.registerName}
        </p>
        <p>Dilayani oleh {transaction.cashierName}</p>
        <p className="line-clamp-2">
          {transaction.itemSummary.length > 0
            ? transaction.itemSummary.join(", ")
            : "Item belum tersedia"}
        </p>
      </div>

      <Link
        href={`/admin/penjualan/${transaction.id}`}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
      >
        Buka detail transaksi
        <ArrowRight className="size-4" />
      </Link>
    </article>
  );
}

function TransactionHistory({
  transactions,
}: {
  transactions: AdminCustomerTransactionRow[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">
            Riwayat Transaksi
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Maksimal 50 transaksi terbaru dari outlet yang bisa kamu akses.
          </p>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <TransactionMobileCard
              key={transaction.id}
              transaction={transaction}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-10 text-center">
            <ReceiptText className="mx-auto size-10 text-neutral-300" />
            <p className="mt-3 font-semibold text-neutral-950">
              Belum ada transaksi
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Riwayat akan muncul setelah customer dipilih saat checkout POS.
            </p>
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-white lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-neutral-50/70 text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-5 py-4 font-semibold">Nota</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">Item</th>
                <th className="px-5 py-4 font-semibold">Outlet & Sales</th>
                <th className="px-5 py-4 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="transition-colors hover:bg-neutral-50/60"
                  >
                    <td className="px-5 py-4 align-top">
                      <Link
                        href={`/admin/penjualan/${transaction.id}`}
                        className="font-semibold text-neutral-950 hover:text-[var(--accent)]"
                      >
                        {transaction.invoiceNumber}
                      </Link>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDateTime(transaction.completedAt ?? transaction.createdAt)}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          getSaleStatusClass(transaction.status),
                        )}
                      >
                        {saleStatusLabels[transaction.status]}
                      </span>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {getPaymentMethodLabel(transaction.paymentMethods)}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-neutral-950">
                        {formatInteger(transaction.totalItems)} item
                      </p>
                      <p className="mt-1 line-clamp-2 max-w-sm text-xs leading-5 text-[var(--muted)]">
                        {transaction.itemSummary.length > 0
                          ? transaction.itemSummary.join(", ")
                          : "Item belum tersedia"}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-neutral-950">
                        {transaction.outletName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {transaction.registerName} · {transaction.cashierName}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      <p className="font-semibold text-neutral-950">
                        {formatMoney(transaction.totalAmount)}
                      </p>
                      {Number(transaction.discountAmount) > 0 ? (
                        <p className="mt-1 text-xs text-amber-700">
                          Diskon {formatMoney(transaction.discountAmount)}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <ReceiptText className="mx-auto size-10 text-neutral-300" />
                    <p className="mt-3 font-semibold text-neutral-950">
                      Belum ada transaksi
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Riwayat akan muncul setelah customer dipilih saat checkout POS.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CustomerUnavailableState({
  customerId,
  reason,
}: {
  customerId: string;
  reason: "invalid" | "not-found";
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav>
        <Link
          href="/admin/pelanggan"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar pelanggan
        </Link>
      </nav>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 text-center sm:p-8">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <UserRound className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950">
          Pelanggan belum ditemukan
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
          {reason === "invalid"
            ? "Parameter pelanggan pada URL tidak valid. Buka ulang dari daftar pelanggan agar sistem memakai ID yang benar."
            : "Data pelanggan tidak ditemukan untuk organisasi akun ini, atau data sudah tidak tersedia di database yang sedang dipakai aplikasi."}
        </p>
        <div className="mt-5 rounded-2xl bg-neutral-50 px-4 py-3 text-left text-xs text-neutral-600">
          <span className="font-semibold text-neutral-800">Lookup:</span>{" "}
          <code className="break-all">{customerId}</code>
        </div>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/admin/pelanggan"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold !text-white transition hover:opacity-90"
          >
            Buka daftar pelanggan
          </Link>
          <Link
            href="/admin/pelanggan/baru"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
          >
            Tambah pelanggan baru
          </Link>
        </div>
      </section>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const auth = await requirePermission("admin.access");
  const { customerId } = await params;

  if (!isUuid(customerId)) {
    return <CustomerUnavailableState customerId={customerId} reason="invalid" />;
  }

  const [data, query] = await Promise.all([
    getAdminCustomerDetailData(auth, customerId),
    searchParams,
  ]);

  if (!data) {
    return <CustomerUnavailableState customerId={customerId} reason="not-found" />;
  }

  const noticeType = query.created === "1" ? "created" : query.updated === "1" ? "updated" : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav>
        <Link
          href="/admin/pelanggan"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar pelanggan
        </Link>
      </nav>

      <SuccessNotice type={noticeType} />

      <CustomerProfileCard data={data} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Belanja"
          value={formatMoney(data.summary.totalSpent)}
          helper="Dari transaksi selesai"
          icon={<ShoppingBag className="size-5" />}
        />
        <SummaryCard
          title="Total Transaksi"
          value={formatInteger(data.summary.totalTransactions)}
          helper="Nota selesai atas nama customer"
          icon={<ReceiptText className="size-5" />}
        />
        <SummaryCard
          title="Item Dibeli"
          value={formatInteger(data.summary.totalItems)}
          helper="Jumlah item serialized terjual"
          icon={<WalletCards className="size-5" />}
        />
        <SummaryCard
          title="Rata-rata Nota"
          value={formatMoney(data.summary.averageTransactionAmount)}
          helper={
            data.summary.lastTransactionAt
              ? `Terakhir ${formatDateTime(data.summary.lastTransactionAt)}`
              : "Belum ada transaksi"
          }
          icon={<Calendar className="size-5" />}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TransactionHistory transactions={data.transactions} />
        <div className="space-y-4">
          <CustomerNotes notes={data.customer.notes} />
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-500">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">Metadata</h2>
                <dl className="mt-3 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-[var(--muted)]">
                      Dibuat
                    </dt>
                    <dd className="mt-1 text-neutral-800">
                      {formatDateTime(data.customer.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-[var(--muted)]">
                      Terakhir diperbarui
                    </dt>
                    <dd className="mt-1 text-neutral-800">
                      {formatDateTime(data.customer.updatedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-[var(--muted)]">
                      Kode customer
                    </dt>
                    <dd className="mt-1 break-all text-neutral-800">
                      {data.customer.customerCode ?? "Belum tersedia"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] p-5">
            <Store className="size-5 text-[var(--accent)]" />
            <h2 className="mt-3 font-semibold text-neutral-950">
              Catatan data outlet
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              Metrik dan riwayat transaksi di halaman ini mengikuti outlet yang
              bisa diakses oleh akun admin saat ini.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
