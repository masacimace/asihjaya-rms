import { ArrowLeft, FolderTree, Gem } from "lucide-react";
import Link from "next/link";

import { ProductMasterForm } from "@/components/products/product-master-form";
import { getProductMasterCategoryOptions } from "@/features/products/product-master-queries";
import { requirePermission } from "@/lib/auth/session";

export default async function CreateProductMasterPage() {
  const auth = await requirePermission("products.manage");
  const categories = await getProductMasterCategoryOptions(
    auth.organization.id,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link
          href="/admin/produk"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke katalog Product
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Gem className="size-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              Tambah Product
            </h1>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Buat identitas desain Product. Spesifikasi dapat ditambahkan saat
              diperlukan, sedangkan item fisik dikelola langsung dari detail
              Product.
            </p>
          </div>
        </div>
      </header>

      {categories.length > 0 ? (
        <ProductMasterForm mode="create" categories={categories} />
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <FolderTree className="mt-0.5 size-5 shrink-0 text-amber-700" />

            <div>
              <h2 className="font-semibold text-amber-950">
                Kategori aktif belum tersedia
              </h2>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Product baru harus menggunakan kategori aktif. Buat atau
                aktifkan kategori terlebih dahulu.
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
