import {
  ArrowRight,
  Boxes,
  CircleDot,
  Filter,
  FolderTree,
  Gem,
  Plus,
  Search,
  Shapes,
  Scale,
} from "lucide-react";
import Link from "next/link";

import { ProductImage } from "@/components/media/product-image";
import {
  parseProductListFilters,
  type ProductStatus,
} from "@/features/products/contracts";
import {
  getProductCategoryOptions,
  getProductList,
  getProductOverview,
} from "@/features/products/queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";

const statusLabels: Record<ProductStatus, string> = {
  draft: "Draft",
  active: "Aktif",
  inactive: "Nonaktif",
};

function getStatusClass(status: ProductStatus) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "draft") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-neutral-100 text-neutral-600";
}

function buildProductListUrl(
  page: number,
  filters: {
    search: string;
    categoryId: string | null;
    status: ProductStatus | null;
  },
) {
  const params = new URLSearchParams();

  if (filters.search) {
    params.set("q", filters.search);
  }

  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query ? `/admin/produk?${query}` : "/admin/produk";
}

export default async function ProductCatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireAnyPermission(["products.view", "products.manage"]);
  const canManage = hasPermission(auth, "products.manage");
  const filters = parseProductListFilters(await searchParams);

  const [overview, categoryOptions, productList] = await Promise.all([
    getProductOverview(auth.organization.id),
    getProductCategoryOptions(auth.organization.id),
    getProductList(auth.organization.id, filters),
  ]);

  const effectivePage = productList.page;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--accent)]">Product</p>

        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Katalog Master Product
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Kelola produk, struktur kategori, spesifikasi, dan jumlah item
              fisik pada setiap desain produk.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/produk/kategori"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            >
              <FolderTree className="size-4" />
              Kelola Kategori
            </Link>

            {canManage ? (
              <Link
                href="/admin/produk/tambah"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <Plus className="size-4" />
                Master Product
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Gem className="size-5 text-[var(--accent)]" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.totalProducts}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Total Master Product
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <CircleDot className="size-5 text-emerald-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.activeProducts}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Master Product aktif
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Boxes className="size-5 text-violet-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.availableItems}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Item Fisik tersedia
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Scale className="size-5 text-amber-600" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {new Intl.NumberFormat("id-ID", {
              maximumFractionDigits: 3,
            }).format(overview.totalWeightGram)}{" "}
            <span className="text-sm font-medium text-[var(--muted)]">Gr</span>
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Total item (dalam hitungan gram)
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3">
            <Search className="size-4 shrink-0 text-neutral-400" />
            <input
              name="q"
              type="search"
              defaultValue={filters.search}
              placeholder="Cari kode, nama, brand, atau koleksi..."
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
            />
          </label>

          <select
            name="categoryId"
            defaultValue={filters.categoryId ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua kategori</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.isActive ? "" : " (Nonaktif)"}
              </option>
            ))}
          </select>

          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Filter className="size-4" />
              Terapkan
            </button>

            <Link
              href="/admin/produk"
              className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="font-semibold text-neutral-950">Daftar Product</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {productList.total} produk ditemukan
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <Shapes className="size-4" />
            {overview.activeCategories} kategori aktif
          </div>
        </div>

        {productList.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--surface-muted)] text-neutral-500">
              <Gem className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-neutral-950">
              Belum ada produk yang cocok
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              Katalog masih kosong atau filter yang digunakan tidak menemukan
              data.
            </p>

            {canManage ? (
              <Link
                href="/admin/produk/tambah"
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <Plus className="size-4" />
                Master Product
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {productList.rows.map((product) => (
              <Link
                key={product.id}
                href={`/admin/produk/${product.id}`}
                className="group flex flex-col gap-4 px-5 py-4 transition hover:bg-neutral-50 sm:flex-row sm:items-center"
              >
                <ProductImage
                  src={getImageUrl(product.imageKey)}
                  alt={product.name}
                  className="size-14 shrink-0 rounded-2xl border border-[var(--border)]"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-neutral-950">
                      {product.name}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(product.status)}`}
                    >
                      {statusLabels[product.status]}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {product.code} · {product.categoryName}
                    {product.brand ? ` · ${product.brand}` : ""}
                    {product.collection ? ` · ${product.collection}` : ""}
                  </p>
                </div>

                <div className="hidden items-center gap-6 sm:flex">
                  <div className="text-sm">
                    <p className="text-xs text-[var(--muted)] mb-0.5">Berat</p>
                    <p className="font-semibold text-neutral-950">
                      {product.totalWeightGram.toLocaleString("id-ID")} gram
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-[var(--muted)] mb-0.5">
                      Item aktif
                    </p>
                    <p className="font-semibold text-neutral-950">
                      {product.activeItemCount}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-[var(--muted)] mb-0.5">
                      Item arsip
                    </p>
                    <p className="font-semibold text-neutral-950">
                      {product.archivedItemCount}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs text-[var(--muted)] mb-0.5">Total</p>
                    <p className="font-semibold text-neutral-950">
                      {product.itemCount}
                    </p>
                  </div>
                </div>

                <div className="text-sm sm:hidden">
                  <p className="text-xs text-[var(--muted)] mb-0.5">
                    Total barang
                  </p>
                  <p className="font-semibold text-neutral-950">
                    {product.itemCount}
                  </p>
                </div>

                <ArrowRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {productList.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3">
          <Link
            href={buildProductListUrl(Math.max(1, effectivePage - 1), filters)}
            aria-disabled={effectivePage <= 1}
            className={`flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition ${
              effectivePage <= 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-neutral-100"
            }`}
          >
            Sebelumnya
          </Link>

          <p className="text-sm text-[var(--muted)]">
            Halaman {effectivePage} dari {productList.pageCount}
          </p>

          <Link
            href={buildProductListUrl(
              Math.min(productList.pageCount, effectivePage + 1),
              filters,
            )}
            aria-disabled={effectivePage >= productList.pageCount}
            className={`flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition ${
              effectivePage >= productList.pageCount
                ? "pointer-events-none opacity-40"
                : "hover:bg-neutral-100"
            }`}
          >
            Berikutnya
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
