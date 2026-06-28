import {
  ArrowLeft,
  ArrowRight,
  CircleDot,
  FolderTree,
  Layers3,
  PackageSearch,
  Plus,
  Shapes,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryForm } from "@/components/products/category-form";
import {
  getCategoryDetail,
  getCategoryParentOptions,
} from "@/features/products/category-queries";
import {
  hasPermission,
  requireAnyPermission,
} from "@/lib/auth/session";

export default async function ProductCategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{
    categoryId: string;
  }>;
  searchParams: Promise<{
    created?: string;
  }>;
}) {
  const auth = await requireAnyPermission(["products.view", "products.manage"]);
  const canManage = hasPermission(auth, "products.manage");
  const { categoryId } = await params;
  const query = await searchParams;

  const category = await getCategoryDetail(
    auth.organization.id,
    categoryId,
  );

  if (!category) {
    notFound();
  }

  const parentOptions = canManage
    ? await getCategoryParentOptions(
        auth.organization.id,
        categoryId,
        category.parentCategoryId,
      )
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link
          href="/admin/produk/kategori"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar kategori
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
                {category.name}
              </h1>

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

            <p className="mt-1 text-sm text-[var(--muted)]">
              Kode kategori: {category.code}
              {category.parent ? ` · Induk: ${category.parent.name}` : ""}
            </p>
          </div>

          {canManage && !category.parent && category.isActive ? (
            <Link
              href={`/admin/produk/kategori/tambah?parentId=${category.id}`}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            >
              <Plus className="size-4" />
              Tambah Subkategori
            </Link>
          ) : null}
        </div>
      </header>

      {query.created === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Kategori berhasil dibuat.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <PackageSearch className="size-5 text-[var(--accent)]" />
          <p className="mt-4 text-xl font-semibold text-neutral-950">
            {category.productCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Total produk</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <CircleDot className="size-5 text-emerald-700" />
          <p className="mt-4 text-xl font-semibold text-neutral-950">
            {category.activeProductCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Produk aktif</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <Layers3 className="size-5 text-blue-700" />
          <p className="mt-4 text-xl font-semibold text-neutral-950">
            {category.childCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Subkategori</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <Shapes className="size-5 text-violet-700" />
          <p className="mt-4 text-xl font-semibold text-neutral-950">
            {category.displayOrder}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Urutan tampilan</p>
        </article>
      </section>

      {canManage ? (
        <CategoryForm
          mode="edit"
          category={category}
          parentOptions={parentOptions}
        />
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <FolderTree className="size-5" />
            </div>

            <div>
              <h2 className="font-semibold text-neutral-950">
                Informasi Kategori
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Akun ini memiliki akses lihat tanpa permission untuk mengubah
                kategori.
              </p>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--muted)]">Kategori induk</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {category.parent
                  ? `${category.parent.name} · ${category.parent.code}`
                  : "Tidak ada"}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-[var(--muted)]">Urutan tampilan</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {category.displayOrder}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="text-xs text-[var(--muted)]">Deskripsi</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-950">
                {category.description ?? "Belum ada deskripsi."}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {!category.parent ? (
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="font-semibold text-neutral-950">Subkategori</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {category.childCount} subkategori terdaftar, {category.activeChildCount} aktif
              </p>
            </div>
          </div>

          {category.children.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Layers3 className="mx-auto size-6 text-neutral-400" />
              <p className="mt-3 text-sm text-[var(--muted)]">
                Kategori ini belum memiliki subkategori.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/admin/produk/kategori/${child.id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition hover:bg-neutral-50"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Layers3 className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-neutral-950">
                        {child.name}
                      </p>
                      <span
                        className={
                          child.isActive
                            ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600"
                        }
                      >
                        {child.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {child.code} · Urutan {child.displayOrder}
                    </p>
                  </div>

                  <div className="text-right text-sm">
                    <p className="font-semibold text-neutral-950">
                      {child.productCount}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {child.activeProductCount} produk aktif
                    </p>
                  </div>

                  <ArrowRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">Metadata</h2>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--muted)]">Dibuat</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-950">
              {category.createdAt.toLocaleString("id-ID")}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-[var(--muted)]">
              Terakhir diperbarui
            </dt>
            <dd className="mt-1 text-sm font-medium text-neutral-950">
              {category.updatedAt.toLocaleString("id-ID")}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
