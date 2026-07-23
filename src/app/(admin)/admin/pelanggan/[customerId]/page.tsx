import type { ReactNode } from "react";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Edit2,
  Mail,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
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
  type AdminCustomerDepositLedgerRow,
  type AdminCustomerDetailData,
  type AdminCustomerTransactionRow,
  isUuid,
} from "@/features/customers/contracts";
import { getAdminCustomerDetailData } from "@/features/customers/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Detail Pelanggan",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saleStatusLabels: Record<AdminCustomerTransactionRow["status"], string> =
  {
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

const customerDepositEntryTypeLabels: Record<
  AdminCustomerDepositLedgerRow["entryType"],
  string
> = {
  adjustment: "Koreksi saldo",
  deposit_in: "Dana Titip masuk",
  deposit_used: "Dana Titip digunakan",
  deposit_withdrawal: "Dana Titip ditarik",
};

function getCustomerDepositDirectionClass(
  direction: AdminCustomerDepositLedgerRow["direction"],
) {
  return direction === "credit"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function getCustomerDepositDirectionPrefix(
  direction: AdminCustomerDepositLedgerRow["direction"],
) {
  return direction === "credit" ? "+" : "-";
}

function getSaleStatusClass(status: AdminCustomerTransactionRow["status"]) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "awaiting_payment" || status === "partially_refunded") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "voided" || status === "refunded" || status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-neutral-200 bg-neutral-100 text-neutral-600";
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
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-emerald-800">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80">
        <BadgeCheck className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {type === "created"
            ? "Profil pelanggan berhasil dibuat"
            : "Perubahan profil berhasil disimpan"}
        </p>
        <p className="mt-1 text-xs leading-5 text-emerald-700">
          {type === "created"
            ? "Pelanggan sekarang sudah tersedia untuk pencarian dan transaksi POS."
            : "Informasi terbaru langsung berlaku pada Admin dan pencarian pelanggan di POS."}
        </p>
      </div>
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
  icon: ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--muted)]">{title}</p>
          <p className="mt-2 break-words text-xl font-semibold text-neutral-950 sm:text-2xl">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{helper}</p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] sm:size-11">
          {icon}
        </div>
      </div>
    </article>
  );
}

