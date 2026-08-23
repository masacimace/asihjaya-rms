import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Package,
  RefreshCcw,
  Store,
} from "lucide-react";
import Link from "next/link";

import { ProductBatchImportLabels } from "@/components/products/product-batch-import-labels";
import type { ProductBatchImportPreview } from "@/features/product-batch-import/preview-queries";
import type { ProductBatchImportResult } from "@/features/product-batch-import/result-queries";

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDateTime(value: Date | null, timeZone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

function collectErrors(preview: ProductBatchImportPreview) {
  return [
    ...preview.masters.flatMap((row) =>
      row.validationErrors.map((error) => ({
        rowNumber: row.rowNumber,
        code: error.code,
        field: error.field,
        message: error.message,
      })),
    ),
    ...preview.items.flatMap((row) =>
      row.validationErrors.map((error) => ({
        rowNumber: row.rowNumber,
        code: error.code,
        field: error.field,
        message: error.message,
      })),
    ),
  ];
}

export function ProductBatchImportV2Session({
  preview,
  result,
  canPrintLabels,
  timeZone,
}: {
  preview: ProductBatchImportPreview;
  result: ProductBatchImportResult | null;
  canPrintLabels: boolean;
  timeZone: string;
}) {
  const completed = preview.session.status === "completed" && result;
  const errors = collectErrors(preview);

  if (completed) {
    const createdMasters = result.masters.filter(
      (master) => master.resolution === "created",
    );
    const reusedMasters = result.masters.filter(
      (master) => master.resolution === "reused",
    );

    return (
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 overflow-x-clip pb-8">
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/admin/produk/import"
                className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
              >
                <ArrowLeft className="size-4" />
                Kembali ke Import
              </Link>
              <div className="mt-4 flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700">
                  <CheckCircle2 className="size-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold text-emerald-950 sm:text-3xl">
                    Import selesai
                  </h1>
                  <p className="mt-2 break-all text-sm font-medium text-emerald-900">
                    {result.session.fileName}
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-900">
                    Semua data valid sudah diimport secara atomic. Item Baru dan
                    Bekas langsung berstatus Tersedia dan dapat digunakan di POS.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href={`/admin/produk/import/${preview.session.id}/result`}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-semibold !text-white transition hover:bg-emerald-800"
            >
              <Download className="size-4" />
              Download hasil
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Item dibuat", result.items.length],
              ["Master baru", createdMasters.length],
              ["Master dipakai ulang", reusedMasters.length],
              ["Warning", result.warnings.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-white/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-neutral-950">
                  {formatNumber(Number(value))}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-emerald-800">
            Selesai {formatDateTime(result.session.committedAt, timeZone)} · operator {result.session.createdByName}
          </p>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold text-neutral-950">Item hasil import</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                SKU dan barcode dibuat otomatis oleh server. Harga jual tidak
                berasal dari file XLSX.
              </p>
            </div>
            <Link
              href="/admin/produk"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Lihat Produk
            </Link>
          </div>

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {result.items.map((item) => (
              <div
                key={item.productItemId}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-neutral-950">
                    {item.displayName ?? item.productName}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-[var(--muted)]">
                    {item.sku} · {item.barcode}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="rounded-lg bg-neutral-100 px-2.5 py-1">
                    {item.outletCode ?? "Tanpa outlet"}
                  </span>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                    {item.availability === "available" ? "Tersedia" : item.availability}
                  </span>
                  {item.imageSource === "none" ? (
                    <span className="rounded-lg bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                      Tanpa foto
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        {result.warnings.length ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
              <div>
                <h2 className="font-semibold text-amber-950">
                  {formatNumber(result.warnings.length)} warning
                </h2>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  Warning tidak memblokir import. Data dapat dibersihkan sambil operasional berjalan.
                </p>
              </div>
            </div>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {result.warnings.map((warning, index) => (
                <div
                  key={`${warning.sheet}-${warning.rowNumber}-${warning.code}-${index}`}
                  className="rounded-xl bg-white/80 p-3 text-xs leading-5 text-amber-950"
                >
                  <strong>Row {warning.rowNumber}</strong>
                  {warning.field ? ` · ${warning.field}` : ""} · {warning.message}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <ProductBatchImportLabels
            sessionId={preview.session.id}
            items={result.items}
            labelJobs={result.labelJobs}
            canPrintLabels={canPrintLabels}
          />
        </section>
      </div>
    );
  }

  if (preview.session.status === "failed") {
    return (
      <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-6 pb-8">
        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 sm:p-6 lg:p-7">
          <Link
            href="/admin/produk/import"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-red-900 transition hover:bg-red-100"
          >
            <ArrowLeft className="size-4" />
            Kembali ke Import
          </Link>

          <div className="mt-4 flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-red-700">
              <AlertTriangle className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-red-950 sm:text-3xl">
                Import gagal diproses
              </h1>
              <p className="mt-2 break-all text-sm font-medium text-red-900">
                {preview.session.fileName}
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-red-900">
                Atomic import dibatalkan. Tidak ada Product Master atau Product
                Item parsial yang disimpan. File yang sama boleh di-upload ulang
                setelah kendala sistem diperbaiki.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Detail kegagalan
            </p>
            <p className="mt-2 font-mono text-xs font-semibold text-red-900">
              {preview.session.failureCode ?? "IMPORT_FAILED"}
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-800">
              {preview.session.failureMessage ??
                "Import gagal diselesaikan karena kendala sistem."}
            </p>
          </div>

          <Link
            href="/admin/produk/import"
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white hover:bg-neutral-800"
          >
            <RefreshCcw className="size-4" />
            Upload ulang file
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 pb-8">
      <section className="rounded-3xl border border-red-200 bg-red-50 p-5 sm:p-6 lg:p-7">
        <Link
          href="/admin/produk/import"
          className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-red-900 transition hover:bg-red-100"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Import
        </Link>

        <div className="mt-4 flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-red-700">
            <AlertTriangle className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-red-950 sm:text-3xl">
              File perlu diperbaiki
            </h1>
            <p className="mt-2 break-all text-sm font-medium text-red-900">
              {preview.session.fileName}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-red-900">
              Tidak ada Product Master atau Product Item yang dibuat. Perbaiki
              row yang bermasalah di XLSX lalu upload ulang file tersebut.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/85 p-4">
            <Package className="size-4 text-red-700" />
            <p className="mt-2 text-xs text-red-700">Product Master group</p>
            <p className="mt-1 text-xl font-semibold text-neutral-950">
              {formatNumber(preview.session.totalMasterRows)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/85 p-4">
            <Store className="size-4 text-red-700" />
            <p className="mt-2 text-xs text-red-700">Item fisik</p>
            <p className="mt-1 text-xl font-semibold text-neutral-950">
              {formatNumber(preview.session.totalItemRows)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/85 p-4">
            <AlertTriangle className="size-4 text-red-700" />
            <p className="mt-2 text-xs text-red-700">Validation error</p>
            <p className="mt-1 text-xl font-semibold text-neutral-950">
              {formatNumber(errors.length)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-neutral-950">Yang perlu diperbaiki</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Nomor row mengikuti worksheet PRODUCTS di file yang di-upload.
            </p>
          </div>
          <Link
            href={`/admin/produk/import/${preview.session.id}/errors`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            <Download className="size-4" />
            Download error XLSX
          </Link>
        </div>

        <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {errors.map((error, index) => (
            <div
              key={`${error.rowNumber}-${error.code}-${error.field ?? "global"}-${index}`}
              className="rounded-2xl border border-red-100 bg-red-50/70 p-4 text-sm leading-6 text-red-950"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-red-700">
                <span>Row {error.rowNumber}</span>
                <span>{error.code}</span>
                {error.field ? <span className="font-mono">{error.field}</span> : null}
              </div>
              <p className="mt-1">{error.message}</p>
            </div>
          ))}
        </div>

        <Link
          href="/admin/produk/import"
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white hover:bg-neutral-800"
        >
          <RefreshCcw className="size-4" />
          Upload file yang sudah diperbaiki
        </Link>
      </section>
    </div>
  );
}
