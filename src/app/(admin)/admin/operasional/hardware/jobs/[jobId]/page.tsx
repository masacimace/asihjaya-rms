import { randomUUID } from "node:crypto";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { resolveUnknownHardwareJobAction } from "@/app/actions/hardware";
import type {
  HardwareJobOperationalDetail,
  HardwareJobSummary,
} from "@/features/hardware/contracts";
import { getHardwareJobOperationalDetail } from "@/features/hardware/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Hardware Job Detail",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ jobId: string }>;
};

const jobStatusLabels: Record<HardwareJobSummary["status"], string> = {
  pending: "Menunggu",
  claimed: "Diklaim",
  processing: "Diproses",
  printing: "Diproses (v1)",
  submitted: "Terkirim ke printer",
  completed: "Selesai",
  failed: "Gagal",
  unknown_outcome: "Hasil belum diketahui",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
};

const jobTypeLabels: Record<HardwareJobSummary["jobType"], string> = {
  print_label_sato: "Cetak Label SATO",
  print_receipt_certificate: "Cetak Nota/Certificate",
  open_cash_drawer: "Buka Cash Drawer",
  test_label_printer: "Test Label Printer",
  test_document_printer: "Test Document Printer",
  test_cash_drawer: "Test Cash Drawer",
};

function formatDateTime(value: Date | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function StatusPill({ status }: { status: HardwareJobSummary["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
        status === "completed" && "bg-emerald-50 text-emerald-700",
        status === "failed" && "bg-red-50 text-red-700",
        status === "unknown_outcome" && "bg-orange-100 text-orange-900",
        status === "submitted" && "bg-violet-50 text-violet-700",
        (status === "processing" || status === "printing") &&
          "bg-blue-50 text-blue-700",
        status === "claimed" && "bg-amber-50 text-amber-700",
        status === "pending" && "bg-neutral-100 text-neutral-700",
        (status === "cancelled" || status === "expired") &&
          "bg-neutral-100 text-neutral-500",
      )}
    >
      {jobStatusLabels[status]}
    </span>
  );
}

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-medium text-neutral-950">
        {children}
      </div>
    </div>
  );
}

function ResolutionForm({
  jobId,
  resolutionType,
  title,
  helper,
  submitLabel,
  tone,
  requireRiskAcknowledgement = false,
}: {
  jobId: string;
  resolutionType: "confirmed_completed" | "retry_authorized" | "cancelled";
  title: string;
  helper: string;
  submitLabel: string;
  tone: "success" | "warning" | "danger";
  requireRiskAcknowledgement?: boolean;
}) {
  return (
    <form
      action={resolveUnknownHardwareJobAction}
      className={cn(
        "rounded-2xl border p-4",
        tone === "success" && "border-emerald-200 bg-emerald-50",
        tone === "warning" && "border-amber-300 bg-amber-50",
        tone === "danger" && "border-red-200 bg-red-50",
      )}
    >
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="resolutionType" value={resolutionType} />
      <input type="hidden" name="requestId" value={randomUUID()} />

      <h3 className="font-semibold text-neutral-950">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-neutral-700">{helper}</p>

      <label className="mt-4 block text-xs font-semibold text-neutral-800">
        Alasan dan hasil pemeriksaan
        <textarea
          name="reason"
          required
          minLength={12}
          maxLength={500}
          rows={3}
          placeholder="Contoh: Staff memastikan satu nota sudah keluar dari printer dan nomor transaksi sesuai."
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[var(--accent)]"
        />
      </label>

      {requireRiskAcknowledgement ? (
        <label className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-white p-3 text-xs leading-5 text-amber-900">
          <input
            type="checkbox"
            name="duplicateRiskAcknowledged"
            required
            className="mt-0.5 size-4"
          />
          <span>
            Saya sudah memeriksa hasil fisik dan memahami bahwa retry dapat
            menghasilkan cetakan atau tindakan hardware ganda.
          </span>
        </label>
      ) : null}

      <button
        type="submit"
        className={cn(
          "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition",
          tone === "success" && "bg-emerald-700 hover:bg-emerald-800",
          tone === "warning" && "bg-amber-700 hover:bg-amber-800",
          tone === "danger" && "bg-red-700 hover:bg-red-800",
        )}
      >
        {resolutionType === "confirmed_completed" ? (
          <CheckCircle2 className="size-4" />
        ) : resolutionType === "retry_authorized" ? (
          <RotateCcw className="size-4" />
        ) : (
          <XCircle className="size-4" />
        )}
        {submitLabel}
      </button>
    </form>
  );
}

