import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  ImageIcon,
  PackageSearch,
  Search,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getLegacyMigrationBatchDetail,
  type LegacyRowStatusFilter,
} from "@/features/legacy-migration/queries";
import { requireAnyPermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Analisis Import Produk Legacy",
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

function RowStatusBadge({ status }: { status: "valid" | "warning" | "invalid" }) {
  const config = {
    valid: {
      label: "Valid",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    warning: {
      label: "Perlu perhatian",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    invalid: {
      label: "Invalid",
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

function getValidationCodeCounts(value: Record<string, unknown>) {
  const raw = value.validationCodeCounts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];

  return Object.entries(raw)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12);
}

function getSourceWarnings(value: Record<string, unknown>) {
  const raw = value.sourceWarnings;
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === "string")
    : [];
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

  const validationCodeCounts = getValidationCodeCounts(
    data.batch.validationSummary,
  );
  const sourceWarnings = getSourceWarnings(data.batch.validationSummary);

  return (
    <div className="space-y-6">
      {flashMessage(query.type, query.message)}

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href="/admin/migrasi-produk"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50"
        >
          <ArrowLeft className="size-4" />
          Kembali ke migrasi produk
        </Link>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <FileSpreadsheet className="size-3.5" />
              Staging · {data.batch.worksheetName}
            </p>
            <h1 className="mt-4 break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
              {data.batch.fileName}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {data.batch.outletName} · {data.batch.outletCode} · diunggah oleh{" "}
              {data.batch.uploadedByName} pada{" "}
              {formatDateTime(
                data.batch.completedAt ?? data.batch.createdAt,
                auth.organization.timezone,
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-4" />
              Belum menjadi inventaris
            </p>
            <p className="mt-1">
              Semua baris pada halaman ini hanya referensi staging. Aktivasi stok
              baru dilakukan setelah scan dan approval pada milestone berikutnya.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <PackageSearch className="size-5 text-neutral-600" />
          <p className="mt-3 text-2xl font-semibold text-neutral-950">
            {formatNumber(data.batch.totalRows)}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">Total baris</p>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <CheckCircle2 className="size-5 text-emerald-700" />
          <p className="mt-3 text-2xl font-semibold text-emerald-950">
            {formatNumber(data.batch.validRows)}
          </p>
          <p className="mt-1 text-sm text-emerald-800">Valid</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="size-5 text-amber-700" />
          <p className="mt-3 text-2xl font-semibold text-amber-950">
            {formatNumber(data.batch.warningRows)}
          </p>
          <p className="mt-1 text-sm text-amber-800">Warning</p>
        </div>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
          <ShieldAlert className="size-5 text-red-700" />
          <p className="mt-3 text-2xl font-semibold text-red-950">
            {formatNumber(data.batch.invalidRows)}
          </p>
          <p className="mt-1 text-sm text-red-800">Invalid</p>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
          <FileSpreadsheet className="size-5 text-neutral-600" />
          <p className="mt-3 text-2xl font-semibold text-neutral-950">
            {formatNumber(data.batch.uniqueMasterCount)}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">Master legacy</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <h2 className="font-semibold text-neutral-950">Kualitas sumber data</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Barcode nol di depan", data.batch.leadingZeroBarcodeCount],
              ["URL foto tersedia", data.batch.imageUrlCount],
              ["Barcode duplikat", data.batch.duplicateBarcodeCount],
              ["Ukuran file", Math.round(data.batch.fileSizeBytes / 1024)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-neutral-50 p-4">
                <p className="text-xs font-medium text-[var(--muted)]">
                  {String(label)}
                </p>
                <p className="mt-1 text-lg font-semibold text-neutral-950">
                  {formatNumber(Number(value))}
                  {label === "Ukuran file" ? " KB" : ""}
                </p>
              </div>
            ))}
          </div>

          {sourceWarnings.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">Peringatan sumber</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-800">
                {sourceWarnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
          <h2 className="font-semibold text-neutral-950">Peringatan terbanyak</h2>
          {validationCodeCounts.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              Tidak ada warning atau error yang tercatat.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {validationCodeCounts.map(([code, total]) => (
                <div
                  key={code}
                  className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2.5"
                >
                  <span className="min-w-0 break-all text-xs font-medium text-neutral-700">
                    {code}
                  </span>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-neutral-900 ring-1 ring-[var(--border)]">
                    {formatNumber(total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Baris staging</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Menampilkan {formatNumber(data.pagination.totalRows)} baris sesuai
              filter.
            </p>
          </div>

          <form className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                name="search"
                defaultValue={data.filters.search}
                placeholder="Cari barcode, master, atau SKU"
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <select
              name="status"
              defaultValue={data.filters.status}
              className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="all">Semua status</option>
              <option value="valid">Valid ({data.statusCounts.valid})</option>
              <option value="warning">
                Warning ({data.statusCounts.warning})
              </option>
              <option value="invalid">Invalid ({data.statusCounts.invalid})</option>
            </select>
            <button
              type="submit"
              className="h-11 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Terapkan
            </button>
          </form>
        </div>

        {data.rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center text-sm text-[var(--muted)]">
            Tidak ada baris yang sesuai filter.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-3 font-semibold">Baris / Barcode</th>
                  <th className="px-3 py-3 font-semibold">Master dan SKU</th>
                  <th className="px-3 py-3 font-semibold">Spesifikasi legacy</th>
                  <th className="px-3 py-3 font-semibold">Harga legacy</th>
                  <th className="px-3 py-3 font-semibold">Validasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-4">
                      <p className="font-mono text-base font-semibold text-neutral-950">
                        {row.normalizedBarcode ?? row.legacyBarcode ?? "-"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Excel baris {row.rowNumber}
                        {row.sourceSequence ? ` · No ${row.sourceSequence}` : ""}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                        <ImageIcon className="size-3.5" />
                        {row.legacyImageUrl ? "URL foto tersedia" : "Tanpa foto"}
                      </p>
                    </td>
                    <td className="max-w-sm px-3 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        {row.legacyCategory ?? "Tanpa kategori"} ·{" "}
                        {row.legacyMasterCode ?? "Tanpa kode"}
                      </p>
                      <p className="mt-1 font-semibold text-neutral-950">
                        {row.legacyMasterName ?? "-"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-neutral-600">
                        {row.legacyItemName ?? "-"}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-xs leading-5 text-neutral-700">
                      <p>Berat: {formatDecimal(row.legacyWeightGram, " g")}</p>
                      <p>Kadar: {formatDecimal(row.legacyPurity)}</p>
                      <p>
                        Kadar tukar: {formatDecimal(row.legacyExchangePurity)}
                      </p>
                      <p>Warna: {row.legacyColor ?? "-"}</p>
                    </td>
                    <td className="px-3 py-4 text-xs leading-5 text-neutral-700">
                      <p>{formatMoney(row.legacyPricePerGram)} / gram</p>
                      <p>
                        Potongan: {formatMoney(row.legacyDeductionPerGram)}
                      </p>
                      <p className="mt-1 font-medium text-amber-700">
                        Referensi saja
                      </p>
                    </td>
                    <td className="max-w-sm px-3 py-4">
                      <RowStatusBadge status={row.validationStatus} />
                      {row.validationIssues.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-neutral-600">
                          {row.validationIssues.slice(0, 4).map((issue, index) => (
                            <li key={`${row.id}-${String(issue.code)}-${index}`}>
                              • {String(issue.message ?? issue.code ?? "Perlu review")}
                            </li>
                          ))}
                          {row.validationIssues.length > 4 ? (
                            <li className="font-medium text-neutral-800">
                              +{row.validationIssues.length - 4} peringatan lain
                            </li>
                          ) : null}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-emerald-700">
                          Tidak ada anomali otomatis.
                        </p>
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
            <p className="text-xs text-[var(--muted)]">
              Halaman {data.pagination.page} dari {data.pagination.pageCount}
            </p>
            <div className="flex gap-2">
              <Link
                aria-disabled={data.pagination.page <= 1}
                href={pageHref({
                  batchId: data.batch.id,
                  page: Math.max(1, data.pagination.page - 1),
                  status: data.filters.status,
                  search: data.filters.search,
                })}
                className={cn(
                  "inline-flex h-9 items-center rounded-xl border border-[var(--border)] px-3 text-xs font-semibold",
                  data.pagination.page <= 1
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-neutral-50",
                )}
              >
                Sebelumnya
              </Link>
              <Link
                aria-disabled={data.pagination.page >= data.pagination.pageCount}
                href={pageHref({
                  batchId: data.batch.id,
                  page: Math.min(
                    data.pagination.pageCount,
                    data.pagination.page + 1,
                  ),
                  status: data.filters.status,
                  search: data.filters.search,
                })}
                className={cn(
                  "inline-flex h-9 items-center rounded-xl border border-[var(--border)] px-3 text-xs font-semibold",
                  data.pagination.page >= data.pagination.pageCount
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-neutral-50",
                )}
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
