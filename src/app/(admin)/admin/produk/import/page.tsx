import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderArchive,
  ImageIcon,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { ProductBatchImportUpload } from "@/components/products/product-batch-import-upload";
import {
  PRODUCT_BATCH_IMPORT_LIMITS,
  PRODUCT_BATCH_IMPORT_TEMPLATE_FILENAME,
} from "@/features/product-batch-import/contracts";
import { getRecentProductBatchImportSessions } from "@/features/product-batch-import/preview-queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Import Produk Batch",
};

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export default async function ProductBatchImportPage() {
  const auth = await requirePermission("products.batch_import");
  const recentSessions = await getRecentProductBatchImportSessions(auth);

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6 lg:p-7">
        <Link
          href="/admin/produk"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Produk
        </Link>

        <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <FileSpreadsheet className="size-3.5" />
              Product Batch Import
            </span>
            <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Import banyak produk dari satu XLSX
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Template baru hanya mempunyai satu worksheet PRODUCTS. Satu row
              berarti satu item fisik. Category, Product Master, SKU, barcode,
              dan QR ditangani otomatis oleh sistem.
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Template resmi
            </p>
            <p className="mt-2 break-all text-sm font-semibold text-neutral-950">
              {PRODUCT_BATCH_IMPORT_TEMPLATE_FILENAME}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Nama file boleh diubah setelah download.
            </p>
            <Link
              href="/admin/produk/import/template"
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Download className="size-4" />
              Download products.xlsx
            </Link>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 md:grid-cols-3">
        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Download className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold text-neutral-950">1. Download template</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Gunakan products.xlsx resmi. File boleh di-rename seperti Gelang
            Rantai Kaki.xlsx selama tetap berformat .xlsx.
          </p>
        </article>

        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
            <ImageIcon className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold text-neutral-950">2. Isi worksheet PRODUCTS</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Isi data item per row. Foto boleh dimasukkan langsung memakai Image
            in Cell di Google Sheets atau Place in Cell di Excel.
          </p>
        </article>

        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold text-neutral-950">3. Upload & selesai</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Sistem memvalidasi file otomatis. Jika valid, seluruh batch langsung
            diimport secara atomic dan item menjadi Tersedia.
          </p>
        </article>
      </section>

      <ProductBatchImportUpload />

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-neutral-950">Flow sederhana, safety tetap ada</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Staff hanya mengurus data bisnis. Validation, identifier,
                duplicate guard, dan atomic commit tetap dikerjakan server.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Satu row PRODUCTS = satu Physical Product Item.",
              "Category dan Product Master existing dipakai ulang; yang belum ada dibuat otomatis.",
              "SKU, barcode, QR, dan Product Master code dibuat otomatis oleh server.",
              "Barang Baru dan Bekas langsung Tersedia; barang Rusak dibuat lewat flow manual.",
              "Harga jual/Harga per Gram tidak diisi dari XLSX. POS tetap memakai global default + transaction pricing.",
              "Foto hanya milik Physical Product Item dan boleh dikosongkan.",
            ].map((item) => (
              <div
                key={item}
                className="flex min-w-0 items-start gap-2 rounded-2xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-700"
              >
                <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />
                <span className="min-w-0">{item}</span>
              </div>
            ))}
          </div>

          <details className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
              Compatibility Excel, Google Sheets, dan ZIP
            </summary>
            <div className="mt-3 space-y-3 text-sm leading-6 text-neutral-700">
              <p>
                Single XLSX adalah workflow utama. Google Sheets tetap didukung:
                gunakan Insert → Image → Image in cell lalu download sebagai
                Microsoft Excel (.xlsx). Excel modern dapat memakai Place in Cell.
              </p>
              <p className="flex items-start gap-2">
                <FolderArchive className="mt-1 size-4 shrink-0" />
                ZIP tetap didukung sebagai mode advanced/compatibility. ZIP boleh
                memakai nama apa saja dan harus mempunyai tepat satu file .xlsx
                di root. Folder physical/ bersifat opsional untuk foto terpisah.
              </p>
              <p>
                Template lama v1 empat-sheet tetap dapat dibaca untuk compatibility,
                tetapi workflow baru yang direkomendasikan adalah template satu-sheet.
              </p>
            </div>
          </details>
        </div>

        <aside className="min-w-0 rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <h2 className="font-semibold text-neutral-950">Batas import</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Single XLSX", formatMegabytes(PRODUCT_BATCH_IMPORT_LIMITS.xlsxUploadBytes)],
              ["ZIP", formatMegabytes(PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes)],
              ["Item per batch", `${PRODUCT_BATCH_IMPORT_LIMITS.itemRows} row`],
              ["Product Master unik", `${PRODUCT_BATCH_IMPORT_LIMITS.masterRows} group`],
              ["Satu foto", formatMegabytes(PRODUCT_BATCH_IMPORT_LIMITS.imageBytes)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-3 last:border-0 last:pb-0"
              >
                <dt className="text-[var(--muted)]">{label}</dt>
                <dd className="font-semibold text-neutral-950">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
            Jika ada error, tidak ada produk yang dibuat. Perbaiki row yang
            ditunjukkan lalu upload ulang. Warning tidak memblokir import.
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-neutral-950">Import terbaru</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Session lama maupun template v2 tetap dapat dibuka kembali dari history.
            </p>
          </div>
          <Link
            href="/admin/produk/import/history"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Lihat semua history
          </Link>
        </div>
        {recentSessions.length ? (
          <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                href={`/admin/produk/import/${session.id}`}
                className="min-w-0 rounded-2xl border border-neutral-200 p-4 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-neutral-950">
                      {session.fileName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {session.totalItemRows} item · {session.invalidRows} invalid · {session.warningCount} warning
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Operator: {session.createdByName}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                    {session.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm text-[var(--muted)]">
            Belum ada session Product Batch Import.
          </p>
        )}
      </section>
    </div>
  );
}
