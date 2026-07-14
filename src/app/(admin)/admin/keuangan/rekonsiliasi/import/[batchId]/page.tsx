import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileSearch,
  FileSpreadsheet,
  Link2,
  RotateCcw,
  SearchX,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import {
  analyzeSettlementImportAction,
  applySettlementImportRowAction,
  commitSettlementImportMatchesAction,
  ignoreSettlementImportRowAction,
} from "@/app/actions/settlement-import";
import {
  settlementImportColumnKeys,
  type SettlementImportRowStatus,
  type SettlementImportStatus,
} from "@/features/reconciliation/import-contracts";
import { getSettlementImportBatchDetail } from "@/features/reconciliation/import-queries";
import { requirePermission } from "@/lib/auth/session";
import { getSettlementImportFileUrl } from "@/lib/storage/settlement-import-storage";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const batchStatusLabels: Record<SettlementImportStatus, string> = {
  uploaded: "Perlu mapping",
  ready: "Siap diproses",
  processing: "Sedang diproses",
  completed: "Selesai",
  completed_with_issues: "Selesai dengan review",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

const rowStatusLabels: Record<SettlementImportRowStatus, string> = {
  pending: "Belum dianalisis",
  matched: "Exact match",
  ambiguous: "Ambiguous",
  mismatch: "Nominal berbeda",
  not_found: "Tidak ditemukan",
  duplicate: "Duplicate",
  ignored: "Diabaikan",
  applied: "Sudah diterapkan",
  failed: "Baris tidak valid",
};

const mappingLabels: Record<(typeof settlementImportColumnKeys)[number], string> = {
  transactionDate: "Tanggal transaksi",
  paymentReference: "Reference payment",
  grossAmount: "Gross amount",
  feeAmount: "Fee/MDR",
  taxAmount: "Pajak",
  netAmount: "Net settlement",
  settlementReference: "Reference settlement",
  providerStatus: "Status provider",
};

function formatMoney(value: string | number | null) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function FlashMessage({ type, message }: { type?: string; message?: string }) {
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

function RowStatusBadge({ status }: { status: SettlementImportRowStatus }) {
  const className =
    status === "applied"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "matched"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : status === "ignored"
          ? "border-neutral-200 bg-neutral-50 text-neutral-600"
          : status === "failed" || status === "mismatch"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", className)}>
      {rowStatusLabels[status]}
    </span>
  );
}

function MetricCard({
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
  tone: "neutral" | "blue" | "emerald" | "amber" | "red";
}) {
  const toneClass = {
    neutral: "bg-neutral-100 text-neutral-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  }[tone];
  return (
    <article className="rounded-3xl border border-[var(--border)] bg-white p-5">
      <div className={cn("grid size-10 place-items-center rounded-xl", toneClass)}>{icon}</div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</p>
      <p className="mt-2 text-2xl font-bold text-neutral-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{description}</p>
    </article>
  );
}

function getPageUrl(batchId: string, page: number) {
  return page <= 1
    ? `/admin/keuangan/rekonsiliasi/import/${batchId}`
    : `/admin/keuangan/rekonsiliasi/import/${batchId}?page=${page}`;
}

export default async function SettlementImportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ page?: string; type?: string; message?: string }>;
}) {
  const auth = await requirePermission("payments.reconciliation.import");
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const page = Math.max(1, Number(query.page) || 1);
  const data = await getSettlementImportBatchDetail(auth, batchId, page);
  if (!data) notFound();

  const fileUrl = getSettlementImportFileUrl(data.batch.fileKey);
  const reviewCount =
    data.batch.ambiguousCount +
    data.batch.mismatchCount +
    data.batch.notFoundCount +
    data.batch.duplicateCount +
    data.batch.failedCount;
  const canAnalyze = ["uploaded", "ready"].includes(data.batch.status);
  const canCommit = data.batch.status === "ready" && data.batch.matchedCount > 0;

  return (
    <div className="space-y-6">
      <FlashMessage type={query.type} message={query.message} />

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:items-end lg:p-7">
          <div>
            <Link
              href="/admin/keuangan/rekonsiliasi/import"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-[var(--accent-soft)]/40"
            >
              <ArrowLeft className="size-4" />
              Kembali ke import settlement
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                {batchStatusLabels[data.batch.status]}
              </span>
              <span className="text-xs text-[var(--muted)]">SHA-256 {data.batch.fileHash.slice(0, 12)}…</span>
            </div>
            <h1 className="mt-3 max-w-3xl truncate text-2xl font-semibold text-neutral-950 sm:text-3xl">
              {data.batch.fileName}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {data.batch.outletName} · {data.batch.profileName} · {data.batch.provider}
              <br />Diupload oleh {data.batch.uploadedByName} pada {formatDateTime(data.batch.createdAt)}.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Ringkasan batch</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-950">{data.batch.appliedCount} dari {data.batch.rowCount} applied</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{reviewCount} baris masih perlu review atau perbaikan data.</p>
            {fileUrl ? (
              <a
                href={fileUrl}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                <Download className="size-4" /> Download file sumber
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total baris" value={String(data.batch.rowCount)} description="Baris data di luar header CSV." icon={<FileSpreadsheet className="size-5" />} tone="neutral" />
        <MetricCard title="Exact match" value={String(data.batch.matchedCount)} description="Belum mengubah payment sampai import dikonfirmasi." icon={<Link2 className="size-5" />} tone="blue" />
        <MetricCard title="Applied" value={String(data.batch.appliedCount)} description="Sudah menjadi reconciliation record." icon={<CheckCircle2 className="size-5" />} tone="emerald" />
        <MetricCard title="Perlu review" value={String(reviewCount)} description="Ambiguous, mismatch, duplicate, not found, atau gagal." icon={<AlertTriangle className="size-5" />} tone="amber" />
        <MetricCard title="Diabaikan" value={String(data.batch.ignoredCount)} description="Ditutup dengan alasan dan audit trail." icon={<ShieldCheck className="size-5" />} tone="neutral" />
      </section>

      {canAnalyze ? (
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">Mapping kolom CSV</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Mapping tersimpan per payment profile. Analisis hanya membuat kandidat dan tidak mengubah payment POS.
              </p>
            </div>
            {data.batch.status === "ready" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                <RotateCcw className="size-3.5" /> Mapping dapat dianalisis ulang
              </span>
            ) : null}
          </div>

          <form action={analyzeSettlementImportAction} className="mt-6">
            <input type="hidden" name="batchId" value={data.batch.id} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {settlementImportColumnKeys.map((key) => {
                const required = ["transactionDate", "paymentReference", "grossAmount"].includes(key);
                return (
                  <label key={key} className="grid gap-2 text-sm font-semibold text-neutral-800">
                    {mappingLabels[key]} {required ? <span className="text-red-600">*</span> : null}
                    <select
                      name={key}
                      defaultValue={data.batch.columnMapping[key] ?? ""}
                      required={required}
                      className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                    >
                      <option value="">{required ? "Pilih kolom" : "Tidak digunakan"}</option>
                      {data.batch.headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
            <button
              type="submit"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              <FileSearch className="size-4" /> Analisis dan buat kandidat
            </button>
          </form>
        </section>
      ) : null}

      {canCommit ? (
        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 lg:flex lg:items-center lg:justify-between lg:gap-6 lg:p-6">
          <div>
            <p className="font-semibold text-blue-950">{data.batch.matchedCount} exact match siap diterapkan</p>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              Hanya baris dengan profile, outlet, reference, dan gross amount yang cocok tepat. Semua baris lain tetap berada di review queue.
            </p>
          </div>
          <form action={commitSettlementImportMatchesAction} className="mt-4 lg:mt-0">
            <input type="hidden" name="batchId" value={data.batch.id} />
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">
              <CheckCircle2 className="size-4" /> Import dan rekonsiliasi exact match
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">
              {data.batch.status === "uploaded" ? "Preview data CSV" : "Hasil per baris"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Halaman {data.page} dari {data.pageCount} · {data.total} baris.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {data.rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-neutral-200 p-4 lg:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-500">Baris {row.rowNumber}</span>
                    <RowStatusBadge status={row.status} />
                  </div>
                  <p className="mt-2 font-semibold text-neutral-950">{row.paymentReference ?? "Belum dipetakan"}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{row.matchReason ?? row.errorMessage ?? "Jalankan analisis untuk membuat kandidat."}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-neutral-950">{row.grossAmount == null ? "-" : formatMoney(row.grossAmount)}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatDate(row.transactionDate)}</p>
                </div>
              </div>

              {data.batch.status === "uploaded" ? (
                <div className="mt-4 overflow-x-auto rounded-xl bg-neutral-50 p-3">
                  <div className="flex min-w-max gap-5 text-xs">
                    {data.batch.headers.slice(0, 10).map((header) => (
                      <div key={header} className="min-w-[140px] max-w-[220px]">
                        <p className="font-semibold text-neutral-500">{header}</p>
                        <p className="mt-1 truncate text-neutral-900">{row.rawData[header] || "-"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {row.candidates.length ? (
                <div className="mt-4 grid gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Kandidat payment POS</p>
                  {row.candidates.map((candidate) => (
                    <div key={candidate.paymentId} className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Link href={`/admin/keuangan/rekonsiliasi/${candidate.paymentId}`} className="font-semibold text-neutral-950 hover:text-[var(--accent)]">
                          {candidate.invoiceNumber}
                        </Link>
                        <p className="mt-1 text-xs text-[var(--muted)]">{candidate.providerReference ?? "Tanpa reference"} · {formatDate(candidate.paidAt)} · {formatMoney(candidate.amount)}</p>
                      </div>
                      {["ambiguous", "mismatch", "not_found", "duplicate"].includes(row.status) && candidate.settlementStatus === "unreconciled" ? (
                        <form action={applySettlementImportRowAction}>
                          <input type="hidden" name="batchId" value={data.batch.id} />
                          <input type="hidden" name="rowId" value={row.id} />
                          <input type="hidden" name="paymentId" value={candidate.paymentId} />
                          <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-neutral-950 px-3 text-xs font-semibold text-white hover:bg-neutral-800">
                            <Link2 className="size-3.5" /> Cocokkan payment ini
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs font-semibold text-neutral-500">{candidate.settlementStatus}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {["ambiguous", "mismatch", "not_found", "duplicate", "failed"].includes(row.status) ? (
                <form action={ignoreSettlementImportRowAction} className="mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-neutral-300 p-3 sm:flex-row">
                  <input type="hidden" name="batchId" value={data.batch.id} />
                  <input type="hidden" name="rowId" value={row.id} />
                  <input
                    name="notes"
                    minLength={8}
                    maxLength={500}
                    required
                    placeholder="Alasan mengabaikan baris ini..."
                    className="h-10 flex-1 rounded-lg border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-50">
                    <SearchX className="size-3.5" /> Abaikan dengan alasan
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </div>

        {data.pageCount > 1 ? (
          <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-5">
            <Link
              href={getPageUrl(data.batch.id, Math.max(1, data.page - 1))}
              aria-disabled={data.page <= 1}
              className={cn("inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold", data.page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-neutral-50")}
            >
              <ArrowLeft className="size-4" /> Sebelumnya
            </Link>
            <span className="text-sm font-medium text-[var(--muted)]">{data.page} / {data.pageCount}</span>
            <Link
              href={getPageUrl(data.batch.id, Math.min(data.pageCount, data.page + 1))}
              aria-disabled={data.page >= data.pageCount}
              className={cn("inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold", data.page >= data.pageCount ? "pointer-events-none opacity-40" : "hover:bg-neutral-50")}
            >
              Berikutnya <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : null}
      </section>

      {data.batch.status === "processing" ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <p className="flex items-center gap-2 font-semibold"><Clock3 className="size-4" /> Batch sedang diproses</p>
          <p className="mt-1">Muat ulang halaman setelah proses selesai. Jangan mengunggah file yang sama kembali.</p>
        </div>
      ) : null}
    </div>
  );
}
