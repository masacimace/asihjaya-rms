import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  FileSpreadsheet,
  Filter,
  FolderTree,
  Gem,
  Layers3,
  PackageCheck,
  Plus,
  Search,
  Scale,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

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
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">
            {title}
          </p>
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

function ProductMasterListItem({ product }: { product: ProductRow }) {
  const hasAvailableStock = product.availableItemCount > 0;

  return (
    <Link
      href={`/admin/produk/${product.id}`}
      className="group block px-5 py-5 text-inherit no-underline transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-base font-semibold text-neutral-950 transition group-hover:text-[var(--accent)]">
              {product.name}
            </h3>
            <ProductStatusBadge status={product.status} />
          </div>

          <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
            <span className="font-mono text-neutral-600">{product.code}</span>
            <span className="mx-1.5 text-neutral-300">•</span>
            <span>{product.categoryName}</span>
            <span className="mx-1.5 text-neutral-300">/</span>
            <span>{product.categoryCode}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 text-xs text-[var(--muted)] lg:justify-end">
          <span>Update {formatDate(product.updatedAt)}</span>
          <ArrowRight className="size-4 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-3 sm:px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Total Item
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950">
            {formatInteger(product.itemCount)}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-3 sm:px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Tersedia
          </p>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${
              hasAvailableStock ? "text-emerald-700" : "text-neutral-950"
            }`}
          >
            {formatInteger(product.availableItemCount)}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-3 sm:px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Terjual
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950">
            {formatInteger(product.soldItemCount)}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-3 sm:px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Berat Tersedia
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950">
            {formatGram(product.availableWeightGram)} gr
          </p>
        </div>
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
  const canCreatePhysicalProduct =
    hasPermission(auth, "inventory.receive") || hasPermission(auth, "inventory.manage");
  const canBatchImport = hasPermission(auth, "products.batch_import");
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
              Product Master sekarang berfungsi sebagai administrasi/reference untuk mengelompokkan produk fisik. Staff dapat membuat master langsung saat menambahkan produk baru tanpa harus masuk ke halaman ini terlebih dahulu.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
                  <Gem className="size-3.5 text-[var(--accent)]" />
                  Master aktif
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
              {canBatchImport ? (
                <Link
                  href="/admin/produk/import"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
                >
                  <FileSpreadsheet className="size-4" />
                  Import Batch
                </Link>
              ) : null}

              {canCreatePhysicalProduct ? (
                <Link
                  href="/admin/produk/tambah"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
                >
                  <Plus className="size-4" />
                  Tambah Produk
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
          title="Berat Tersedia"
          value={`${formatGram(overview.availableWeightGram)} gr`}
          helper={`${formatInteger(overview.availableItems)} item ready stock`}
          icon={<Scale className="size-5" />}
        />
        <SummaryCard
          title="Tanpa Stok"
          value={formatInteger(overview.activeProductsWithoutAvailableStock)}
          helper="Product Master aktif tanpa item tersedia"
          icon={<Sparkles className="size-5" />}
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Filter Produk</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Cari Product Master berdasarkan kode, nama, kategori, atau status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Link
                href="/admin/produk/master/tambah"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 hover:text-[var(--accent)]"
              >
                <Plus className="size-4" />
                Tambah Product Master
              </Link>
            ) : null}

          <Link
            href="/admin/produk/kategori"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 hover:text-[var(--accent)]"
          >
            <FolderTree className="size-4" />
            Kelola Kategori
          </Link>
          </div>
        </div>

        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 transition focus-within:border-[var(--accent)]">
            <Search className="size-4 shrink-0 text-neutral-400" />
            <input
              name="q"
              type="search"
              defaultValue={filters.search}
              placeholder="Cari kode atau nama Product Master..."
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
              Coba ubah kata kunci, kategori, atau status. Jika masih kosong, kamu bisa langsung membuat produk fisik dan quick-create Product Master dari form.
            </p>

            {canCreatePhysicalProduct ? (
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
          <div className="divide-y divide-[var(--border)]">
            {productList.rows.map((product) => (
              <ProductMasterListItem key={product.id} product={product} />
            ))}
          </div>
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
