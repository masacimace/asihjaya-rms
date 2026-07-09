import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Filter,
  Inbox,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  TimerReset,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ApprovalResolutionForm } from "@/components/approvals/approval-resolution-form";
import {
  parseAdminApprovalFilters,
  type AdminApprovalFilters,
  type AdminApprovalRow,
  type AdminApprovalStatus,
  type AdminApprovalType,
} from "@/features/approvals/contracts";
import { getAdminApprovalListData } from "@/features/approvals/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const approvalStatusLabels: Record<AdminApprovalStatus, string> = {
  all: "Semua status",
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const approvalTypeLabels: Record<AdminApprovalType, string> = {
  all: "Semua tipe",
  discount: "Diskon Khusus",
  void_receipt: "Void Nota",
  refund_transaction: "Refund Transaksi",
  stock_adjustment: "Penyesuaian Stok",
  other: "Lainnya",
};

const rangeLabels = {
  today: "Hari ini",
  "7d": "7 hari",
  "30d": "30 hari",
  all: "Semua periode",
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(isoString: string | null) {
  if (!isoString) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(isoString));
}

function getStatusMeta(status: AdminApprovalRow["status"]) {
  if (status === "approved") {
    return {
      label: "Disetujui",
      icon: CheckCircle2,
      badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      card: "border-emerald-100",
      dot: "bg-emerald-500",
    };
  }

  if (status === "rejected") {
    return {
      label: "Ditolak",
      icon: XCircle,
      badge: "bg-red-50 text-red-700 ring-red-100",
      card: "border-red-100",
      dot: "bg-red-500",
    };
  }

  return {
    label: "Menunggu",
    icon: Clock3,
    badge: "bg-amber-50 text-amber-700 ring-amber-100",
    card: "border-amber-200 ring-1 ring-amber-100",
    dot: "bg-amber-500",
  };
}

function getTypeTone(type: AdminApprovalRow["type"]) {
  if (type === "discount") return "bg-violet-50 text-violet-700";
  if (type === "void_receipt") return "bg-red-50 text-red-700";
  if (type === "refund_transaction") return "bg-orange-50 text-orange-700";
  if (type === "stock_adjustment") return "bg-blue-50 text-blue-700";

  return "bg-neutral-100 text-neutral-700";
}

function getLineTone(
  tone: AdminApprovalRow["summary"]["lines"][number]["tone"],
) {
  if (tone === "danger") return "text-red-700";
  if (tone === "success") return "text-emerald-700";
  if (tone === "warning") return "text-amber-700";

  return "text-neutral-900";
}

function buildApprovalQueryParams(filters: AdminApprovalFilters) {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.outletId) params.set("outletId", filters.outletId);
  if (filters.status !== "pending") params.set("status", filters.status);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.range !== "30d") params.set("range", filters.range);

  return params;
}

function buildApprovalListUrl(page: number, filters: AdminApprovalFilters) {
  const params = buildApprovalQueryParams(filters);

  if (page > 1) params.set("page", String(page));

  const query = params.toString();

  return query
    ? `/admin/operasional/approval?${query}`
    : "/admin/operasional/approval";
}

function FlashMessage({
  type,
  message,
}: {
  type?: string | string[];
  message?: string | string[];
}) {
  const normalizedType = Array.isArray(type) ? type[0] : type;
  const normalizedMessage = Array.isArray(message) ? message[0] : message;

  if (!normalizedMessage) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "rounded-3xl border px-5 py-4 text-sm font-medium",
        normalizedType === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {normalizedMessage}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  tone: "amber" | "emerald" | "red" | "neutral";
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  }[tone];

  return (
    <article className="rounded-3xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-neutral-950">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "grid size-11 place-items-center rounded-2xl ring-1",
            toneClass,
          )}
        >
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </article>
  );
}

