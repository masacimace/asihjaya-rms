import {
  ArrowRight,
  Boxes,
  CircleDot,
  Filter,
  PackageCheck,
  Search,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";

import { ProductImage } from "@/components/media/product-image";
import {
  parseProductItemListFilters,
  type ItemAvailability,
  type ItemCondition,
} from "@/features/inventory/product-item-contracts";
import {
  getInventoryOutletOptions,
  getProductItemList,
  getProductItemOverview,
} from "@/features/inventory/product-item-queries";
import { requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";

const availabilityLabels: Record<ItemAvailability, string> = {
  draft: "Draft",
  available: "Tersedia",
  reserved: "Reserved",
  sold: "Terjual",
};

const conditionLabels: Record<ItemCondition, string> = {
  good: "Baru",
  damaged: "Bekas",
  lost: "Hilang",
  returned: "Retur",
};

function getAvailabilityClass(availability: ItemAvailability) {
  if (availability === "available") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (availability === "reserved") {
    return "bg-amber-50 text-amber-700";
  }

  if (availability === "sold") {
    return "bg-neutral-950 text-white";
  }

  return "bg-blue-50 text-blue-700";
}

function formatMoney(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function buildInventoryUrl(
  page: number,
  filters: {
    search: string;
    outletId: string | null;
    availability: ItemAvailability | null;
    condition: ItemCondition | null;
    status: "active" | "archived";
  },
) {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.outletId) params.set("outletId", filters.outletId);
  if (filters.availability) params.set("availability", filters.availability);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.status !== "active") params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();

  return query ? `/admin/inventaris?${query}` : "/admin/inventaris";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireAnyPermission([
    "inventory.view",
    "inventory.receive",
    "inventory.adjust",
    "inventory.transfer",
    "inventory.manage",
  ]);
  const filters = parseProductItemListFilters(await searchParams);
  const [overview, outletOptions, itemList] = await Promise.all([
    getProductItemOverview(auth.organization.id),
    getInventoryOutletOptions(auth.organization.id),
    getProductItemList(auth.organization.id, filters),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--accent)]">Inventaris</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
          Item Fisik
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Cari dan tinjau setiap barang fisik berdasarkan SKU, barcode, produk,
          outlet, serta status inventaris.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <Boxes className="size-5 text-violet-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.total}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Total item fisik</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <PackageCheck className="size-5 text-emerald-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.available}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Tersedia</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <CircleDot className="size-5 text-blue-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.draft}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Draft</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <ShoppingBag className="size-5 text-neutral-700" />
          <p className="mt-4 text-2xl font-semibold text-neutral-950">
            {overview.sold}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Terjual</p>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <form className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_140px_200px_150px_150px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3">
            <Search className="size-4 shrink-0 text-neutral-400" />
            <input
              name="q"
              type="search"
              defaultValue={filters.search}
              placeholder="Cari SKU, barcode, serial, atau produk..."
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
            />
          </label>

          <select
            name="status"
            defaultValue={filters.status}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="active">Item Aktif</option>
            <option value="archived">Item Diarsipkan</option>
          </select>

          <select
            name="outletId"
            defaultValue={filters.outletId ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua outlet</option>
            {outletOptions.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
                {outlet.isActive ? "" : " (Nonaktif)"}
              </option>
            ))}
          </select>

          <select
            name="availability"
            defaultValue={filters.availability ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="available">Tersedia</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Terjual</option>
          </select>

          <select
            name="condition"
            defaultValue={filters.condition ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
          >
            <option value="">Semua kondisi</option>
            <option value="good">Baru</option>
            <option value="damaged">Bekas</option>
            <option value="lost">Hilang</option>
            <option value="returned">Retur</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Filter className="size-4" />
              Terapkan
            </button>
            <Link
              href="/admin/inventaris"
              className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-semibold text-neutral-950">
            Daftar Item · {itemList.total}
          </h2>
        </div>

        {itemList.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Boxes className="mx-auto size-7 text-neutral-400" />
            <p className="mt-3 text-sm text-[var(--muted)]">
              Belum ada item fisik yang sesuai dengan filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {itemList.rows.map((item) => {
              const imageUrl = getImageUrl(
                item.imageKey ?? item.productImageKey,
              );
              const usesCatalogPhoto =
                !item.imageKey && Boolean(item.productImageKey);

              return (
                <Link
                  key={item.id}
                  href={`/admin/inventaris/item/${item.id}`}
                  aria-label={`Buka detail item ${item.productName} ${item.sku}`}
                  className="group block px-5 py-4 text-inherit no-underline transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <ProductImage
                      src={imageUrl}
                      alt={`${item.productName} ${item.sku}`}
                      className="size-20 shrink-0 rounded-xl border border-[var(--border)]"
                      badge={usesCatalogPhoto ? "Foto katalog" : undefined}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-neutral-950 transition group-hover:text-[var(--accent)]">
                          {item.productName}
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getAvailabilityClass(
                            item.availability,
                          )}`}
                        >
                          {availabilityLabels[item.availability]}
                        </span>
                      </div>

                      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                        {item.sku} · {item.barcode}
                      </p>

                    </div>

                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4 lg:min-w-[520px]">
                      <div>
                        <dt className="text-xs text-[var(--muted)]">Berat</dt>
                        <dd className="mt-1 font-medium text-neutral-950">
                          {item.weightGram ? `${item.weightGram} g` : "—"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-[var(--muted)]">Harga</dt>
                        <dd className="mt-1 font-medium text-neutral-950">
                          {formatMoney(item.sellingAmount)}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-[var(--muted)]">Outlet</dt>
                        <dd className="mt-1 font-medium text-neutral-950">
                          {item.outletName ?? "Belum ditempatkan"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-[var(--muted)]">Kondisi</dt>
                        <dd className="mt-1 font-medium text-neutral-950">
                          {conditionLabels[item.condition]}
                        </dd>
                      </div>
                    </dl>

                    <span className="inline-flex items-center gap-2 self-end text-sm font-medium text-[var(--accent)] transition group-hover:text-neutral-950 lg:self-auto">
                      Detail
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {itemList.pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-4">
            <p className="text-xs text-[var(--muted)]">
              Halaman {itemList.page} dari {itemList.pageCount}
            </p>
            <div className="flex gap-2">
              <Link
                href={buildInventoryUrl(
                  Math.max(1, itemList.page - 1),
                  filters,
                )}
                aria-disabled={itemList.page <= 1}
                className={`inline-flex h-9 items-center justify-center rounded-xl border border-[var(--border)] px-3 text-sm font-medium ${
                  itemList.page <= 1
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-neutral-50"
                }`}
              >
                Sebelumnya
              </Link>
              <Link
                href={buildInventoryUrl(
                  Math.min(itemList.pageCount, itemList.page + 1),
                  filters,
                )}
                aria-disabled={itemList.page >= itemList.pageCount}
                className={`inline-flex h-9 items-center justify-center rounded-xl border border-[var(--border)] px-3 text-sm font-medium ${
                  itemList.page >= itemList.pageCount
                    ? "pointer-events-none opacity-40"
                    : "hover:bg-neutral-50"
                }`}
              >
                Berikutnya
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