function ProfileMetaItem({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[var(--border)] bg-neutral-50/70 px-3.5 py-3">
      <div className="mt-0.5 text-neutral-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
        <p
          className={cn(
            "mt-1 break-words text-sm font-medium text-neutral-900",
            valueClassName,
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function CustomerProfileHeader({ data }: { data: AdminCustomerDetailData }) {
  const { customer, summary, transactions } = data;
  const whatsappHref = buildWhatsAppHref(customer.phone);
  const latestTransaction = transactions[0] ?? null;

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] xl:items-stretch">
        <div className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="grid size-20 shrink-0 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] text-xl font-semibold text-[var(--accent)] sm:size-24 sm:text-2xl">
              {getCustomerInitials(customer.fullName)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
                  {customer.fullName}
                </h1>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                    customer.isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-neutral-200 bg-neutral-100 text-neutral-600",
                  )}
                >
                  {customer.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
                <span className="font-mono text-xs text-neutral-700 sm:text-sm">
                  {customer.customerCode ?? "Kode belum tersedia"}
                </span>
                <span aria-hidden="true">•</span>
                <span>Bergabung {formatDate(customer.createdAt)}</span>
              </div>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Profil terpusat untuk melihat nilai pelanggan, riwayat
                pembelian, kanal kontak, dan konteks pelayanan terakhir.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <ProfileMetaItem
              icon={<Phone className="size-4" />}
              label="WhatsApp / telepon"
              value={customer.phone ?? "Belum diisi"}
            />
            <ProfileMetaItem
              icon={<Mail className="size-4" />}
              label="Email"
              value={customer.email ?? "Belum diisi"}
            />
            <ProfileMetaItem
              icon={<MapPin className="size-4" />}
              label="Alamat"
              value={customer.address ?? "Belum diisi"}
              valueClassName="xl:line-clamp-2"
            />
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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

        <aside className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
              <Clock3 className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-950">
                Aktivitas terakhir
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Konteks pelayanan terbaru yang tercatat untuk pelanggan ini.
              </p>
            </div>
          </div>

          <dl className="mt-5 space-y-3">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
              <dt className="text-xs text-[var(--muted)]">
                Transaksi terakhir
              </dt>
              <dd className="text-right text-sm font-medium text-neutral-900">
                {formatDateTime(summary.lastTransactionAt)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
              <dt className="text-xs text-[var(--muted)]">Outlet</dt>
              <dd className="max-w-[65%] text-right text-sm font-medium text-neutral-900">
                {summary.lastOutletName ?? "Belum ada"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
              <dt className="text-xs text-[var(--muted)]">Register</dt>
              <dd className="max-w-[65%] text-right text-sm font-medium text-neutral-900">
                {latestTransaction?.registerName ?? "Belum ada"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
              <dt className="text-xs text-[var(--muted)]">Sales</dt>
              <dd className="max-w-[65%] text-right text-sm font-medium text-neutral-900">
                {summary.lastCashierName ?? "Belum ada"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-xs text-[var(--muted)]">Produk terakhir</dt>
              <dd className="max-w-[65%] text-right text-sm font-medium text-neutral-900">
                {summary.lastItemName ?? "Belum ada"}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

function CustomerDepositPanel({ data }: { data: AdminCustomerDetailData }) {
  const { customerDeposits } = data;
  const hasLedgerEntries = customerDeposits.recentEntries.length > 0;

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ead7ad] bg-[#fff8e8] px-3 py-1 text-xs font-semibold text-[#815618]">
            <WalletCards className="size-3.5" />
            Dana Titip
          </div>
          <h2 className="mt-3 text-xl font-semibold text-neutral-950 sm:text-2xl">
            Saldo Dana Titip pelanggan
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Saldo ditampilkan per outlet dan tidak dapat dipakai lintas outlet.
            Mutasi ini masih bersifat ringkasan admin sebelum integrasi checkout
            Dana Titip aktif di POS.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3 lg:min-w-72 lg:text-right">
          <p className="text-xs font-medium uppercase text-[var(--muted)]">
            Total saldo terakses
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-950">
            {formatMoney(customerDeposits.totalBalance)}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {formatInteger(customerDeposits.outletsWithBalance)} outlet memiliki
            saldo
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(340px,1.05fr)]">
        <div className="rounded-2xl border border-[var(--border)] bg-neutral-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-neutral-950">
                Saldo per outlet
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Hanya outlet yang dapat diakses akun admin saat ini.
              </p>
            </div>
            <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600">
              {formatInteger(customerDeposits.balances.length)} outlet
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {customerDeposits.balances.length > 0 ? (
              customerDeposits.balances.map((balance) => (
                <article
                  key={balance.outletId}
                  className="rounded-xl border border-[var(--border)] bg-white p-3.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold leading-5 text-neutral-950">
                        {balance.outletName}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                        {balance.outletCode}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-sm font-semibold text-neutral-950">
                      {formatMoney(balance.balance)}
                    </p>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                    Mutasi terakhir: {formatDateTime(balance.lastLedgerEntryAt)}
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-4 py-8 text-center">
                <WalletCards className="mx-auto size-8 text-neutral-300" />
                <p className="mt-3 text-sm font-semibold text-neutral-950">
                  Belum ada outlet terakses
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Saldo Dana Titip akan tampil setelah admin memiliki akses
                  outlet.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-neutral-950">Mutasi terbaru</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Maksimal 8 mutasi Dana Titip terbaru pelanggan ini.
              </p>
            </div>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600">
              {formatInteger(customerDeposits.recentEntries.length)} mutasi
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {hasLedgerEntries ? (
              customerDeposits.recentEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-xl border border-[var(--border)] bg-neutral-50/60 p-3.5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-semibold",
                            getCustomerDepositDirectionClass(entry.direction),
                          )}
                        >
                          {customerDepositEntryTypeLabels[entry.entryType]}
                        </span>
                        <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-600">
                          {entry.outletName}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                        {formatDateTime(entry.occurredAt)} oleh{" "}
                        {entry.createdByName}
                      </p>
                      {entry.description ? (
                        <p className="mt-2 text-xs leading-5 text-neutral-700">
                          {entry.description}
                        </p>
                      ) : null}
                      {entry.invoiceNumber ? (
                        <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                          Ref nota: {entry.invoiceNumber}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 sm:text-right">
                      <p className="text-sm font-semibold text-neutral-950">
                        {getCustomerDepositDirectionPrefix(entry.direction)}{" "}
                        {formatMoney(entry.amount)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Saldo: {formatMoney(entry.balanceAfter)}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-neutral-50/60 px-4 py-8 text-center">
                <Clock3 className="mx-auto size-8 text-neutral-300" />
                <p className="mt-3 text-sm font-semibold text-neutral-950">
                  Belum ada mutasi Dana Titip
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Mutasi akan muncul setelah Dana Titip masuk, digunakan,
                  ditarik, atau dikoreksi.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CustomerInsights({ data }: { data: AdminCustomerDetailData }) {
  const { customer, summary } = data;
  const hasContact = Boolean(customer.phone || customer.email);

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-neutral-950">
              Catatan pelayanan
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Informasi internal untuk menjaga konteks dan kualitas pelayanan.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-4">
          <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-700">
            {customer.notes?.trim()
              ? customer.notes
              : "Belum ada catatan internal untuk pelanggan ini."}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 font-medium",
              hasContact
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700",
            )}
          >
            {hasContact ? "Kontak tersedia" : "Kontak belum tersedia"}
          </span>
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-medium text-neutral-600">
            {customer.address ? "Alamat tersedia" : "Alamat belum diisi"}
          </span>
        </div>
      </article>

      <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
            <UserRound className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-neutral-950">
              Profil & metadata
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Identitas permanen dan waktu pembaruan data pelanggan.
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
            <dt className="text-xs text-[var(--muted)]">Kode pelanggan</dt>
            <dd className="mt-1.5 break-all font-mono text-sm font-medium text-neutral-900">
              {customer.customerCode ?? "Belum tersedia"}
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
            <dt className="text-xs text-[var(--muted)]">Status profil</dt>
            <dd className="mt-1.5 text-sm font-medium text-neutral-900">
              {customer.isActive ? "Aktif untuk transaksi" : "Tidak aktif"}
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
            <dt className="text-xs text-[var(--muted)]">Dibuat</dt>
            <dd className="mt-1.5 text-sm font-medium text-neutral-900">
              {formatDateTime(customer.createdAt)}
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
            <dt className="text-xs text-[var(--muted)]">Terakhir diperbarui</dt>
            <dd className="mt-1.5 text-sm font-medium text-neutral-900">
              {formatDateTime(customer.updatedAt)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-3.5">
          <Store className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
          <p className="text-xs leading-5 text-neutral-700">
            Ringkasan dan riwayat di halaman ini mengikuti outlet yang dapat
            diakses oleh akun admin saat ini. Total nilai pelanggan tercatat
            dari transaksi selesai sebesar{" "}
            <strong>{formatMoney(summary.totalSpent)}</strong>.
          </p>
        </div>
      </article>
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
            className="break-all font-semibold text-neutral-950 hover:text-[var(--accent)]"
          >
            {transaction.invoiceNumber}
          </Link>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatDateTime(transaction.completedAt ?? transaction.createdAt)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
            getSaleStatusClass(transaction.status),
          )}
        >
          {saleStatusLabels[transaction.status]}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
        <p className="text-lg font-semibold text-neutral-950">
          {formatMoney(transaction.totalAmount)}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
          <span>{formatInteger(transaction.totalItems)} item</span>
          <span aria-hidden="true">•</span>
          <span>{getPaymentMethodLabel(transaction.paymentMethods)}</span>
        </div>
        {Number(transaction.discountAmount) > 0 ? (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Diskon {formatMoney(transaction.discountAmount)}
          </p>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[var(--muted)]">Outlet & register</dt>
          <dd className="mt-1 font-medium leading-5 text-neutral-800">
            {transaction.outletName} · {transaction.registerName}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Sales</dt>
          <dd className="mt-1 font-medium leading-5 text-neutral-800">
            {transaction.cashierName}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl bg-neutral-50 px-3.5 py-3">
        <p className="text-xs text-[var(--muted)]">Ringkasan item</p>
        <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-neutral-700">
          {transaction.itemSummary.length > 0
            ? transaction.itemSummary.join(", ")
            : "Item belum tersedia"}
        </p>
      </div>

      <Link
        href={`/admin/penjualan/${transaction.id}`}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
      >
        Buka Detail Transaksi
        <ArrowRight className="size-4" />
      </Link>
    </article>
  );
}

function TransactionHistory({
  transactions,
  totalSpent,
}: {
  transactions: AdminCustomerTransactionRow[];
  totalSpent: number;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-950">
              Riwayat Transaksi
            </h2>
            <span className="rounded-full border border-[var(--border)] bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600">
              {formatInteger(transactions.length)} transaksi
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">
            Maksimal 50 transaksi terbaru dari outlet yang dapat diakses akun
            admin.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
          <div className="rounded-xl border border-[var(--border)] bg-neutral-50/70 px-3.5 py-2.5">
            <p className="text-xs text-[var(--muted)]">Total belanja selesai</p>
            <p className="mt-1 text-sm font-semibold text-neutral-950">
              {formatMoney(totalSpent)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-neutral-50/70 px-3.5 py-2.5">
            <p className="text-xs text-[var(--muted)]">Cakupan data</p>
            <p className="mt-1 text-sm font-semibold text-neutral-950">
              Outlet terakses
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 lg:hidden">
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <TransactionMobileCard
              key={transaction.id}
              transaction={transaction}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50/40 px-5 py-10 text-center">
            <ReceiptText className="mx-auto size-10 text-neutral-300" />
            <p className="mt-3 font-semibold text-neutral-950">
              Belum ada transaksi
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Riwayat akan muncul setelah pelanggan dipilih saat checkout POS.
            </p>
          </div>
        )}
      </div>

      <div className="hidden p-4 lg:block lg:p-5">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[13%]" />
                <col className="w-[27%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[9%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead className="border-b border-[var(--border)] bg-neutral-50/80 text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nota & tanggal</th>
                  <th className="px-4 py-3 font-semibold">
                    Status & pembayaran
                  </th>
                  <th className="px-4 py-3 font-semibold">Ringkasan item</th>
                  <th className="px-4 py-3 font-semibold">Outlet</th>
                  <th className="px-4 py-3 font-semibold">Register & sales</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {transactions.length > 0 ? (
                  transactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="align-top transition-colors hover:bg-neutral-50/70"
                    >
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/penjualan/${transaction.id}`}
                          className="break-words text-xs font-semibold leading-5 text-neutral-950 hover:text-[var(--accent)]"
                        >
                          {transaction.invoiceNumber}
                        </Link>
                        <p className="mt-2 whitespace-nowrap text-xs text-[var(--muted)]">
                          {formatDateTime(
                            transaction.completedAt ?? transaction.createdAt,
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                            getSaleStatusClass(transaction.status),
                          )}
                        >
                          {saleStatusLabels[transaction.status]}
                        </span>
                        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                          {getPaymentMethodLabel(transaction.paymentMethods)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="size-4 shrink-0 text-neutral-400" />
                          <p className="font-semibold text-neutral-950">
                            {formatInteger(transaction.totalItems)} item
                          </p>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                          {transaction.itemSummary.length > 0
                            ? transaction.itemSummary.join(", ")
                            : "Item belum tersedia"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          <Store className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                          <p className="font-semibold leading-5 text-neutral-950">
                            {transaction.outletName}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          <MonitorSmartphone className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                          <div className="min-w-0">
                            <p className="font-semibold leading-5 text-neutral-950">
                              {transaction.registerName}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                              {transaction.cashierName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="whitespace-nowrap font-semibold text-neutral-950">
                          {formatMoney(transaction.totalAmount)}
                        </p>
                        {Number(transaction.discountAmount) > 0 ? (
                          <p className="mt-1.5 whitespace-nowrap text-xs font-medium text-amber-700">
                            Diskon {formatMoney(transaction.discountAmount)}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs text-[var(--muted)]">
                            Tanpa diskon
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right">
                        <Link
                          href={`/admin/penjualan/${transaction.id}`}
                          aria-label={`Buka transaksi ${transaction.invoiceNumber}`}
                          title="Buka detail transaksi"
                          className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-neutral-600 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                        >
                          <ArrowRight className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <ReceiptText className="mx-auto size-10 text-neutral-300" />
                      <p className="mt-3 font-semibold text-neutral-950">
                        Belum ada transaksi
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Riwayat akan muncul setelah pelanggan dipilih saat
                        checkout POS.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-6">
      <Link
        href="/admin/pelanggan"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
      >
        <ArrowLeft className="size-4" />
        Kembali ke daftar pelanggan
      </Link>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 text-center sm:p-8">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
          <UserRound className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-neutral-950">
          Pelanggan belum ditemukan
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
          {reason === "invalid"
            ? "Parameter pelanggan pada URL tidak valid. Buka ulang halaman melalui daftar pelanggan agar sistem menggunakan ID yang benar."
            : "Data pelanggan tidak ditemukan untuk organisasi akun ini, atau datanya sudah tidak tersedia di database aktif."}
        </p>
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-neutral-50 px-4 py-3 text-left text-xs text-neutral-600">
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
    return (
      <CustomerUnavailableState customerId={customerId} reason="invalid" />
    );
  }

  const [data, query] = await Promise.all([
    getAdminCustomerDetailData(auth, customerId),
    searchParams,
  ]);

  if (!data) {
    return (
      <CustomerUnavailableState customerId={customerId} reason="not-found" />
    );
  }

  const noticeType =
    query.created === "1"
      ? "created"
      : query.updated === "1"
        ? "updated"
        : undefined;

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-clip pb-6">
      <Link
        href="/admin/pelanggan"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
      >
        <ArrowLeft className="size-4" />
        Kembali ke daftar pelanggan
      </Link>

      <SuccessNotice type={noticeType} />

      <CustomerProfileHeader data={data} />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <SummaryCard
          title="Total Belanja"
          value={formatMoney(data.summary.totalSpent)}
          helper={`Dari ${formatInteger(data.summary.totalTransactions)} transaksi selesai`}
          icon={<CircleDollarSign className="size-5" />}
        />
        <SummaryCard
          title="Total Transaksi"
          value={formatInteger(data.summary.totalTransactions)}
          helper="Nota selesai atas nama pelanggan"
          icon={<ReceiptText className="size-5" />}
        />
        <SummaryCard
          title="Item Dibeli"
          value={formatInteger(data.summary.totalItems)}
          helper="Jumlah item yang tercatat terjual"
          icon={<WalletCards className="size-5" />}
        />
        <SummaryCard
          title="Rata-rata Nota"
          value={formatMoney(data.summary.averageTransactionAmount)}
          helper={
            data.summary.lastTransactionAt
              ? `Terakhir ${formatDate(data.summary.lastTransactionAt)}`
              : "Belum ada transaksi"
          }
          icon={<CalendarDays className="size-5" />}
        />
      </section>

      <CustomerDepositPanel data={data} />

      <CustomerInsights data={data} />

      <TransactionHistory
        transactions={data.transactions}
        totalSpent={data.summary.totalSpent}
      />
    </div>
  );
}
