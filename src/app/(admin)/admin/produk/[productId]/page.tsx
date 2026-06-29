import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  CircleDot,
  Gem,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductImage } from "@/components/media/product-image";
import { ProductMasterForm } from "@/components/products/product-master-form";
import { getRecentProductItems } from "@/features/inventory/product-item-queries";
import { getProductInventoryAccess } from "@/features/products/access";
import { getProductMasterCategoryOptions } from "@/features/products/product-master-queries";
import { getProductDetail } from "@/features/products/queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";

const statusLabels = {
  draft: "Draft",
  active: "Aktif",
  inactive: "Nonaktif",
} as const;

function getStatusClass(status: keyof typeof statusLabels) {
  if (status === "active") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "draft") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-neutral-100 text-neutral-600";
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const auth = await requireAnyPermission(["products.view", "products.manage"]);
  const canManage = hasPermission(auth, "products.manage");
  const access = getProductInventoryAccess(auth);
  const { productId } = await params;
  const query = await searchParams;
  const product = await getProductDetail(auth.organization.id, productId);

  if (!product) {
    notFound();
  }

  const categoryOptions = canManage
    ? await getProductMasterCategoryOptions(
        auth.organization.id,
        product.categoryId,
      )
    : [];

  const recentItems = access.canAccessInventory
    ? await getRecentProductItems(auth.organization.id, product.id)
    : [];
  const productImageUrl = getImageUrl(product.imageKey);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link
          href="/admin/produk"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke katalog produk
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <ProductImage
              src={productImageUrl}
              alt={product.name}
              className="size-20 shrink-0 rounded-2xl border border-[var(--border)]"
            />

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                  {product.name}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(product.status)}`}
                >
                  {statusLabels[product.status]}
                </span>
              </div>

              <p className="mt-2 text-sm text-[var(--muted)]">
                {product.code} · {product.categoryName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]">
              {canManage ? "Dapat dikelola" : "Akses lihat"}
            </span>

            {access.canReceiveInventory && product.status !== "inactive" ? (
              <Link
                href={`/admin/produk/${product.id}/item/tambah`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <Boxes className="size-4" />
                Tambah Item
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {query.created === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Produk berhasil dibuat.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Boxes className="size-5 text-violet-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {product.totalItems}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Total item fisik</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <CircleDot className="size-5 text-emerald-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {product.availableItems}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Item tersedia</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Gem className="size-5 text-amber-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {product.reservedItems}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Item reserved</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Gem className="size-5 text-neutral-500" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {product.soldItems}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Item terjual</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">Item Fisik</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Kelola unit perhiasan individual yang memiliki barcode, berat,
              harga, outlet, dan status inventaris masing-masing.
            </p>
          </div>

          {access.canReceiveInventory && product.status !== "inactive" ? (
            <Link
              href={`/admin/produk/${product.id}/item/tambah`}
              className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Plus className="size-4" />
              Tambah Item
            </Link>
          ) : null}
        </div>

        <div className="border-t border-[var(--border)]">
          {!access.canAccessInventory ? (
            <div className="px-6 py-10 text-center">
              <Boxes className="mx-auto size-6 text-neutral-400" />
              <p className="mt-3 text-sm text-[var(--muted)]">
                Permission inventaris diperlukan untuk melihat identitas dan
                lokasi item fisik.
              </p>
            </div>
          ) : recentItems.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Boxes className="mx-auto size-6 text-neutral-400" />
              <p className="mt-3 text-sm text-[var(--muted)]">
                Belum ada item fisik untuk produk ini.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {recentItems.map((item) => {
                const itemImageUrl = getImageUrl(
                  item.imageKey ?? product.imageKey,
                );

                return (
                  <article
                    key={item.id}
                    className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center"
                  >
                    <ProductImage
                      src={itemImageUrl}
                      alt={`${product.name} ${item.sku}`}
                      className="size-16 shrink-0 rounded-xl border border-[var(--border)]"
                      badge={
                        !item.imageKey && product.imageKey
                          ? "Katalog"
                          : undefined
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold text-neutral-950">
                        {item.sku}
                      </p>
                      <p className="mt-1 text-sm font-medium text-neutral-950">
                        {item.displayName ?? product.name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {item.barcode}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm sm:min-w-[300px]">
                      <div>
                        <p className="text-xs text-[var(--muted)]">Berat</p>
                        <p className="mt-1 font-medium text-neutral-950">
                          {item.weightGram ? `${item.weightGram} g` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--muted)]">Outlet</p>
                        <p className="mt-1 font-medium text-neutral-950">
                          {item.outletName ?? "Belum ditempatkan"}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/admin/inventaris/item/${item.id}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] transition hover:text-neutral-950"
                    >
                      Detail
                      <ArrowRight className="size-4" />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {canManage ? (
        <ProductMasterForm
          key={product.updatedAt.toISOString()}
          mode="edit"
          product={{ ...product, imageUrl: productImageUrl }}
          categories={categoryOptions}
        />
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Gem className="size-5" />
            </div>

            <div>
              <h2 className="font-semibold text-neutral-950">
                Informasi Produk
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Akun ini memiliki akses lihat tanpa permission untuk mengubah
                produk.
              </p>
            </div>
          </div>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Kategori
              </dt>
              <dd className="mt-1 text-sm text-neutral-950">
                {product.categoryName} · {product.categoryCode}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Brand
              </dt>
              <dd className="mt-1 text-sm text-neutral-950">
                {product.brand ?? "—"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Koleksi
              </dt>
              <dd className="mt-1 text-sm text-neutral-950">
                {product.collection ?? "—"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Status
              </dt>
              <dd className="mt-1 text-sm text-neutral-950">
                {statusLabels[product.status]}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Deskripsi
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-950">
                {product.description ?? "Belum ada deskripsi produk."}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">Metadata</h2>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--muted)]">Dibuat</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-950">
              {product.createdAt.toLocaleString("id-ID")}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-[var(--muted)]">Terakhir diperbarui</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-950">
              {product.updatedAt.toLocaleString("id-ID")}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-[var(--muted)]">Item terjual</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-950">
              {product.soldItems}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-[var(--muted)]">Material lama</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-950">
              {product.material ?? "—"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
