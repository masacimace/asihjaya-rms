import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleOff,
  Eye,
  Filter,
  FolderTree,
  Layers3,
  PackageSearch,
  Plus,
  Search,
  Shapes,
  SlidersHorizontal,
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

  return query ? `/admin/produk/kategori?${query}` : "/admin/produk/kategori";
}

function getPercentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
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
  const activeCategories = Math.max(
    0,
    overview.totalCategories - overview.inactiveCategories,
  );
  const activeCategoryCoverage = getPercentage(
    activeCategories,
    overview.totalCategories,
  );
  const hasActiveFilters = Boolean(
    filters.search || filters.status || filters.type,
  );
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
  const typeLabel =
    filters.type === "root"
      ? "Kategori utama"
      : filters.type === "child"
        ? "Subkategori"
        : null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/admin/produk"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-transparent px-3 text-sm font-medium text-neutral-700 transition hover:border-[var(--border)] hover:bg-[var(--surface-muted)] hover:text-neutral-950"
          >
            <ArrowLeft className="size-4" />
            Kembali ke katalog produk
          </Link>

          {canManage ? (
            <Link
              href="/admin/produk/kategori/tambah"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold !text-white transition hover:brightness-95"
            >
              <Plus className="size-4" />
              Tambah Kategori
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                <FolderTree className="size-3.5" />
                Manajemen Kategori
              </span>

              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  canManage
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-neutral-200 bg-neutral-50 text-neutral-600"
                }`}
              >
                {canManage ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
                {canManage ? "Mode kelola" : "Mode lihat"}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Kategori Produk
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Susun kategori utama dan subkategori sebagai fondasi katalog
              produk. Struktur yang rapi membantu pencarian, pelaporan, dan
              pengelolaan produk master tetap konsisten.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                <Shapes className="size-3.5 text-[var(--accent)]" />
                {overview.totalCategories} kategori terdaftar
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                <PackageSearch className="size-3.5 text-[var(--accent)]" />
                {overview.activeProducts} produk aktif
              </span>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Struktur katalog
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Gunakan kategori utama sebagai kelompok tingkat pertama, lalu
              subkategori untuk segmentasi produk yang lebih spesifik.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                  <FolderTree className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">
                    Kategori utama
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">
                    Kelompok katalog tingkat pertama tanpa induk.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
                  <Layers3 className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">
                    Subkategori
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">
                    Struktur turunan yang berada di bawah kategori utama.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Shapes className="size-5" />
            </div>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
              Seluruh struktur
            </span>
          </div>
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.totalCategories}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-800">
            Total kategori
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Kategori utama dan subkategori dalam organisasi.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="grid size-10 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <FolderTree className="size-5" />
          </div>
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.activeRootCategories}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-800">
            Kategori utama aktif
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Siap digunakan sebagai kelompok katalog utama.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="grid size-10 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
            <Layers3 className="size-5" />
          </div>
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.activeChildCategories}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-800">
            Subkategori aktif
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Struktur turunan yang tersedia untuk produk baru.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="grid size-10 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-600">
            <CircleOff className="size-5" />
          </div>
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.inactiveCategories}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-800">
            Kategori nonaktif
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Tidak tersedia untuk penempatan produk baru.
          </p>
        </article>
      </section>

      <section className="grid gap-4 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-700">
              <PackageSearch className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-950">
                Cakupan katalog
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Ringkasan kesiapan struktur kategori untuk produk aktif.
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${activeCategoryCoverage}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
            <span>{activeCategoryCoverage}% kategori masih aktif</span>
            <span>
              {activeCategories} dari {overview.totalCategories}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <p className="text-xs text-[var(--muted)]">Produk aktif</p>
            <p className="mt-1 text-lg font-semibold text-neutral-950">
              {overview.activeProducts}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <p className="text-xs text-[var(--muted)]">Hasil saat ini</p>
            <p className="mt-1 text-lg font-semibold text-neutral-950">
              {categoryList.total}
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
            <h2 className="font-semibold text-neutral-950">
              Cari dan saring kategori
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Temukan kategori berdasarkan identitas, status, atau posisi dalam
              struktur katalog.
            </p>
          </div>
        </div>

        <form className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_190px_auto]">
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

          <select
            name="type"
            defaultValue={filters.type ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          >
            <option value="">Semua struktur</option>
            <option value="root">Kategori utama</option>
            <option value="child">Subkategori</option>
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
            {typeLabel ? (
              <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-neutral-700">
                Struktur: {typeLabel}
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
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-neutral-700">
            <PackageSearch className="size-3.5 text-[var(--accent)]" />
            {overview.activeProducts} produk aktif
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
                : "Struktur kategori belum dibuat"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              {hasActiveFilters
                ? "Tidak ada kategori yang sesuai dengan pencarian atau kombinasi filter saat ini."
                : "Buat kategori utama pertama untuk mulai menyusun struktur katalog produk."}
            </p>

            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              {hasActiveFilters ? (
                <Link
                  href="/admin/produk/kategori"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
                >
                  Reset Filter
                </Link>
              ) : null}

              {canManage ? (
                <Link
                  href="/admin/produk/kategori/tambah"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95"
                >
                  <Plus className="size-4" />
                  {hasActiveFilters
                    ? "Tambah Kategori"
                    : "Tambah Kategori Pertama"}
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1080px] border-collapse text-left">
                <thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Kategori</th>
                    <th className="px-4 py-3 font-medium">Struktur</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Produk</th>
                    <th className="px-4 py-3 font-medium">Subkategori</th>
                    <th className="px-4 py-3 text-center font-medium">
                      Urutan
                    </th>
                    <th className="px-5 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {categoryList.rows.map((category) => (
                    <tr
                      key={category.id}
                      className="align-middle transition hover:bg-neutral-50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`grid size-11 shrink-0 place-items-center rounded-xl border ${
                              category.parent
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {category.parent ? (
                              <Layers3 className="size-5" />
                            ) : (
                              <FolderTree className="size-5" />
                            )}
                          </div>

                          <div className="min-w-0 max-w-md">
                            <p className="font-semibold text-neutral-950">
                              {category.name}
                            </p>
                            <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                              {category.code}
                            </p>
                            <p className="mt-1 max-w-md text-xs leading-5 text-[var(--muted)]">
                              {category.description?.trim() ||
                                "Belum ada deskripsi kategori."}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                            category.parent
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {category.parent ? "Subkategori" : "Kategori utama"}
                        </span>
                        {category.parent ? (
                          <div className="mt-2 text-xs leading-5 text-[var(--muted)]">
                            <p>Induk: {category.parent.name}</p>
                            <p className="font-mono">{category.parent.code}</p>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-[var(--muted)]">
                            Tanpa kategori induk
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                            category.isActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-neutral-200 bg-neutral-50 text-neutral-600"
                          }`}
                        >
                          {category.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-neutral-950">
                          {category.productCount} produk
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {category.activeProductCount} aktif
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        {category.parent ? (
                          <p className="text-xs leading-5 text-[var(--muted)]">
                            Tidak memiliki turunan
                          </p>
                        ) : (
                          <>
                            <p className="font-semibold text-neutral-950">
                              {category.childCount} subkategori
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {category.activeChildCount} aktif
                            </p>
                          </>
                        )}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex min-w-10 justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1.5 font-mono text-xs font-semibold text-neutral-700">
                          {category.displayOrder}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/produk/kategori/${category.id}`}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                        >
                          Lihat Detail
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[var(--border)] lg:hidden">
              {categoryList.rows.map((category) => (
                <article key={category.id} className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid size-11 shrink-0 place-items-center rounded-xl border ${
                        category.parent
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {category.parent ? (
                        <Layers3 className="size-5" />
                      ) : (
                        <FolderTree className="size-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-neutral-950">
                          {category.name}
                        </h3>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                            category.isActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-neutral-200 bg-neutral-50 text-neutral-600"
                          }`}
                        >
                          {category.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                        {category.code}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          category.parent
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {category.parent ? "Subkategori" : "Kategori utama"}
                      </span>
                    </div>
                  </div>

                  {category.parent ? (
                    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-xs text-neutral-700">
                      <span className="text-[var(--muted)]">Induk:</span>{" "}
                      <span className="font-medium">
                        {category.parent.name}
                      </span>{" "}
                      <span className="font-mono text-[var(--muted)]">
                        · {category.parent.code}
                      </span>
                    </div>
                  ) : null}

                  <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                    {category.description?.trim() ||
                      "Belum ada deskripsi kategori."}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                      <p className="text-xs text-[var(--muted)]">Produk</p>
                      <p className="mt-1 text-sm font-semibold text-neutral-950">
                        {category.productCount}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {category.activeProductCount} aktif
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                      <p className="text-xs text-[var(--muted)]">Turunan</p>
                      <p className="mt-1 text-sm font-semibold text-neutral-950">
                        {category.parent ? "—" : category.childCount}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {category.parent
                          ? "Tidak tersedia"
                          : `${category.activeChildCount} aktif`}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                      <p className="text-xs text-[var(--muted)]">Urutan</p>
                      <p className="mt-1 font-mono text-sm font-semibold text-neutral-950">
                        {category.displayOrder}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/admin/produk/kategori/${category.id}`}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                  >
                    Buka Detail Kategori
                    <ArrowRight className="size-4" />
                  </Link>
                </article>
              ))}
            </div>
          </>
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
    </div>
  );
}
