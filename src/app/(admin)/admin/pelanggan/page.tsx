import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShoppingBag,
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

export const metadata = {
  title: "Pelanggan",
};

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

function formatDate(value: Date | null, timeZone: string) {
  if (!value) {
    return "Belum pernah";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(value);
}

function formatDateTime(value: Date | null, timeZone: string) {
  if (!value) {
    return "Belum pernah";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
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

function getPaginationTokens(currentPage: number, totalPages: number) {
  const pages = Array.from(
    new Set([
      1,
      totalPages,
      currentPage - 2,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      currentPage + 2,
    ]),
  )
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const tokens: Array<number | "ellipsis"> = [];

  pages.forEach((page, index) => {
    const previous = pages[index - 1];

    if (previous && page - previous > 1) {
      tokens.push("ellipsis");
    }

    tokens.push(page);
  });

  return tokens;
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
          <p className="mt-3 break-words text-md md:text-2xl lg:text-2xl font-semibold text-neutral-950">
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
    <div className="space-y-2 text-xs leading-5 text-[var(--muted)]">
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
        <p className="flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          <span className="line-clamp-2">{customer.address}</span>
        </p>
      ) : null}
      {!customer.phone && !customer.email && !customer.address ? (
        <p>Kontak belum dilengkapi.</p>
      ) : null}
    </div>
  );
}

