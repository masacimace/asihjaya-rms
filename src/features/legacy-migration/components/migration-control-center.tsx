import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  Circle,
  ClipboardCheck,
  FileCheck2,
  FolderTree,
  MapPinned,
  PackageCheck,
  PackageSearch,
  PackageX,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { LegacyMigrationControlCenterData } from "@/features/legacy-migration/control-center-queries";
import {
  getLegacyBatchControlAction,
  getLegacySessionControlAction,
  getLegacyWorkflowSteps,
  type LegacyControlActionTone,
  type LegacyWorkflowStepState,
} from "@/features/legacy-migration/control-center-rules";
import { cn } from "@/lib/utils";

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDateTime(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

const actionToneClasses: Record<LegacyControlActionTone, string> = {
  neutral:
    "border-neutral-300 bg-neutral-950 text-white hover:bg-neutral-800",
  accent:
    "border-[var(--accent)] bg-[var(--accent)] text-white hover:opacity-90",
  success:
    "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800",
  warning:
    "border-amber-700 bg-amber-700 text-white hover:bg-amber-800",
  danger: "border-red-700 bg-red-700 text-white hover:bg-red-800",
};

const sessionStatusConfig = {
  draft: {
    label: "Draft",
    className: "border-neutral-200 bg-neutral-100 text-neutral-700",
  },
  active: {
    label: "Sedang berjalan",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  locked: {
    label: "Dikunci",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  completed: {
    label: "Stok aktif",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  cancelled: {
    label: "Dibatalkan",
    className: "border-red-200 bg-red-50 text-red-700",
  },
} as const;

function WorkflowStateIcon({ state }: { state: LegacyWorkflowStepState }) {
  if (state === "complete") {
    return <Check className="size-4" />;
  }
  if (state === "current") {
    return <Circle className="size-3.5 fill-current" />;
  }
  return <Circle className="size-3.5" />;
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  helper: string;
  icon: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border p-4",
        tone === "neutral" && "border-[var(--border)] bg-white",
        tone === "success" && "border-emerald-200 bg-emerald-50",
        tone === "warning" && "border-amber-200 bg-amber-50",
        tone === "danger" && "border-red-200 bg-red-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-950">
            {formatNumber(value)}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{helper}</p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-current/15 bg-white/80">
          {icon}
        </div>
      </div>
    </article>
  );
}

function OptionalTargetProgress({
  processed,
  expected,
}: {
  processed: number;
  expected: number | null;
}) {
  if (!expected) {
    return (
      <p className="text-xs leading-5 text-[var(--muted)]">
        {formatNumber(processed)} item terproses · target tidak diisi
      </p>
    );
  }

  const difference = processed - expected;
  const width = Math.min(100, Math.round((processed / expected) * 100));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span>
          {formatNumber(processed)} terproses dari target {formatNumber(expected)}
        </span>
        <span>
          {difference === 0
            ? "Sesuai"
            : difference < 0
              ? `Kurang ${formatNumber(Math.abs(difference))}`
              : `Lebih ${formatNumber(difference)}`}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-neutral-700"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
        Target hanya pembanding dan tidak memblokir aktivasi.
      </p>
    </div>
  );
}

export function MigrationControlCenter({
  data,
  timeZone,
  canManageSold,
  canReconcile,
  canCutover,
}: {
  data: LegacyMigrationControlCenterData;
  timeZone: string;
  canManageSold: boolean;
  canReconcile: boolean;
  canCutover: boolean;
}) {
  const batchAction = getLegacyBatchControlAction({
    batchId: data.batch.id,
    mapping: data.mapping,
    sessions: data.sessions,
    batchIssues: data.batchIssues,
  });
  const steps = getLegacyWorkflowSteps({
    mapping: data.mapping,
    sessions: data.sessions,
  });
  const batchActionDisabled =
    batchAction.label.includes("Aktifkan") && !canCutover;
  const totalActivated = data.sessions.reduce(
    (total, session) => total + session.activatedCount,
    0,
  );
  const totalUnresolved = data.sessions.reduce(
    (total, session) => total + session.unresolvedCount,
    0,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] xl:items-stretch">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
                <ShieldCheck className="size-3.5" />
                Pusat kendali migrasi
              </span>
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
                {data.sessionSummary.total} sesi
              </span>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-neutral-950 sm:text-2xl">
              Langkah berikutnya sudah diprioritaskan
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Gunakan satu tindakan utama di bawah. Status kesiapan berasal dari
              preflight yang sama dengan transactional cutover, bukan perkiraan UI.
            </p>

            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 sm:p-5">
              <p className="text-xs font-semibold text-[var(--muted)]">
                Tindakan utama
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-950">
                {batchAction.label}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {batchAction.description}
              </p>
              <Link
                href={batchAction.href}
                className={cn(
                  "mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold transition",
                  actionToneClasses[batchAction.tone],
                  batchActionDisabled && "pointer-events-none opacity-50",
                )}
                aria-disabled={batchActionDisabled}
              >
                {batchAction.label}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              label="Barang terproses"
              value={data.processedPhysicalCount}
              helper="Scan dan sold-before-scan"
              icon={<PackageSearch className="size-5 text-neutral-700" />}
            />
            <SummaryCard
              label="Perlu review"
              value={totalUnresolved}
              helper="Verification belum final"
              icon={<ClipboardCheck className="size-5 text-amber-700" />}
              tone={totalUnresolved > 0 ? "warning" : "neutral"}
            />
            <SummaryCard
              label="Blocker aktivasi"
              value={data.blockerCount}
              helper="Dihitung per sesi"
              icon={<AlertTriangle className="size-5 text-red-700" />}
              tone={data.blockerCount > 0 ? "danger" : "neutral"}
            />
            <SummaryCard
              label="Stok sudah aktif"
              value={totalActivated}
              helper="Hasil cutover berhasil"
              icon={<PackageCheck className="size-5 text-emerald-700" />}
              tone={totalActivated > 0 ? "success" : "neutral"}
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div>
          <h2 className="font-semibold text-neutral-950">Alur migrasi batch</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Tahap yang sedang dikerjakan ditandai otomatis berdasarkan data batch.
          </p>
        </div>
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <article
              key={step.key}
              className={cn(
                "min-w-[220px] flex-1 rounded-2xl border p-4",
                step.state === "complete" &&
                  "border-emerald-200 bg-emerald-50",
                step.state === "current" &&
                  "border-[var(--accent)] bg-[var(--accent-soft)]",
                step.state === "upcoming" &&
                  "border-[var(--border)] bg-neutral-50",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full border text-xs font-semibold",
                    step.state === "complete" &&
                      "border-emerald-300 bg-white text-emerald-700",
                    step.state === "current" &&
                      "border-[var(--accent)] bg-white text-[var(--accent)]",
                    step.state === "upcoming" &&
                      "border-neutral-300 bg-white text-neutral-500",
                  )}
                >
                  <WorkflowStateIcon state={step.state} />
                </span>
                <p className="text-xs font-semibold text-[var(--muted)]">
                  Tahap {index + 1}
                </p>
              </div>
              <p className="mt-3 font-semibold text-neutral-950">{step.label}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                {step.helper}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Sesi migrasi</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Setiap sesi hanya menampilkan satu tindakan yang paling relevan.
            </p>
          </div>
          <Link
            href={`/admin/migrasi-produk/${data.batch.id}/sesi`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
          >
            <MapPinned className="size-4" />
            Kelola sesi dan staff
          </Link>
        </div>

        {data.sessions.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center">
            <MapPinned className="mx-auto size-8 text-neutral-400" />
            <p className="mt-3 font-semibold text-neutral-900">
              Belum ada sesi migrasi
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Buat sesi berdasarkan etalase atau lokasi fisik agar scan tidak tumpang tindih.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {data.sessions.map((session) => {
              const action = getLegacySessionControlAction(
                data.batch.id,
                session,
              );
              const status = sessionStatusConfig[session.status];
              const soldCount =
                session.soldCount + session.soldBeforeScanCount;

              return (
                <article
                  key={session.id}
                  id={`session-${session.id}`}
                  className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-neutral-950">
                          {session.name}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                            status.className,
                          )}
                        >
                          {status.label}
                        </span>
                        {session.locationCode ? (
                          <span className="rounded-full border border-[var(--border)] bg-neutral-50 px-2.5 py-1 font-mono text-xs font-semibold text-neutral-700">
                            {session.locationCode}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                        <span className="inline-flex items-center gap-1.5">
                          <UsersRound className="size-3.5" />
                          {session.assignments.length > 0
                            ? session.assignments
                                .slice(0, 3)
                                .map((assignment) => assignment.fullName)
                                .join(", ")
                            : "Belum ada staff"}
                        </span>
                        {session.assignments.length > 3 ? (
                          <span>+{session.assignments.length - 3} staff</span>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      {formatNumber(session.readyItemCount)} siap aktivasi
                    </span>
                  </div>

                  <div className="mt-4">
                    <OptionalTargetProgress
                      processed={session.processedItemCount}
                      expected={session.expectedItemCount}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Verification", session.totalVerifications],
                      ["Approved hold", session.approvedCount],
                      ["Terjual legacy", soldCount],
                      ["Blocker", session.issueCount],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-xl border border-[var(--border)] bg-neutral-50 p-3"
                      >
                        <p className="text-xs text-[var(--muted)]">
                          {String(label)}
                        </p>
                        <p className="mt-1 font-semibold text-neutral-950">
                          {formatNumber(Number(value))}
                        </p>
                      </div>
                    ))}
                  </div>

                  {session.cutoverRun ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <p className="flex items-center gap-2 font-semibold">
                        <FileCheck2 className="size-4" />
                        Aktivasi berhasil
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-800">
                        {formatNumber(session.cutoverRun.itemCount)} item dan {" "}
                        {formatNumber(session.cutoverRun.movementCount)} opening movement · {" "}
                        {formatDateTime(session.cutoverRun.executedAt, timeZone)} · oleh {" "}
                        {session.cutoverRun.executedByName}
                      </p>
                    </div>
                  ) : null}

                  {session.issues.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {session.issues.slice(0, 3).map((issue) => (
                        <Link
                          key={issue.code}
                          href={
                            issue.href ??
                            `/admin/migrasi-produk/${data.batch.id}/rekonsiliasi`
                          }
                          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                        >
                          <span>{issue.label}</span>
                          <span>{formatNumber(issue.count)}</span>
                        </Link>
                      ))}
                      {session.issues.length > 3 ? (
                        <p className="text-xs text-[var(--muted)]">
                          +{session.issues.length - 3} jenis blocker lain
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-neutral-50 p-3">
                    <p className="text-xs font-semibold text-[var(--muted)]">
                      Langkah sesi berikutnya
                    </p>
                    <p className="mt-1 font-semibold text-neutral-950">
                      {action.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      {action.description}
                    </p>
                    <Link
                      href={action.href}
                      className={cn(
                        "mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                        actionToneClasses[action.tone],
                        action.label.includes("Aktifkan") && !canCutover &&
                          "pointer-events-none opacity-50",
                      )}
                    >
                      {action.label}
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-3xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold text-red-950">
                <PackageX className="size-4" />
                Terjual di sistem lama
              </p>
              <p className="mt-2 text-2xl font-semibold text-red-950">
                {formatNumber(data.soldSummary.total)}
              </p>
              <p className="mt-1 text-xs leading-5 text-red-800">
                {formatNumber(data.soldSummary.beforeScan)} tercatat sebelum scan.
              </p>
            </div>
          </div>
          {canManageSold ? (
            <Link
              href={`/admin/migrasi-produk/${data.batch.id}/sold`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-800 hover:text-red-950"
            >
              Tandai atau lihat audit
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
        </article>

        <article className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
          <p className="flex items-center gap-2 font-semibold text-blue-950">
            <Camera className="size-4" />
            Foto legacy
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-blue-200 bg-white p-2.5">
              <p className="font-semibold text-blue-950">
                {formatNumber(data.photos.copied)}
              </p>
              <p className="mt-0.5 text-xs text-blue-700">Tersalin</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-white p-2.5">
              <p className="font-semibold text-blue-950">
                {formatNumber(data.photos.pending)}
              </p>
              <p className="mt-0.5 text-xs text-blue-700">Pending</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-white p-2.5">
              <p className="font-semibold text-blue-950">
                {formatNumber(data.photos.failed)}
              </p>
              <p className="mt-0.5 text-xs text-blue-700">Gagal</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-blue-800">
            Foto bersifat maintenance dan tidak memblokir aktivasi stok.
          </p>
          {canReconcile ? (
            <Link
              href={`/admin/migrasi-produk/${data.batch.id}/rekonsiliasi#photo-migration`}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-950"
            >
              Kelola foto
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
        </article>

        <article className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <p className="flex items-center gap-2 font-semibold text-neutral-950">
            <FolderTree className="size-4" />
            Akses pendukung
          </p>
          <div className="mt-3 space-y-2">
            <Link
              href={`/admin/migrasi-produk/${data.batch.id}/mapping`}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
            >
              Mapping master
              <span>{formatNumber(data.mapping.pending)} pending</span>
            </Link>
            <Link
              href={`/admin/migrasi-produk/${data.batch.id}/review`}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
            >
              Antrean review
              <span>{formatNumber(totalUnresolved)}</span>
            </Link>
            {canReconcile ? (
              <Link
                href={`/admin/migrasi-produk/${data.batch.id}/rekonsiliasi`}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
              >
                Kesiapan aktivasi
                <span>{formatNumber(data.executableSessionCount)} siap</span>
              </Link>
            ) : null}
            <Link
              href="#staging-data"
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
            >
              Data staging
              <PackageSearch className="size-4" />
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
