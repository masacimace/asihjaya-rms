import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cpu,
  FileText,
  RotateCcw,
  RefreshCw,
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
  printing: "Diproses",
  completed: "Selesai",
  failed: "Gagal",
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
        status === "printing" && "bg-blue-50 text-blue-700",
        status === "claimed" && "bg-amber-50 text-amber-700",
        status === "pending" && "bg-neutral-100 text-neutral-600",
        status === "cancelled" && "bg-neutral-100 text-neutral-500",
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
        enabled ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500",
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
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
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
            "border-[var(--border)] bg-white text-neutral-700 hover:border-[var(--accent)] hover:text-[var(--accent)]",
          tone === "danger" &&
            "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100",
        )}
      >
        {children}
      </button>
    </form>
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
    <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Last seen
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {formatDateTime(agent.lastSeenAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                IP Address
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {agent.lastIpAddress ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Outlet
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {agent.outlet.code}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Register
              </dt>
              <dd className="mt-1 font-medium text-neutral-900">
                {agent.register.code}
              </dd>
            </div>
          </dl>

          {runtimeLabel ? (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Runtime: {runtimeLabel}
              {diagnostics.nodeVersion ? ` · Node ${diagnostics.nodeVersion}` : ""}
              {diagnostics.hostname ? ` · ${diagnostics.hostname}` : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
          <CapabilityBadge label="Label SATO" enabled={canPrintLabel} />
          <CapabilityBadge label="Nota PDF" enabled={canPrintDocument} />
          <CapabilityBadge label="Cash Drawer" enabled={canOpenDrawer} />
          {isDryRun ? <DryRunBadge outputDir={dryRunOutputDir} /> : null}
        </div>
      </div>

      <div className="mt-5 grid gap-2 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
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

      {isDryRun ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          Dry-run aktif: job akan diproses sampai completed tanpa mengirim perintah
          ke hardware fisik. File hasil simulasi disimpan di folder dry-run agent.
        </p>
      ) : null}

      {diagnostics.configWarnings.length > 0 ? (
        <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
          <p className="font-semibold">Peringatan konfigurasi agent:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {diagnostics.configWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {agent.displayStatus !== "online" && agent.displayStatus !== "disabled" ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          Agent belum terdeteksi online dalam beberapa menit terakhir. Test job
          tetap bisa masuk antrean, tetapi baru diproses saat Hardware Hub aktif.
        </p>
      ) : null}
    </article>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Server;
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            tone === "neutral" && "bg-neutral-100 text-neutral-600",
            tone === "success" && "bg-emerald-50 text-emerald-700",
            tone === "warning" && "bg-amber-50 text-amber-700",
            tone === "danger" && "bg-red-50 text-red-700",
          )}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-950">
            {value}
          </p>
        </div>
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
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">
            Operasional · Hardware Hub
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Hardware Hub
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Pantau status Mini PC outlet, antrean hardware job, dan lakukan test
            printer label, printer nota/certificate, atau cash drawer dari satu
            halaman.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={recoverStaleHardwareJobsAction}>
            <button
              type="submit"
              disabled={dashboard.totals.staleJobs === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RotateCcw className="size-4" />
              Pulihkan Job Macet
            </button>
          </form>

          <form action={cleanupHardwareJobsAction}>
            <button
              type="submit"
              disabled={dashboard.totals.cleanupEligibleJobs === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Trash2 className="size-4" />
              Bersihkan Job Lama
            </button>
          </form>

          <Link
            href="/admin/operasional/hardware"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Link>
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
        <SummaryCard
          icon={Server}
          label="Total Agent"
          value={dashboard.totals.agents}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Online"
          value={dashboard.totals.onlineAgents}
          tone="success"
        />
        <SummaryCard
          icon={Clock3}
          label="Perlu Dicek"
          value={dashboard.totals.staleAgents}
          tone="warning"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Config Warning"
          value={dashboard.totals.configurationWarningAgents}
          tone="danger"
        />
        <SummaryCard
          icon={Activity}
          label="Job Aktif"
          value={dashboard.totals.pendingJobs}
          tone="warning"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Job Macet"
          value={dashboard.totals.staleJobs}
          tone="warning"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Job Gagal"
          value={dashboard.totals.failedJobs}
          tone="danger"
        />
        <SummaryCard
          icon={Trash2}
          label="Bisa Dibersihkan"
          value={dashboard.totals.cleanupEligibleJobs}
          tone="neutral"
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">
              Retensi Hardware Jobs
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Cleanup hanya menghapus job terminal yang sudah lama: selesai,
              dibatalkan, atau gagal. Job aktif seperti pending, claimed, dan
              printing tidak akan dihapus.
            </p>
          </div>
          <form action={cleanupHardwareJobsAction}>
            <button
              type="submit"
              disabled={dashboard.cleanupPreview.totalEligible === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Trash2 className="size-4" />
              Bersihkan Sekarang
            </button>
          </form>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Completed
            </p>
            <p className="mt-1 text-2xl font-semibold text-neutral-950">
              {dashboard.cleanupPreview.completed}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Lebih lama dari {dashboard.cleanupPreview.retentionDays.completed}
              hari · cutoff {formatDateTime(dashboard.cleanupPreview.cutoffs.completed)}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Cancelled
            </p>
            <p className="mt-1 text-2xl font-semibold text-neutral-950">
              {dashboard.cleanupPreview.cancelled}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Lebih lama dari {dashboard.cleanupPreview.retentionDays.cancelled}
              hari · cutoff {formatDateTime(dashboard.cleanupPreview.cutoffs.cancelled)}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--surface-muted)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Failed
            </p>
            <p className="mt-1 text-2xl font-semibold text-neutral-950">
              {dashboard.cleanupPreview.failed}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Lebih lama dari {dashboard.cleanupPreview.retentionDays.failed}
              hari · cutoff {formatDateTime(dashboard.cleanupPreview.cutoffs.failed)}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">
              Agent Outlet
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Satu agent mewakili Mini PC/Register yang mengontrol hardware lokal.
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

      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Recent Jobs</h2>
            <p className="text-sm text-[var(--muted)]">
              30 hardware job terbaru dari outlet yang bisa kamu akses.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            <span>Pending: {dashboard.jobStatusSummary.pending}</span>
            <span>Printing: {dashboard.jobStatusSummary.printing}</span>
            <span>Completed: {dashboard.jobStatusSummary.completed}</span>
            <span>Failed: {dashboard.jobStatusSummary.failed}</span>
          </div>
        </div>

        {dashboard.recentJobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)] text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Job</th>
                  <th className="px-5 py-3 text-left font-semibold">Status</th>
                  <th className="px-5 py-3 text-left font-semibold">Agent</th>
                  <th className="px-5 py-3 text-left font-semibold">Outlet</th>
                  <th className="px-5 py-3 text-left font-semibold">Waktu</th>
                  <th className="px-5 py-3 text-left font-semibold">Error</th>
                  <th className="px-5 py-3 text-left font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {dashboard.recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-5 py-4 align-top">
                      <div className="font-medium text-neutral-950">
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
                    </td>
                    <td className="px-5 py-4 align-top">
                      <JobStatusPill status={job.status} />
                    </td>
                    <td className="px-5 py-4 align-top text-neutral-700">
                      {job.agent?.name ?? "Belum diklaim"}
                    </td>
                    <td className="px-5 py-4 align-top text-neutral-700">
                      {job.outlet.name}
                      <div className="text-xs text-[var(--muted)]">
                        {job.register.name}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-neutral-700">
                      {formatDateTime(job.createdAt)}
                    </td>
                    <td className="max-w-xs px-5 py-4 align-top text-xs leading-5">
                      {job.error ? (
                        <div className="space-y-1 text-red-700">
                          <p>{job.error}</p>
                          {job.errorCategory || job.errorCode ? (
                            <p className="text-[var(--muted)]">
                              {[job.errorCategory, job.errorCode]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="grid min-w-28 gap-2">
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

                        {job.status === "failed" || job.status === "cancelled" ? (
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
                          <span className="text-xs text-[var(--muted)]">-</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            tidak membuat antrean ganda. Job yang macet di status diklaim/diproses
            akan dipulihkan otomatis saat agent melakukan claim berikutnya, atau
            bisa dipulihkan manual melalui tombol Pulihkan Job Macet. Job terminal
            yang sudah melewati masa retensi bisa dibersihkan melalui tombol
            Bersihkan Job Lama.
          </p>
        </div>
      </section>
    </div>
  );
}
