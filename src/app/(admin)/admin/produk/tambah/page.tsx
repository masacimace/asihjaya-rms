import {
  ArrowLeft,
  CheckCircle2,
  FolderTree,
  PackageCheck,
  Plus,
} from "lucide-react";
import Link from "next/link";

import { ProductMasterForm } from "@/components/products/product-master-form";
import { getProductMasterCategoryOptions } from "@/features/products/product-master-queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Tambah Produk",
};

export default async function CreateProductMasterPage() {
  const auth = await requirePermission("products.manage");
  const categories = await getProductMasterCategoryOptions(
    auth.organization.id,
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/produk"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke katalog produk
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    <Plus className="size-3.5" />
                    Produk master baru
                  </span>

                  <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Siap dibuat
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
                  Tambah Produk Master
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Buat identitas katalog model perhiasan terlebih dahulu.
                  Setelah produk master tersimpan, item fisik serialized,
                  barcode, berat aktual, harga, dan lokasi outlet dikelola dari
                  detail produk atau halaman inventaris.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <FolderTree className="size-3.5 text-[var(--accent)]" />
                    {categories.length} kategori tersedia
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <PackageCheck className="size-3.5 text-[var(--accent)]" />
                    Item fisik dibuat setelah produk tersimpan
                  </span>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Alur pembuatan
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Produk master adalah katalog/model. Stok fisik outlet dibuat
              sebagai item terpisah setelah produk ini tersimpan.
            </p>

            <div className="mt-4 space-y-2 text-xs text-neutral-700">
              {[
                "Isi kode, nama, kategori, brand, dan koleksi.",
                "Unggah foto katalog utama sebelum produk diaktifkan.",
                "Tambahkan item fisik setelah produk berhasil dibuat.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span className="leading-5">{item}</span>
                </div>
              ))}
            </div>

            <Link
              href="/admin/produk/kategori"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            >
              <FolderTree className="size-4" />
              Kelola Kategori
            </Link>
          </aside>
        </div>
      </section>

      {categories.length > 0 ? (
        <ProductMasterForm mode="create" categories={categories} />
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <FolderTree className="mt-0.5 size-5 shrink-0 text-amber-700" />

            <div className="min-w-0">
              <h2 className="font-semibold text-amber-950">
                Kategori aktif belum tersedia
              </h2>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Produk baru harus menggunakan kategori aktif. Buat atau aktifkan
                kategori terlebih dahulu sebelum menambahkan produk master baru.
              </p>

              <Link
                href="/admin/produk/kategori"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-amber-950 px-4 text-sm font-medium text-white transition hover:bg-amber-900"
              >
                Kelola Kategori
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
