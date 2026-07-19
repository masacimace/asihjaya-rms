import { ArrowLeft, BookOpenCheck } from "lucide-react";
import Link from "next/link";

import { HardwareSetupGuideClient } from "@/components/hardware/setup-guide-client";
import { getHardwareHubDashboard } from "@/features/hardware/queries";
import {
  HARDWARE_SETUP_GUIDE_VERSION,
  hardwareSetupFinalChecklist,
  hardwareSetupGuideSections,
} from "@/features/hardware/setup-guide";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Panduan Setup Hardware Hub",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HardwareSetupGuidePage() {
  const auth = await requirePermission("admin.access");
  const dashboard = await getHardwareHubDashboard(auth);

  const runtimeStatus = {
    generatedAt: dashboard.observability.generatedAt.toISOString(),
    totalAgents: dashboard.totals.agents,
    onlineAgents: dashboard.totals.onlineAgents,
    warningAgents:
      dashboard.totals.staleAgents +
      dashboard.totals.offlineAgents +
      dashboard.totals.configurationWarningAgents,
    unknownOutcomeJobs: dashboard.observability.metrics.unknownOutcomeJobs,
    staleSubmittedJobs: dashboard.observability.metrics.staleSubmittedJobs,
    agents: dashboard.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      outlet: agent.outlet.name,
      register: agent.register.name,
      status: agent.displayStatus,
      version: agent.diagnostics.agentVersion,
    })),
  };

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between lg:p-7">
          <div className="min-w-0">
            <Link
              href="/admin/operasional/hardware"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-[var(--accent)] print:hidden"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Hardware Hub
            </Link>
            <div className="mt-4 flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <BookOpenCheck className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                  Panduan Setup Hardware Hub
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Panduan dari persiapan Windows 10, instalasi software, fake-mode validation,
                  aktivasi SATO dan Epson, sampai physical acceptance test serta rollback.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 lg:max-w-sm">
            Mulai selalu dari adapter <strong>fake</strong>. Aktifkan hardware real satu perangkat
            pada satu waktu dan jangan hapus SQLite journal ketika terjadi masalah.
          </div>
        </div>
      </header>

      <HardwareSetupGuideClient
        sections={hardwareSetupGuideSections}
        finalChecklist={hardwareSetupFinalChecklist}
        guideVersion={HARDWARE_SETUP_GUIDE_VERSION}
        runtimeStatus={runtimeStatus}
      />
    </div>
  );
}
