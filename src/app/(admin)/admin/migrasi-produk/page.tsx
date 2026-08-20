import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  History,
  ImageIcon,
  PackageCheck,
  PackageSearch,
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
  const auth = await requireAnyPermission(["migration.view", "migration.import"]);
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
      helper: "Langsung aktif di inventaris",
      value: data.totals.importedRows,
      Icon: PackageCheck,
    },
    {
      label: "Perlu dirapikan",
      helper: "Tidak memblokir operasional",
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
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_22rem] lg:items-end lg:p-7">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <PackageSearch className="size-3.5" />
              Direct import produk legacy
            </p>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Import Produk Legacy
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Upload XLSX dari sistem lama dan seluruh baris langsung dibuat sebagai
              Product Item aktif. Tidak ada stock opname, review, migration hold,
              reconciliation, atau cutover.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <CheckCircle2 className="size-4" />
              Import dibuat non-blocking
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Data yang kurang rapi tetap masuk. Warning dicatat untuk cleanup
              sambil berjalan, sedangkan foto disalin otomatis setelah item aktif.
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
            <p className="mt-1 text-sm font-semibold text-neutral-800">{label}</p>
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
              <p className="font-semibold">Sekali upload langsung aktif</p>
              <p className="mt-1">
                Kategori dan Product Master dipetakan/dibuat otomatis, identitas
                internal dibuat aman, barcode legacy tetap dapat dipindai jika unik,
                dan semua item masuk ke status Tersedia. Harga legacy hanya disimpan
                sebagai referensi; POS tetap memakai Harga/Gram aktif berdasarkan Kadar %.
              </p>
            </div>

            <FormSubmitButton
              pendingText="Mengimport produk..."
              className="mt-6 w-full bg-neutral-950 hover:bg-neutral-800"
            >
              <FileSpreadsheet className="size-4" />
              Import XLSX ke Inventaris
            </FormSubmitButton>
          </form>
        ) : (
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
            <ShieldCheck className="size-10 text-neutral-500" />
            <h2 className="mt-4 font-semibold text-neutral-950">Akses lihat saja</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Permission <strong>migration.import</strong> diperlukan untuk direct import.
            </p>
          </section>
        )}

        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <h2 className="font-semibold text-neutral-950">Aturan import baru</h2>
          <div className="mt-5 grid gap-3">
            {[
              ["Semua row tetap masuk", "Warning/invalid hanya menjadi penanda cleanup."],
              ["Langsung Tersedia", "Tidak ada verification session atau stock opname."],
              ["Barcode duplicate-safe", "Barcode legacy yang bentrok tidak memblokir item; item tetap punya barcode internal unik."],
              ["Foto non-blocking", "URL foto disalin ke storage internal setelah commit. Gagal download tidak mematikan item."],
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
                    <p className="truncate font-semibold text-neutral-950">{batch.fileName}</p>
                    <BatchStatusBadge status={batch.status} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {batch.outletName} · {batch.outletCode} · {formatNumber(batch.totalRows)} item · {formatNumber(batch.uniqueMasterCount)} master
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatNumber(batch.warningRows + batch.invalidRows)} perlu dirapikan · oleh {batch.uploadedByName}
                  </p>
                </div>
                <div className="text-xs text-[var(--muted)] md:text-right">
                  {formatDateTime(batch.completedAt ?? batch.createdAt, auth.organization.timezone)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