function CustomerCompactRow({
  customer,
  timeZone,
}: {
  customer: AdminCustomerListRow;
  timeZone: string;
}) {
  const whatsappHref = buildWhatsAppHref(customer.phone);

  return (
    <article
      data-customer-layout="compact-row-card"
      className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm shadow-neutral-950/[0.02] transition hover:border-neutral-300 hover:shadow-md hover:shadow-neutral-950/[0.04] sm:p-5"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
            {getCustomerInitials(customer.fullName)}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/pelanggan/${customer.id}`}
                className="truncate text-base font-semibold text-neutral-950 transition hover:text-[var(--accent)]"
              >
                {customer.fullName}
              </Link>
              <CustomerStatusBadge isActive={customer.isActive} />
            </div>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {customer.customerCode ?? "Tanpa kode customer"} · Bergabung{" "}
              {formatDate(customer.createdAt, timeZone)}
            </p>

            {customer.notes ? (
              <p className="mt-2 line-clamp-2 max-w-3xl text-xs leading-5 text-[var(--muted)]">
                {customer.notes}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          ) : null}

          <Link
            href={`/admin/pelanggan/${customer.id}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
          >
            Lihat detail
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-xl border border-[var(--border)] bg-neutral-50/60 p-3.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Kontak pelanggan
          </p>
          <CustomerContactInfo customer={customer} />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-neutral-50 p-3.5">
            <p className="text-[11px] font-medium uppercase text-[var(--muted)]">
              Total belanja
            </p>
            <p className="mt-1.5 break-words text-base font-semibold text-neutral-950">
              {formatMoney(customer.totalSpent)}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-3.5">
            <p className="text-[11px] font-medium uppercase text-[var(--muted)]">
              Transaksi
            </p>
            <p className="mt-1.5 text-base font-semibold text-neutral-950">
              {formatInteger(customer.totalTransactions)}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 p-3.5">
            <p className="text-[11px] font-medium uppercase text-[var(--muted)]">
              Item
            </p>
            <p className="mt-1.5 text-base font-semibold text-neutral-950">
              {formatInteger(customer.totalItems)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--border)] px-3.5 py-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Transaksi terakhir
            </p>
            {customer.lastTransaction ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <Link
                  href={`/admin/penjualan/${customer.lastTransaction.id}`}
                  className="font-semibold text-neutral-950 transition hover:text-[var(--accent)]"
                >
                  {customer.lastTransaction.invoiceNumber}
                </Link>
                <span className="text-neutral-300">·</span>
                <span className="text-[var(--muted)]">
                  {formatDateTime(
                    customer.lastTransaction.completedAt ??
                      customer.lastTransaction.createdAt,
                    timeZone,
                  )}
                </span>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                Belum ada transaksi selesai.
              </p>
            )}
          </div>

          {customer.lastTransaction ? (
            <p className="text-xs text-[var(--muted)]">
              {customer.lastTransaction.outletName} ·{" "}
              {customer.lastTransaction.cashierName}
            </p>
          ) : null}
        </div>
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
  const selectedOutlet = data.outlets.find(
    (outlet) => outlet.id === filters.outletId,
  );
  const activeFilterCount = [
    filters.search || null,
    filters.status !== "active" ? filters.status : null,
    filters.outletId,
  ].filter(Boolean).length;
  const isFiltered = activeFilterCount > 0;
  const organizationCustomerCount =
    data.summary.activeCustomers + data.summary.inactiveCustomers;
  const paginationTokens = getPaginationTokens(data.page, data.pageCount);
  const timeZone = auth.organization.timezone;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:items-start lg:p-7">
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
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
              <Users className="size-3.5 text-[var(--accent)]" />
              Pelanggan aktif
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-950">
              {formatInteger(data.summary.activeCustomers)} customer
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {formatInteger(organizationCustomerCount)} total pelanggan ·{" "}
              {formatInteger(data.summary.customersWithTransactions)} sudah
              bertransaksi.
            </p>

            <Link
              href="/admin/pelanggan/baru"
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Plus className="size-4" />
              Tambah Customer
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Pelanggan"
          value={formatInteger(organizationCustomerCount)}
          helper={`${formatInteger(data.summary.activeCustomers)} aktif · ${formatInteger(data.summary.inactiveCustomers)} nonaktif`}
          icon={<Users className="size-5" />}
        />
        <SummaryCard
          title="Punya Transaksi"
          value={formatInteger(data.summary.customersWithTransactions)}
          helper={
            selectedOutlet
              ? `Transaksi selesai di ${selectedOutlet.name}`
              : "Transaksi selesai di seluruh outlet akses"
          }
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
          helper="Berdasarkan tanggal data pelanggan dibuat"
          icon={<CalendarPlus className="size-5" />}
        />
      </section>

      <details className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-neutral-50 text-neutral-600">
            <Search className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-neutral-950">
                Filter pelanggan
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
                {customerStatusLabels[filters.status]}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
              {formatInteger(data.total)} pelanggan sesuai filter ·{" "}
              {selectedOutlet ? selectedOutlet.name : "Semua outlet akses"}.
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
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_260px_auto]">
            <label className="flex h-11 min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] px-3 transition focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)] md:col-span-2 xl:col-span-1">
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

            <div className="flex gap-2 md:col-span-2 xl:col-span-1">
              <button
                type="submit"
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <Search className="size-4" />
                Terapkan
              </button>
              {isFiltered ? (
                <Link
                  href="/admin/pelanggan"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        </div>
      </details>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-2 px-1 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Daftar pelanggan</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Profil, kontak, metrik belanja, dan aktivitas transaksi terakhir.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700">
            {formatInteger(data.total)} pelanggan
          </span>
        </div>

        {data.rows.length > 0 ? (
          <div className="space-y-3">
            {data.rows.map((customer) => (
              <CustomerCompactRow
                key={customer.id}
                customer={customer}
                timeZone={timeZone}
              />
            ))}
          </div>
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

      {data.pageCount > 1 ? (
        <nav className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--muted)]">
              Halaman {data.page} dari {data.pageCount} ·{" "}
              {formatInteger(data.total)} pelanggan
            </p>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Link
                href={buildCustomersListUrl(
                  Math.max(1, data.page - 1),
                  data.filters,
                )}
                aria-disabled={data.page <= 1}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold transition",
                  data.page <= 1
                    ? "pointer-events-none bg-neutral-50 text-neutral-300"
                    : "bg-white text-neutral-700 hover:bg-neutral-50",
                )}
              >
                <ChevronLeft className="size-4" />
                Sebelumnya
              </Link>

              <div className="hidden items-center gap-1 md:flex">
                {paginationTokens.map((token, index) =>
                  token === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="grid size-9 place-items-center text-xs font-semibold text-neutral-400"
                    >
                      …
                    </span>
                  ) : (
                    <Link
                      key={token}
                      href={buildCustomersListUrl(token, data.filters)}
                      aria-current={token === data.page ? "page" : undefined}
                      className={cn(
                        "grid size-9 place-items-center rounded-lg text-xs font-semibold transition",
                        token === data.page
                          ? "bg-neutral-950 text-white"
                          : "border border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50",
                      )}
                    >
                      {token}
                    </Link>
                  ),
                )}
              </div>

              <Link
                href={buildCustomersListUrl(
                  Math.min(data.pageCount, data.page + 1),
                  data.filters,
                )}
                aria-disabled={data.page >= data.pageCount}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold transition",
                  data.page >= data.pageCount
                    ? "pointer-events-none bg-neutral-50 text-neutral-300"
                    : "bg-white text-neutral-700 hover:bg-neutral-50",
                )}
              >
                Berikutnya
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
