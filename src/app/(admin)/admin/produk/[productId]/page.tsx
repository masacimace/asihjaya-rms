import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Boxes,
  CircleDot,
  Gem,
  PackageCheck,
  Plus,
  Tag,
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
import { cn } from "@/lib/utils";

const statusLabels = {
  draft: "Draft",
  active: "Aktif",
  inactive: "Nonaktif",
} as const;

const availabilityLabels = {
  draft: "Draft",
  available: "Tersedia",
  reserved: "Reserved",
  sold: "Terjual",
} as const;

function getStatusClass(status: keyof typeof statusLabels) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-neutral-200 bg-neutral-100 text-neutral-600";
}

function getAvailabilityClass(status: keyof typeof availabilityLabels) {
  if (status === "available") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "reserved") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "sold") {
    return "border-neutral-200 bg-neutral-100 text-neutral-600";
  }

  return "border-violet-200 bg-violet-50 text-violet-700";
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: string | number | null) {
  if (value === null) return "—";

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "—";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function formatWeight(value: string | number | null) {
  if (value === null) return "—";

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return "—";

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(numericValue)} gr`;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
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
  const shouldScrollRecentItems = recentItems.length > 6;

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-5 overflow-x-hidden pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/produk"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke katalog produk
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <ProductImage
                src={productImageUrl}
                alt={product.name}
                className="size-64 shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] sm:size-64"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    <Gem className="size-3.5" />
                    Detail produk master
                  </span>

                  <span
                    className={cn(
                      "inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold",
                      getStatusClass(product.status),
                    )}
                  >
                    {statusLabels[product.status]}
                  </span>
                </div>

                <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
                  {product.name}
                </h1>

                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {product.code} · {product.categoryName}
                  {product.material ? ` · ${product.material}` : ""}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Tag className="size-3.5 text-[var(--accent)]" />
                    {product.brand ?? "Brand belum diatur"}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <PackageCheck className="size-3.5 text-[var(--accent)]" />
                    {product.collection ?? "Koleksi belum diatur"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-semibold text-neutral-950">
              Status pengelolaan
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Kelola model produk, lalu tambahkan item fisik serialized untuk
              stok outlet dan barcode.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                {canManage ? "Dapat dikelola" : "Akses lihat"}
              </span>

              {access.canReceiveInventory && product.status !== "inactive" ? (
                <Link
                  href={`/admin/produk/${product.id}/item/tambah`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
                >
                  <Plus className="size-4" />
                  Tambah Item
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {query.created === "1" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Produk berhasil dibuat.
        </div>
      ) : null}

      <section className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Total item fisik",
            value: formatInteger(product.totalItems),
            icon: Boxes,
            iconClassName: "bg-violet-50 text-violet-700",
          },
          {
            label: "Item tersedia",
            value: formatInteger(product.availableItems),
            icon: CircleDot,
            iconClassName: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "Item reserved",
            value: formatInteger(product.reservedItems),
            icon: Gem,
            iconClassName: "bg-amber-50 text-amber-700",
          },
          {
            label: "Item terjual",
            value: formatInteger(product.soldItems),
            icon: Gem,
            iconClassName: "bg-neutral-100 text-neutral-600",
          },
        ].map(({ label, value, icon: Icon, iconClassName }) => (
          <article
            key={label}
            className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5"
          >
            <div
              className={cn(
                "grid size-10 place-items-center rounded-xl",
                iconClassName,
              )}
            >
              <Icon className="size-5" />
            </div>
            <p className="mt-4 text-2xl font-semibold text-neutral-950">
              {value}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
          </article>
        ))}
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <article className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
            <div className="min-w-0">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                <Boxes className="size-3.5" />
                Item fisik
              </span>
              <h2 className="mt-3 font-semibold text-neutral-950">
                Riwayat item produk
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Unit perhiasan individual yang memiliki barcode, berat, harga,
                outlet, dan status inventaris masing-masing.
              </p>
            </div>
          </div>

          {!access.canAccessInventory ? (
            <div className="px-6 py-12 text-center">
              <Boxes className="mx-auto size-7 text-neutral-400" />
              <p className="mt-3 text-sm text-[var(--muted)]">
                Permission inventaris diperlukan untuk melihat identitas dan
                lokasi item fisik.
              </p>
            </div>
          ) : recentItems.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Boxes className="mx-auto size-7 text-neutral-400" />
              <p className="mt-3 text-sm font-medium text-neutral-900">
                Belum ada item fisik.
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Tambahkan item pertama untuk mulai mencatat stok serialized.
              </p>
            </div>
          ) : (
            <div
              className={cn(
                shouldScrollRecentItems &&
                  "scrollbar-clean max-h-[620px] overflow-y-auto overscroll-contain",
              )}
            >
              <div className="hidden min-w-[760px] divide-y divide-[var(--border)] lg:block">
                {recentItems.map((item) => {
                  const itemImageUrl = getImageUrl(
                    item.imageKey ?? product.imageKey,
                  );

                  return (
                    <article
                      key={item.id}
                      className="grid grid-cols-[minmax(0,1.8fr)_120px_160px_130px_92px] items-center gap-4 px-5 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductImage
                          src={itemImageUrl}
                          alt={`${product.name} ${item.sku}`}
                          className="size-14 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]"
                          badge={
                            !item.imageKey && product.imageKey
                              ? "Katalog"
                              : undefined
                          }
                        />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-950">
                            {item.displayName ?? product.name}
                          </p>
                          <p className="mt-1 truncate font-mono text-xs text-neutral-700">
                            {item.sku}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                            {item.barcode}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-[var(--muted)]">Berat</p>
                        <p className="mt-1 font-semibold text-neutral-950">
                          {formatWeight(item.weightGram)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-[var(--muted)]">Outlet</p>
                        <p className="mt-1 truncate font-semibold text-neutral-950">
                          {item.outletName ?? "Belum ditempatkan"}
                        </p>
                      </div>

                      <div>
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                            getAvailabilityClass(item.availability),
                          )}
                        >
                          {availabilityLabels[item.availability]}
                        </span>
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {formatMoney(item.sellingAmount)}
                        </p>
                      </div>

                      <Link
                        href={`/admin/inventaris/item/${item.id}`}
                        className="inline-flex items-center justify-end gap-2 text-sm font-semibold text-[var(--accent)] transition hover:text-neutral-950"
                      >
                        Detail
                        <ArrowRight className="size-4" />
                      </Link>
                    </article>
                  );
                })}
              </div>

              <div className="divide-y divide-[var(--border)] lg:hidden">
                {recentItems.map((item) => {
                  const itemImageUrl = getImageUrl(
                    item.imageKey ?? product.imageKey,
                  );

                  return (
                    <Link
                      key={item.id}
                      href={`/admin/inventaris/item/${item.id}`}
                      className="block px-4 py-4 transition hover:bg-[var(--surface-muted)]"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <ProductImage
                          src={itemImageUrl}
                          alt={`${product.name} ${item.sku}`}
                          className="size-14 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]"
                          badge={
                            !item.imageKey && product.imageKey
                              ? "Katalog"
                              : undefined
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-neutral-950">
                                {item.displayName ?? product.name}
                              </p>
                              <p className="mt-1 truncate font-mono text-xs text-neutral-700">
                                {item.sku}
                              </p>
                            </div>

                            <span
                              className={cn(
                                "shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold",
                                getAvailabilityClass(item.availability),
                              )}
                            >
                              {availabilityLabels[item.availability]}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs">
                            <div>
                              <p className="text-[var(--muted)]">Berat</p>
                              <p className="mt-1 font-semibold text-neutral-950">
                                {formatWeight(item.weightGram)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[var(--muted)]">Outlet</p>
                              <p className="mt-1 truncate font-semibold text-neutral-950">
                                {item.outletName ?? "Belum ditempatkan"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </article>

        <aside className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Gem className="size-5" />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-neutral-950">
                  Informasi Produk
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Ringkasan master produk dan metadata katalog.
                </p>
              </div>
            </div>

            <dl className="mt-5 space-y-4">
              {[
                [
                  "Kategori",
                  `${product.categoryName} · ${product.categoryCode}`,
                ],
                ["Brand", product.brand ?? "—"],
                ["Koleksi", product.collection ?? "—"],
                ["Material", product.material ?? "—"],
                ["Dibuat", formatDateTime(product.createdAt)],
                ["Diperbarui", formatDateTime(product.updatedAt)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
                >
                  <dt className="text-xs text-[var(--muted)]">{label}</dt>
                  <dd className="text-right text-sm font-semibold text-neutral-950">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="font-semibold text-neutral-950">Deskripsi</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
              {product.description ?? "Belum ada deskripsi produk."}
            </p>
          </section>
        </aside>
      </section>

      {canManage ? (
        <details className="group rounded-2xl border border-[var(--border)] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:content-none sm:px-5 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                <Tag className="size-3.5" />
                Pengaturan produk
              </span>
              <h2 className="mt-3 font-semibold text-neutral-950">
                Edit data produk
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Buka panel ini hanya saat perlu mengubah nama, kategori, brand,
                koleksi, atau deskripsi produk master.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-neutral-400 transition-transform group-open:rotate-90" />
          </summary>

          <div className="border-t border-[var(--border)] px-4 py-5 sm:px-5">
            <ProductMasterForm
              key={product.updatedAt.toISOString()}
              mode="edit"
              product={{ ...product, imageUrl: productImageUrl }}
              categories={categoryOptions}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
