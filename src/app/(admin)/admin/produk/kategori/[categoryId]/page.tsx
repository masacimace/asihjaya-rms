import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  CircleOff,
  Eye,
  Folder,
  FolderTree,
  Layers3,
  ListOrdered,
  PackageCheck,
  PackageSearch,
  Plus,
  Shapes,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EditCategoryForm } from "@/components/products/category-form";
import {
  getCategoryDetail,
  getCategoryParentOptions,
} from "@/features/products/category-queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getPercentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

export default async function ProductCategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const auth = await requireAnyPermission(["products.view", "products.manage"]);
  const canManage = hasPermission(auth, "products.manage");
  const { categoryId } = await params;
  const query = await searchParams;

  const category = await getCategoryDetail(auth.organization.id, categoryId);

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

  const isRootCategory = category.parent === null;
  const canReceiveNewProducts =
    category.isActive && (!category.parent || category.parent.isActive);
  const activeProductPercentage = getPercentage(
    category.activeProductCount,
    category.productCount,
  );
  const activeChildPercentage = getPercentage(
    category.activeChildCount,
    category.childCount,
  );
  const statusClassName = category.isActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-neutral-200 bg-neutral-50 text-neutral-600";

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/produk/kategori"
          className="inline-flex h-10 w-fit items-center gap-2 px-3 text-sm font-medium text-neutral-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke daftar kategori
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div
                className={`grid size-16 shrink-0 place-items-center rounded-2xl border ${
                  isRootCategory
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                {isRootCategory ? (
                  <Folder className="size-7" />
                ) : (
                  <Layers3 className="size-7" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    <FolderTree className="size-3.5" />
                    Detail kategori
                  </span>
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName}`}
                  >
                    {category.isActive ? (
                      <CircleDot className="size-3.5" />
                    ) : (
                      <CircleOff className="size-3.5" />
                    )}
                    {category.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {isRootCategory ? (
                      <Folder className="size-3.5" />
                    ) : (
                      <Layers3 className="size-3.5" />
                    )}
                    {isRootCategory ? "Kategori utama" : "Subkategori"}
                  </span>
                </div>

                <h1 className="mt-3 break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
                  {category.name}
                </h1>

                <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
                  {category.description ??
                    "Belum ada deskripsi. Tambahkan penjelasan singkat agar cakupan kategori lebih mudah dipahami oleh tim katalog."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 font-mono">
                    <Shapes className="size-3.5 text-[var(--accent)]" />
                    {category.code}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <PackageSearch className="size-3.5 text-[var(--accent)]" />
                    {category.productCount} produk terhubung
                  </span>
                  {category.parent ? (
                    <Link
                      href={`/admin/produk/kategori/${category.parent.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <FolderTree className="size-3.5 text-[var(--accent)]" />
                      Induk: {category.parent.name} · {category.parent.code}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                      <Layers3 className="size-3.5 text-[var(--accent)]" />
                      {category.childCount} subkategori
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950">
                  Status struktur
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Ringkasan penggunaan kategori dalam katalog produk.
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  canManage
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-neutral-200 bg-white text-neutral-600"
                }`}
              >
                {canManage ? "Mode kelola" : "Mode lihat"}
              </span>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
                <dt className="text-[var(--muted)]">Status katalog</dt>
                <dd className="font-semibold text-neutral-950">
                  {category.isActive ? "Aktif" : "Nonaktif"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
                <dt className="text-[var(--muted)]">Struktur</dt>
                <dd className="text-right font-semibold text-neutral-950">
                  {isRootCategory ? "Kategori utama" : "Subkategori"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
                <dt className="text-[var(--muted)]">Produk aktif</dt>
                <dd className="font-semibold text-neutral-950">
                  {category.activeProductCount}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
                <dt className="text-[var(--muted)]">
                  {isRootCategory ? "Subkategori aktif" : "Kategori induk"}
                </dt>
                <dd className="max-w-[58%] text-right font-semibold text-neutral-950">
                  {isRootCategory
                    ? `${category.activeChildCount} dari ${category.childCount}`
                    : (category.parent?.name ?? "Tidak tersedia")}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[var(--muted)]">Urutan</dt>
                <dd className="font-semibold text-neutral-950">
                  {category.displayOrder}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-col gap-2">
              {canManage && isRootCategory && category.isActive ? (
                <Link
                  href={`/admin/produk/kategori/tambah?parentId=${category.id}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold !text-white transition hover:brightness-95"
                >
                  <Plus className="size-4" />
                  Tambah Subkategori
                </Link>
              ) : null}
              <Link
                href="/admin/produk"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                <PackageSearch className="size-4" />
                Buka Katalog Produk
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {query.created === "1" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-emerald-950">
                Kategori berhasil dibuat
              </h2>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                {category.name} ({category.code}) sudah tersimpan. Kategori
                aktif kini dapat digunakan untuk produk master baru.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canManage && isRootCategory && category.isActive ? (
                  <Link
                    href={`/admin/produk/kategori/tambah?parentId=${category.id}`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-950 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
                  >
                    <Plus className="size-4" />
                    Tambah Subkategori
                  </Link>
                ) : null}
                <Link
                  href="/admin/produk/kategori"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                >
                  Kembali ke Daftar
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--accent)]">
            <PackageSearch className="size-5" />
          </div>
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {category.productCount}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-800">
            Total produk
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Produk master yang terhubung langsung ke kategori ini.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="grid size-10 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <PackageCheck className="size-5" />
          </div>
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {category.activeProductCount}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-800">
            Produk aktif
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {category.productCount > 0
              ? `${activeProductPercentage}% dari produk terhubung sedang aktif.`
              : "Belum ada produk yang ditempatkan pada kategori ini."}
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="grid size-10 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
            <Layers3 className="size-5" />
          </div>
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {isRootCategory ? category.childCount : "—"}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-800">
            Subkategori
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {isRootCategory
              ? `${category.activeChildCount} subkategori sedang aktif.`
              : "Subkategori tidak dapat memiliki turunan lagi."}
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="grid size-10 place-items-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700">
            <ListOrdered className="size-5" />
          </div>
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {category.displayOrder}
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-800">
            Urutan tampilan
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Angka lebih kecil ditampilkan lebih dahulu pada tingkat yang sama.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Shapes className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Kesehatan Katalog
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Pantau status kategori dan dependensi aktif sebelum mengubah
                  struktur atau menonaktifkannya.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[var(--muted)]">Produk aktif</span>
                  <span className="font-semibold text-neutral-950">
                    {category.activeProductCount} / {category.productCount}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${activeProductPercentage}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[var(--muted)]">
                    {isRootCategory ? "Subkategori aktif" : "Status induk"}
                  </span>
                  <span className="font-semibold text-neutral-950">
                    {isRootCategory
                      ? `${category.activeChildCount} / ${category.childCount}`
                      : category.parent?.isActive
                        ? "Aktif"
                        : "Nonaktif"}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className={`h-full rounded-full ${
                      isRootCategory || category.parent?.isActive
                        ? "bg-emerald-600"
                        : "bg-neutral-400"
                    }`}
                    style={{
                      width: `${
                        isRootCategory
                          ? activeChildPercentage
                          : category.parent?.isActive
                            ? 100
                            : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              canReceiveNewProducts
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex items-start gap-3">
              {canReceiveNewProducts ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
              ) : (
                <CircleOff className="mt-0.5 size-5 shrink-0 text-amber-700" />
              )}
              <div>
                <p
                  className={`text-sm font-semibold ${
                    canReceiveNewProducts
                      ? "text-emerald-950"
                      : "text-amber-950"
                  }`}
                >
                  {canReceiveNewProducts
                    ? "Siap untuk produk baru"
                    : "Belum tersedia untuk produk baru"}
                </p>
                <p
                  className={`mt-1 text-xs leading-5 ${
                    canReceiveNewProducts
                      ? "text-emerald-800"
                      : "text-amber-800"
                  }`}
                >
                  {canReceiveNewProducts
                    ? "Kategori dan induknya aktif sehingga dapat dipilih pada produk master baru."
                    : "Aktifkan kategori dan pastikan kategori induk juga aktif sebelum digunakan kembali."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {canManage ? (
        <EditCategoryForm
          key={category.updatedAt.toISOString()}
          category={{
            id: category.id,
            code: category.code,
            name: category.name,
            parentCategoryId: category.parentCategoryId,
            description: category.description,
            displayOrder: category.displayOrder,
            isActive: category.isActive,
            parent: category.parent,
            productCount: category.productCount,
            activeProductCount: category.activeProductCount,
            childCount: category.childCount,
            activeChildCount: category.activeChildCount,
          }}
          parentOptions={parentOptions}
        />
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
              <Eye className="size-5" />
            </div>
            <div>
              <span className="inline-flex w-fit rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600">
                Mode lihat
              </span>
              <h2 className="mt-3 font-semibold text-neutral-950">
                Informasi Kategori
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Akun ini dapat melihat struktur kategori tetapi tidak memiliki
                permission untuk memperbaruinya.
              </p>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <dt className="text-xs text-[var(--muted)]">Kode permanen</dt>
              <dd className="mt-2 break-all font-mono text-sm font-semibold text-neutral-950">
                {category.code}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <dt className="text-xs text-[var(--muted)]">Kategori induk</dt>
              <dd className="mt-2 text-sm font-semibold text-neutral-950">
                {category.parent
                  ? `${category.parent.name} · ${category.parent.code}`
                  : "Tidak ada · kategori utama"}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <dt className="text-xs text-[var(--muted)]">Urutan tampilan</dt>
              <dd className="mt-2 text-sm font-semibold text-neutral-950">
                {category.displayOrder}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <dt className="text-xs text-[var(--muted)]">Status</dt>
              <dd className="mt-2 text-sm font-semibold text-neutral-950">
                {category.isActive ? "Aktif" : "Nonaktif"}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:col-span-2 xl:col-span-4">
              <dt className="text-xs text-[var(--muted)]">Deskripsi</dt>
              <dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-950">
                {category.description ?? "Belum ada deskripsi kategori."}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {isRootCategory ? (
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          <div className="flex flex-col gap-4 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-neutral-950">Subkategori</h2>
                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {category.childCount} terdaftar
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                {category.activeChildCount} aktif. Gunakan subkategori untuk
                membagi katalog menjadi kelompok yang lebih spesifik.
              </p>
            </div>

            {canManage && category.isActive ? (
              <Link
                href={`/admin/produk/kategori/tambah?parentId=${category.id}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold !text-white transition hover:brightness-95"
              >
                <Plus className="size-4" />
                Tambah Subkategori
              </Link>
            ) : null}
          </div>

          {category.children.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] text-neutral-500">
                <Layers3 className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold text-neutral-950">
                Subkategori belum tersedia
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">
                {category.isActive
                  ? "Tambahkan subkategori untuk menyusun segmentasi produk yang lebih spesifik di bawah kategori utama ini."
                  : "Aktifkan kategori utama terlebih dahulu sebelum menambahkan subkategori baru."}
              </p>
              {canManage && category.isActive ? (
                <Link
                  href={`/admin/produk/kategori/tambah?parentId=${category.id}`}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold !text-white transition hover:brightness-95"
                >
                  <Plus className="size-4" />
                  Tambah Subkategori Pertama
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[880px] border-collapse text-left">
                  <thead className="bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Subkategori</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Produk</th>
                      <th className="px-4 py-3 text-center font-medium">
                        Urutan
                      </th>
                      <th className="px-5 py-3 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {category.children.map((child) => (
                      <tr
                        key={child.id}
                        className="align-top hover:bg-neutral-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
                              <Layers3 className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-950">
                                {child.name}
                              </p>
                              <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                                {child.code}
                              </p>
                              <p className="mt-2 line-clamp-2 max-w-xl text-xs leading-5 text-[var(--muted)]">
                                {child.description ??
                                  "Belum ada deskripsi subkategori."}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              child.isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-neutral-200 bg-neutral-50 text-neutral-600"
                            }`}
                          >
                            {child.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-neutral-950">
                            {child.productCount} produk
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {child.activeProductCount} aktif
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-grid min-w-10 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs font-semibold text-neutral-800">
                            {child.displayOrder}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/admin/produk/kategori/${child.id}`}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                          >
                            Buka Detail
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-[var(--border)] lg:hidden">
                {category.children.map((child) => (
                  <article key={child.id} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
                        <Layers3 className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-neutral-950">
                            {child.name}
                          </h3>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              child.isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-neutral-200 bg-neutral-50 text-neutral-600"
                            }`}
                          >
                            {child.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                          {child.code}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                      {child.description ?? "Belum ada deskripsi subkategori."}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                        <p className="font-semibold text-neutral-950">
                          {child.productCount}
                        </p>
                        <p className="mt-1 text-[var(--muted)]">Produk</p>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                        <p className="font-semibold text-neutral-950">
                          {child.activeProductCount}
                        </p>
                        <p className="mt-1 text-[var(--muted)]">Aktif</p>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                        <p className="font-semibold text-neutral-950">
                          {child.displayOrder}
                        </p>
                        <p className="mt-1 text-[var(--muted)]">Urutan</p>
                      </div>
                    </div>

                    <Link
                      href={`/admin/produk/kategori/${child.id}`}
                      className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                    >
                      Buka Detail Kategori
                      <ArrowRight className="size-4" />
                    </Link>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-neutral-600">
            <Shapes className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">Metadata & Audit</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Informasi identitas permanen dan waktu perubahan kategori.
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <dt className="text-xs text-[var(--muted)]">ID kategori</dt>
            <dd className="mt-2 break-all font-mono text-xs font-semibold text-neutral-950">
              {category.id}
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <dt className="text-xs text-[var(--muted)]">Kode permanen</dt>
            <dd className="mt-2 font-mono text-sm font-semibold text-neutral-950">
              {category.code}
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <dt className="text-xs text-[var(--muted)]">Dibuat</dt>
            <dd className="mt-2 text-sm font-semibold text-neutral-950">
              {formatDateTime(category.createdAt)}
            </dd>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <dt className="text-xs text-[var(--muted)]">Diperbarui</dt>
            <dd className="mt-2 text-sm font-semibold text-neutral-950">
              {formatDateTime(category.updatedAt)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
