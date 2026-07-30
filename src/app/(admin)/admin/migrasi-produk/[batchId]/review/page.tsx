import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { bulkApproveLegacyMigrationVerificationsAction } from "@/app/actions/legacy-migration-review";
import {
  parseLegacyReviewFilters,
  type LegacyReviewStatusFilter,
} from "@/features/legacy-migration/review-contracts";
import { getLegacyMigrationReviewQueue } from "@/features/legacy-migration/review-queries";
import { canBulkApproveLegacyVerification } from "@/features/legacy-migration/review-rules";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Review Migrasi Produk" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function flashMessage(type?: string, message?: string) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-3xl border px-5 py-4 text-sm font-medium",
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {message}
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    submitted: "Clean / terkirim",
    needs_review: "Perlu review",
    returned: "Dikembalikan",
    approved: "Disetujui",
    rejected: "Ditolak",
    sold_during_migration: "Terjual saat migrasi",
    activated: "Aktif",
  };
  return labels[status] ?? status;
}

function statusClass(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "needs_review") return "bg-amber-50 text-amber-700";
  if (status === "returned") return "bg-blue-50 text-blue-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-neutral-100 text-neutral-700";
}

function pageHref(input: {
  batchId: string;
  page: number;
  status: LegacyReviewStatusFilter;
  search: string;
  sessionId: string | null;
}) {
  const query = new URLSearchParams();
  if (input.page > 1) query.set("page", String(input.page));
  if (input.status !== "pending") query.set("status", input.status);
  if (input.search) query.set("q", input.search);
  if (input.sessionId) query.set("sessionId", input.sessionId);
  const suffix = query.toString();
  return `/admin/migrasi-produk/${input.batchId}/review${suffix ? `?${suffix}` : ""}`;
}

