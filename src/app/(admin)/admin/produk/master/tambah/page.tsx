import { ArrowLeft, Gem } from "lucide-react";
import Link from "next/link";

import { ProductMasterForm } from "@/components/products/product-master-form";
import { getProductMasterCategoryOptions } from "@/features/products/product-master-queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Tambah Product Master",
};

export default async function CreateProductMasterPage() {
  const auth = await requirePermission("products.manage");
  const categories = await getProductMasterCategoryOptions(
    auth.organization.id,
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-5 pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/produk"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Product Master
        </Link>

        <div className="mt-5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            <Gem className="size-3.5" />
            Administrasi Product Master
          </span>
          <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
            Tambah Product Master
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Halaman ini hanya untuk administrasi/reference. Pada pekerjaan harian, Product Master baru bisa dibuat langsung dari form Tambah Produk.
          </p>
        </div>
      </section>

      {categories.length > 0 ? (
        <ProductMasterForm mode="create" categories={categories} />
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Belum ada kategori aktif. Buat kategori terlebih dahulu sebelum membuat Product Master.
        </section>
      )}
    </div>
  );
}
