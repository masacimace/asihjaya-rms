import {
  ArrowLeft,
  CheckCircle2,
  FolderPlus,
  FolderTree,
  Layers3,
  Shapes,
} from "lucide-react";
import Link from "next/link";

import { CreateCategoryForm } from "@/components/products/category-form";
import { isUuid } from "@/features/products/category-contracts";
import { getCategoryParentOptions } from "@/features/products/category-queries";
import { requirePermission } from "@/lib/auth/session";

export default async function CreateProductCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    parentId?: string;
  }>;
}) {
  const auth = await requirePermission("products.manage");
  const query = await searchParams;

  const parentOptions = await getCategoryParentOptions(auth.organization.id);

  const defaultParentId =
    query.parentId &&
    isUuid(query.parentId) &&
    parentOptions.some((option) => option.id === query.parentId)
      ? query.parentId
      : undefined;

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/produk/kategori"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-xl px-3 text-sm font-medium text-neutral-700 transition hover:bg-[var(--surface-muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar kategori
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <FolderPlus className="size-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    <Shapes className="size-3.5" />
                    Kategori baru
                  </span>

                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="size-3.5" />
                    Siap dikonfigurasi
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
                  Tambah Kategori Produk
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Susun struktur katalog melalui kategori utama atau subkategori.
                  Kode kategori menjadi identitas permanen setelah data tersimpan.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <FolderTree className="size-3.5 text-[var(--accent)]" />
                    {parentOptions.length} kategori utama aktif
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Layers3 className="size-3.5 text-[var(--accent)]" />
                    Hierarki maksimal satu tingkat
                  </span>
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Alur konfigurasi
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Tentukan posisi kategori dalam katalog sebelum melengkapi identitas
              dan status operasionalnya.
            </p>

            <div className="mt-4 space-y-3">
              {[
                "Pilih kategori utama atau subkategori.",
                "Lengkapi kode, nama, deskripsi, dan urutan.",
                "Tentukan status lalu simpan kategori.",
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-white text-xs font-semibold text-[var(--accent)]">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-xs leading-5 text-neutral-700">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <CreateCategoryForm
        parentOptions={parentOptions}
        defaultParentId={defaultParentId}
      />
    </div>
  );
}
