import { ArrowLeft, Shapes } from "lucide-react";
import Link from "next/link";

import { CategoryForm } from "@/components/products/category-form";
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
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <Link
          href="/admin/produk/kategori"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar kategori
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Shapes className="size-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              Tambah Kategori
            </h1>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Buat kategori utama atau subkategori baru untuk katalog produk.
            </p>
          </div>
        </div>
      </header>

      <CategoryForm
        mode="create"
        parentOptions={parentOptions}
        defaultParentId={defaultParentId}
      />
    </div>
  );
}
