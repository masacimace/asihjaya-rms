import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Filter,
  Inbox,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { NotificationCenterPage } from "@/components/notifications/notification-center-page";
import {
  adminNotificationCategories,
  adminNotificationDateRanges,
  adminNotificationPageStatuses,
  adminNotificationSeverities,
  parseAdminNotificationFilters,
  type AdminNotificationDateRange,
  type AdminNotificationPageStatus,
  type NotificationCategory,
  type NotificationSeverity,
} from "@/features/notifications/contracts";
import { getAdminNotificationPageData } from "@/features/notifications/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";

const categoryLabels: Record<NotificationCategory, string> = {
  sales: "Transaksi",
  payment: "Keuangan",
  cash_shift: "Shift & Kas",
  inventory_return: "Retur & Stok",
  hardware: "Hardware",
  security: "Keamanan",
  system: "Sistem",
  approval_result: "Hasil Approval",
};

const severityLabels: Record<NotificationSeverity, string> = {
  info: "Info",
  success: "Berhasil",
  warning: "Peringatan",
  critical: "Kritis",
};

const statusLabels: Record<AdminNotificationPageStatus, string> = {
  all: "Semua aktif",
  unread: "Belum dibaca",
  read: "Sudah dibaca",
  actionable: "Perlu tindakan",
  resolved: "Selesai",
  archived: "Diarsipkan",
};

