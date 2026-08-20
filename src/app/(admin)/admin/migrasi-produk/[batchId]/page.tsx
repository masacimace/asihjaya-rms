import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  ImageIcon,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { retryLegacyProductImportBatchAction } from "@/app/actions/legacy-product-import";
import { LegacyImageSyncRunner } from "@/features/legacy-migration/components/legacy-image-sync-runner";
import {
  getLegacyMigrationBatchDetail,
  type LegacyRowStatusFilter,
} from "@/features/legacy-migration/queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Detail Import Produk Legacy",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatMoney(value: string | null) {
  if (!value) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatDecimal(value: string | null, suffix = "") {
  if (!value) return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `${value}${suffix}`;
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(numeric)}${suffix}`;
}

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

function readStatus(value: string | undefined): LegacyRowStatusFilter {
  return value === "valid" || value === "warning" || value === "invalid"
    ? value
    : "all";
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

function RowStatusBadge({
  status,
}: {
  status: "valid" | "warning" | "invalid";
}) {
  const config = {
    valid: {
      label: "Bersih",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    warning: {
      label: "Perlu dicek",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    invalid: {
      label: "Perlu dirapikan",
      className: "border-red-200 bg-red-50 text-red-700",
    },
  }[status];

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

function pageHref(input: {
  batchId: string;
  page: number;
  status: LegacyRowStatusFilter;
  search: string;
}) {
  const query = new URLSearchParams();
  if (input.page > 1) query.set("page", String(input.page));
  if (input.status !== "all") query.set("status", input.status);
  if (input.search) query.set("search", input.search);
  const suffix = query.toString();
  return `/admin/migrasi-produk/${input.batchId}${suffix ? `?${suffix}` : ""}`;
}

function readDirectImportSummary(value: Record<string, unknown>) {
  const raw = value.directImport;
  const data = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

  return {
    importedItemCount: Number(data.importedItemCount ?? 0),
    createdMasterCount: Number(data.createdMasterCount ?? 0),
    reusedMasterCount: Number(data.reusedMasterCount ?? 0),
    createdCategoryCount: Number(data.createdCategoryCount ?? 0),
    cleanupItemCount: Number(data.cleanupItemCount ?? 0),
    legacyBarcodeAliasCount: Number(data.legacyBarcodeAliasCount ?? 0),
    systemOnlyBarcodeCount: Number(data.systemOnlyBarcodeCount ?? 0),
  };
}

function getValidationCodeCounts(value: Record<string, unknown>) {
  const raw = value.validationCodeCounts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];

  return Object.entries(raw)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10);
}

export default async function LegacyProductBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
    type?: string;
    message?: string;
  }>;
}) {
  const auth = await requireAnyPermission(["migration.view", "migration.import"]);
  const [routeParams, query] = await Promise.all([params, searchParams]);
  const status = readStatus(query.status);
  const requestedPage = Number(query.page ?? "1");
  const search = String(query.search ?? "").trim().slice(0, 120);
  const data = await getLegacyMigrationBatchDetail(auth, {
    batchId: routeParams.batchId,
    page: requestedPage,
    status,
    search,
  });

  if (!data) notFound();
  const canImport = hasPermission(auth, "migration.import");
  const directImport = readDirectImportSummary(data.batch.validationSummary);
  const validationCodeCounts = getValidationCodeCounts(data.batch.validationSummary);
  const cleanupCount = data.batch.warningRows + data.batch.invalidRows;
  const importedCount = directImport.importedItemCount || (data.batch.status === "ready" ? data.batch.totalRows : 0);

  return (
    <div className="space-y-6">
      {flashMessage(query.type, query.message)}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href="/admin/migrasi-produk"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
        >
          <ArrowLeft className="size-4" />
          Kembali ke import produk
        </Link>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <FileSpreadsheet className="size-3.5" />
              Import legacy · {data.batch.worksheetName}
            </p>
            <h1 className="mt-4 break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
              {data.batch.fileName}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {data.batch.outletName} · {data.batch.outletCode} · diunggah oleh {data.batch.uploadedByName} pada {formatDateTime(data.batch.completedAt ?? data.batch.createdAt, auth.organization.timezone)}
            </p>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-4 text-sm leading-6",
              data.batch.status === "ready"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : data.batch.status === "failed"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-blue-200 bg-blue-50 text-blue-900",
            )}
          >
            <p className="flex items-center gap-2 font-semibold">
              {data.batch.status === "ready" ? (
                <CheckCircle2 className="size-4" />
              ) : data.batch.status === "failed" ? (
                <ShieldAlert className="size-4" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {data.batch.status === "ready"
                ? "Import selesai"
                : data.batch.status === "failed"
                  ? "Import gagal"
                  : "Import sedang diproses"}
            </p>
            <p className="mt-1">
              {data.batch.status === "ready"
                ? "Item sudah aktif di inventaris/POS. Data warning dapat dirapikan sambil operasional berjalan."
                : data.batch.errorMessage ?? "Tidak ada item parsial yang diaktifkan sebelum commit selesai."}
            </p>
            {data.batch.status === "failed" && canImport ? (
              <form action={retryLegacyProductImportBatchAction} className="mt-3">
                <input type="hidden" name="batchId" value={data.batch.id} />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-neutral-950 px-3 text-xs font-semibold text-white"
                >
                  <RefreshCw className="size-3.5" />
                  Coba Import Lagi
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <PackageCheck className="size-5 text-emerald-600" />
          <p className="mt-3 text-2xl font-semibold text-neutral-950">{formatNumber(importedCount)}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Item aktif</p>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <PackageSearch className="size-5 text-neutral-600" />
          <p className="mt-3 text-2xl font-semibold text-neutral-950">{formatNumber(data.batch.uniqueMasterCount)}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Product Master</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="size-5 text-amber-700" />
          <p className="mt-3 text-2xl font-semibold text-amber-950">{formatNumber(directImport.cleanupItemCount || cleanupCount)}</p>
          <p className="mt-1 text-sm text-amber-800">Perlu dirapikan</p>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <ImageIcon className="size-5 text-neutral-600" />
          <p className="mt-3 text-2xl font-semibold text-neutral-950">{formatNumber(data.batch.imageUrlCount)}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">URL foto sumber</p>
        </div>
      </section>

      {data.batch.status === "ready" ? (
        <LegacyImageSyncRunner
          batchId={data.batch.id}
          initialPendingCount={data.imageSync.pendingCount}
          initialSyncedCount={data.imageSync.syncedCount}
          initialFailedCount={data.imageSync.totalFailedCount}
          missingCount={data.imageSync.missingCount}
          totalWithSourceCount={data.imageSync.totalWithSourceCount}
          canSync={canImport}
        />
      ) : null}

      {data.batch.status === "ready" ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Product Master</p>
            <p className="mt-2 text-xl font-semibold text-neutral-950">
              {formatNumber(directImport.createdMasterCount)} dibuat
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {formatNumber(directImport.reusedMasterCount)} memakai master yang sudah ada
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Barcode legacy</p>
            <p className="mt-2 text-xl font-semibold text-neutral-950">
              {formatNumber(directImport.legacyBarcodeAliasCount)} alias aktif
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {formatNumber(directImport.systemOnlyBarcodeCount)} item memakai barcode internal saja
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">Kategori</p>
            <p className="mt-2 text-xl font-semibold text-neutral-950">
              {formatNumber(directImport.createdCategoryCount)} dibuat otomatis
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Kategori existing digunakan kembali jika cocok</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <h2 className="font-semibold text-neutral-950">Kualitas sumber data</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Barcode nol di depan", data.batch.leadingZeroBarcodeCount],
              ["URL foto tersedia", data.batch.imageUrlCount],
              ["Barcode duplikat", data.batch.duplicateBarcodeCount],
              ["Ukuran file (KB)", Math.round(data.batch.fileSizeBytes / 1024)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-neutral-50 p-4">
                <p className="text-xs text-[var(--muted)]">{String(label)}</p>
                <p className="mt-1 text-lg font-semibold text-neutral-950">{formatNumber(Number(value))}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <h2 className="font-semibold text-neutral-950">Cleanup terbanyak</h2>
          {validationCodeCounts.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">Tidak ada warning otomatis.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {validationCodeCounts.map(([code, total]) => (
                <div key={code} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
                  <span className="min-w-0 break-all text-xs font-medium text-neutral-700">{code}</span>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-neutral-900 ring-1 ring-[var(--border)]">{formatNumber(total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="source-data" className="scroll-mt-24 rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Data sumber & cleanup</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Semua row tetap diimport. Tabel ini hanya membantu mencari data yang ingin dirapikan setelahnya.
            </p>
          </div>

          <form className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                name="search"
                defaultValue={data.filters.search}
                placeholder="Cari barcode, master, atau produk"
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <select
              name="status"
              defaultValue={data.filters.status}
              className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="all">Semua data</option>
              <option value="valid">Bersih ({data.statusCounts.valid})</option>
              <option value="warning">Perlu dicek ({data.statusCounts.warning})</option>
              <option value="invalid">Perlu dirapikan ({data.statusCounts.invalid})</option>
            </select>
            <button type="submit" className="h-11 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white">Terapkan</button>
          </form>
        </div>

        {data.rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center text-sm text-[var(--muted)]">
            Tidak ada baris yang sesuai filter.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)]">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-neutral-50 text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-3 font-semibold">Barcode</th>
                  <th className="px-3 py-3 font-semibold">Produk</th>
                  <th className="px-3 py-3 font-semibold">Spesifikasi</th>
                  <th className="px-3 py-3 font-semibold">Data legacy</th>
                  <th className="px-3 py-3 font-semibold">Cleanup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-4">
                      <p className="font-mono font-semibold text-neutral-950">{row.normalizedBarcode ?? row.legacyBarcode ?? "Barcode internal"}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Excel baris {row.rowNumber}</p>
                    </td>
                    <td className="max-w-sm px-3 py-4">
                      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{row.legacyCategory ?? "Tanpa kategori"} · {row.legacyMasterCode ?? "Kode otomatis"}</p>
                      <p className="mt-1 font-semibold text-neutral-950">{row.legacyMasterName ?? "Master otomatis"}</p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600">{row.legacyItemName ?? "Nama fallback otomatis"}</p>
                    </td>
                    <td className="px-3 py-4 text-xs leading-5 text-neutral-700">
                      <p>Berat: {formatDecimal(row.legacyWeightGram, " g")}</p>
                      <p>Kadar %: {formatDecimal(row.legacyPurity)}</p>
                      <p>Kadar tukar: {formatDecimal(row.legacyExchangePurity)}</p>
                      <p>Warna: {row.legacyColor ?? "-"}</p>
                    </td>
                    <td className="px-3 py-4 text-xs leading-5 text-neutral-700">
                      <p>Harga lama: {formatMoney(row.legacyPricePerGram)} / gram</p>
                      <p>Potongan/gr: {formatMoney(row.legacyDeductionPerGram)}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[var(--muted)]"><ImageIcon className="size-3.5" />{row.legacyImageUrl ? "URL foto tersedia" : "Tanpa URL foto"}</p>
                    </td>
                    <td className="max-w-sm px-3 py-4">
                      <RowStatusBadge status={row.validationStatus} />
                      {row.validationIssues.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-neutral-600">
                          {row.validationIssues.slice(0, 4).map((issue, index) => (
                            <li key={`${row.id}-${String(issue.code)}-${index}`}>• {String(issue.message ?? issue.code ?? "Perlu dirapikan")}</li>
                          ))}
                          {row.validationIssues.length > 4 ? <li className="font-medium text-neutral-800">+{row.validationIssues.length - 4} catatan lain</li> : null}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-emerald-700">Tidak ada anomali otomatis.</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.pagination.pageCount > 1 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
            <p className="text-xs text-[var(--muted)]">Halaman {data.pagination.page} dari {data.pagination.pageCount}</p>
            <div className="flex gap-2">
              <Link
                aria-disabled={data.pagination.page <= 1}
                href={pageHref({ batchId: data.batch.id, page: Math.max(1, data.pagination.page - 1), status: data.filters.status, search: data.filters.search })}
                className={cn("inline-flex h-9 items-center rounded-xl border border-[var(--border)] px-3 text-xs font-semibold", data.pagination.page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-neutral-50")}
              >
                Sebelumnya
              </Link>
              <Link
                aria-disabled={data.pagination.page >= data.pagination.pageCount}
                href={pageHref({ batchId: data.batch.id, page: Math.min(data.pagination.pageCount, data.pagination.page + 1), status: data.filters.status, search: data.filters.search })}
                className={cn("inline-flex h-9 items-center rounded-xl border border-[var(--border)] px-3 text-xs font-semibold", data.pagination.page >= data.pagination.pageCount ? "pointer-events-none opacity-40" : "hover:bg-neutral-50")}
              >
                Berikutnya
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
