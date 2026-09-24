import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Filter,
  PackageCheck,
  Scale,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

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
import {
  getActiveGoldPriceRateMap,
  normalizePurityKey,
} from "@/features/pricing/metal-price-rates";
import { requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Inventaris",
};

const availabilityLabels: Record<ItemAvailability, string> = {
  draft: "Draft",
  migration_hold: "Hold Migrasi",
  processing: "Pemrosesan Buyback",
  available: "Tersedia",
  reserved: "Reserved",
  inspection: "Inspeksi",
  sold: "Terjual",
};

const conditionLabels: Record<ItemCondition, string> = {
  good: "Baru",
  used: "Bekas",
  damaged: "Rusak",
  lost: "Hilang",
  returned: "Retur",
};

function getAvailabilityClass(availability: ItemAvailability) {
  if (availability === "available") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (availability === "reserved") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (availability === "sold") {
    return "border-neutral-200 bg-neutral-950 text-white";
  }

  if (availability === "processing" || availability === "inspection") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function getConditionClass(condition: ItemCondition) {
  if (condition === "good" || condition === "used") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (condition === "returned") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (condition === "damaged") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function formatPurity(value: string | null) {
  if (!value) {
    return "Belum diisi";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Belum diisi";
  }

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(amount)}%`;
}

function formatPricePerGram(value: string | null | undefined) {
  if (!value) {
    return "Harga Dinamis";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Harga Dinamis";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(value: number | string | null) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatWeight(value: number | string | null) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "—";
  }

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(amount)} gr`;
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
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

function getPaginationTokens(page: number, pageCount: number) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const visiblePages = new Set<number>([
    1,
    pageCount,
    page - 1,
    page,
    page + 1,
  ]);

  if (page <= 4) {
    [2, 3, 4, 5].forEach((value) => visiblePages.add(value));
  }

  if (page >= pageCount - 3) {
    [pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1].forEach(
      (value) => visiblePages.add(value),
    );
  }

  const pages = [...visiblePages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((left, right) => left - right);
  const tokens: Array<number | string> = [];

  pages.forEach((value, index) => {
    const previous = pages[index - 1];

    if (previous !== undefined) {
      const gap = value - previous;
      if (gap === 2) {
        tokens.push(previous + 1);
      } else if (gap > 2) {
        tokens.push(`ellipsis-${previous}-${value}`);
      }
    }

    tokens.push(value);
  });

  return tokens;
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
          <p className="text-xs font-semibold uppercase text-neutral-500">
            {title}
          </p>
          <p className="mt-3 text-xl font-semibold text-neutral-950 sm:text-2xl">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{helper}</p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-amber-100">
          {icon}
        </div>
      </div>
    </article>
  );
}

function InventoryMetric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2.5">
      <p className="text-[11px] font-medium text-neutral-500">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-semibold tabular-nums text-neutral-950",
          emphasis && "text-[var(--accent)]",
        )}
      >
        {value}
      </p>
    </div>
  );
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
  const [overview, outletOptions, itemList, activePriceRateMap] =
    await Promise.all([
      getProductItemOverview(auth.organization.id),
      getInventoryOutletOptions(auth.organization.id),
      getProductItemList(auth.organization.id, filters),
      getActiveGoldPriceRateMap(auth.organization.id),
    ]);
  const isFiltered = Boolean(
    filters.search ||
    filters.outletId ||
    filters.availability ||
    filters.condition ||
    filters.status !== "active",
  );
  const selectedOutlet = outletOptions.find(
    (outlet) => outlet.id === filters.outletId,
  );
  const activeFilterCount = [
    filters.search || null,
    filters.outletId,
    filters.availability,
    filters.condition,
    filters.status !== "active" ? filters.status : null,
  ].filter(Boolean).length;
  const paginationTokens = getPaginationTokens(
    itemList.page,
    itemList.pageCount,
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_23rem] lg:items-end lg:p-7">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>

            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Inventaris Perhiasan
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Pantau item fisik perhiasan berdasarkan SKU, barcode, outlet,
              status stok, harga, gramasi, dan kondisi barang secara real-data.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
                  <Sparkles className="size-3.5 text-[var(--accent)]" />
                  Stok inventaris
                </p>
                <p className="mt-2 text-2xl font-semibold text-neutral-950">
                  {formatNumber(overview.available)} item
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  {formatWeight(overview.availableWeightGram)} siap jual ·{" "}
                  {formatNumber(overview.total)} total item aktif.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Item tersedia"
          value={formatNumber(overview.available)}
          helper={`${formatWeight(overview.availableWeightGram)} siap jual di outlet aktif`}
          icon={<PackageCheck className="size-5" />}
        />
        <SummaryCard
          title="Total berat tersedia"
          value={formatWeight(overview.availableWeightGram)}
          helper="Akumulasi berat item yang berstatus Tersedia"
          icon={<Scale className="size-5" />}
        />
        <SummaryCard
          title="Reserved & draft"
          value={formatNumber(overview.reserved + overview.draft)}
          helper={`${formatNumber(overview.reserved)} reserved · ${formatNumber(overview.draft)} draft`}
          icon={<CircleDot className="size-5" />}
        />
        <SummaryCard
          title="Perlu perhatian"
          value={formatNumber(overview.attention)}
          helper="Item rusak, retur, atau hilang yang perlu dicek"
          icon={<AlertTriangle className="size-5" />}
        />
      </section>

      <details className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-neutral-50 text-neutral-600">
            <Filter className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-neutral-950">
                Filter inventaris
              </p>
              {isFiltered ? (
                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  {activeFilterCount} filter aktif
                </span>
              ) : (
                <span className="inline-flex rounded-full border border-[var(--border)] bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
                  Opsional
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
              {isFiltered
                ? `${formatNumber(itemList.total)} item sesuai filter. Buka untuk mengubah pencarian, outlet, status stok, atau kondisi.`
                : "Buka untuk mencari item berdasarkan SKU, barcode, produk, outlet, status stok, atau kondisi."}
            </p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden text-xs font-semibold text-neutral-500 sm:inline group-open:hidden">
              Buka filter
            </span>
            <span className="hidden text-xs font-semibold text-neutral-500 sm:group-open:inline">
              Tutup filter
            </span>
            <ChevronDown className="size-5 text-neutral-400 transition-transform duration-200 group-open:rotate-180" />
          </div>
        </summary>

        <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5 sm:py-5">
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 transition focus-within:border-[var(--accent)] focus-within:bg-white md:col-span-2 xl:col-span-2">
              <Search className="size-4 shrink-0 text-neutral-400" />
              <input
                name="q"
                type="search"
                defaultValue={filters.search}
                placeholder="Cari SKU, barcode, nama, atau kode produk..."
                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
              />
            </label>

            <select
              name="status"
              defaultValue={filters.status}
              className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
            >
              <option value="active">Item aktif</option>
              <option value="archived">Item diarsipkan</option>
            </select>

            <select
              name="outletId"
              defaultValue={filters.outletId ?? ""}
              className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
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
              className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
            >
              <option value="">Semua status stok</option>
              <option value="available">Tersedia</option>
              <option value="reserved">Reserved</option>
              <option value="draft">Draft</option>
              <option value="migration_hold">Hold Migrasi</option>
              <option value="processing">Pemrosesan Buyback</option>
              <option value="inspection">Inspeksi</option>
              <option value="sold">Terjual</option>
            </select>

            <select
              name="condition"
              defaultValue={filters.condition ?? ""}
              className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
            >
              <option value="">Semua kondisi</option>
              <option value="good">Baru</option>
              <option value="used">Bekas</option>
              <option value="damaged">Rusak</option>
              <option value="lost">Hilang</option>
              <option value="returned">Retur</option>
            </select>

            <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-2 xl:flex xl:justify-end">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <Filter className="size-4" />
                Terapkan
              </button>
              <Link
                href="/admin/inventaris"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 hover:text-neutral-950"
              >
                Reset
              </Link>
            </div>
          </form>

          {isFiltered ? (
            <div className="mt-4 flex flex-col gap-1 rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50 px-4 py-3 text-sm text-neutral-700 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span>
                Menampilkan <strong>{formatNumber(itemList.total)}</strong> item
                {selectedOutlet ? ` di ${selectedOutlet.name}` : ""} sesuai
                filter aktif.
              </span>
              <span className="text-xs text-[var(--muted)]">
                Reset filter untuk kembali ke seluruh inventaris.
              </span>
            </div>
          ) : null}
        </div>
      </details>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold text-neutral-950">
              Daftar Item Inventaris
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {formatNumber(itemList.total)} item ditemukan · halaman{" "}
              {itemList.page} dari {itemList.pageCount}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">
            <Barcode className="size-3.5" />
            SKU & barcode aktif
          </div>
        </div>

        {itemList.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-[var(--border)] bg-neutral-50 text-neutral-500">
              <Boxes className="size-6" />
            </div>
            <p className="mt-4 font-semibold text-neutral-950">
              Tidak ada item yang cocok
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              Coba ubah kata kunci, status, kondisi, outlet, atau reset filter
              untuk melihat seluruh item inventaris aktif.
            </p>
            <Link
              href="/admin/inventaris"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
            >
              Reset filter
            </Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--border)]">
              {itemList.rows.map((item) => {
                const imageUrl = getImageUrl(item.imageKey);
                const purityKey = normalizePurityKey(item.purityPercent);
                const activeRate = purityKey
                  ? activePriceRateMap.get(purityKey)
                  : null;

                return (
                  <div
                    key={item.id}
                    className="group pointer-events-none relative p-4 transition hover:bg-neutral-50 sm:p-5"
                  >
                    <Link
                      href={`/admin/inventaris/item/${item.id}`}
                      aria-label={`Buka detail item ${item.productName} ${item.sku}`}
                      className="pointer-events-auto absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
                    >
                      <span className="sr-only">
                        Buka detail item {item.productName} {item.sku}
                      </span>
                    </Link>

                    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                      <ProductImage
                        src={imageUrl}
                        alt={`${item.productName} ${item.sku}`}
                        className={cn(
                          "relative z-10 size-16 shrink-0 rounded-2xl border border-[var(--border)] sm:size-20",
                          imageUrl
                            ? "pointer-events-auto"
                            : "pointer-events-none",
                        )}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-neutral-950 transition group-hover:text-[var(--accent)]">
                              {item.productName}
                            </h3>
                            <p className="mt-1 truncate text-xs text-[var(--muted)]">
                              {item.masterProductName}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1.5">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-1 text-xs font-semibold",
                                getAvailabilityClass(item.availability),
                              )}
                            >
                              {availabilityLabels[item.availability]}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2 py-1 text-xs font-semibold",
                                getConditionClass(item.condition),
                              )}
                            >
                              {conditionLabels[item.condition]}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 grid min-w-0 gap-1 text-[11px] sm:grid-cols-1 sm:gap-x-4">
                          <p className="truncate font-semibold text-neutral-800">
                            SKU: {item.sku}
                          </p>
                          <p className="truncate text-neutral-800">
                            Barcode: {item.barcode}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <InventoryMetric
                        label="Kadar"
                        value={formatPurity(item.purityPercent)}
                      />
                      <InventoryMetric
                        label="Harga / Gram"
                        value={formatPricePerGram(activeRate?.ratePerGram)}
                        emphasis={Boolean(activeRate)}
                      />
                      <InventoryMetric
                        label="Berat"
                        value={formatWeight(item.weightGram)}
                      />
                      <InventoryMetric
                        label="Warna"
                        value={item.color || "—"}
                      />
                    </div>

                    {!activeRate ? (
                      <p className="mt-2 text-[11px] font-medium text-amber-600">
                        Harga / Gram untuk kadar ini dinamis.
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-3 text-xs text-neutral-700 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <span className="text-[var(--muted)]">
                          Outlet / Lokasi:{" "}
                        </span>
                        <span className="font-semibold text-neutral-950">
                          {item.outletName ?? "Belum ditempatkan"}
                        </span>
                        {item.outletCode ? (
                          <span className="text-[var(--muted)]">
                            {` · ${item.outletCode}`}
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-[var(--muted)]">
                        Update {formatDateTime(item.updatedAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {itemList.pageCount > 1 ? (
          <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs text-[var(--muted)]">
                Halaman {itemList.page} dari {itemList.pageCount} ·{" "}
                {formatNumber(itemList.total)} item
              </p>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Link
                    href={buildInventoryUrl(
                      Math.max(1, itemList.page - 1),
                      filters,
                    )}
                    aria-disabled={itemList.page <= 1}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-neutral-900 transition",
                      itemList.page <= 1
                        ? "pointer-events-none opacity-40"
                        : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40",
                    )}
                  >
                    <ChevronLeft className="size-4" />
                    Sebelumnya
                  </Link>
                  <Link
                    href={buildInventoryUrl(
                      Math.min(itemList.pageCount, itemList.page + 1),
                      filters,
                    )}
                    aria-disabled={itemList.page >= itemList.pageCount}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold text-neutral-900 transition",
                      itemList.page >= itemList.pageCount
                        ? "pointer-events-none opacity-40"
                        : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40",
                    )}
                  >
                    Berikutnya
                    <ChevronRight className="size-4" />
                  </Link>
                </div>

                <div className="hidden items-center gap-1 xl:flex">
                  {paginationTokens.map((token) =>
                    typeof token === "number" ? (
                      <Link
                        key={token}
                        href={buildInventoryUrl(token, filters)}
                        aria-current={
                          token === itemList.page ? "page" : undefined
                        }
                        className={cn(
                          "grid size-10 place-items-center rounded-xl border text-sm font-semibold transition",
                          token === itemList.page
                            ? "border-neutral-950 bg-neutral-950 !text-white"
                            : "border-[var(--border)] bg-white text-neutral-700 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 hover:text-neutral-950",
                        )}
                      >
                        {token}
                      </Link>
                    ) : (
                      <span
                        key={token}
                        className="grid size-8 place-items-center text-sm text-[var(--muted)]"
                        aria-hidden="true"
                      >
                        …
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
