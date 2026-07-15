import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Filter,
  FolderTree,
  Gem,
  Layers3,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
} from "lucide-react";
import Link from "next/link";

import { ProductImage } from "@/components/media/product-image";
import {
  parseProductListFilters,
  type ProductListFilters,
  type ProductStatus,
} from "@/features/products/contracts";
import {
  getProductCategoryOptions,
  getProductList,
  getProductOverview,
} from "@/features/products/queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";

export const metadata = {
  title: "Produk Master",
};

const statusLabels: Record<ProductStatus, string> = {
  draft: "Draft",
  active: "Aktif",
  inactive: "Nonaktif",
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatGram(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function getStatusClass(status: ProductStatus) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-neutral-200 bg-neutral-100 text-neutral-600";
}

function buildProductListUrl(page: number, filters: ProductListFilters) {
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

function SummaryCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--muted)]">{title}</p>
          <p className="mt-3 truncate text-sm font-semibold text-neutral-950 sm:text-2xl">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{helper}</p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] sm:size-11">
          {icon}
        </div>
      </div>
    </article>
  );
}

function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClass(status)}`}
    >
      {statusLabels[status]}
    </span>
  );
}

type ProductRow = Awaited<ReturnType<typeof getProductList>>["rows"][number];

function ProductPriceRange({ product }: { product: ProductRow }) {
  if (product.minSellingAmount <= 0 && product.maxSellingAmount <= 0) {
    return <span className="text-[var(--muted)]">Belum ada harga</span>;
  }

  if (product.minSellingAmount === product.maxSellingAmount) {
    return <span>{formatMoney(product.minSellingAmount)}</span>;
  }

  return (
    <span>
      {formatMoney(product.minSellingAmount)} -{" "}
      {formatMoney(product.maxSellingAmount)}
    </span>
  );
}

function ProductMobileCard({ product }: { product: ProductRow }) {
  return (
    <Link
      href={`/admin/produk/${product.id}`}
      className="group block rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/30"
    >
      <div className="flex gap-3">
        <ProductImage
          src={getImageUrl(product.imageKey)}
          alt={product.name}
          className="size-16 shrink-0 rounded-2xl border border-[var(--border)] bg-neutral-50"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-neutral-950">
                {product.name}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">
                {product.code} · {product.categoryName}
              </p>
            </div>
            <ProductStatusBadge status={product.status} />
          </div>

          <p className="mt-2 line-clamp-1 text-xs text-[var(--muted)]">
            {[product.brand, product.material, product.collection]
              .filter(Boolean)
              .join(" · ") || "Brand, material, dan koleksi belum dilengkapi"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-3">
          <p className="text-xs text-[var(--muted)]">Item fisik</p>
          <p className="mt-1 font-semibold text-neutral-950">
            {formatInteger(product.itemCount)} item
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-neutral-50 p-3">
          <p className="text-xs text-[var(--muted)]">Tersedia</p>
          <p className="mt-1 font-semibold text-neutral-950">
            {formatInteger(product.availableItemCount)} item
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--muted)]">Harga label</span>
          <span className="text-right font-semibold text-neutral-950">
            <ProductPriceRange product={product} />
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[var(--muted)]">Gramasi aktif</span>
          <span className="font-semibold text-neutral-950">
            {formatGram(product.totalWeightGram)} gr
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-[var(--accent)]">
        <span>Lihat detail produk</span>
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
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
  const isFiltered = Boolean(
    filters.search || filters.categoryId || filters.status,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="inline-flex h-10 items-center gap-2 bg-white px-3 text-sm font-semibold text-neutral-700"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>

            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Produk Master
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Kelola katalog model perhiasan, kategori, brand, material, status
              produk, dan relasi item fisik yang tersambung ke inventaris
              serialized.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
                  <Gem className="size-3.5 text-[var(--accent)]" />
                  Product aktif
                </p>
                <p className="mt-2 text-2xl font-semibold text-neutral-950">
                  {formatInteger(overview.activeProducts)} produk
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {formatInteger(overview.totalProducts)} total master ·{" "}
                  {formatInteger(overview.availableItems)} item tersedia.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Link
                href={buildProductListUrl(effectivePage, filters)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
              >
                <RefreshCw className="size-4" />
                Refresh
              </Link>

              {canManage ? (
                <Link
                  href="/admin/produk/tambah"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
                >
                  <Plus className="size-4" />
                  Produk Master
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SummaryCard
          title="Produk Aktif"
          value={formatInteger(overview.activeProducts)}
          helper={`${formatInteger(overview.draftProducts)} draft · ${formatInteger(overview.inactiveProducts)} nonaktif`}
          icon={<PackageCheck className="size-5" />}
        />
        <SummaryCard
          title="Item Fisik"
          value={formatInteger(overview.totalItems)}
          helper={`${formatInteger(overview.availableItems)} tersedia · ${formatInteger(overview.reservedItems)} reserved`}
          icon={<Boxes className="size-5" />}
        />
        <SummaryCard
          title="Nilai Inventory"
          value={formatMoney(overview.availableCostAmount)}
          helper={`${formatGram(overview.availableWeightGram)} gr ready stock`}
          icon={<Tag className="size-5" />}
        />
        <SummaryCard
          title="Tanpa Stok"
          value={formatInteger(overview.activeProductsWithoutAvailableStock)}
          helper={`${formatInteger(overview.activeCategories)} kategori aktif`}
          icon={<Sparkles className="size-5" />}
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Filter Produk</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Cari master produk berdasarkan nama, kode, brand, koleksi,
              kategori, atau status katalog.
            </p>
          </div>

          <Link
            href="/admin/produk/kategori"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 hover:text-[var(--accent)]"
          >
            <FolderTree className="size-4" />
            Kelola Kategori
          </Link>
        </div>

        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 transition focus-within:border-[var(--accent)]">
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
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Filter className="size-4" />
              Terapkan
            </button>

            <Link
              href="/admin/produk"
              className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">
              Daftar Produk Master
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {formatInteger(productList.total)} produk ditemukan
              {isFiltered ? " sesuai filter aktif" : " dalam katalog"}.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-600">
            <Layers3 className="size-3.5" />
            {formatInteger(overview.activeCategories)} kategori aktif
          </div>
        </div>

        {productList.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--surface-muted)] text-neutral-500">
              <Gem className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-neutral-950">
              Tidak ada produk yang cocok
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              Coba ubah kata kunci, kategori, atau status produk. Jika katalog
              masih kosong, tambahkan produk master terlebih dahulu.
            </p>

            {canManage ? (
              <Link
                href="/admin/produk/tambah"
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <Plus className="size-4" />
                Tambah Produk
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="grid min-w-[74rem] grid-cols-[minmax(18rem,1.4fr)_12rem_10rem_10rem_14rem_10rem_3rem] gap-4 border-b border-[var(--border)] bg-neutral-50 px-5 py-3 text-xs font-semibold text-neutral-500">
                <span>Produk</span>
                <span>Kategori</span>
                <span>Status</span>
                <span>Item fisik</span>
                <span>Harga label</span>
                <span>Update</span>
                <span className="sr-only">Detail</span>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[74rem] divide-y divide-[var(--border)]">
                  {productList.rows.map((product) => (
                    <Link
                      key={product.id}
                      href={`/admin/produk/${product.id}`}
                      className="group grid grid-cols-[minmax(18rem,1.4fr)_12rem_10rem_10rem_14rem_10rem_3rem] gap-4 px-5 py-4 transition hover:bg-neutral-50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductImage
                          src={getImageUrl(product.imageKey)}
                          alt={product.name}
                          className="size-14 shrink-0 rounded-2xl border border-[var(--border)] bg-neutral-50"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-neutral-950">
                            {product.name}
                          </p>
                          <p className="mt-1 truncate text-xs text-[var(--muted)]">
                            {product.code}
                            {product.brand ? ` · ${product.brand}` : ""}
                            {product.collection
                              ? ` · ${product.collection}`
                              : ""}
                          </p>
                          <p className="mt-1 truncate text-xs text-[var(--muted)]">
                            {product.material || "Material belum diatur"}
                          </p>
                        </div>
                      </div>

                      <div className="min-w-0 self-center">
                        <p className="truncate text-sm font-semibold text-neutral-950">
                          {product.categoryName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {product.categoryCode}
                        </p>
                      </div>

                      <div className="self-center">
                        <ProductStatusBadge status={product.status} />
                      </div>

                      <div className="self-center text-sm">
                        <p className="font-semibold text-neutral-950">
                          {formatInteger(product.itemCount)} item
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatInteger(product.availableItemCount)} tersedia ·{" "}
                          {formatInteger(product.soldItemCount)} terjual
                        </p>
                      </div>

                      <div className="self-center text-sm">
                        <p className="font-semibold text-neutral-950">
                          <ProductPriceRange product={product} />
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatGram(product.totalWeightGram)} gr aktif
                        </p>
                      </div>

                      <div className="self-center text-sm">
                        <p className="font-semibold text-neutral-950">
                          {formatDate(product.updatedAt)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Terakhir diperbarui
                        </p>
                      </div>

                      <div className="self-center justify-self-end text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]">
                        <ArrowRight className="size-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {productList.rows.map((product) => (
                <ProductMobileCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </section>

      {productList.pageCount > 1 ? (
        <nav className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={buildProductListUrl(Math.max(1, effectivePage - 1), filters)}
            aria-disabled={effectivePage <= 1}
            className={`flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold transition ${
              effectivePage <= 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-neutral-100"
            }`}
          >
            Sebelumnya
          </Link>

          <p className="text-center text-sm text-[var(--muted)]">
            Halaman {effectivePage} dari {productList.pageCount}
          </p>

          <Link
            href={buildProductListUrl(
              Math.min(productList.pageCount, effectivePage + 1),
              filters,
            )}
            aria-disabled={effectivePage >= productList.pageCount}
            className={`flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold transition ${
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
