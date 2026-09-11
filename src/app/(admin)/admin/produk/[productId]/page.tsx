import {
  ArrowLeft,
  ChevronRight,
  Boxes,
  CircleDot,
  Gem,
  PackageCheck,
  Plus,
  Tag,
} from "lucide-react";
import Link from "next/link";

import { ProductImage } from "@/components/media/product-image";
import { notFound } from "next/navigation";

import { ProductMasterForm } from "@/components/products/product-master-form";
import { getRecentProductItems } from "@/features/inventory/product-item-queries";
import { getProductInventoryAccess } from "@/features/products/access";
import { getProductMasterCategoryOptions } from "@/features/products/product-master-queries";
import { getProductDetail } from "@/features/products/queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Detail Produk",
};

const ITEM_HISTORY_PAGE_SIZE = 8;

const statusLabels = {
  draft: "Draft",
  active: "Aktif",
  inactive: "Nonaktif",
} as const;

const availabilityLabels = {
  draft: "Draft",
  migration_hold: "Hold Migrasi",
  processing: "Pemrosesan Buyback",
  available: "Tersedia",
  reserved: "Reserved",
  inspection: "Pemeriksaan Retur",
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
  searchParams: Promise<{ created?: string; itemPage?: string }>;
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

  const parsedItemPage = Number.parseInt(query.itemPage ?? "1", 10);
  const requestedItemPage = Number.isFinite(parsedItemPage)
    ? Math.max(1, parsedItemPage)
    : 1;
  const itemPageCount = Math.max(
    1,
    Math.ceil(product.totalItems / ITEM_HISTORY_PAGE_SIZE),
  );
  const itemPage = Math.min(requestedItemPage, itemPageCount);
  const itemOffset = (itemPage - 1) * ITEM_HISTORY_PAGE_SIZE;
  const recentItems = access.canAccessInventory
    ? await getRecentProductItems(
        auth.organization.id,
        product.id,
        ITEM_HISTORY_PAGE_SIZE,
        itemOffset,
      )
    : [];
  const itemRangeStart = product.totalItems === 0 ? 0 : itemOffset + 1;
  const itemRangeEnd = Math.min(
    itemOffset + recentItems.length,
    product.totalItems,
  );

  const buildItemHistoryUrl = (page: number) => {
    const search = new URLSearchParams();
    if (page > 1) search.set("itemPage", String(page));
    const queryString = search.toString();
    return `/admin/produk/${product.id}${queryString ? `?${queryString}` : ""}#item-history`;
  };

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 overflow-x-hidden pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/produk"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Product Master
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    <Gem className="size-3.5" />
                    Reference Product Master
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
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <Tag className="size-3.5 text-[var(--accent)]" />
                    {product.categoryName}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                    <PackageCheck className="size-3.5 text-[var(--accent)]" />
                    {formatInteger(product.totalItems)} item fisik
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
              Halaman ini hanya untuk reference dan pengelompokan. Produk fisik baru bisa ditambahkan langsung dari sini atau dari menu Tambah Produk.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                {canManage ? "Dapat dikelola" : "Akses lihat"}
              </span>

              {access.canReceiveInventory && product.status === "active" ? (
                <Link
                  href={`/admin/produk/${product.id}/item/tambah`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
                >
                  <Plus className="size-4" />
                  Tambah Produk
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

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <article
          id="item-history"
          className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-white scroll-mt-5"
        >
          <div className="flex flex-col gap-4 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                <Boxes className="size-3.5" />
                Item fisik
              </span>
              <h2 className="mt-3 font-semibold text-neutral-950">
                Riwayat item produk
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">
                Unit perhiasan individual dengan barcode, berat, outlet, kondisi,
                dan status inventaris masing-masing. Klik item untuk membuka detail.
              </p>
            </div>

            {access.canAccessInventory && product.totalItems > 0 ? (
              <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-right">
                <p className="text-xs text-[var(--muted)]">Total item</p>
                <p className="mt-0.5 text-sm font-semibold text-neutral-950">
                  {formatInteger(product.totalItems)} unit
                </p>
              </div>
            ) : null}
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
            <>
              <div className="hidden divide-y divide-[var(--border)] lg:block">
                {recentItems.map((item) => {
                  const itemImageUrl = getImageUrl(item.imageKey);

                  return (
                    <div
                      key={item.id}
                      className="group pointer-events-none relative grid grid-cols-[minmax(0,2.1fr)_0.75fr_1fr_0.4fr_10px] items-center gap-5 px-5 py-4 transition hover:bg-[var(--surface-muted)]/70"
                    >
                      <Link
                        href={`/admin/inventaris/item/${item.id}`}
                        aria-label={`Buka detail item ${item.displayName ?? product.name} ${item.sku}`}
                        className="pointer-events-auto absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
                      >
                        <span className="sr-only">
                          Buka detail item {item.displayName ?? product.name} {item.sku}
                        </span>
                      </Link>
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductImage
                          src={itemImageUrl}
                          alt={`${product.name} ${item.sku}`}
                          className={cn(
                            "relative z-10 size-14 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]",
                            itemImageUrl ? "pointer-events-auto" : "pointer-events-none",
                          )}
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

                      <div className="min-w-0">
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
                          {item.condition === "used"
                            ? "Bekas"
                            : item.condition === "good"
                              ? "Baru"
                              : "Perlu perhatian"}
                        </p>
                      </div>

                      <ChevronRight className="size-4 justify-self-end text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-700" />
                    </div>
                  );
                })}
              </div>

              <div className="divide-y divide-[var(--border)] lg:hidden">
                {recentItems.map((item) => {
                  const itemImageUrl = getImageUrl(item.imageKey);

                  return (
                    <div
                      key={item.id}
                      className="group pointer-events-none relative block px-4 py-4 transition hover:bg-[var(--surface-muted)]"
                    >
                      <Link
                        href={`/admin/inventaris/item/${item.id}`}
                        aria-label={`Buka detail item ${item.displayName ?? product.name} ${item.sku}`}
                        className="pointer-events-auto absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
                      >
                        <span className="sr-only">
                          Buka detail item {item.displayName ?? product.name} {item.sku}
                        </span>
                      </Link>
                      <div className="flex min-w-0 items-start gap-3">
                        <ProductImage
                          src={itemImageUrl}
                          alt={`${product.name} ${item.sku}`}
                          className={cn(
                            "relative z-10 size-14 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]",
                            itemImageUrl ? "pointer-events-auto" : "pointer-events-none",
                          )}
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
                              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                                {item.barcode}
                              </p>
                            </div>

                            <ChevronRight className="mt-1 size-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5" />
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs">
                            <div>
                              <p className="text-[var(--muted)]">Berat</p>
                              <p className="mt-1 font-semibold text-neutral-950">
                                {formatWeight(item.weightGram)}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[var(--muted)]">Outlet</p>
                              <p className="mt-1 truncate font-semibold text-neutral-950">
                                {item.outletName ?? "Belum ditempatkan"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-1 text-[11px] font-semibold",
                                getAvailabilityClass(item.availability),
                              )}
                            >
                              {availabilityLabels[item.availability]}
                            </span>
                            <span className="text-xs text-[var(--muted)]">
                              {item.condition === "used"
                                ? "Bekas"
                                : item.condition === "good"
                                  ? "Baru"
                                  : "Perlu perhatian"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-muted)]/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs text-[var(--muted)]">
                  Menampilkan {formatInteger(itemRangeStart)}–{formatInteger(itemRangeEnd)} dari {formatInteger(product.totalItems)} item · Halaman {formatInteger(itemPage)} dari {formatInteger(itemPageCount)}
                </p>

                {itemPageCount > 1 ? (
                  <nav
                    aria-label="Pagination riwayat item produk"
                    className="grid grid-cols-2 gap-2 sm:flex"
                  >
                    <Link
                      href={buildItemHistoryUrl(Math.max(1, itemPage - 1))}
                      aria-disabled={itemPage <= 1}
                      className={cn(
                        "inline-flex h-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-900 transition",
                        itemPage <= 1
                          ? "pointer-events-none opacity-40"
                          : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40",
                      )}
                    >
                      Sebelumnya
                    </Link>
                    <Link
                      href={buildItemHistoryUrl(
                        Math.min(itemPageCount, itemPage + 1),
                      )}
                      aria-disabled={itemPage >= itemPageCount}
                      className={cn(
                        "inline-flex h-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-900 transition",
                        itemPage >= itemPageCount
                          ? "pointer-events-none opacity-40"
                          : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40",
                      )}
                    >
                      Berikutnya
                    </Link>
                  </nav>
                ) : null}
              </div>
            </>
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

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Ringkasan inventaris
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
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
                    icon: PackageCheck,
                    iconClassName: "bg-neutral-100 text-neutral-600",
                  },
                ].map(({ label, value, icon: Icon, iconClassName }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg",
                          iconClassName,
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <p className="text-lg font-semibold text-neutral-950">
                        {value}
                      </p>
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <dl className="mt-5 space-y-4 border-t border-[var(--border)] pt-5">
              {[
                ["Kode Master", product.code],
                ["Kategori", `${product.categoryName} · ${product.categoryCode}`],
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
                Ubah kategori, nama, atau status Product Master. Data fisik dan pricing tetap dikelola pada item produk.
              </p>
            </div>

            <ChevronRight className="size-5 shrink-0 text-neutral-400 transition-transform group-open:rotate-90" />
          </summary>

          <div className="border-t border-[var(--border)] px-4 py-5 sm:px-5">
            <ProductMasterForm
              key={product.updatedAt.toISOString()}
              mode="edit"
              product={product}
              categories={categoryOptions}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