function AttemptTimeline({ detail }: { detail: HardwareJobOperationalDetail }) {
  if (detail.attempts.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Belum ada attempt.</p>;
  }

  return (
    <div className="space-y-3">
      {detail.attempts.map((attempt) => (
        <article
          key={attempt.id}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-neutral-950">
                Attempt #{attempt.attemptNumber} · {attempt.agent.name}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {attempt.status} · sequence {attempt.eventSequence}
              </p>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {formatDateTime(attempt.createdAt)}
            </p>
          </div>

          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Dispatch">
              {formatDateTime(attempt.dispatchStartedAt)}
            </InfoItem>
            <InfoItem label="Submitted">
              {formatDateTime(attempt.submittedAt)}
            </InfoItem>
            <InfoItem label="Server ACK">
              {formatDateTime(attempt.serverAcknowledgedAt)}
            </InfoItem>
            <InfoItem label="Finished">
              {formatDateTime(attempt.finishedAt)}
            </InfoItem>
          </div>

          {attempt.errorMessage ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
              {[attempt.errorCode, attempt.errorMessage]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export default async function HardwareJobDetailPage({ params }: PageProps) {
  const auth = await requirePermission("admin.access");
  const { jobId } = await params;
  const detail = await getHardwareJobOperationalDetail(auth, jobId);

  if (!detail) notFound();

  const canResolveUnknown = auth.permissionCodes.includes(
    "hardware.resolve_unknown",
  );
  const { job } = detail;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-7">
        <Link
          href="/admin/operasional/hardware"
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-[var(--accent)]"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Hardware Hub
        </Link>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--muted)]">
              Protocol v{job.protocolVersion} · {job.id}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-neutral-950">
              {jobTypeLabels[job.jobType]}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {job.outlet.name} · {job.register.name}
            </p>
          </div>
          <StatusPill status={job.status} />
        </div>
      </header>

      {job.status === "unknown_outcome" ? (
        <section className="rounded-3xl border border-orange-300 bg-orange-50 p-5 lg:p-6">
          <div className="flex gap-3">
            <ShieldAlert className="mt-0.5 size-6 shrink-0 text-orange-800" />
            <div>
              <h2 className="text-lg font-semibold text-orange-950">
                Jangan langsung menjalankan ulang job ini
              </h2>
              <p className="mt-2 text-sm leading-6 text-orange-900">
                Dispatch sudah dimulai, tetapi hasil akhirnya tidak dapat
                dipastikan. Periksa printer, kertas/label, spooler Windows, dan
                hasil fisik sebelum memilih resolusi.
              </p>
            </div>
          </div>

          {canResolveUnknown ? (
            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <ResolutionForm
                jobId={job.id}
                resolutionType="confirmed_completed"
                title="Sudah tercetak"
                helper="Pilih ini setelah staff memastikan output fisik sudah keluar dan sesuai."
                submitLabel="Tandai Selesai"
                tone="success"
              />
              <ResolutionForm
                jobId={job.id}
                resolutionType="retry_authorized"
                title="Retry dengan risiko"
                helper="Membuat attempt baru. Gunakan hanya setelah pemeriksaan dan menerima risiko duplikat."
                submitLabel="Izinkan Retry"
                tone="warning"
                requireRiskAcknowledgement
              />
              <ResolutionForm
                jobId={job.id}
                resolutionType="cancelled"
                title="Batalkan tanpa retry"
                helper="Pilih ini jika output tidak diperlukan lagi atau operator memutuskan tidak mencetak ulang."
                submitLabel="Batalkan Job"
                tone="danger"
              />
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-orange-300 bg-white px-4 py-3 text-sm text-orange-900">
              Akun Anda tidak memiliki permission
              <code> hardware.resolve_unknown</code>. Hubungi manager atau
              owner untuk melakukan resolusi.
            </p>
          )}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <h2 className="font-semibold text-neutral-950">Informasi Job</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <InfoItem label="Agent">{job.agent?.name ?? "-"}</InfoItem>
            <InfoItem label="Capability">
              {job.requiredCapability ?? "-"}
            </InfoItem>
            <InfoItem label="Attempt">
              {job.attempts}/{job.maxAttempts}
            </InfoItem>
            <InfoItem label="Current attempt">
              {job.currentAttemptId ?? "-"}
            </InfoItem>
            <InfoItem label="Dibuat">{formatDateTime(job.createdAt)}</InfoItem>
            <InfoItem label="Kedaluwarsa">
              {formatDateTime(job.expiresAt)}
            </InfoItem>
            <InfoItem label="Submitted">
              {formatDateTime(job.submittedAt)}
            </InfoItem>
            <InfoItem label="Unknown at">
              {formatDateTime(job.unknownAt)}
            </InfoItem>
          </div>
        </article>

        <article className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <h2 className="font-semibold text-neutral-950">Error & Integrity</h2>
          <div className="mt-4 space-y-4">
            <InfoItem label="Error code">
              {job.lastErrorCode ?? job.errorCode ?? "-"}
            </InfoItem>
            <InfoItem label="Error message">
              {job.lastErrorMessage ?? job.error ?? "-"}
            </InfoItem>
            <InfoItem label="Payload hash">
              <code className="break-all text-xs font-normal">
                {job.payloadHash ?? "-"}
              </code>
            </InfoItem>
          </div>
        </article>
      </section>

      {detail.resolutions.length > 0 ? (
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-700" />
            <h2 className="text-lg font-semibold text-neutral-950">
              Riwayat Resolusi Operator
            </h2>
          </div>
          <div className="mt-4 space-y-3">
            {detail.resolutions.map((resolution) => (
              <article
                key={resolution.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
              >
                <p className="font-semibold text-neutral-950">
                  {resolution.resolutionType} · {resolution.previousStatus} →{" "}
                  {resolution.nextStatus}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  {resolution.reason}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {resolution.resolvedByName ?? resolution.resolvedByUserId} ·{" "}
                  {formatDateTime(resolution.createdAt)}
                  {resolution.duplicateRiskAcknowledged
                    ? " · risiko duplikat diakui"
                    : ""}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="flex items-center gap-2">
          <Clock3 className="size-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-neutral-950">
            Attempt Timeline
          </h2>
        </div>
        <div className="mt-4">
          <AttemptTimeline detail={detail} />
        </div>
      </section>

      {job.status !== "unknown_outcome" && !job.manualResolution ? (
        <div className="flex gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 text-sm text-[var(--muted)]">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          Job ini tidak memerlukan resolusi unknown outcome. Detail tetap dapat
          digunakan untuk troubleshooting dan audit.
        </div>
      ) : null}
    </div>
  );
}