const rangeLabels: Record<AdminNotificationDateRange, string> = {
  today: "Hari ini",
  "7d": "7 hari terakhir",
  "30d": "30 hari terakhir",
  "90d": "90 hari terakhir",
  all: "Semua waktu",
  custom: "Tanggal khusus",
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function createPageHref({
  filters,
  page,
}: {
  filters: Awaited<ReturnType<typeof parseAdminNotificationFilters>>;
  page: number;
}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.severity !== "all") params.set("severity", filters.severity);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.outletId) params.set("outletId", filters.outletId);
  if (filters.range !== "30d") params.set("range", filters.range);
  if (filters.range === "custom" && filters.from)
    params.set("from", filters.from);
  if (filters.range === "custom" && filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/notifikasi?${query}` : "/admin/notifikasi";
}

export default async function NotificationCenterPageRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requirePermission("admin.access");
  const filters = parseAdminNotificationFilters(await searchParams);
  const data = await getAdminNotificationPageData(auth, filters);
  const isFiltered = Boolean(
    filters.search ||
    filters.category !== "all" ||
    filters.severity !== "all" ||
    filters.status !== "all" ||
    filters.outletId ||
    filters.range !== "30d" ||
    filters.from ||
    filters.to,
  );

  const summaryCards = [
    {
      label: "Notifikasi aktif",
      value: data.summary.total,
      description: "Tidak termasuk arsip",
      icon: Inbox,
      className: "bg-neutral-100 text-neutral-700",
    },
    {
      label: "Belum dibaca",
      value: data.summary.unread,
      description: "Masih perlu ditinjau",
      icon: Bell,
      className: "bg-blue-50 text-blue-700",
    },
    {
      label: "Perlu tindakan",
      value: data.summary.actionable,
      description: "Belum diselesaikan",
      icon: TriangleAlert,
      className: "bg-amber-50 text-amber-700",
    },
    {
      label: "Selesai",
      value: data.summary.resolved,
      description: "Event sudah resolved",
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Diarsipkan",
      value: data.summary.archived,
      description: "Tersembunyi dari drawer",
      icon: Archive,
      className: "bg-violet-50 text-violet-700",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-neutral-700"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>

            <div className="mt-4 flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Bell className="size-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-neutral-950 sm:text-3xl">
                  Notification Center
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Cari, filter, tinjau, dan arsipkan notifikasi transaksi serta
                  event operasional dari seluruh outlet yang dapat kamu akses.
                </p>
              </div>
            </div>
          </div>

          <div className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[var(--border)] bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-600">
            <CalendarDays className="size-4" />
            Periode: {data.periodLabel}
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(
          ({ label, value, description, icon: Icon, className }) => (
            <div
              key={label}
              className="rounded-2xl border border-[var(--border)] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-500">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-neutral-950">
                    {formatInteger(value)}
                  </p>
                </div>
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-xl",
                    className,
                  )}
                >
                  <Icon className="size-5" />
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500">
                {description}
              </p>
            </div>
          ),
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] bg-neutral-50/70 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white text-neutral-600 shadow-sm">
                <SlidersHorizontal className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Filter notifikasi
                </h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-500">
                  Cari berdasarkan judul, ringkasan, tipe event, entity, atau
                  outlet.
                </p>
              </div>
            </div>

            {isFiltered ? (
              <span className="inline-flex w-fit items-center rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]">
                Filter aktif
              </span>
            ) : null}
          </div>
        </div>

        <form method="get" className="space-y-5 p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
            <label className="min-w-0 md:col-span-2 xl:col-span-4">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">
                Pencarian
              </span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  name="q"
                  defaultValue={filters.search}
                  placeholder="Cari invoice, event, atau outlet..."
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 hover:border-neutral-300 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
              </span>
            </label>

            <label className="min-w-0 xl:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">
                Status
              </span>
              <select
                name="status"
                defaultValue={filters.status}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition hover:border-neutral-300 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              >
                {adminNotificationPageStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 xl:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">
                Kategori
              </span>
              <select
                name="category"
                defaultValue={filters.category}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition hover:border-neutral-300 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              >
                <option value="all">Semua kategori</option>
                {adminNotificationCategories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 xl:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">
                Severity
              </span>
              <select
                name="severity"
                defaultValue={filters.severity}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition hover:border-neutral-300 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              >
                <option value="all">Semua severity</option>
                {adminNotificationSeverities.map((severity) => (
                  <option key={severity} value={severity}>
                    {severityLabels[severity]}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 xl:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-neutral-600">
                Outlet
              </span>
              <select
                name="outletId"
                defaultValue={filters.outletId ?? ""}
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition hover:border-neutral-300 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              >
                <option value="">Semua outlet</option>
                {data.outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.code} · {outlet.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-4">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-neutral-500 shadow-sm ring-1 ring-[var(--border)]">
                <CalendarRange className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">
                  Periode notifikasi
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                  Pilih periode cepat atau gunakan tanggal khusus untuk rentang
                  yang lebih spesifik.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="min-w-0">
                <span className="mb-2 block text-xs font-semibold text-neutral-600">
                  Rentang waktu
                </span>
                <select
                  name="range"
                  defaultValue={filters.range}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition hover:border-neutral-300 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                >
                  {adminNotificationDateRanges.map((range) => (
                    <option key={range} value={range}>
                      {rangeLabels[range]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className="mb-2 block text-xs font-semibold text-neutral-600">
                  Tanggal mulai
                </span>
                <input
                  type="date"
                  name="from"
                  defaultValue={filters.from ?? ""}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition hover:border-neutral-300 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
              </label>

              <label className="min-w-0">
                <span className="mb-2 block text-xs font-semibold text-neutral-600">
                  Tanggal akhir
                </span>
                <input
                  type="date"
                  name="to"
                  defaultValue={filters.to ?? ""}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition hover:border-neutral-300 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-neutral-500">
              Tanggal mulai dan akhir digunakan saat periode
              <span className="font-semibold text-neutral-700">
                {" "}
                Tanggal khusus{" "}
              </span>
              dipilih.
            </p>

            <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
              {isFiltered ? (
                <Link
                  href="/admin/notifikasi"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:flex-none"
                >
                  <RotateCcw className="size-4" />
                  Reset
                </Link>
              ) : null}
              <button
                type="submit"
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus:outline-none focus:ring-4 focus:ring-neutral-200 sm:flex-none"
              >
                <Filter className="size-4" />
                Terapkan filter
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">
              Daftar notifikasi
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {formatInteger(data.totalCount)} notifikasi ditemukan · halaman{" "}
              {data.page} dari {data.pageCount}.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600">
            Maksimal {data.pageSize} per halaman
          </span>
        </div>

        <NotificationCenterPage
          key={data.rows.map((row) => `${row.id}:${row.status}`).join("|")}
          initialRows={data.rows}
        />
      </section>

      {data.pageCount > 1 ? (
        <nav
          aria-label="Pagination notifikasi"
          className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="px-2 text-sm text-neutral-500">
            Menampilkan halaman {data.page} dari {data.pageCount}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={createPageHref({
                filters: data.filters,
                page: data.page - 1,
              })}
              aria-disabled={data.page <= 1}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition",
                data.page > 1
                  ? "border-[var(--border)] text-neutral-700 hover:bg-neutral-50"
                  : "pointer-events-none border-neutral-100 bg-neutral-50 text-neutral-300",
              )}
            >
              <ArrowLeft className="size-4" />
              Sebelumnya
            </Link>
            <Link
              href={createPageHref({
                filters: data.filters,
                page: data.page + 1,
              })}
              aria-disabled={data.page >= data.pageCount}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition",
                data.page < data.pageCount
                  ? "border-[var(--border)] text-neutral-700 hover:bg-neutral-50"
                  : "pointer-events-none border-neutral-100 bg-neutral-50 text-neutral-300",
              )}
            >
              Berikutnya
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
