import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";

import {
  parseAdminCustomerFilters,
  type AdminCustomerFilters,
  type AdminCustomerListRow,
  type AdminCustomerStatus,
} from "@/features/customers/contracts";
import { getAdminCustomerListData } from "@/features/customers/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const customerStatusLabels: Record<AdminCustomerStatus, string> = {
  active: "Aktif",
  inactive: "Nonaktif",
  all: "Semua status",
};

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
    return "Belum pernah";
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
    return "Belum pernah";
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

function buildCustomersQueryParams(filters: AdminCustomerFilters) {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.status !== "active") params.set("status", filters.status);
  if (filters.outletId) params.set("outletId", filters.outletId);

  return params;
}

function buildCustomersListUrl(page: number, filters: AdminCustomerFilters) {
  const params = buildCustomersQueryParams(filters);

  if (page > 1) params.set("page", String(page));

  const query = params.toString();

  return query ? `/admin/pelanggan?${query}` : "/admin/pelanggan";
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
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">
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

function CustomerStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        isActive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-neutral-100 text-neutral-600",
      )}
    >
      {isActive ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function CustomerContactInfo({ customer }: { customer: AdminCustomerListRow }) {
  return (
    <div className="mt-3 space-y-1.5 text-xs leading-5 text-[var(--muted)]">
      {customer.phone ? (
        <p className="flex min-w-0 items-center gap-2">
          <Phone className="size-3.5 shrink-0" />
          <span className="truncate">{customer.phone}</span>
        </p>
      ) : null}
      {customer.email ? (
        <p className="flex min-w-0 items-center gap-2">
          <Mail className="size-3.5 shrink-0" />
          <span className="truncate">{customer.email}</span>
        </p>
      ) : null}
      {customer.address ? (
        <p className="flex min-w-0 items-center gap-2">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{customer.address}</span>
        </p>
      ) : null}
      {!customer.phone && !customer.email && !customer.address ? (
        <p>Kontak belum dilengkapi.</p>
      ) : null}
    </div>
  );
}

function CustomerMobileCard({ customer }: { customer: AdminCustomerListRow }) {
  const whatsappHref = buildWhatsAppHref(customer.phone);

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm shadow-neutral-950/[0.02]">
      <div className="flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
          {getCustomerInitials(customer.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold text-neutral-950">
              {customer.fullName}
            </h2>
            <CustomerStatusBadge isActive={customer.isActive} />
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {customer.customerCode ?? "Tanpa kode customer"}
          </p>
          <CustomerContactInfo customer={customer} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-neutral-50 p-3 text-center">
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            {formatInteger(customer.totalTransactions)}
          </p>
          <p className="mt-0.5 text-[10px] uppercase text-[var(--muted)]">
            Transaksi
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            {formatInteger(customer.totalItems)}
          </p>
          <p className="mt-0.5 text-[10px] uppercase text-[var(--muted)]">
            Item
          </p>
        </div>
        <div>
          <p className="truncate text-sm font-semibold text-neutral-950">
            {formatMoney(customer.totalSpent)}
          </p>
          <p className="mt-0.5 text-[10px] uppercase text-[var(--muted)]">
            Belanja
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
        <p className="font-medium text-neutral-700">Transaksi terakhir</p>
        <p className="mt-1">
          {customer.lastTransaction
            ? `${customer.lastTransaction.invoiceNumber} · ${formatDateTime(customer.lastTransaction.completedAt ?? customer.lastTransaction.createdAt)}`
            : "Belum ada transaksi"}
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/admin/pelanggan/${customer.id}`}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-3 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
        >
          Detail
          <ArrowRight className="size-4" />
        </Link>
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="grid size-10 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
            aria-label={`Chat WhatsApp ${customer.fullName}`}
          >
            <MessageCircle className="size-4" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default async function CustomerListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requirePermission("admin.access");
  const filters = parseAdminCustomerFilters(await searchParams);
  const data = await getAdminCustomerListData(auth, filters);
  const isFiltered = Boolean(
    filters.search || filters.status !== "active" || filters.outletId,
  );
  const selectedOutlet = data.outlets.find(
    (outlet) => outlet.id === filters.outletId,
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:items-end lg:p-7">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>

            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Daftar Customer
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Kelola profil pelanggan real dari POS, pantau histori belanja, dan
              siapkan follow-up WhatsApp untuk transaksi jewelry berikutnya.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
                  <Users className="size-3.5 text-[var(--accent)]" />
                  Pelanggan aktif
                </p>
                <p className="mt-2 text-2xl font-semibold text-neutral-950">
                  {formatInteger(data.summary.activeCustomers)} customer
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {formatInteger(data.summary.totalCustomers)} total pelanggan ·{" "}
                  {formatInteger(data.summary.customersWithTransactions)} sudah
                  bertransaksi.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Link
                href={buildCustomersListUrl(data.page, data.filters)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
              >
                <RefreshCw className="size-4" />
                Refresh
              </Link>

              <Link
                href="/admin/pelanggan/baru"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <Plus className="size-4" />
                Customer
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Total Pelanggan"
          value={formatInteger(data.summary.totalCustomers)}
          helper={`${formatInteger(data.summary.activeCustomers)} aktif · ${formatInteger(data.summary.inactiveCustomers)} nonaktif`}
          icon={<Users className="size-5" />}
        />
        <SummaryCard
          title="Punya Transaksi"
          value={formatInteger(data.summary.customersWithTransactions)}
          helper="Customer dengan transaksi selesai"
          icon={<UserCheck className="size-5" />}
        />
        <SummaryCard
          title="Total Belanja"
          value={formatMoney(data.summary.totalSpent)}
          helper={
            selectedOutlet
              ? `Metrik outlet ${selectedOutlet.name}`
              : "Metrik seluruh outlet yang bisa diakses"
          }
          icon={<ShoppingBag className="size-5" />}
        />
        <SummaryCard
          title="Baru Bulan Ini"
          value={formatInteger(data.summary.newCustomersThisMonth)}
          helper="Berdasarkan tanggal data dibuat"
          icon={<CalendarPlus className="size-5" />}
        />
        <SummaryCard
          title="Status View"
          value={customerStatusLabels[data.filters.status]}
          helper={
            isFiltered ? "Filter sedang aktif" : "Menampilkan pelanggan aktif"
          }
          icon={<Sparkles className="size-5" />}
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <form className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_260px_auto]">
          <label className="flex h-11 min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] px-3 transition focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]">
            <Search className="size-4 shrink-0 text-neutral-400" />
            <input
              name="q"
              type="search"
              defaultValue={filters.search}
              placeholder="Cari nama, kode, WhatsApp, email, atau alamat..."
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
            />
          </label>

          <select
            name="status"
            defaultValue={filters.status}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          >
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="all">Semua status</option>
          </select>

          <label className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[var(--border)] px-3 transition focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]">
            <Store className="size-4 shrink-0 text-neutral-400" />
            <select
              name="outletId"
              defaultValue={filters.outletId ?? ""}
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none"
            >
              <option value="">Semua outlet akses</option>
              {data.outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
          >
            <Search className="size-4" />
            Terapkan
          </button>
        </form>

        {isFiltered ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span className="rounded-full bg-neutral-100 px-3 py-1">
              {formatInteger(data.total)} hasil ditemukan
            </span>
            <Link
              href="/admin/pelanggan"
              className="rounded-full border border-[var(--border)] px-3 py-1 font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Reset filter
            </Link>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 lg:hidden">
        {data.rows.length > 0 ? (
          data.rows.map((customer) => (
            <CustomerMobileCard key={customer.id} customer={customer} />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-5 py-10 text-center">
            <UserRound className="mx-auto size-10 text-neutral-300" />
            <h2 className="mt-3 font-semibold text-neutral-950">
              Pelanggan belum ditemukan
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ubah filter pencarian atau tambahkan pelanggan baru.
            </p>
          </div>
        )}
      </section>

      <section className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-white lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-neutral-50/70 text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-5 py-4 font-semibold">Pelanggan</th>
                <th className="px-5 py-4 font-semibold">Kontak</th>
                <th className="px-5 py-4 font-semibold">Metrik Belanja</th>
                <th className="px-5 py-4 font-semibold">Transaksi Terakhir</th>
                <th className="px-5 py-4 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.rows.length > 0 ? (
                data.rows.map((customer) => {
                  const whatsappHref = buildWhatsAppHref(customer.phone);

                  return (
                    <tr
                      key={customer.id}
                      className="transition-colors hover:bg-neutral-50/60"
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
                            {getCustomerInitials(customer.fullName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/admin/pelanggan/${customer.id}`}
                                className="font-semibold text-neutral-950 hover:text-[var(--accent)]"
                              >
                                {customer.fullName}
                              </Link>
                              <CustomerStatusBadge
                                isActive={customer.isActive}
                              />
                            </div>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {customer.customerCode ?? "Tanpa kode customer"} ·
                              Bergabung {formatDate(customer.createdAt)}
                            </p>
                            {customer.notes ? (
                              <p className="mt-2 line-clamp-2 max-w-sm text-xs leading-5 text-[var(--muted)]">
                                {customer.notes}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-1.5 text-sm text-neutral-700">
                          {customer.phone ? (
                            <p className="flex items-center gap-2">
                              <Phone className="size-3.5 text-neutral-400" />
                              {customer.phone}
                            </p>
                          ) : null}
                          {customer.email ? (
                            <p className="flex items-center gap-2">
                              <Mail className="size-3.5 text-neutral-400" />
                              {customer.email}
                            </p>
                          ) : null}
                          {customer.address ? (
                            <p className="flex max-w-xs items-center gap-2 text-xs text-[var(--muted)]">
                              <MapPin className="size-3.5 shrink-0 text-neutral-400" />
                              <span className="truncate">
                                {customer.address}
                              </span>
                            </p>
                          ) : null}
                          {!customer.phone &&
                          !customer.email &&
                          !customer.address ? (
                            <p className="text-xs text-[var(--muted)]">
                              Kontak belum dilengkapi
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-neutral-950">
                          {formatMoney(customer.totalSpent)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatInteger(customer.totalTransactions)} transaksi
                          · {formatInteger(customer.totalItems)} item
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {customer.lastTransaction ? (
                          <div>
                            <Link
                              href={`/admin/penjualan/${customer.lastTransaction.id}`}
                              className="font-medium text-neutral-950 hover:text-[var(--accent)]"
                            >
                              {customer.lastTransaction.invoiceNumber}
                            </Link>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {formatDateTime(
                                customer.lastTransaction.completedAt ??
                                  customer.lastTransaction.createdAt,
                              )}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {customer.lastTransaction.outletName} ·{" "}
                              {customer.lastTransaction.cashierName}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-[var(--muted)]">
                            Belum ada transaksi
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right align-top">
                        <div className="flex justify-end gap-2">
                          {whatsappHref ? (
                            <a
                              href={whatsappHref}
                              target="_blank"
                              rel="noreferrer"
                              className="grid size-9 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                              aria-label={`Chat WhatsApp ${customer.fullName}`}
                            >
                              <MessageCircle className="size-4" />
                            </a>
                          ) : null}
                          <Link
                            href={`/admin/pelanggan/${customer.id}`}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                          >
                            Detail
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <UserRound className="mx-auto size-10 text-neutral-300" />
                    <p className="mt-3 font-semibold text-neutral-950">
                      Pelanggan belum ditemukan
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Ubah filter pencarian atau tambahkan pelanggan baru.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.pageCount > 1 ? (
        <nav className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[var(--muted)]">
            Halaman {data.page} dari {data.pageCount} ·{" "}
            {formatInteger(data.total)} pelanggan
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={buildCustomersListUrl(
                Math.max(1, data.page - 1),
                data.filters,
              )}
              aria-disabled={data.page <= 1}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium transition",
                data.page <= 1
                  ? "pointer-events-none bg-neutral-50 text-neutral-300"
                  : "bg-white text-neutral-700 hover:bg-neutral-50",
              )}
            >
              <ChevronLeft className="size-4" />
              Sebelumnya
            </Link>
            <Link
              href={buildCustomersListUrl(
                Math.min(data.pageCount, data.page + 1),
                data.filters,
              )}
              aria-disabled={data.page >= data.pageCount}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium transition",
                data.page >= data.pageCount
                  ? "pointer-events-none bg-neutral-50 text-neutral-300"
                  : "bg-white text-neutral-700 hover:bg-neutral-50",
              )}
            >
              Berikutnya
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
