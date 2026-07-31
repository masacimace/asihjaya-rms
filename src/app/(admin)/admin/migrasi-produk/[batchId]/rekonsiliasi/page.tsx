import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  CloudDownload,
  ImageOff,
  Images,
  PackageCheck,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { migrateLegacyPhotosAction } from "@/app/actions/legacy-migration-reconciliation";
import { LEGACY_PHOTO_MIGRATION_BATCH_SIZE } from "@/features/legacy-migration/reconciliation-contracts";
import { getLegacyMigrationReconciliationData } from "@/features/legacy-migration/reconciliation-queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Rekonsiliasi Akhir Migrasi" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    return `${processed} · target tidak diisi (opsional)`;
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

function formatDateTime(value: string, timeZone: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
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
          : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {message}
    </div>
  );
}

export default async function LegacyMigrationReconciliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requirePermission("migration.verification.approve");
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const data = await getLegacyMigrationReconciliationData(auth, batchId);
  if (!data) notFound();


  return (
    <div className="space-y-6">
      {flashMessage(query.type, query.message)}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href={`/admin/migrasi-produk/${data.batch.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" /> Kembali ke batch migrasi
        </Link>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <ClipboardCheck className="size-3.5" /> Milestone 5B
            </p>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Rekonsiliasi Akhir & Foto Legacy
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Satu halaman untuk melihat blocker cutover dan menyalin foto item
              dari link XLSX ke private storage. Tidak ada approval tambahan dan
              belum ada item yang diaktifkan ke POS.
            </p>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-4 text-sm leading-6",
              data.executableSessionCount > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            <p className="flex items-center gap-2 font-semibold">
              {data.executableSessionCount > 0 ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <CircleAlert className="size-4" />
              )}
              {data.executableSessionCount > 0
                ? `${formatNumber(data.executableSessionCount)} sesi siap cutover`
                : `${formatNumber(data.blockerCount)} blocker perlu dibereskan`}
            </p>
            <p className="mt-1">
              Foto pending atau gagal hanya menjadi warning. Foto Product Master
              otomatis menjadi fallback tampilan bila tersedia.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <Store className="size-5 text-blue-700" />
          <p className="mt-3 text-2xl font-semibold text-blue-950">
            {formatNumber(data.processedPhysicalCount)}
          </p>
          <p className="text-xs text-blue-800">Barang fisik terproses</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <PackageCheck className="size-5 text-emerald-700" />
          <p className="mt-3 text-2xl font-semibold text-emerald-950">
            {formatNumber(data.verificationSummary.approved)}
          </p>
          <p className="text-xs text-emerald-800">Approved migration hold</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <ShieldCheck className="size-5 text-red-700" />
          <p className="mt-3 text-2xl font-semibold text-red-950">
            {formatNumber(data.soldSummary.total)}
          </p>
          <p className="text-xs text-red-800">Dikecualikan karena terjual</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="size-5 text-amber-700" />
          <p className="mt-3 text-2xl font-semibold text-amber-950">
            {formatNumber(data.blockerCount)}
          </p>
          <p className="text-xs text-amber-800">Total blocker cutover</p>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Readiness per sesi</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Setiap etalase dinilai mandiri. Target bersifat opsional dan hanya
              menjadi pembanding progress; selisih target tidak memblokir cutover.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
            {formatNumber(data.sessions.length)} sesi
          </span>
        </div>

        {data.batchIssues.length > 0 ? (
          <div className="mt-5 space-y-2">
            {data.batchIssues.map((issue) => (
              <Link
                key={issue.code}
                href={issue.href}
                className="flex items-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 transition hover:bg-red-100"
              >
                <CircleAlert className="size-5 shrink-0 text-red-700" />
                <span className="min-w-0 flex-1 text-sm font-semibold text-red-950">
                  {issue.label}
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-red-900">
                  {formatNumber(issue.count)}
                </span>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {data.sessions.map((session) => (
            <article
              key={session.id}
              className="rounded-2xl border border-[var(--border)] p-4 lg:p-5"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-neutral-950">{session.name}</h3>
                    {session.locationCode ? (
                      <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--accent)]">
                        {session.locationCode}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold",
                        session.canExecute
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-neutral-200 bg-neutral-50 text-neutral-700",
                      )}
                    >
                      {session.canExecute ? "Siap cutover" : session.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {formatOptionalTargetProgress(session)} · {formatNumber(session.readyItemCount)} item siap · {formatNumber(session.pricingBlockerCount)} blocker pricing
                  </p>
                </div>
                <Link
                  href={`/admin/migrasi-produk/${data.batch.id}/cutover`}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-xs font-semibold text-neutral-900"
                >
                  Lihat preflight sesi
                </Link>
              </div>

              {session.issues.length > 0 ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {session.issues.map((issue) => (
                    <Link
                      key={issue.code}
                      href={issue.href ?? `/admin/migrasi-produk/${data.batch.id}/review`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 transition hover:bg-amber-100"
                    >
                      <span>{issue.label}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold">
                        {formatNumber(issue.count)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="size-4" /> Tidak ada blocker pada sesi ini.
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      {data.executableSessionCount > 0 ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 lg:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold text-emerald-950">
                <CheckCircle2 className="size-4" /> Ada sesi yang siap diaktifkan
              </p>
              <p className="mt-1 text-sm leading-6 text-emerald-900">
                Sesi lain boleh tetap aktif. Foto legacy pending atau gagal tetap
                menjadi warning dan tidak memblokir stok.
              </p>
            </div>
            <Link
              href={`/admin/migrasi-produk/${data.batch.id}/cutover`}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              <PlayCircle className="size-4" /> Buka aktivasi stok
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-neutral-950">
              <Images className="size-5 text-[var(--accent)]" /> Migrasi foto legacy
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Foto milik item approved atau sudah activated dapat disalin. Foto aktual hasil upload
              sudah berada di storage internal dan tidak diproses ulang. Link asli
              tetap disimpan sebagai jejak sumber.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-2xl font-semibold text-emerald-900">
                  {formatNumber(data.photos.copied)}
                </p>
                <p className="text-xs text-emerald-800">Tersalin internal</p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-2xl font-semibold text-blue-900">
                  {formatNumber(data.photos.actualUpload)}
                </p>
                <p className="text-xs text-blue-800">Foto aktual / tidak perlu</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-2xl font-semibold text-amber-900">
                  {formatNumber(data.photos.pending)}
                </p>
                <p className="text-xs text-amber-800">Menunggu disalin</p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-2xl font-semibold text-red-900">
                  {formatNumber(data.photos.failed)}
                </p>
                <p className="text-xs text-red-800">Gagal, dapat diulang</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <form action={migrateLegacyPhotosAction}>
                <input type="hidden" name="batchId" value={data.batch.id} />
                <input type="hidden" name="mode" value="pending" />
                <button
                  disabled={data.photos.pending === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CloudDownload className="size-4" /> Salin hingga {" "}
                  {LEGACY_PHOTO_MIGRATION_BATCH_SIZE} foto berikutnya
                </button>
              </form>

              <form action={migrateLegacyPhotosAction}>
                <input type="hidden" name="batchId" value={data.batch.id} />
                <input type="hidden" name="mode" value="failed" />
                <button
                  disabled={data.photos.failed === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCw className="size-4" /> Ulangi foto gagal
                </button>
              </form>
            </div>

            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              Proses berjalan maksimal {LEGACY_PHOTO_MIGRATION_BATCH_SIZE} foto
              per klik agar request tetap stabil. Saat jumlah pending masih ada,
              klik kembali tombol yang sama.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
            <p className="flex items-center gap-2 font-semibold text-neutral-950">
              <ImageOff className="size-4" /> Fallback tampilan
            </p>
            <p className="mt-2">
              {formatNumber(data.photos.masterFallback)} item pending/gagal masih
              memiliki foto Product Master. {formatNumber(data.photos.noFallback)}
              item akan memakai placeholder sampai foto item ditambahkan.
            </p>
            <p className="mt-2 font-medium text-neutral-900">
              Foto gagal tidak memblokir cutover dan tetap dapat diulang setelah aktivasi.
            </p>
          </div>
        </div>
      </section>

      {data.failedPhotos.length > 0 ? (
        <section className="rounded-3xl border border-red-200 bg-white p-5 lg:p-6">
          <h2 className="font-semibold text-neutral-950">
            Foto gagal terbaru
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Daftar ini hanya untuk diagnosis cepat; gunakan tombol Ulangi foto
            gagal setelah sumber URL kembali tersedia.
          </p>
          <div className="mt-5 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)]">
            {data.failedPhotos.map((photo) => (
              <div
                key={photo.itemId}
                className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[120px_1fr_180px] sm:items-center"
              >
                <Link
                  href={`/admin/inventaris/item/${photo.itemId}`}
                  className="font-mono font-semibold text-[var(--accent)] hover:underline"
                >
                  {photo.barcodeValue}
                </Link>
                <p className="text-red-700">{photo.errorMessage}</p>
                <p className="text-xs text-[var(--muted)] sm:text-right">
                  {formatDateTime(photo.attemptedAt, auth.organization.timezone)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
        <p className="font-semibold">Batas Milestone 5B</p>
        <p className="mt-1">
          Halaman ini tidak membuat inventory movement, tidak mengubah
          `migration_hold` menjadi `available`, dan belum mengaktifkan lookup
          barcode legacy pada checkout POS.
        </p>
      </section>
    </div>
  );
}
