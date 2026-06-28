import {
  ArrowLeft,
  ArrowRight,
  CircleOff,
  Filter,
  FolderTree,
  Layers3,
  PackageSearch,
  Plus,
  Search,
  Shapes,
} from "lucide-react";
import Link from "next/link";

import {
  parseCategoryListFilters,
  type CategoryStatus,
  type CategoryType,
} from "@/features/products/category-contracts";
import {
  getCategoryList,
  getCategoryOverview,
} from "@/features/products/category-queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";

function buildCategoryListUrl(
  page: number,
  filters: {
    search: string;
    status: CategoryStatus | null;
    type: CategoryType | null;
  },
) {
  const params = new URLSearchParams();

  if (filters.search) {
    params.set("q", filters.search);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.type) {
    params.set("type", filters.type);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query
    ? `/admin/produk/kategori?${query}`
    : "/admin/produk/kategori";
}

export default async function ProductCategoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireAnyPermission(["products.view", "products.manage"]);
  const canManage = hasPermission(auth, "products.manage");
  const filters = parseCategoryListFilters(await searchParams);

  const [overview, categoryList] = await Promise.all([
    getCategoryOverview(auth.organization.id),
    getCategoryList(auth.organization.id, filters),
  ]);

  const effectivePage = categoryList.page;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/admin/produk"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
          >
            <ArrowLeft className="size-4" />
            Kembali ke katalog produk
          </Link>

          <p className="mt-5 text-sm font-medium text-[var(--accent)]">
            Produk
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Kategori Produk
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Kelola kategori utama dan subkategori yang digunakan untuk
            mengelompokkan produk.
          </p>
        </div>

        {canManage ? (
          <Link
            href="/admin/produk/kategori/tambah"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95"
          >
            <Plus className="size-4" />
            Tambah Kategori
          </Link>
        ) : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Shapes className="size-5 text-[var(--accent)]" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.totalCategories}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Total kategori</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <FolderTree className="size-5 text-emerald-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.activeRootCategories}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Kategori utama aktif
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Layers3 className="size-5 text-blue-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.activeChildCategories}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Subkategori aktif
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <CircleOff className="size-5 text-neutral-500" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.inactiveCategories}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Kategori nonaktif
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_190px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3">
            <Search className="size-4 shrink-0 text-neutral-400" />
            <input
              name="q"
              type="search"
              defaultValue={filters.search}
              placeholder="Cari kode, nama, atau deskripsi..."
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
            />
          </label>

          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <select
            name="type"
            defaultValue={filters.type ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua tipe</option>
            <option value="root">Kategori utama</option>
            <option value="child">Subkategori</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              <Filter className="size-4" />
              Terapkan
            </button>

            <Link
              href="/admin/produk/kategori"
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
            <h2 className="font-semibold text-neutral-950">Daftar Kategori</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {categoryList.total} kategori ditemukan
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <PackageSearch className="size-4" />
            {overview.activeProducts} produk aktif
          </div>
        </div>

        {categoryList.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--surface-muted)] text-neutral-500">
              <Shapes className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-neutral-950">
              Belum ada kategori yang cocok
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              Ubah filter pencarian atau tambahkan kategori baru untuk mulai
              menyusun katalog produk.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {categoryList.rows.map((category) => (
              <Link
                key={category.id}
                href={`/admin/produk/kategori/${category.id}`}
                className="group flex flex-col gap-4 px-5 py-4 transition hover:bg-neutral-50 lg:flex-row lg:items-center"
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  {category.parent ? (
                    <Layers3 className="size-5" />
                  ) : (
                    <FolderTree className="size-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-neutral-950">
                      {category.name}
                    </p>

                    <span
                      className={
                        category.isActive
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600"
                      }
                    >
                      {category.isActive ? "Aktif" : "Nonaktif"}
                    </span>

                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {category.parent ? "Subkategori" : "Kategori utama"}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {category.code}
                    {category.parent
                      ? ` · Induk: ${category.parent.name}`
                      : " · Tanpa induk"}
                    {` · Urutan ${category.displayOrder}`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm sm:min-w-56">
                  <div>
                    <p className="font-semibold text-neutral-950">
                      {category.productCount}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Produk ({category.activeProductCount} aktif)
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-neutral-950">
                      {category.childCount}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Subkategori ({category.activeChildCount} aktif)
                    </p>
                  </div>
                </div>

                <ArrowRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {categoryList.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3">
          <Link
            href={buildCategoryListUrl(
              Math.max(1, effectivePage - 1),
              filters,
            )}
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
            Halaman {effectivePage} dari {categoryList.pageCount}
          </p>

          <Link
            href={buildCategoryListUrl(
              Math.min(categoryList.pageCount, effectivePage + 1),
              filters,
            )}
            aria-disabled={effectivePage >= categoryList.pageCount}
            className={`flex h-10 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium transition ${
              effectivePage >= categoryList.pageCount
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
