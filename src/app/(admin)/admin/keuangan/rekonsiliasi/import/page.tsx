import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Landmark,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";

import { uploadSettlementCsvAction } from "@/app/actions/settlement-import";
import type { SettlementImportStatus } from "@/features/reconciliation/import-contracts";
import { getSettlementImportSetupData } from "@/features/reconciliation/import-queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusLabels: Record<SettlementImportStatus, string> = {
  uploaded: "Perlu mapping",
  ready: "Siap diproses",
  processing: "Sedang diproses",
  completed: "Selesai",
  completed_with_issues: "Selesai dengan review",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

function StatusBadge({ status }: { status: SettlementImportStatus }) {
  const className =
    status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "completed_with_issues" || status === "ready"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : status === "failed"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-neutral-200 bg-neutral-50 text-neutral-700";
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", className)}>
      {statusLabels[status]}
    </span>
  );
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

export default async function SettlementImportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requirePermission("payments.reconciliation.import");
  const [data, query] = await Promise.all([
    getSettlementImportSetupData(auth),
    searchParams,
  ]);
  const activeCount = data.recentBatches.filter((batch) =>
    ["uploaded", "ready", "processing"].includes(batch.status),
  ).length;
  const issueCount = data.recentBatches.reduce(
    (total, batch) => total + batch.issueCount,
    0,
  );

  return (
    <div className="space-y-6">
      <FlashMessage type={query.type} message={query.message} />

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:items-end lg:p-7">
          <div>
            <Link
              href="/admin/keuangan/rekonsiliasi"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-[var(--accent-soft)]/40"
            >
              <ArrowLeft className="size-4" />
              Kembali ke rekonsiliasi
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Import settlement CSV
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Upload laporan QRIS, batch EDC, atau mutasi bank. Sistem akan
              memetakan kolom, mencegah file duplikat, lalu mencocokkan payment
              POS tanpa mengubah data sebelum kamu menyetujui hasilnya.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
              <Sparkles className="size-3.5 text-[var(--accent)]" />
              Status import
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-950">
              {activeCount} batch aktif
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {issueCount} baris dari batch terbaru masih perlu review finance.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
        <form
          action={uploadSettlementCsvAction}
          className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <UploadCloud className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-950">Upload file CSV</h2>
              <p className="text-xs leading-5 text-[var(--muted)]">
                Maksimal 5 MB dan 1.000 baris per batch.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-neutral-800">
              Outlet
              <select
                name="outletId"
                required
                className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="">Pilih outlet</option>
                {data.outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} · {outlet.code}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-neutral-800">
              Payment profile
              <select
                name="profileId"
                required
                className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="">Pilih akun QRIS, EDC, atau rekening</option>
                {data.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.outletName} · {profile.name} · {profile.provider}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-neutral-800">
              File settlement
              <input
                name="file"
                type="file"
                accept=".csv,text/csv,text/plain"
                required
                className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
              />
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            <p className="font-semibold">Kolom minimum</p>
            <p className="mt-1">
              Tanggal transaksi, reference payment, dan gross amount. Fee, pajak,
              net settlement, reference settlement, serta status provider bersifat
              opsional dan dapat dipetakan pada langkah berikutnya.
            </p>
          </div>

          <button
            type="submit"
            disabled={data.profiles.length === 0}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="size-4" />
            Upload dan preview CSV
          </button>
        </form>

        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-neutral-100 text-neutral-700">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-950">Guardrail import</h2>
              <p className="text-xs leading-5 text-[var(--muted)]">
                Dibuat untuk mencegah rekonsiliasi otomatis yang ambigu.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {[
              ["Preview sebelum commit", "Payment tidak berubah saat file baru diunggah atau mapping dianalisis."],
              ["Exact match saja", "Auto-apply hanya berjalan bila profile, outlet, reference, dan gross amount cocok tepat."],
              ["Duplicate file guard", "Hash SHA-256 mencegah laporan settlement yang sama diimpor dua kali."],
              ["Review queue", "Ambiguous, mismatch, duplicate, dan not found tetap membutuhkan keputusan finance."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl bg-neutral-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  {title}
                </p>
                <p className="mt-1 pl-6 text-xs leading-5 text-[var(--muted)]">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
              <History className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-950">Riwayat import</h2>
              <p className="text-xs text-[var(--muted)]">15 batch terbaru yang dapat kamu akses.</p>
            </div>
          </div>
          <Link
            href="/admin/keuangan/rekonsiliasi"
            className="hidden items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline sm:inline-flex"
          >
            Rekonsiliasi manual <ArrowRight className="size-4" />
          </Link>
        </div>

        {data.recentBatches.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-y border-neutral-100 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Profile</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Baris</th>
                  <th className="px-4 py-3 text-right">Applied</th>
                  <th className="px-4 py-3 text-right">Review</th>
                  <th className="px-4 py-3">Dibuat</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.recentBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-neutral-50/70">
                    <td className="px-4 py-4">
                      <p className="max-w-[220px] truncate font-semibold text-neutral-950">{batch.fileName}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{batch.uploadedByName}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-neutral-900">{batch.profileName}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{batch.outletName}</p>
                    </td>
                    <td className="px-4 py-4"><StatusBadge status={batch.status} /></td>
                    <td className="px-4 py-4 text-right font-semibold">{batch.rowCount}</td>
                    <td className="px-4 py-4 text-right font-semibold text-emerald-700">{batch.appliedCount}</td>
                    <td className="px-4 py-4 text-right font-semibold text-amber-700">{batch.issueCount}</td>
                    <td className="px-4 py-4 text-xs text-[var(--muted)]">{formatDateTime(batch.createdAt)}</td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/admin/keuangan/rekonsiliasi/import/${batch.id}`}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                      >
                        Buka <ArrowRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center">
            <Landmark className="size-7 text-neutral-400" />
            <p className="mt-3 font-semibold text-neutral-900">Belum ada batch import</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Upload CSV pertama untuk memulai auto-matching.</p>
          </div>
        )}
      </section>
    </div>
  );
}
