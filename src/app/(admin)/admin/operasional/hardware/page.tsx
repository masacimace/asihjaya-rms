import { randomUUID } from "node:crypto";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  MonitorCog,
  RefreshCw,
  ScanBarcode,
  Server,
  Settings2,
  ShieldAlert,
  Trash2,
  WalletCards,
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
import { HardwareAgentReactivateButton } from "@/components/hardware/hardware-agent-reactivate-button";
import {
  DeleteFailedHardwareJobButton,
  PurgeInactiveHardwareAgentButton,
} from "@/components/hardware/hardware-cleanup-buttons";
import { HardwareHubManageDialog } from "@/components/hardware/hardware-hub-manage-dialog";
import { HardwareHubSetupDialog } from "@/components/hardware/hardware-hub-setup-dialog";
import type {
  HardwareAgentDisplayStatus,
  HardwareAgentSummary,
  HardwareJobSummary,
} from "@/features/hardware/contracts";
import { getHardwareHubProvisioningOptions } from "@/features/hardware/provisioning-options";
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
  printing: "Diproses",
  submitted: "Terkirim ke printer",
  completed: "Selesai",
  failed: "Gagal",
  unknown_outcome: "Perlu diperiksa",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
};

const jobTypeLabels: Record<HardwareJobSummary["jobType"], string> = {
  print_label_sato: "Cetak Label",
  print_receipt_certificate: "Cetak Nota",
  open_cash_drawer: "Buka Cash Drawer",
  test_label_printer: "Test Label",
  test_document_printer: "Test Nota",
  test_cash_drawer: "Test Cash Drawer",
};

