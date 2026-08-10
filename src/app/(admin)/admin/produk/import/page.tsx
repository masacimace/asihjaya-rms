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
  PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
} from "@/features/product-batch-import/contracts";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Import Produk Batch",
};

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export default async function ProductBatchImportPage() {
  await requirePermission("products.batch_import");

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
              Template Product Batch Import v{PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION}
            </span>
            <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Siapkan import produk dalam satu workbook
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Download template resmi, isi Product Master dan item fisik, lalu
              siapkan foto dalam struktur ZIP yang dijelaskan di workbook.
              Identifier teknis seperti kode master, SKU, barcode, dan QR dibuat
              otomatis oleh sistem saat proses commit.
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Template resmi
            </p>
            <p className="mt-2 break-all text-sm font-semibold text-neutral-950">
              {PRODUCT_BATCH_IMPORT_TEMPLATE_FILENAME}
            </p>
            <Link
              href="/admin/produk/import/template"
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Download className="size-4" />
              Download template XLSX
            </Link>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-4 md:grid-cols-3">
        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <FileSpreadsheet className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold text-neutral-950">1. Isi workbook</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Gunakan sheet PRODUCT_MASTERS dan PHYSICAL_PRODUCTS. Ganti atau
            hapus baris contoh sebelum membuat paket final.
          </p>
        </article>

        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
            <ImageIcon className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold text-neutral-950">2. Siapkan foto</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Foto master masuk ke images/masters. Foto item fisik opsional masuk
            ke images/physical dan dapat kosong untuk memakai foto master.
          </p>
        </article>

        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="grid size-10 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
            <FolderArchive className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold text-neutral-950">3. Buat satu ZIP</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            products.xlsx berada di root ZIP. Upload validation staging sudah
            aktif; preview detail akan tersedia pada tahap 2B.5.
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
              <h2 className="font-semibold text-neutral-950">Contract penting v1</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Template dibuat supaya staff cukup mengisi data bisnis dan tidak
                perlu mengelola identifier teknis.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Product Master code dibuat otomatis oleh server.",
              "SKU, barcode, dan QR Product Item dibuat saat commit.",
              "Barcode legacy tetap memakai Legacy Product Migration.",
              "Master default active bila status dikosongkan.",
              "Item default draft bila availability dikosongkan.",
              "Foto fisik item boleh kosong dan memakai foto master.",
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
        </div>

        <aside className="min-w-0 rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <h2 className="font-semibold text-neutral-950">Batas template v1</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["ZIP upload", formatMegabytes(PRODUCT_BATCH_IMPORT_LIMITS.zipUploadBytes)],
              ["Workbook", formatMegabytes(PRODUCT_BATCH_IMPORT_LIMITS.workbookBytes)],
              ["Product Master", `${PRODUCT_BATCH_IMPORT_LIMITS.masterRows} baris`],
              ["Item fisik", `${PRODUCT_BATCH_IMPORT_LIMITS.itemRows} baris`],
              ["Satu image", formatMegabytes(PRODUCT_BATCH_IMPORT_LIMITS.imageBytes)],
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
            Upload ZIP sudah aktif untuk validation staging. Preview detail,
            commit Product Master/Product Item, dan label belum aktif sampai
            tahap berikutnya.
          </div>
        </aside>
      </section>
    </div>
  );
}