export default async function LegacyMigrationReviewQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireAnyPermission([
    "migration.verification.review",
    "migration.verification.approve",
  ]);
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const filters = parseLegacyReviewFilters(query);
  const data = await getLegacyMigrationReviewQueue(auth, batchId, filters);
  if (!data) notFound();
  const canApprove = hasPermission(auth, "migration.verification.approve");

  const filterItems: Array<{
    label: string;
    value: LegacyReviewStatusFilter;
    count?: number;
  }> = [
    {
      label: "Menunggu review",
      value: "pending",
      count: data.summary.submitted + data.summary.needsReview,
    },
    { label: "Clean", value: "submitted", count: data.summary.submitted },
    {
      label: "Perlu review",
      value: "needs_review",
      count: data.summary.needsReview,
    },
    { label: "Dikembalikan", value: "returned", count: data.summary.returned },
    { label: "Disetujui", value: "approved", count: data.summary.approved },
    { label: "Ditolak", value: "rejected", count: data.summary.rejected },
    { label: "Semua", value: "all" },
  ];

  return (
    <div className="space-y-6">
      {flashMessage(
        typeof query.type === "string" ? query.type : undefined,
        typeof query.message === "string" ? query.message : undefined,
      )}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href={`/admin/migrasi-produk/${data.batch.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" /> Kembali ke batch
        </Link>
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <ClipboardCheck className="size-3.5" /> Milestone 4 · Manager
              Review
            </p>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Antrean review migrasi
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {data.batch.outletName} · item yang disetujui dibuat sebagai
              <strong> migration hold</strong>. Belum tersedia dan belum bisa
              dijual di POS sampai cutover.
            </p>
          </div>
          <Link
            href={`/admin/migrasi-produk/${data.batch.id}/sesi`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-900"
          >
            Lihat sesi etalase
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <PackageCheck className="size-5 text-neutral-600" />
          <p className="mt-3 text-2xl font-semibold">
            {data.summary.submitted}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Clean, siap bulk approve
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="size-5 text-amber-700" />
          <p className="mt-3 text-2xl font-semibold text-amber-900">
            {data.summary.needsReview}
          </p>
          <p className="text-xs text-amber-800">Perlu review individual</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <RotateCcw className="size-5 text-blue-700" />
          <p className="mt-3 text-2xl font-semibold text-blue-900">
            {data.summary.returned}
          </p>
          <p className="text-xs text-blue-800">Dikembalikan ke staff</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="size-5 text-emerald-700" />
          <p className="mt-3 text-2xl font-semibold text-emerald-900">
            {data.summary.approved}
          </p>
          <p className="text-xs text-emerald-800">Migration hold</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <XCircle className="size-5 text-red-700" />
          <p className="mt-3 text-2xl font-semibold text-red-900">
            {data.summary.rejected}
          </p>
          <p className="text-xs text-red-800">Ditolak</p>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <form className="grid gap-3 lg:grid-cols-[1fr_240px_auto]">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-3">
            <Search className="size-4 text-neutral-400" />
            <input
              name="q"
              defaultValue={filters.search}
              placeholder="Cari barcode, nama item, atau master..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <select
            name="sessionId"
            defaultValue={filters.sessionId ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="">Semua sesi</option>
            {data.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} · {session.status}
              </option>
            ))}
          </select>
          <button className="h-11 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white">
            Terapkan
          </button>
          <input type="hidden" name="status" value={filters.status} />
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {filterItems.map((item) => (
            <Link
              key={item.value}
              href={pageHref({
                batchId: data.batch.id,
                page: 1,
                status: item.value,
                search: filters.search,
                sessionId: filters.sessionId,
              })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                filters.status === item.value
                  ? "border-neutral-950 bg-neutral-950 !text-white"
                  : "border-[var(--border)] bg-white text-neutral-700",
              )}
            >
              {item.label}
              {typeof item.count === "number" ? ` · ${item.count}` : ""}
            </Link>
          ))}
        </div>
      </section>

      <form action={bulkApproveLegacyMigrationVerificationsAction}>
        <input type="hidden" name="batchId" value={data.batch.id} />
        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-neutral-950">
                Daftar verification
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Centang hanya item clean. Approval individual tersedia pada
                detail.
              </p>
            </div>
            {canApprove ? (
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white">
                <ShieldCheck className="size-4" /> Bulk approve clean
              </button>
            ) : null}
          </div>

          {data.rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--muted)]">
              Tidak ada verification sesuai filter.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {data.rows.map((row) => {
                const clean = canBulkApproveLegacyVerification({
                  status: row.status,
                  reviewFlags: row.reviewFlags,
                  condition: row.condition,
                });
                return (
                  <article
                    key={row.id}
                    className="grid gap-4 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center lg:p-5"
                  >
                    <input
                      type="checkbox"
                      name="verificationIds"
                      value={row.id}
                      disabled={!clean || !canApprove}
                      aria-label={`Pilih ${row.barcodeValue}`}
                      className="size-5 accent-emerald-700 disabled:opacity-30"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-neutral-950">
                          {row.barcodeValue}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            statusClass(row.status),
                          )}
                        >
                          {statusLabel(row.status)}
                        </span>
                        {row.source === "physical_unmatched" ? (
                          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                            Tidak ada di export
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 truncate font-semibold text-neutral-900">
                        {row.verifiedItemName}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {row.productMasterCode} · {row.productMasterName} ·{" "}
                        {row.verifiedWeightGram} g · kadar {row.verifiedPurity}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {row.sessionName} · {row.submittedByName}
                      </p>
                      {row.reviewFlags.length > 0 ? (
                        <p className="mt-2 text-xs font-medium text-amber-700">
                          {row.reviewFlags.length} review flag
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={`/admin/migrasi-produk/${data.batch.id}/review/${row.id}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-xs font-semibold text-neutral-900"
                    >
                      Buka detail
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </form>

      <nav className="flex items-center justify-between gap-3">
        <Link
          aria-disabled={data.pagination.page <= 1}
          href={pageHref({
            batchId: data.batch.id,
            page: Math.max(1, data.pagination.page - 1),
            status: filters.status,
            search: filters.search,
            sessionId: filters.sessionId,
          })}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm font-semibold",
            data.pagination.page <= 1 && "pointer-events-none opacity-40",
          )}
        >
          Sebelumnya
        </Link>
        <span className="text-sm text-[var(--muted)]">
          Halaman {data.pagination.page} dari {data.pagination.totalPages} ·{" "}
          {data.pagination.total} item
        </span>
        <Link
          aria-disabled={data.pagination.page >= data.pagination.totalPages}
          href={pageHref({
            batchId: data.batch.id,
            page: Math.min(
              data.pagination.totalPages,
              data.pagination.page + 1,
            ),
            status: filters.status,
            search: filters.search,
            sessionId: filters.sessionId,
          })}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm font-semibold",
            data.pagination.page >= data.pagination.totalPages &&
              "pointer-events-none opacity-40",
          )}
        >
          Berikutnya
        </Link>
      </nav>
    </div>
  );
}
