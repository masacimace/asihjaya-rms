import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  History,
  ImageIcon,
  PackageCheck,
  ArrowLeft,
  ShieldCheck,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { uploadLegacyProductWorkbookAction } from "@/app/actions/legacy-product-import";
import { FormSubmitButton } from "@/components/forms/form-submit-button";
import { getLegacyMigrationOverview } from "@/features/legacy-migration/queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Import Produk Legacy",
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
      ? "Selesai"
      : status === "processing"
        ? "Mengimport"
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
  const auth = await requireAnyPermission([
    "migration.view",
    "migration.import",
  ]);
  const [data, query] = await Promise.all([
    getLegacyMigrationOverview(auth),
    searchParams,
  ]);
  const canImport = hasPermission(auth, "migration.import");
  const overviewCards: Array<{
    label: string;
    helper: string;
    value: number;
    Icon: LucideIcon;
  }> = [
    {
      label: "Batch selesai",
      helper: "Import XLSX yang sudah diproses",
      value: data.totals.batchCount,
      Icon: FileSpreadsheet,
    },
    {
      label: "Item diimport",
      helper: "Produk baru dari hasil import",
      value: data.totals.importedRows,
      Icon: PackageCheck,
    },
    {
      label: "Baris ditunda",
      helper: "Akumulasi hasil seluruh batch",
      value: data.totals.cleanupRows,
      Icon: AlertTriangle,
    },
    {
      label: "URL foto sumber",
      helper: "Disalin ke internal storage",
      value: data.totals.imageUrlRows,
      Icon: ImageIcon,
    },
  ];

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-clip">
      <FlashMessage type={query.type} message={query.message} />

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_23rem] lg:items-end lg:p-7">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Import Produk Legacy
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Upload Excel dari sistem lama, pilih outlet, lalu klik Sinkronkan
              Produk. Produk yang sudah ada dikenali otomatis agar tidak ganda.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <CheckCircle2 className="size-4" />
              Sekali upload, otomatis dicocokkan
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Produk baru ditambahkan sesuai status stok Excel. Baris yang
              ambigu ditunda dan dapat diperiksa setelah proses selesai.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map(({ label, helper, value, Icon }) => (
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
            <p className="mt-1 text-sm font-semibold text-neutral-800">
              {label}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">{helper}</p>
          </div>
        ))}
      </section>

      <section className="grid w-full min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        {canImport ? (
          <form
            action={uploadLegacyProductWorkbookAction}
            className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
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
                Outlet tujuan stok
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
                  className="block w-full overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-xs text-neutral-700 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white sm:text-sm"
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              <p className="font-semibold">Tanpa mencocokkan produk satu per satu</p>
              <p className="mt-1">
                Produk lama tidak dibuat ulang. Produk baru mengikuti status
                stok Excel, dan transaksi yang sudah berjalan tetap
                dipertahankan. Foto produk baru disalin otomatis.
              </p>
              <p className="mt-2 text-xs">
                Excel lama tanpa kolom status dianggap berisi stok tersedia.
              </p>
            </div>

            <FormSubmitButton
              pendingText="Menyinkronkan produk..."
              className="mt-6 w-full bg-neutral-950 hover:bg-neutral-800"
            >
              <FileSpreadsheet className="size-4" />
              Sinkronkan Produk
            </FormSubmitButton>
          </form>
        ) : (
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
            <ShieldCheck className="size-10 text-neutral-500" />
            <h2 className="mt-4 font-semibold text-neutral-950">
              Akses lihat saja
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Permission <strong>migration.import</strong> diperlukan untuk
              sinkronisasi produk.
            </p>
          </section>
        )}

        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <h2 className="font-semibold text-neutral-950">Sistem mengerjakan otomatis</h2>
          <div className="mt-5 grid gap-3">
            {[
              [
                "Produk sudah ada",
                "Dikenali dan tidak dibuat ulang.",
              ],
              [
                "Produk baru",
                "Ditambahkan mengikuti status stok dari Excel.",
              ],
              [
                "Data yang bentrok",
                "Ditunda otomatis; produk lainnya tetap diproses.",
              ],
              [
                "Transaksi tetap aman",
                "Status operasional di sistem baru tidak diaktifkan kembali oleh Excel.",
              ],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl bg-neutral-50 p-4">
                <p className="flex items-start gap-2 text-sm font-semibold text-neutral-900">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
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
            <h2 className="font-semibold text-neutral-950">Import terbaru</h2>
            <p className="text-xs leading-5 text-[var(--muted)]">
              Dua puluh batch terbaru yang dapat diakses akun ini.
            </p>
          </div>
        </div>

        {data.recentBatches.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center text-sm text-[var(--muted)]">
            Belum ada workbook legacy yang diimport.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {data.recentBatches.map((batch) => (
              <Link
                key={batch.id}
                href={`/admin/migrasi-produk/${batch.id}`}
                className="group grid gap-4 rounded-2xl border border-[var(--border)] p-4 text-inherit no-underline transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/20 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-neutral-950">
                      {batch.fileName}
                    </p>
                    <BatchStatusBadge status={batch.status} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {batch.outletName} · {batch.outletCode} ·{" "}
                    {formatNumber(batch.totalRows)} item ·{" "}
                    {formatNumber(batch.uniqueMasterCount)} master
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {batch.syncSummary.syncVersion === 1 ? `${formatNumber(Number(batch.syncSummary.importedItemCount ?? 0))} baru · ${formatNumber(Number(batch.syncSummary.existingItemCount ?? 0))} sudah ada · ${formatNumber(Number(batch.syncSummary.deferredRowCount ?? 0))} ditunda` : `${formatNumber(batch.warningRows + batch.invalidRows)} perlu dirapikan`} · oleh {batch.uploadedByName}
                  </p>
                </div>
                <div className="text-xs text-[var(--muted)] md:text-right">
                  {formatDateTime(
                    batch.completedAt ?? batch.createdAt,
                    auth.organization.timezone,
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