function formatDateTime(value: Date | null) {
  if (!value) return "Belum pernah";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function readBooleanCapability(
  capabilities: Record<string, unknown>,
  key: string,
) {
  return capabilities[key] === true;
}

function readStringCapability(
  capabilities: Record<string, unknown>,
  key: string,
) {
  const value = capabilities[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function StatusPill({ status }: { status: HardwareAgentDisplayStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "online" && "bg-emerald-50 text-emerald-700",
        status === "stale" && "bg-amber-50 text-amber-800",
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

function DeviceRow({
  label,
  configured,
  helper,
}: {
  label: string;
  configured: boolean;
  helper: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
      <div>
        <p className="text-sm font-semibold text-neutral-900">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{helper}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
          configured
            ? "bg-emerald-50 text-emerald-700"
            : "bg-neutral-200 text-neutral-600",
        )}
      >
        {configured ? "Dikonfigurasi" : "Belum tersedia"}
      </span>
    </div>
  );
}

function TestButton({
  agentId,
  jobType,
  disabled,
  children,
}: {
  agentId: string;
  jobType: "test_label_printer" | "test_document_printer" | "test_cash_drawer";
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <form action={createHardwareTestJobAction}>
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="jobType" value={jobType} />
      <input type="hidden" name="requestId" value={randomUUID()} />
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {children}
      </button>
    </form>
  );
}

function AgentCard({
  agent,
  canManageAgents,
}: {
  agent: HardwareAgentSummary;
  canManageAgents: boolean;
}) {
  const labelConfigured = readBooleanCapability(
    agent.capabilities,
    "print_label_sato",
  );
  const documentConfigured = readBooleanCapability(
    agent.capabilities,
    "print_receipt_certificate",
  );
  const drawerConfigured = readBooleanCapability(
    agent.capabilities,
    "open_cash_drawer",
  );
  const hostname = agent.diagnostics.hostname ?? "Mini PC belum melapor";
  const labelPrinter =
    readStringCapability(agent.capabilities, "label_printer_name") ??
    "Printer label";
  const documentPrinter =
    readStringCapability(agent.capabilities, "document_printer_name") ??
    "Printer nota";
  const isDisabled = agent.displayStatus === "disabled";

  return (
    <article className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 lg:flex-row lg:items-start lg:justify-between lg:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-950">
              {agent.register.name}
            </h2>
            <StatusPill status={agent.displayStatus} />
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{agent.outlet.name}</p>
        </div>

        {canManageAgents && !isDisabled ? (
          <HardwareHubManageDialog
            agent={{
              id: agent.id,
              code: agent.code,
              name: agent.name,
              outletName: agent.outlet.name,
              registerName: agent.register.name,
            }}
          />
        ) : null}
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr] lg:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Mini PC
          </p>
          <p className="mt-2 text-base font-semibold text-neutral-950">{hostname}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Terakhir terhubung {formatDateTime(agent.lastSeenAt)}
          </p>
          {agent.diagnostics.agentVersion ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Hardware Hub {agent.diagnostics.agentVersion}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <DeviceRow
            label="Printer Label"
            configured={labelConfigured}
            helper={labelPrinter}
          />
          <DeviceRow
            label="Printer Nota"
            configured={documentConfigured}
            helper={documentPrinter}
          />
          {drawerConfigured ? (
            <DeviceRow
              label="Cash Drawer"
              configured
              helper="Perangkat drawer dikonfigurasi"
            />
          ) : null}
        </div>
      </div>

      {!isDisabled ? (
        <div className="grid gap-2 border-t border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:grid-cols-2 lg:grid-cols-3">
          <TestButton
            agentId={agent.id}
            jobType="test_label_printer"
            disabled={!labelConfigured}
          >
            <ScanBarcode className="size-4" />
            Test Label
          </TestButton>
          <TestButton
            agentId={agent.id}
            jobType="test_document_printer"
            disabled={!documentConfigured}
          >
            <FileText className="size-4" />
            Test Nota
          </TestButton>
          <TestButton
            agentId={agent.id}
            jobType="test_cash_drawer"
            disabled={!drawerConfigured}
          >
            <WalletCards className="size-4" />
            Test Drawer
          </TestButton>
        </div>
      ) : null}

      {agent.diagnostics.configWarnings.length > 0 ? (
        <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs leading-5 text-amber-900">
          Konfigurasi Mini PC perlu diperiksa. Buka Diagnostik Lanjutan untuk detail.
        </div>
      ) : null}
    </article>
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
        ["pending", "claimed", "processing", "printing", "submitted"].includes(status) &&
          "bg-amber-50 text-amber-800",
        (status === "cancelled" || status === "expired") &&
          "bg-neutral-100 text-neutral-500",
      )}
    >
      {jobStatusLabels[status]}
    </span>
  );
}

function RecentActivity({ jobs }: { jobs: HardwareJobSummary[] }) {
  const visibleJobs = jobs.slice(0, 5);

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5 lg:p-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
            <Activity className="size-3.5" />
            Aktivitas terbaru
          </div>
          <h2 className="mt-3 text-xl font-semibold text-neutral-950">
            Aktivitas Hardware
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ringkasan lima aktivitas terbaru. Detail teknis tetap tersedia saat dibutuhkan.
          </p>
        </div>
      </div>

      {visibleJobs.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--muted)]">
          Belum ada aktivitas hardware.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {visibleJobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-neutral-950">
                    {jobTypeLabels[job.jobType]}
                  </p>
                  <JobStatusPill status={job.status} />
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  {job.outlet.name} · {job.register.name} · {formatDateTime(job.createdAt)}
                </p>
                {job.error ? (
                  <p className="mt-1 line-clamp-1 text-xs text-red-700">{job.error}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {job.status === "failed" ? (
                  <DeleteFailedHardwareJobButton jobId={job.id} />
                ) : null}
                <Link
                  href={`/admin/operasional/hardware/jobs/${job.id}`}
                  className={cn(
                    "inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold",
                    job.status === "unknown_outcome"
                      ? "border-orange-300 bg-orange-50 text-orange-900"
                      : "border-[var(--border)] bg-white text-neutral-700",
                  )}
                >
                  {job.status === "unknown_outcome" ? "Periksa" : "Detail"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function HardwareHubPage({ searchParams }: PageProps) {
  const auth = await requirePermission("admin.access");
  const query = await searchParams;
  const canManageAgents = auth.permissionCodes.includes(
    "hardware.agents.manage",
  );

  const [dashboard, provisioningOptions] = await Promise.all([
    getHardwareHubDashboard(auth),
    canManageAgents
      ? getHardwareHubProvisioningOptions(auth)
      : Promise.resolve([]),
  ]);

  const activeAgents = dashboard.agents.filter(
    (agent) => agent.isActive && agent.displayStatus !== "disabled",
  );
  const disabledAgents = dashboard.agents.filter(
    (agent) => !agent.isActive || agent.displayStatus === "disabled",
  );
  const configurationWarnings = activeAgents.flatMap((agent) =>
    agent.diagnostics.configWarnings.map((warning) => ({
      agentId: agent.id,
      agentName: agent.name,
      registerName: agent.register.name,
      warning,
    })),
  );
  const problems =
    dashboard.observability.metrics.unknownOutcomeJobs +
    dashboard.observability.metrics.staleSubmittedJobs +
    dashboard.totals.configurationWarningAgents +
    dashboard.totals.offlineAgents +
    dashboard.totals.staleAgents;
  const message = typeof query.message === "string" ? query.message : null;
  const messageType = query.type === "success" ? "success" : "error";

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-7">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-[var(--accent)]"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Dashboard
        </Link>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <MonitorCog className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                  Hardware Hub
                </h1>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Hubungkan Mini PC outlet untuk mencetak label dan nota secara otomatis.
                </p>
              </div>
            </div>
          </div>

          {canManageAgents && provisioningOptions.some((option) => !option.activeAgent) ? (
            <HardwareHubSetupDialog options={provisioningOptions} />
          ) : null}
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

      {activeAgents.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-[var(--border)] bg-white p-8 text-center sm:p-12">
          <MonitorCog className="mx-auto size-10 text-neutral-300" />
          <h2 className="mt-4 text-xl font-semibold text-neutral-950">
            Hardware Hub belum disiapkan
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Hubungkan Mini PC outlet agar POS dapat mencetak label dan nota secara otomatis tanpa setup teknis di halaman utama.
          </p>
          {canManageAgents && provisioningOptions.some((option) => !option.activeAgent) ? (
            <div className="mt-5 flex justify-center">
              <HardwareHubSetupDialog options={provisioningOptions} />
            </div>
          ) : null}
        </section>
      ) : (
        <section className="space-y-4">
          {activeAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              canManageAgents={canManageAgents}
            />
          ))}
        </section>
      )}

      <section
        className={cn(
          "flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6",
          problems === 0
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50",
        )}
      >
        <div className="flex items-start gap-3">
          {problems === 0 ? (
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-700" />
          ) : (
            <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-800" />
          )}
          <div>
            <h2 className="font-semibold text-neutral-950">
              {problems === 0
                ? "Sistem hardware berjalan normal"
                : `${problems} indikator perlu diperiksa`}
            </h2>
            <p className="mt-1 text-sm leading-6 text-neutral-700">
              {problems === 0
                ? "Tidak ada indikator operasional yang memerlukan tindakan saat ini."
                : "Buka Diagnostik Lanjutan untuk melihat detail tanpa memenuhi halaman utama dengan informasi teknis."}
            </p>
          </div>
        </div>
      </section>

      <RecentActivity jobs={dashboard.recentJobs} />

      <details className="group overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 lg:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
              <Settings2 className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-950">Diagnostik Lanjutan</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Informasi teknis, maintenance job, dan riwayat perangkat.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[var(--muted)] group-open:hidden">
            Buka
          </span>
          <span className="hidden text-xs font-semibold text-[var(--muted)] group-open:inline">
            Tutup
          </span>
        </summary>

        <div className="space-y-6 border-t border-[var(--border)] p-5 lg:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Status</p>
              <p className="mt-2 text-lg font-semibold text-neutral-950">
                {dashboard.observability.status}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Unknown outcome</p>
              <p className="mt-2 text-lg font-semibold text-neutral-950">
                {dashboard.observability.metrics.unknownOutcomeJobs}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Job aktif</p>
              <p className="mt-2 text-lg font-semibold text-neutral-950">
                {dashboard.totals.pendingJobs}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Success 24 jam</p>
              <p className="mt-2 text-lg font-semibold text-neutral-950">
                {dashboard.observability.metrics.successRateLast24Hours === null
                  ? "-"
                  : `${dashboard.observability.metrics.successRateLast24Hours.toFixed(1)}%`}
              </p>
            </div>
          </div>

          {dashboard.observability.alerts.length > 0 ? (
            <div className="grid gap-2">
              {dashboard.observability.alerts.map((alert) => (
                <div
                  key={alert.code}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                  <strong>{alert.code}</strong> · {alert.message}
                </div>
              ))}
            </div>
          ) : null}

          {configurationWarnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-800" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-amber-950">Peringatan Konfigurasi</p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">
                    Detail berikut berasal langsung dari heartbeat Hardware Hub aktif.
                  </p>
                  <div className="mt-3 space-y-2">
                    {configurationWarnings.map((item) => (
                      <div
                        key={`${item.agentId}:${item.warning}`}
                        className="rounded-xl border border-amber-200 bg-white/70 px-3 py-2"
                      >
                        <p className="text-xs font-semibold text-amber-950">
                          {item.registerName}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-900">
                          {item.warning}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 text-neutral-500" />
              <div>
                <p className="font-semibold text-neutral-950">Maintenance Job</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Recovery ini hanya untuk compatibility job lama. Protocol v2 melakukan lease recovery sendiri.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <form action={recoverStaleHardwareJobsAction}>
                <button
                  type="submit"
                  disabled={dashboard.totals.staleJobs === 0}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-40"
                >
                  <RefreshCw className="size-4" />
                  Pulihkan Job Lama
                </button>
              </form>
              <form action={cleanupHardwareJobsAction}>
                <button
                  type="submit"
                  disabled={dashboard.totals.cleanupEligibleJobs === 0}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                  Bersihkan Job Lama
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-neutral-950">Riwayat Job</p>
                <p className="mt-1 text-xs text-[var(--muted)]">30 job terbaru untuk troubleshooting.</p>
              </div>
              <Link
                href="/admin/operasional/hardware/setup-guide"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent)]"
              >
                <BookOpenCheck className="size-4" />
                Panduan teknis
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {dashboard.recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-950">
                          {jobTypeLabels[job.jobType]}
                        </p>
                        <JobStatusPill status={job.status} />
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {job.agent?.name ?? "Belum diklaim"} · {formatDateTime(job.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {job.status === "failed" ||
                      (job.protocolVersion === 1 && job.status === "cancelled") ? (
                        <form action={retryHardwareJobAction}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <button className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700">
                            Retry
                          </button>
                        </form>
                      ) : null}
                      {job.status === "pending" ? (
                        <form action={cancelHardwareJobAction}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <button className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700">
                            Batalkan
                          </button>
                        </form>
                      ) : null}
                      {job.status === "failed" ? (
                        <DeleteFailedHardwareJobButton jobId={job.id} />
                      ) : null}
                      <Link
                        href={`/admin/operasional/hardware/jobs/${job.id}`}
                        className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700"
                      >
                        Detail
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {disabledAgents.length > 0 ? (
            <div className="rounded-2xl border border-[var(--border)] p-4">
              <div className="flex items-start gap-3">
                <Server className="mt-0.5 size-5 text-neutral-500" />
                <div>
                  <p className="font-semibold text-neutral-950">Riwayat Perangkat</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Agent nonaktif tetap disimpan untuk audit. Perangkat hanya dapat dihapus permanen jika tidak lagi memiliki dependency job, attempt, atau enrollment.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {disabledAgents.map((agent) => {
                  const activePeer =
                    activeAgents.find(
                      (candidate) => candidate.register.id === agent.register.id,
                    ) ?? null;

                  return (
                    <div key={agent.id} className="rounded-xl border border-[var(--border)] p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-neutral-950">{agent.name}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {agent.outlet.name} · {agent.register.name} · {agent.code}
                          </p>
                        </div>
                        <StatusPill status="disabled" />
                      </div>
                      {canManageAgents ? (
                        <div className="mt-3 space-y-2">
                          <HardwareAgentReactivateButton
                            agent={{
                              id: agent.id,
                              code: agent.code,
                              name: agent.name,
                              outletName: agent.outlet.name,
                              registerName: agent.register.name,
                            }}
                            blockedByAgent={
                              activePeer
                                ? {
                                    id: activePeer.id,
                                    code: activePeer.code,
                                    name: activePeer.name,
                                  }
                                : null
                            }
                          />
                          <PurgeInactiveHardwareAgentButton
                            agentId={agent.id}
                            agentName={agent.name}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
