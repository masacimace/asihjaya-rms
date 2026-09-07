import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleOff,
  Filter,
  PackageSearch,
  Search,
  Shapes,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

import {
  CategoryCreateDrawer,
  CategoryListInteractive,
} from "@/components/products/category-management";
import {
  parseCategoryListFilters,
  type CategoryStatus,
} from "@/features/products/category-contracts";
import {
  getCategoryList,
  getCategoryOverview,
} from "@/features/products/category-queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";

export const metadata = {
  title: "Kategori Produk",
};

function buildCategoryListUrl(
  page: number,
  filters: {
    search: string;
    status: CategoryStatus | null;
  },
) {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/produk/kategori?${query}` : "/admin/produk/kategori";
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
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
  const hasActiveFilters = Boolean(filters.search || filters.status);
  const startItem =
    categoryList.total === 0
      ? 0
      : (effectivePage - 1) * categoryList.pageSize + 1;
  const endItem = Math.min(
    effectivePage * categoryList.pageSize,
    categoryList.total,
  );
  const statusLabel =
    filters.status === "active"
      ? "Aktif"
      : filters.status === "inactive"
        ? "Nonaktif"
        : null;

  const clientRows = categoryList.rows.map((category) => ({
    id: category.id,
    code: category.code,
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    productCount: category.productCount,
    activeProductCount: category.activeProductCount,
    updatedAtLabel: formatDateTime(category.updatedAt),
  }));

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link
              href="/admin/produk"
              className="inline-flex h-10 w-fit items-center gap-2 px-2 text-sm font-medium text-neutral-700"
            >
              <ArrowLeft className="size-4" />
              Kembali ke katalog produk
            </Link>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                <Shapes className="size-3.5" />
                Kategori Produk
              </span>
              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  canManage
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-neutral-200 bg-neutral-50 text-neutral-600"
                }`}
              >
                <CheckCircle2 className="size-3.5" />
                {canManage ? "Mode kelola" : "Mode lihat"}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Kategori Produk
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Kelola kategori yang digunakan pada Product Master. Semua kategori
              sekarang berada dalam satu daftar sederhana tanpa subkategori dan
              tanpa pengaturan urutan manual.
            </p>
          </div>

          {canManage ? <CategoryCreateDrawer /> : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-5 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
            <p className="text-xs text-[var(--muted)]">Total kategori</p>
            <p className="mt-1 text-xl font-semibold text-neutral-950">
              {overview.totalCategories}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
            <p className="text-xs text-emerald-700">Kategori aktif</p>
            <p className="mt-1 text-xl font-semibold text-emerald-950">
              {overview.activeCategories}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5">
            <p className="text-xs text-neutral-600">Kategori nonaktif</p>
            <p className="mt-1 text-xl font-semibold text-neutral-950">
              {overview.inactiveCategories}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5">
            <p className="text-xs text-[var(--muted)]">Product Master aktif</p>
            <p className="mt-1 text-xl font-semibold text-neutral-950">
              {overview.activeProducts}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-700">
            <SlidersHorizontal className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">Filter Kategori</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Cari berdasarkan nama, kode, atau deskripsi lalu saring statusnya.
            </p>
          </div>
        </div>

        <form className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 transition focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]">
            <Search className="size-4 shrink-0 text-neutral-400" />
            <input
              name="q"
              type="search"
              defaultValue={filters.search}
              placeholder="Cari nama, kode, atau deskripsi kategori"
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
            />
          </label>

          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          >
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              <Filter className="size-4" />
              Terapkan
            </button>

            <Link
              href="/admin/produk/kategori"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              Reset
            </Link>
          </div>
        </form>

        {hasActiveFilters ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
            <span className="text-xs font-medium text-[var(--muted)]">
              Filter aktif:
            </span>
            {filters.search ? (
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-neutral-700">
                Pencarian: “{filters.search}”
              </span>
            ) : null}
            {statusLabel ? (
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-neutral-700">
                Status: {statusLabel}
              </span>
            ) : null}
            <Link
              href="/admin/produk/kategori"
              className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
            >
              Hapus semua filter
            </Link>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold text-neutral-950">Daftar Kategori</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {categoryList.total} kategori sesuai pencarian dan filter saat
              ini.
              {canManage ? " Klik kategori untuk mengedit." : ""}
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-neutral-700">
            <PackageSearch className="size-3.5 text-[var(--accent)]" />
            Urutan nama A–Z
          </div>
        </div>

        {categoryList.rows.length === 0 ? (
          <div className="px-5 py-14 text-center sm:px-6 sm:py-16">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-neutral-500">
              {hasActiveFilters ? (
                <Search className="size-6" />
              ) : (
                <Shapes className="size-6" />
              )}
            </div>
            <h3 className="mt-4 font-semibold text-neutral-950">
              {hasActiveFilters
                ? "Kategori tidak ditemukan"
                : "Belum ada kategori produk"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              {hasActiveFilters
                ? "Tidak ada kategori yang sesuai dengan pencarian atau filter saat ini."
                : "Buat kategori pertama untuk mulai mengelompokkan Product Master."}
            </p>
            {hasActiveFilters ? (
              <Link
                href="/admin/produk/kategori"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                Reset Filter
              </Link>
            ) : null}
          </div>
        ) : (
          <CategoryListInteractive
            categories={clientRows}
            canManage={canManage}
          />
        )}

        {categoryList.rows.length > 0 ? (
          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[var(--muted)]">
                Menampilkan {startItem}–{endItem} dari {categoryList.total}{" "}
                kategori
              </p>

              {categoryList.pageCount > 1 ? (
                <nav className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <Link
                    href={buildCategoryListUrl(
                      Math.max(1, effectivePage - 1),
                      filters,
                    )}
                    aria-disabled={effectivePage <= 1}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium transition ${
                      effectivePage <= 1
                        ? "pointer-events-none opacity-40"
                        : "hover:bg-neutral-100"
                    }`}
                  >
                    <ArrowLeft className="size-4" />
                    Sebelumnya
                  </Link>

                  <p className="col-span-2 order-first text-center text-xs text-[var(--muted)] sm:order-none sm:px-2">
                    Halaman {effectivePage} dari {categoryList.pageCount}
                  </p>

                  <Link
                    href={buildCategoryListUrl(
                      Math.min(categoryList.pageCount, effectivePage + 1),
                      filters,
                    )}
                    aria-disabled={effectivePage >= categoryList.pageCount}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium transition ${
                      effectivePage >= categoryList.pageCount
                        ? "pointer-events-none opacity-40"
                        : "hover:bg-neutral-100"
                    }`}
                  >
                    Berikutnya
                    <ArrowRight className="size-4" />
                  </Link>
                </nav>
              ) : (
                <span className="text-xs text-[var(--muted)]">
                  Halaman 1 dari 1
                </span>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {!canManage ? (
        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          <div className="flex items-start gap-3">
            <CircleOff className="mt-0.5 size-4 shrink-0 text-neutral-500" />
            <p>
              Akun ini berada dalam mode lihat. Klik kategori untuk membuka
              halaman detail existing.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