function ApprovalLines({ approval }: { approval: AdminApprovalRow }) {
  const lines = approval.summary.lines;

  if (lines.length === 0) {
    return (
      <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-[var(--muted)]">
        Request ini belum memiliki detail tambahan.
      </p>
    );
  }

  return (
    <div className="grid gap-2 rounded-2xl bg-neutral-50 p-4 text-sm">
      {lines.map((line) => (
        <div
          key={`${approval.id}-${line.label}`}
          className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {line.label}
          </span>
          <span className={cn("font-semibold", getLineTone(line.tone))}>
            {line.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ApprovalCard({ approval }: { approval: AdminApprovalRow }) {
  const statusMeta = getStatusMeta(approval.status);
  const StatusIcon = statusMeta.icon;

  return (
    <article className={cn("rounded-3xl border bg-white p-5", statusMeta.card)}>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ClipboardCheck className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-neutral-950">
                    {approval.summary.title}
                  </h2>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1",
                      statusMeta.badge,
                    )}
                  >
                    <StatusIcon className="size-3.5" />
                    {statusMeta.label}
                  </span>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold",
                      getTypeTone(approval.type),
                    )}
                  >
                    {approvalTypeLabels[approval.type]}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {approval.summary.description}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
              <p className="text-xs font-medium text-[var(--muted)]">
                Requester
              </p>
              <p className="mt-1 truncate text-sm font-bold text-neutral-950">
                {approval.requestedByName}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
              <p className="text-xs font-medium text-[var(--muted)]">Outlet</p>
              <p className="mt-1 truncate text-sm font-bold text-neutral-950">
                {approval.outletName ?? "Semua outlet"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
              <p className="text-xs font-medium text-[var(--muted)]">
                Referensi
              </p>
              <p className="mt-1 truncate text-sm font-bold text-neutral-950">
                {approval.referenceLabel ?? approval.referenceType ?? "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
              <p className="text-xs font-medium text-[var(--muted)]">Dibuat</p>
              <p className="mt-1 text-sm font-bold text-neutral-950">
                {formatDateTime(approval.createdAtIso)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <ApprovalLines approval={approval} />
          </div>

          {approval.notes || approval.responseNotes ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {approval.notes ? (
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Catatan Request
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">
                    {approval.notes}
                  </p>
                </div>
              ) : null}
              {approval.responseNotes ? (
                <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                    Catatan Keputusan
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">
                    {approval.responseNotes}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {approval.status !== "pending" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              <span className={cn("size-2 rounded-full", statusMeta.dot)} />
              Diproses oleh {approval.approvedByName ?? "-"} pada{" "}
              {formatDateTime(approval.resolvedAtIso)}
            </div>
          ) : null}
        </div>

        {approval.status === "pending" ? (
          <aside className="w-full rounded-3xl border border-[var(--border)] bg-neutral-50 p-4 xl:w-80">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="size-4 text-[var(--accent)]" />
              <p className="text-sm font-bold text-neutral-950">
                Keputusan Manager
              </p>
            </div>
            <ApprovalResolutionForm approval={approval} mode="full" />
          </aside>
        ) : null}
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white p-10 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-3xl bg-neutral-100 text-neutral-500">
        <Inbox className="size-7" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-neutral-950">
        Tidak ada approval ditemukan
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        Coba ubah filter status, tipe approval, outlet, atau periode untuk
        melihat request yang sudah diproses.
      </p>
    </div>
  );
}

export default async function ApprovalPage({ searchParams }: PageProps) {
  const auth = await requirePermission("admin.access");
  const query = await searchParams;
  const filters = parseAdminApprovalFilters(query);
  const data = await getAdminApprovalListData(auth, filters);
  const previousPageUrl = buildApprovalListUrl(
    Math.max(1, data.page - 1),
    filters,
  );
  const nextPageUrl = buildApprovalListUrl(
    Math.min(data.pageCount, data.page + 1),
    filters,
  );

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-white">
        <div className="relative p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-[var(--accent-soft)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-col items-start gap-3">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-[var(--accent)]"
                >
                  <ArrowLeft className="size-4" />
                  Kembali ke Dashboard
                </Link>
              </div>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                Kotak Masuk Approval
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Tinjau diskon khusus, pembatalan nota, penyesuaian stok, dan
                request operasional lain dengan audit trail yang rapi.
              </p>
            </div>

            <div className="grid gap-3 rounded-3xl border border-[var(--border)] bg-neutral-50/80 p-4 sm:min-w-72">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-[var(--muted)]">
                  Periode aktif
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-900">
                  {data.periodLabel}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-[var(--muted)]">
                  Total hasil
                </span>
                <span className="text-lg font-bold text-neutral-950">
                  {formatInteger(data.summary.total)} request
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <FlashMessage type={query.type} message={query.message} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Menunggu"
          value={formatInteger(data.summary.pending)}
          description="Request yang perlu segera ditinjau manager."
          icon={<Clock3 className="size-5" />}
          tone="amber"
        />
        <SummaryCard
          title="Disetujui"
          value={formatInteger(data.summary.approved)}
          description="Request yang sudah lolos approval."
          icon={<CheckCircle2 className="size-5" />}
          tone="emerald"
        />
        <SummaryCard
          title="Ditolak"
          value={formatInteger(data.summary.rejected)}
          description="Request yang ditolak beserta catatan audit."
          icon={<XCircle className="size-5" />}
          tone="red"
        />
        <SummaryCard
          title="Impact Pending"
          value={formatInteger(data.summary.highImpactPending)}
          description="Request pending dengan nominal/impact tercatat di halaman ini."
          icon={<AlertCircle className="size-5" />}
          tone="neutral"
        />
      </section>

      <section className="rounded-[2rem] border border-[var(--border)] bg-white p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-950">
              <SlidersHorizontal className="size-5 text-[var(--accent)]" />
              Filter Approval
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Cari request berdasarkan staff, outlet, invoice, catatan, atau
              detail JSON request.
            </p>
          </div>
          <Link
            href="/admin/operasional/approval"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <TimerReset className="size-4" />
            Reset
          </Link>
        </div>

        <form className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(150px,1fr))_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              name="q"
              defaultValue={filters.search}
              placeholder="Cari requester, invoice, alasan..."
              className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
          </label>

          <label className="relative block">
            <Store className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <select
              name="outletId"
              defaultValue={filters.outletId ?? ""}
              className="h-11 w-full appearance-none rounded-2xl border border-[var(--border)] bg-white pl-10 pr-4 text-sm font-medium outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            >
              <option value="">Semua outlet</option>
              {data.outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.code} — {outlet.name}
                </option>
              ))}
            </select>
          </label>

          <label className="relative block">
            <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <select
              name="status"
              defaultValue={filters.status}
              className="h-11 w-full appearance-none rounded-2xl border border-[var(--border)] bg-white pl-10 pr-4 text-sm font-medium outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            >
              {Object.entries(approvalStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <select
            name="type"
            defaultValue={filters.type}
            className="h-11 rounded-2xl border border-[var(--border)] bg-white px-4 text-sm font-medium outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          >
            {Object.entries(approvalTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            name="range"
            defaultValue={filters.range}
            className="h-11 rounded-2xl border border-[var(--border)] bg-white px-4 text-sm font-medium outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          >
            {Object.entries(rangeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800">
            <Search className="size-4" />
            Terapkan
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {data.rows.length > 0 ? (
          data.rows.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} />
          ))
        ) : (
          <EmptyState />
        )}
      </section>

      {data.pageCount > 1 ? (
        <nav className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            Halaman{" "}
            <span className="font-bold text-neutral-950">{data.page}</span> dari{" "}
            <span className="font-bold text-neutral-950">{data.pageCount}</span>
          </p>
          <div className="flex gap-2">
            <Link
              href={previousPageUrl}
              aria-disabled={data.page <= 1}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold transition hover:bg-neutral-50",
                data.page <= 1 && "pointer-events-none opacity-50",
              )}
            >
              <ChevronLeft className="size-4" />
              Sebelumnya
            </Link>
            <Link
              href={nextPageUrl}
              aria-disabled={data.page >= data.pageCount}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold transition hover:bg-neutral-50",
                data.page >= data.pageCount && "pointer-events-none opacity-50",
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
