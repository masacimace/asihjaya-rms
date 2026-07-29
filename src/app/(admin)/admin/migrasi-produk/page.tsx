import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  History,
  LockKeyhole,
  PackageSearch,
  ShieldCheck,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { uploadLegacyProductWorkbookAction } from "@/app/actions/legacy-product-import";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { getLegacyMigrationOverview } from "@/features/legacy-migration/queries";
import {
  hasPermission,
  requireAnyPermission,
} from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Migrasi Produk Legacy",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null, timeZone: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
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

function BatchStatusBadge({ status }: { status: string }) {
  const label =
    status === "ready"
      ? "Siap direview"
      : status === "processing"
        ? "Diproses"
        : status === "failed"
          ? "Gagal"
          : "Diarsipkan";

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        status === "ready"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : status === "failed"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-neutral-200 bg-neutral-50 text-neutral-700",
      )}
    >
      {label}
    </span>
  );
}

export default async function LegacyProductMigrationPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requireAnyPermission(["migration.view", "migration.import"]);
  const [data, query] = await Promise.all([
    getLegacyMigrationOverview(auth),
    searchParams,
  ]);
  const canImport = hasPermission(auth, "migration.import");
  const overviewCards: Array<{
    label: string;
    value: number;
    Icon: LucideIcon;
  }> = [
    { label: "Batch staging", value: data.totals.batchCount, Icon: FileSpreadsheet },
    { label: "Baris referensi", value: data.totals.stagedRows, Icon: PackageSearch },
    { label: "Perlu perhatian", value: data.totals.warningRows, Icon: AlertTriangle },
    { label: "Data invalid", value: data.totals.invalidRows, Icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <FlashMessage type={query.type} message={query.message} />

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:items-end lg:p-7">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <PackageSearch className="size-3.5" />
              Milestone 1 · staging legacy
            </p>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Migrasi Produk Legacy
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Import export XLSX dari sistem lama sebagai referensi staging.
              Tidak ada baris yang otomatis menjadi stok aktif atau dapat dijual
              melalui POS pada tahap ini.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <LockKeyhole className="size-4" />
              Guardrail aktif
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Stok aktif tetap bersumber dari verifikasi barang fisik. Harga lama
              hanya disimpan sebagai referensi.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map(({ label, value, Icon }) => (
          <div
            key={label}
            className="rounded-3xl border border-[var(--border)] bg-white p-5"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
              <Icon className="size-5" />
            </div>
            <p className="mt-4 text-2xl font-semibold text-neutral-950">
              {formatNumber(value)}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        {canImport ? (
          <form
            action={uploadLegacyProductWorkbookAction}
            className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <UploadCloud className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Upload export master produk
                </h2>
                <p className="text-xs leading-5 text-[var(--muted)]">
                  Format .xlsx, maksimal 10 MB dan 50.000 baris.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-neutral-800">
                Outlet tujuan verifikasi
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
                File export legacy
                <input
                  name="file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                  className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              <p className="font-semibold">Yang dilakukan sistem</p>
              <p className="mt-1">
                Mempertahankan barcode enam digit termasuk nol di depan,
                mengekstrak URL foto, mendeteksi duplikasi dan anomali, lalu
                menyimpan seluruh baris ke staging.
              </p>
            </div>

            <FormSubmitButton
              pendingText="Menganalisis dan menyimpan staging..."
              className="mt-6 w-full bg-neutral-950 hover:bg-neutral-800"
            >
              <FileSpreadsheet className="size-4" />
              Upload dan analisis XLSX
            </FormSubmitButton>
          </form>
        ) : (
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
            <ShieldCheck className="size-10 text-neutral-500" />
            <h2 className="mt-4 font-semibold text-neutral-950">
              Akses lihat saja
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Akun ini dapat melihat hasil staging, tetapi membutuhkan permission
              <strong> migration.import</strong> untuk mengunggah workbook.
            </p>
          </section>
        )}

        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-neutral-100 text-neutral-700">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-950">
                Batas aman Milestone 1
              </h2>
              <p className="text-xs leading-5 text-[var(--muted)]">
                Import ini belum mengubah operasional outlet.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {[
              [
                "Tidak membuat stok aktif",
                "Workbook hanya disimpan pada tabel staging terpisah dari product_items.",
              ],
              [
                "Hash file anti-duplikat",
                "File yang sama tidak dapat diimpor dua kali untuk outlet yang sama.",
              ],
              [
                "Harga lama bukan pricing aktif",
                "Nilai harga dan potongan hanya menjadi referensi saat verifikasi fisik.",
              ],
              [
                "Status stok tidak diasumsikan",
                "Export lama tidak memiliki status yang dapat dipercaya, sehingga keberadaan fisik tetap wajib dipindai.",
              ],
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
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
            <History className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">Riwayat batch staging</h2>
            <p className="text-xs leading-5 text-[var(--muted)]">
              Dua puluh batch terbaru yang dapat diakses akun ini.
            </p>
          </div>
        </div>

        {data.recentBatches.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center text-sm text-[var(--muted)]">
            Belum ada workbook legacy yang diimpor.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-3 font-semibold">File dan outlet</th>
                  <th className="px-3 py-3 font-semibold">Ringkasan</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Waktu</th>
                  <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.recentBatches.map((batch) => (
                  <tr key={batch.id} className="align-top">
                    <td className="px-3 py-4">
                      <p className="max-w-xs truncate font-semibold text-neutral-950">
                        {batch.fileName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {batch.outletName} · {batch.outletCode}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        oleh {batch.uploadedByName}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-xs leading-5 text-neutral-700">
                      <p>{formatNumber(batch.totalRows)} baris</p>
                      <p>{formatNumber(batch.uniqueMasterCount)} master</p>
                      <p className="text-amber-700">
                        {formatNumber(batch.warningRows)} warning
                      </p>
                      <p className="text-red-700">
                        {formatNumber(batch.invalidRows)} invalid
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <BatchStatusBadge status={batch.status} />
                    </td>
                    <td className="px-3 py-4 text-xs leading-5 text-[var(--muted)]">
                      {formatDateTime(batch.completedAt ?? batch.createdAt, auth.organization.timezone)}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <Link
                        href={`/admin/migrasi-produk/${batch.id}`}
                        className="inline-flex h-9 items-center rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50"
                      >
                        Lihat analisis
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
