import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  Boxes,
  CircleDot,
  Filter,
  PackageCheck,
  Plus,
  RefreshCw,
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

const quickAvailabilityFilters: Array<{
  label: string;
  value: ItemAvailability | null;
}> = [
  { label: "Semua", value: null },
  { label: "Tersedia", value: "available" },
  { label: "Hold Migrasi", value: "migration_hold" },
  { label: "Reserved", value: "reserved" },
  { label: "Terjual", value: "sold" },
  { label: "Draft", value: "draft" },
];

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
    return "Belum diatur";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Belum diatur";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatWeightValue(value: number | string | null) {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
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

function buildAvailabilityUrl(
  availability: ItemAvailability | null,
  filters: {
    search: string;
    outletId: string | null;
    availability: ItemAvailability | null;
    condition: ItemCondition | null;
    status: "active" | "archived";
  },
) {
  return buildInventoryUrl(1, {
    ...filters,
    availability,
  });
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

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_23rem] lg:items-start lg:p-7">
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

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Link
                href={buildInventoryUrl(itemList.page, filters)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40"
              >
                <RefreshCw className="size-4" />
                Refresh
              </Link>

              <Link
                href="/admin/produk/tambah"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <Plus className="size-4" />
                Tambah Produk
              </Link>
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

      <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-950">
              Filter inventaris
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Gunakan pencarian cepat untuk SKU, barcode, produk, outlet, atau
              kondisi item.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickAvailabilityFilters.map((filter) => {
              const active = filters.availability === filter.value;

              return (
                <Link
                  key={filter.label}
                  href={buildAvailabilityUrl(filter.value, filters)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "border-neutral-950 bg-neutral-950 !text-white"
                      : "border-[var(--border)] bg-white text-neutral-700 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 hover:text-neutral-950",
                  )}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>
        </div>

        <form className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_150px_200px_160px_160px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 transition focus-within:border-[var(--accent)] focus-within:bg-white">
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
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
          >
            <option value="active">Item aktif</option>
            <option value="archived">Item diarsipkan</option>
          </select>

          <select
            name="outletId"
            defaultValue={filters.outletId ?? ""}
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
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
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
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
            className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-[var(--accent)]"
          >
            <option value="">Semua kondisi</option>
            <option value="good">Baik</option>
            <option value="damaged">Rusak</option>
            <option value="lost">Hilang</option>
            <option value="returned">Retur</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
            >
              <Filter className="size-4" />
              Terapkan
            </button>
            <Link
              href="/admin/inventaris"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40 hover:text-neutral-950"
            >
              Reset
            </Link>
          </div>
        </form>

        {isFiltered ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            Menampilkan {formatNumber(itemList.total)} item
            {selectedOutlet ? ` di ${selectedOutlet.name}` : ""} sesuai filter
            aktif.
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-neutral-950">
              Daftar Item Inventaris
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {formatNumber(itemList.total)} item ditemukan · halaman{" "}
              {itemList.page} dari {itemList.pageCount}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">
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
            <div className="hidden xl:block">
              <div className="overflow-x-auto">
                <div className="min-w-[1520px]">
                  <div className="grid grid-cols-[minmax(300px,1.55fr)_180px_190px_110px_175px_150px_165px_130px] gap-4 border-b border-[var(--border)] bg-neutral-50 px-5 py-3 text-xs font-semibold text-neutral-500">
                    <div>Item</div>
                    <div className="min-w-0 self-center pl-5">
                      SKU / Barcode
                    </div>
                    <div className="min-w-0 self-center pl-10">
                      Stock Tersedia
                    </div>
                    <div className="min-w-0 self-center pl-13">Kadar %</div>
                    <div className="min-w-0 self-center pl-20">
                      Harga / Gram
                    </div>
                    <div className="min-w-0 self-center pl-15">
                      Berat (Gram)
                    </div>
                    <div className="min-w-0 self-center pl-15">Warna</div>
                    <div className="min-w-0 self-center pl-6">Status</div>
                  </div>

                  <div className="divide-y divide-[var(--border)]">
                    {itemList.rows.map((item) => {
                      const imageUrl = getImageUrl(item.imageKey);
                      const purityKey = normalizePurityKey(item.purityPercent);
                      const activeRate = purityKey
                        ? activePriceRateMap.get(purityKey)
                        : null;

                      return (
                        <Link
                          key={item.id}
                          href={`/admin/inventaris/item/${item.id}`}
                          aria-label={`Buka detail item ${item.productName} ${item.sku}`}
                          className="group grid grid-cols-[minmax(300px,1.55fr)_180px_190px_110px_175px_150px_165px_130px] gap-4 px-5 py-4 text-inherit no-underline transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <ProductImage
                              src={imageUrl}
                              alt={`${item.productName} ${item.sku}`}
                              className="size-14 shrink-0 rounded-xl border border-[var(--border)]"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-neutral-950 transition group-hover:text-[var(--accent)]">
                                {item.productName}
                              </p>
                              <p className="mt-1 truncate text-xs text-[var(--muted)]">
                                {item.masterProductName}
                              </p>
                              <p className="mt-1 truncate text-[11px] text-neutral-400">
                                Update {formatDateTime(item.updatedAt)}
                              </p>
                            </div>
                          </div>

                          <div className="min-w-0 self-center pl-6">
                            <p className="truncate font-mono text-xs font-semibold text-neutral-900">
                              {item.sku}
                            </p>
                            <p className="mt-1 truncate font-mono text-xs text-[var(--muted)]">
                              {item.barcode}
                            </p>
                          </div>

                          <div className="min-w-0 self-center pl-5">
                            <p className="truncate text-sm font-semibold text-neutral-950">
                              {item.outletName ?? "Belum ditempatkan"}
                            </p>
                            <p className="mt-1 truncate text-xs text-[var(--muted)]">
                              {item.outletCode || "Kode outlet belum tersedia"}
                            </p>
                          </div>

                          <div className="min-w-0 self-center pl-16">
                            <p className="text-sm font-semibold tabular-nums text-neutral-950">
                              {formatPurity(item.purityPercent)}
                            </p>
                          </div>

                          <div className="self-center text-right">
                            <p className="text-sm font-semibold tabular-nums text-neutral-950">
                              {formatPricePerGram(activeRate?.ratePerGram)}
                            </p>
                            {!activeRate ? (
                              <p className="mt-1 text-[11px] text-amber-600">
                                Rate belum tersedia
                              </p>
                            ) : null}
                          </div>

                          <div className="min-w-0 self-center pl-22">
                            <p className="text-sm font-semibold tabular-nums text-neutral-950">
                              {formatWeightValue(item.weightGram)}
                            </p>
                          </div>

                          <div className="min-w-0 self-center pl-15">
                            <p className="truncate text-sm font-medium text-neutral-900">
                              {item.color || "—"}
                            </p>
                          </div>

                          <div className="min-w-0 self-center pl-5">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                                getAvailabilityClass(item.availability),
                              )}
                            >
                              {availabilityLabels[item.availability]}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-[var(--border)] lg:hidden">
              {itemList.rows.map((item) => {
                const imageUrl = getImageUrl(item.imageKey);
                const purityKey = normalizePurityKey(item.purityPercent);
                const activeRate = purityKey
                  ? activePriceRateMap.get(purityKey)
                  : null;

                return (
                  <Link
                    key={item.id}
                    href={`/admin/inventaris/item/${item.id}`}
                    aria-label={`Buka detail item ${item.productName} ${item.sku}`}
                    className="group block p-4 text-inherit no-underline transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
                  >
                    <div className="flex gap-3">
                      <ProductImage
                        src={imageUrl}
                        alt={`${item.productName} ${item.sku}`}
                        className="size-20 shrink-0 rounded-2xl border border-[var(--border)]"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 font-semibold leading-5 text-neutral-950 transition group-hover:text-[var(--accent)]">
                              {item.productName}
                            </h3>
                            <p className="mt-1 truncate font-mono text-xs text-[var(--muted)]">
                              {item.sku}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-2 py-1 text-xs font-semibold",
                              getAvailabilityClass(item.availability),
                            )}
                          >
                            {availabilityLabels[item.availability]}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3">
                            <p className="text-neutral-500">Kadar %</p>
                            <p className="mt-1 font-semibold text-neutral-950">
                              {formatPurity(item.purityPercent)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3">
                            <p className="text-neutral-500">Harga / Gram</p>
                            <p className="mt-1 font-semibold text-neutral-950">
                              {formatPricePerGram(activeRate?.ratePerGram)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3">
                            <p className="text-neutral-500">Berat (Gram)</p>
                            <p className="mt-1 font-semibold text-neutral-950">
                              {formatWeightValue(item.weightGram)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3">
                            <p className="text-neutral-500">Warna</p>
                            <p className="mt-1 truncate font-semibold text-neutral-950">
                              {item.color || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-neutral-700">
                          <div className="flex justify-between gap-3">
                            <span className="text-[var(--muted)]">Outlet</span>
                            <span className="min-w-0 truncate font-semibold text-neutral-950">
                              {item.outletName ?? "Belum ditempatkan"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-[var(--muted)]">Barcode</span>
                            <span className="min-w-0 truncate font-mono text-neutral-950">
                              {item.barcode}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-[var(--muted)]">Kondisi</span>
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 font-semibold",
                                getConditionClass(item.condition),
                              )}
                            >
                              {conditionLabels[item.condition]}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-[var(--border)] pt-3">
                          <span className="text-xs text-[var(--muted)]">
                            Update {formatDateTime(item.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {itemList.pageCount > 1 ? (
          <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--muted)]">
              Halaman {itemList.page} dari {itemList.pageCount} ·{" "}
              {formatNumber(itemList.total)} item
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Link
                href={buildInventoryUrl(
                  Math.max(1, itemList.page - 1),
                  filters,
                )}
                aria-disabled={itemList.page <= 1}
                className={cn(
                  "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-900 transition",
                  itemList.page <= 1
                    ? "pointer-events-none opacity-40"
                    : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40",
                )}
              >
                Sebelumnya
              </Link>
              <Link
                href={buildInventoryUrl(
                  Math.min(itemList.pageCount, itemList.page + 1),
                  filters,
                )}
                aria-disabled={itemList.page >= itemList.pageCount}
                className={cn(
                  "inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-900 transition",
                  itemList.page >= itemList.pageCount
                    ? "pointer-events-none opacity-40"
                    : "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/40",
                )}
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
