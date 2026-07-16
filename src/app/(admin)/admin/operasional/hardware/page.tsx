import { randomUUID } from "node:crypto";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Cpu,
  FileText,
  RefreshCw,
  RotateCcw,
  ScanBarcode,
  Server,
  ShieldCheck,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  cancelHardwareJobAction,
  cleanupHardwareJobsAction,
  createHardwareTestJobAction,
  recoverStaleHardwareJobsAction,
  retryHardwareJobAction,
} from "@/app/actions/hardware";
import type {
  HardwareAgentDisplayStatus,
  HardwareAgentSummary,
  HardwareJobSummary,
} from "@/features/hardware/contracts";
import { getHardwareHubDashboard } from "@/features/hardware/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Hardware Hub",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    type?: string;
    message?: string;
  }>;
};

const statusLabels: Record<HardwareAgentDisplayStatus, string> = {
  online: "Online",
  stale: "Perlu dicek",
  offline: "Offline",
  disabled: "Nonaktif",
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
  if (!value) {
    return "Belum pernah";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatDuration(value: number | null) {
  if (!value) {
    return null;
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(1)} dtk`;
}

function readBooleanCapability(
  capabilities: Record<string, unknown>,
  key: string,
) {
  return capabilities[key] === true;
}

function StatusPill({ status }: { status: HardwareAgentDisplayStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "online" && "bg-emerald-50 text-emerald-700",
        status === "stale" && "bg-amber-50 text-amber-700",
        status === "offline" && "bg-neutral-100 text-neutral-600",
        status === "disabled" && "bg-red-50 text-red-700",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "online" && "bg-emerald-500",
          status === "stale" && "bg-amber-500",
          status === "offline" && "bg-neutral-400",
          status === "disabled" && "bg-red-500",
        )}
      />
      {statusLabels[status]}
    </span>
  );
}

function JobStatusPill({ status }: { status: HardwareJobSummary["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "completed" && "bg-emerald-50 text-emerald-700",
        status === "failed" && "bg-red-50 text-red-700",
        status === "unknown_outcome" && "bg-orange-50 text-orange-800",
        (status === "processing" || status === "printing") &&
          "bg-blue-50 text-blue-700",
        status === "submitted" && "bg-violet-50 text-violet-700",
        status === "claimed" && "bg-amber-50 text-amber-700",
        status === "pending" && "bg-neutral-100 text-neutral-600",
        (status === "cancelled" || status === "expired") &&
          "bg-neutral-100 text-neutral-500",
      )}
    >
      {jobStatusLabels[status]}
    </span>
  );
}

function CapabilityBadge({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        enabled
          ? "bg-emerald-50 text-emerald-700"
          : "bg-neutral-100 text-neutral-500",
      )}
    >
      {enabled ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <XCircle className="size-3" />
      )}
      {label}
    </span>
  );
}

function DryRunBadge({ outputDir }: { outputDir: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
      title={outputDir ? `Output: ${outputDir}` : undefined}
    >
      <ShieldCheck className="size-3" />
      Dry Run Aktif
    </span>
  );
}

function TestJobButton({
  agentId,
  jobType,
  children,
  disabled,
}: {
  agentId: string;
  jobType: "test_label_printer" | "test_document_printer" | "test_cash_drawer";
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <form action={createHardwareTestJobAction}>
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="jobType" value={jobType} />
      <input type="hidden" name="requestId" value={randomUUID()} />
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {children}
      </button>
    </form>
  );
}

function HardwareJobActionButton({
  action,
  jobId,
  children,
  tone = "neutral",
}: {
  action: (formData: FormData) => Promise<void>;
  jobId: string;
  children: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="jobId" value={jobId} />
      <button
        type="submit"
        className={cn(
          "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
          tone === "neutral" &&
            "border-[var(--border)] bg-white text-neutral-700 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
          tone === "danger" &&
            "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100",
        )}
      >
        {children}
      </button>
    </form>
  );
}

function HeaderMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-neutral-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{helper}</p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "neutral",
}: {
  icon: typeof Server;
  label: string;
  value: number;
  helper: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-neutral-950">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{helper}</p>
        </div>
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            tone === "neutral" && "bg-neutral-100 text-neutral-600",
            tone === "success" && "bg-emerald-50 text-emerald-700",
            tone === "warning" && "bg-amber-50 text-amber-700",
            tone === "danger" && "bg-red-50 text-red-700",
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </article>
  );
}

function RetentionStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-neutral-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{helper}</p>
    </div>
  );
}

function AgentCard({ agent }: { agent: HardwareAgentSummary }) {
  const canPrintLabel = readBooleanCapability(
    agent.capabilities,
    "print_label_sato",
  );
  const canPrintDocument = readBooleanCapability(
    agent.capabilities,
    "print_receipt_certificate",
  );
  const canOpenDrawer = readBooleanCapability(
    agent.capabilities,
    "open_cash_drawer",
  );
  const isDryRun = readBooleanCapability(agent.capabilities, "dry_run");
  const dryRunOutputDir =
    typeof agent.capabilities.dry_run_output_dir === "string"
      ? agent.capabilities.dry_run_output_dir
      : null;
  const diagnostics = agent.diagnostics;
  const runtimeLabel = [
    diagnostics.agentVersion,
    diagnostics.platform,
    diagnostics.arch,
  ]
    .filter(Boolean)
    .join(" · ");
  const isDisabled = agent.displayStatus === "disabled";

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-950">
              {agent.name}
            </h2>
            <StatusPill status={agent.displayStatus} />
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {agent.outlet.name} · {agent.register.name} · {agent.code}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
          <CapabilityBadge label="Label SATO" enabled={canPrintLabel} />
          <CapabilityBadge label="Nota PDF" enabled={canPrintDocument} />
          <CapabilityBadge label="Cash Drawer" enabled={canOpenDrawer} />
          {isDryRun ? <DryRunBadge outputDir={dryRunOutputDir} /> : null}
        </div>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Last seen
          </p>
          <p className="mt-1 font-semibold text-neutral-950">
            {formatDateTime(agent.lastSeenAt)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            IP Address
          </p>
          <p className="mt-1 font-semibold text-neutral-950">
            {agent.lastIpAddress ?? "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Outlet
          </p>
          <p className="mt-1 font-semibold text-neutral-950">
            {agent.outlet.code}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Register
          </p>
          <p className="mt-1 font-semibold text-neutral-950">
            {agent.register.code}
          </p>
        </div>
      </div>

      {runtimeLabel ? (
        <p className="px-5 pb-4 text-xs leading-5 text-[var(--muted)]">
          Runtime: {runtimeLabel}
          {diagnostics.nodeVersion ? ` · Node ${diagnostics.nodeVersion}` : ""}
          {diagnostics.hostname ? ` · ${diagnostics.hostname}` : ""}
        </p>
      ) : null}

      <div className="grid gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:grid-cols-3">
        <TestJobButton
          agentId={agent.id}
          jobType="test_label_printer"
          disabled={isDisabled}
        >
          <ScanBarcode className="size-4" />
          Test Label
        </TestJobButton>
        <TestJobButton
          agentId={agent.id}
          jobType="test_document_printer"
          disabled={isDisabled || !canPrintDocument}
        >
          <FileText className="size-4" />
          Test Nota PDF
        </TestJobButton>
        <TestJobButton
          agentId={agent.id}
          jobType="test_cash_drawer"
          disabled={isDisabled || !canOpenDrawer}
        >
          <WalletCards className="size-4" />
          Test Drawer
        </TestJobButton>
      </div>

      <div className="space-y-3 px-5 pb-5 pt-4">
        {isDryRun ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            Dry-run aktif: job akan diproses sampai completed tanpa mengirim
            perintah ke hardware fisik. File hasil simulasi disimpan di folder
            dry-run agent.
          </p>
        ) : null}

        {diagnostics.configWarnings.length > 0 ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
            <p className="font-semibold">Peringatan konfigurasi agent:</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {diagnostics.configWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {agent.displayStatus !== "online" &&
        agent.displayStatus !== "disabled" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            Agent belum terdeteksi online dalam beberapa menit terakhir. Test
            job tetap bisa masuk antrean, tetapi baru diproses saat Hardware Hub
            aktif.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function RecentJobMobileCard({ job }: { job: HardwareJobSummary }) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-950">
            {jobTypeLabels[job.jobType]}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {job.deviceType} · attempts {job.attempts}/{job.maxAttempts}
            {formatDuration(job.durationMs)
              ? ` · ${formatDuration(job.durationMs)}`
              : ""}
          </p>
        </div>
        <JobStatusPill status={job.status} />
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Agent
          </p>
          <p className="mt-1 font-medium text-neutral-950">
            {job.agent?.name ?? "Belum diklaim"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Outlet/Register
          </p>
          <p className="mt-1 font-medium text-neutral-950">{job.outlet.name}</p>
          <p className="text-xs text-[var(--muted)]">{job.register.name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Waktu
          </p>
          <p className="mt-1 font-medium text-neutral-950">
            {formatDateTime(job.createdAt)}
          </p>
        </div>
      </div>

      {job.error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {job.error}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2">
        {job.isStale ? (
          <form action={recoverStaleHardwareJobsAction}>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100"
            >
              <RotateCcw className="size-3.5" />
              Pulihkan
            </button>
          </form>
        ) : null}

        {job.status === "failed" ||
        (job.protocolVersion === 1 && job.status === "cancelled") ? (
          <HardwareJobActionButton
            action={retryHardwareJobAction}
            jobId={job.id}
          >
            <RotateCcw className="size-3.5" />
            Retry
          </HardwareJobActionButton>
        ) : null}

        {job.status === "pending" ? (
          <HardwareJobActionButton
            action={cancelHardwareJobAction}
            jobId={job.id}
            tone="danger"
          >
            <Trash2 className="size-3.5" />
            Batalkan
          </HardwareJobActionButton>
        ) : null}
      </div>
    </article>
  );
}

export default async function HardwareHubPage({ searchParams }: PageProps) {
  const auth = await requirePermission("admin.access");
  const query = await searchParams;
  const dashboard = await getHardwareHubDashboard(auth);
  const message = typeof query.message === "string" ? query.message : null;
  const messageType = query.type === "success" ? "success" : "error";

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_360px] lg:p-7">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-[var(--accent)]"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Hardware Hub
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Pantau Mini PC outlet, status agent, antrean hardware job, dan
              test printer label, printer nota, serta cash drawer dari satu
              halaman operasional.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <HeaderMetric
              label="Agent online"
              value={`${dashboard.totals.onlineAgents}/${dashboard.totals.agents}`}
              helper="Mini PC aktif dari total agent outlet."
            />
            <HeaderMetric
              label="Job aktif"
              value={dashboard.totals.pendingJobs}
              helper="Pending, diklaim, atau sedang diproses."
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--border)] p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Gunakan aksi recovery hanya saat job terlihat macet atau antrean
            lama sudah tidak relevan.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <form action={recoverStaleHardwareJobsAction}>
              <button
                type="submit"
                disabled={dashboard.totals.staleJobs === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                <RotateCcw className="size-4" />
                Pulihkan Job Macet
              </button>
            </form>

            <form action={cleanupHardwareJobsAction}>
              <button
                type="submit"
                disabled={dashboard.totals.cleanupEligibleJobs === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                <Trash2 className="size-4" />
                Bersihkan Job Lama
              </button>
            </form>

            <Link
              href="/admin/operasional/hardware"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] sm:w-auto"
            >
              <RefreshCw className="size-4" />
              Refresh
            </Link>
          </div>
        </div>
      </header>

      {message ? (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm font-medium",
            messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800",
          )}
        >
          {message}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Server}
          label="Total Agent"
          value={dashboard.totals.agents}
          helper="Mini PC/Register yang terdaftar."
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Online"
          value={dashboard.totals.onlineAgents}
          helper="Agent aktif dan siap menerima job."
          tone="success"
        />
        <SummaryCard
          icon={Clock3}
          label="Perlu Dicek"
          value={dashboard.totals.staleAgents}
          helper="Agent tidak heartbeat beberapa menit."
          tone="warning"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Config Warning"
          value={dashboard.totals.configurationWarningAgents}
          helper="Agent punya peringatan konfigurasi."
          tone="danger"
        />
        <SummaryCard
          icon={Activity}
          label="Job Aktif"
          value={dashboard.totals.pendingJobs}
          helper="Job pending/claimed/processing/submitted."
          tone="warning"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Job Macet"
          value={dashboard.totals.staleJobs}
          helper="Job aktif yang perlu dipulihkan."
          tone="warning"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Job Gagal"
          value={dashboard.totals.failedJobs}
          helper="Job terminal yang gagal diproses."
          tone="danger"
        />
        <SummaryCard
          icon={Trash2}
          label="Bisa Dibersihkan"
          value={dashboard.totals.cleanupEligibleJobs}
          helper="Job terminal melewati retensi."
        />
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              <Trash2 className="size-3.5" />
              Retensi job
            </div>
            <h2 className="mt-4 text-xl font-semibold text-neutral-950">
              Retensi Hardware Jobs
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Cleanup hanya menghapus job terminal yang sudah lama: selesai,
              dibatalkan, atau gagal. Job aktif seperti pending, claimed, dan
              printing tidak akan dihapus.
            </p>
          </div>
          <form action={cleanupHardwareJobsAction}>
            <button
              type="submit"
              disabled={dashboard.cleanupPreview.totalEligible === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            >
              <Trash2 className="size-4" />
              Bersihkan Sekarang
            </button>
          </form>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <RetentionStat
            label="Completed"
            value={dashboard.cleanupPreview.completed}
            helper={`Lebih lama dari ${dashboard.cleanupPreview.retentionDays.completed} hari · cutoff ${formatDateTime(dashboard.cleanupPreview.cutoffs.completed)}`}
          />
          <RetentionStat
            label="Cancelled"
            value={dashboard.cleanupPreview.cancelled}
            helper={`Lebih lama dari ${dashboard.cleanupPreview.retentionDays.cancelled} hari · cutoff ${formatDateTime(dashboard.cleanupPreview.cutoffs.cancelled)}`}
          />
          <RetentionStat
            label="Failed"
            value={dashboard.cleanupPreview.failed}
            helper={`Lebih lama dari ${dashboard.cleanupPreview.retentionDays.failed} hari · cutoff ${formatDateTime(dashboard.cleanupPreview.cutoffs.failed)}`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <Cpu className="size-3.5" />
              Agent outlet
            </div>
            <h2 className="mt-3 text-xl font-semibold text-neutral-950">
              Mini PC/Register Outlet
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Satu agent mewakili Mini PC/Register yang mengontrol hardware
              lokal.
            </p>
          </div>
        </div>

        {dashboard.agents.length > 0 ? (
          <div className="space-y-4">
            {dashboard.agents.map((agent) => (
              <AgentCard agent={agent} key={agent.id} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-8 text-center">
            <Cpu className="mx-auto size-10 text-neutral-300" />
            <h3 className="mt-3 font-semibold text-neutral-950">
              Belum ada Hardware Agent
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Jalankan script <code>npm run hardware:agent:create</code> untuk
              membuat agent Mini PC outlet, lalu isi hasilnya ke
              <code> hardware-hub/.env</code>.
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
              <Activity className="size-3.5" />
              Ledger hardware
            </div>
            <h2 className="mt-3 text-xl font-semibold text-neutral-950">
              Recent Jobs
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              30 hardware job terbaru dari outlet yang bisa kamu akses.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)] sm:grid-cols-4">
            <span className="rounded-full bg-neutral-100 px-2.5 py-1">
              Pending: {dashboard.jobStatusSummary.pending}
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
              Printing: {dashboard.jobStatusSummary.printing}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              Completed: {dashboard.jobStatusSummary.completed}
            </span>
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
              Failed: {dashboard.jobStatusSummary.failed}
            </span>
          </div>
        </div>

        {dashboard.recentJobs.length > 0 ? (
          <>
            <div className="hidden lg:block">
              <div className="grid min-w-[1120px] grid-cols-[1.45fr_0.85fr_1fr_1fr_1fr_1.25fr_0.8fr] border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <div>Job</div>
                <div>Status</div>
                <div>Agent</div>
                <div>Outlet</div>
                <div>Waktu</div>
                <div>Error</div>
                <div className="text-right">Aksi</div>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                <div className="min-w-[1120px] divide-y divide-[var(--border)]">
                  {dashboard.recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="grid grid-cols-[1.45fr_0.85fr_1fr_1fr_1fr_1.25fr_0.8fr] items-start gap-4 px-5 py-4 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-neutral-950">
                          {jobTypeLabels[job.jobType]}
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {job.deviceType} · attempts {job.attempts}/
                          {job.maxAttempts}
                          {formatDuration(job.durationMs)
                            ? ` · ${formatDuration(job.durationMs)}`
                            : ""}
                        </div>
                        {job.isStale ? (
                          <div className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Terdeteksi macet
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <JobStatusPill status={job.status} />
                      </div>
                      <div className="min-w-0 truncate text-neutral-700">
                        {job.agent?.name ?? "Belum diklaim"}
                      </div>
                      <div className="min-w-0 text-neutral-700">
                        <p className="truncate">{job.outlet.name}</p>
                        <div className="truncate text-xs text-[var(--muted)]">
                          {job.register.name}
                        </div>
                      </div>
                      <div className="text-neutral-700">
                        {formatDateTime(job.createdAt)}
                      </div>
                      <div className="min-w-0 text-xs leading-5">
                        {job.error ? (
                          <div className="space-y-1 text-red-700">
                            <p className="line-clamp-2">{job.error}</p>
                            {job.errorCategory || job.errorCode ? (
                              <p className="truncate text-[var(--muted)]">
                                {[job.errorCategory, job.errorCode]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">-</span>
                        )}
                      </div>
                      <div className="grid gap-2">
                        {job.isStale ? (
                          <form action={recoverStaleHardwareJobsAction}>
                            <button
                              type="submit"
                              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100"
                            >
                              <RotateCcw className="size-3.5" />
                              Pulihkan
                            </button>
                          </form>
                        ) : null}

                        {job.status === "failed" ||
                        (job.protocolVersion === 1 &&
                          job.status === "cancelled") ? (
                          <HardwareJobActionButton
                            action={retryHardwareJobAction}
                            jobId={job.id}
                          >
                            <RotateCcw className="size-3.5" />
                            Retry
                          </HardwareJobActionButton>
                        ) : null}

                        {job.status === "pending" ? (
                          <HardwareJobActionButton
                            action={cancelHardwareJobAction}
                            jobId={job.id}
                            tone="danger"
                          >
                            <Trash2 className="size-3.5" />
                            Batalkan
                          </HardwareJobActionButton>
                        ) : null}

                        {!job.isStale &&
                        job.status !== "failed" &&
                        job.status !== "cancelled" &&
                        job.status !== "pending" ? (
                          <span className="text-right text-xs text-[var(--muted)]">
                            -
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {dashboard.recentJobs.map((job) => (
                <RecentJobMobileCard job={job} key={job.id} />
              ))}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-sm text-[var(--muted)]">
            Belum ada hardware job.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <p>
            Test job akan masuk antrean <strong>hardware_jobs</strong>. Kalau
            laptop dev belum memiliki printer fisik, job bisa berubah menjadi
            gagal dengan error printer Windows. Itu normal selama agent berhasil
            online, claim job, dan mengirim status balik ke server. Job gagal
            bisa di-retry dari tabel Recent Jobs, sedangkan job yang masih
            menunggu bisa dibatalkan sebelum diklaim agent. Sistem juga menahan
            duplikat job aktif untuk source yang sama supaya tombol test/cetak
            tidak membuat antrean ganda. Job yang macet di status
            diklaim/diproses akan dipulihkan otomatis saat agent melakukan claim
            berikutnya, atau bisa dipulihkan manual melalui tombol Pulihkan Job
            Macet. Job terminal yang sudah melewati masa retensi bisa
            dibersihkan melalui tombol Bersihkan Job Lama.
          </p>
        </div>
      </section>
    </div>
  );
}
