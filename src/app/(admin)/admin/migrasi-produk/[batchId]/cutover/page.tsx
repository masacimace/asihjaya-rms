import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  PackageCheck,
  PlayCircle,
  ShieldCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { executeLegacyMigrationCutoverAction } from "@/app/actions/legacy-migration-cutover";
import { LEGACY_CUTOVER_CONFIRMATION } from "@/features/legacy-migration/cutover-contracts";
import { getLegacyMigrationCutoverData } from "@/features/legacy-migration/cutover-queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Aktivasi Stok Migrasi" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatOptionalTargetProgress(input: {
  processedItemCount: number;
  expectedItemCount: number | null;
  targetShortfall: number;
  targetSurplus: number;
}) {
  const processed = `${formatNumber(input.processedItemCount)} terproses`;
  if (input.expectedItemCount === null) {
    return `${processed} · tanpa target`;
  }
  const target = `target ${formatNumber(input.expectedItemCount)}`;
  if (input.targetShortfall > 0) {
    return `${processed} · ${target} · kurang ${formatNumber(
      input.targetShortfall,
    )}`;
  }
  if (input.targetSurplus > 0) {
    return `${processed} · ${target} · lebih ${formatNumber(
      input.targetSurplus,
    )}`;
  }
  return `${processed} · sesuai ${target}`;
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

const sessionStatusLabels = {
  draft: "Draft",
  active: "Aktif",
  locked: "Dikunci",
  completed: "Selesai",
  cancelled: "Dibatalkan",
} as const;

export default async function LegacyMigrationCutoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requirePermission("migration.cutover.execute");
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const data = await getLegacyMigrationCutoverData(auth, batchId);
  if (!data) notFound();

  const executableCount = data.executableSessionCount;

  return (
    <div className="space-y-6">
      {flashMessage(query.type, query.message)}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href={`/admin/migrasi-produk/${data.batch.id}/rekonsiliasi`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" /> Kembali ke rekonsiliasi akhir
        </Link>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <PlayCircle className="size-3.5" /> Milestone 5C
            </p>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Aktivasi Stok Transactional
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Aktivasi dilakukan per sesi atau etalase. Seluruh item eligible pada
              satu sesi berubah dari migration hold menjadi available dalam satu
              transaksi, bersama opening inventory movement dan audit log.
            </p>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-4 text-sm leading-6",
              executableCount > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            <p className="flex items-center gap-2 font-semibold">
              {executableCount > 0 ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <CircleAlert className="size-4" />
              )}
              {executableCount > 0
                ? `${executableCount} sesi siap dijalankan`
                : `${formatNumber(data.blockerCount)} blocker masih aktif`}
            </p>
            <p className="mt-1">
              Foto legacy pending atau gagal tetap hanya warning dan tidak
              menghalangi aktivasi stok.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <Store className="size-5 text-blue-700" />
          <p className="mt-3 text-2xl font-semibold text-blue-950">
            {formatNumber(data.sessions.length)}
          </p>
          <p className="text-xs text-blue-800">Total sesi</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <PackageCheck className="size-5 text-emerald-700" />
          <p className="mt-3 text-2xl font-semibold text-emerald-950">
            {formatNumber(data.totalReadyItems)}
          </p>
          <p className="text-xs text-emerald-800">Item hold menunggu aktivasi</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <ShieldCheck className="size-5 text-violet-700" />
          <p className="mt-3 text-2xl font-semibold text-violet-950">
            {formatNumber(data.totalActivatedItems)}
          </p>
          <p className="text-xs text-violet-800">Item sudah diaktifkan</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <ClipboardCheck className="size-5 text-neutral-700" />
          <p className="mt-3 text-2xl font-semibold text-neutral-950">
            {formatNumber(data.completedRunCount)}
          </p>
          <p className="text-xs text-neutral-700">Cutover run selesai</p>
        </div>
      </section>

      {data.batchIssues.length > 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" /> Blocker batch
          </p>
          <p className="mt-1">
            Blocker berikut harus dibereskan sebelum sesi mana pun dapat
            diaktifkan. Blocker milik sesi lain tidak lagi menahan sesi yang sudah
            siap.
          </p>
          <div className="mt-3 space-y-2">
            {data.batchIssues.map((issue) => (
              <Link
                key={issue.code}
                href={issue.href}
                className="flex items-center justify-between rounded-xl border border-amber-200 bg-white px-3 py-2 font-semibold"
              >
                <span>{issue.label}</span>
                <span>{formatNumber(issue.count)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        {data.sessions.map((session) => (
          <article
            key={session.id}
            className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-neutral-950">
                    {session.name}
                  </h2>
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                    {sessionStatusLabels[session.status]}
                  </span>
                  {session.locationCode ? (
                    <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--accent)]">
                      {session.locationCode}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {formatOptionalTargetProgress(session)} · {" "}
                  {formatNumber(session.readyItemCount)} siap · {" "}
                  {formatNumber(session.approvedCount)} hold · {" "}
                  {formatNumber(session.activatedCount)} aktif · {" "}
                  {formatNumber(session.soldCount + session.soldBeforeScanCount)} terjual legacy · {" "}
                  {formatNumber(session.rejectedCount)} ditolak
                </p>
              </div>

              {session.cutoverRun ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <p className="font-semibold">Cutover selesai</p>
                  <p className="mt-1 text-xs leading-5">
                    {formatNumber(session.cutoverRun.itemCount)} item · {" "}
                    {formatDateTime(
                      session.cutoverRun.executedAt,
                      auth.organization.timezone,
                    )}
                    <br />oleh {session.cutoverRun.executedByName}
                  </p>
                </div>
              ) : null}
            </div>

            {session.issues.length > 0 ? (
              <div className="mt-5 grid gap-2 md:grid-cols-2">
                {session.issues.map((issue) => (
                  <Link
                    key={issue.code}
                    href={issue.href ?? `/admin/migrasi-produk/${data.batch.id}/rekonsiliasi`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition hover:bg-amber-100"
                  >
                    <span>{issue.label}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold">
                      {formatNumber(issue.count)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}

            {!session.cutoverRun ? (
              <form
                action={executeLegacyMigrationCutoverAction}
                className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
              >
                <input type="hidden" name="batchId" value={data.batch.id} />
                <input type="hidden" name="sessionId" value={session.id} />
                <div className="grid gap-3 lg:grid-cols-[1fr_250px_auto] lg:items-end">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">
                      {session.readyItemCount > 0
                        ? `Aktifkan ${formatNumber(session.readyItemCount)} item`
                        : "Selesaikan sesi tanpa stok eligible"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Target hanya menjadi pembanding dan tidak memblokir proses.
                      Pricing, master, kondisi, lokasi, dan barcode tetap diperiksa
                      untuk sesi ini secara atomic tanpa aktivasi parsial.
                    </p>
                  </div>
                  <label className="block text-xs font-semibold text-neutral-700">
                    Ketik {LEGACY_CUTOVER_CONFIRMATION}
                    <input
                      name="confirmation"
                      required
                      autoComplete="off"
                      disabled={!session.canExecute}
                      className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold uppercase outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:bg-neutral-100"
                    />
                  </label>
                  <button
                    disabled={!session.canExecute}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlayCircle className="size-4" /> Jalankan cutover
                  </button>
                </div>
              </form>
            ) : null}
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
        <p className="font-semibold">Batas Milestone 5C</p>
        <p className="mt-1">
          Setelah aktivasi, item berstatus available dan tercatat sebagai saldo
          awal stok. Lookup checkout menggunakan alias barcode legacy baru
          diaktifkan pada Milestone 5D; barcode internal tetap mengikuti perilaku
          POS yang sudah ada.
        </p>
      </section>
    </div>
  );
}
