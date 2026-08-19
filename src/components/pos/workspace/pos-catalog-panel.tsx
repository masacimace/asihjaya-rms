"use client";

import {
  Check,
  ChevronDown,
  Gem,
  ListFilter,
  ScanBarcode,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { PosItemImage } from "@/components/pos/workspace/pos-item-image";
import {
  filterPosCatalogItems,
  getPosActiveCategoryLabel,
  getPosItemDetail,
  getPosItemSpecChips,
} from "@/features/pos/catalog-state";
import {
  POS_INITIAL_ITEM_LIMIT,
  type PosAvailableItem,
  type PosCategoryOption,
} from "@/features/pos/contracts";
import { formatCurrency } from "@/features/pos/payment-draft";
import { calculatePosBasePrice } from "@/features/pos/transaction-pricing";
import { cn } from "@/lib/utils";

type PosCatalogPanelProps = {
  categories: PosCategoryOption[];
  items: PosAvailableItem[];
  cartItemIds: ReadonlySet<string>;
  activeCategoryId: string;
  isCategoryPickerOpen: boolean;
  searchQuery: string;
  children?: ReactNode;
  onActiveCategoryChange: (categoryId: string) => void;
  onCategoryPickerOpenChange: (isOpen: boolean) => void;
  onSearchQueryChange: (value: string) => void;
  onOpenScanner: () => void;
  onAddItem: (item: PosAvailableItem) => void;
};

export function PosCatalogPanel({
  categories,
  items,
  cartItemIds,
  activeCategoryId,
  isCategoryPickerOpen,
  searchQuery,
  children,
  onActiveCategoryChange,
  onCategoryPickerOpenChange,
  onSearchQueryChange,
  onOpenScanner,
  onAddItem,
}: PosCatalogPanelProps) {
  const filteredItems = useMemo(
    () =>
      filterPosCatalogItems({
        items,
        activeCategoryId,
        searchQuery,
      }),
    [activeCategoryId, items, searchQuery],
  );
  const totalAvailableItems = items.length;
  const activeCategoryLabel = getPosActiveCategoryLabel({
    categories,
    activeCategoryId,
  });

  return (
    <section className="min-w-0 p-4 pb-22 sm:p-5 sm:pb-36 lg:overflow-y-auto lg:border-r lg:border-[var(--border)] lg:p-6">
      {children}

      {/* Search mobile */}
      <div className="mb-2 flex items-center gap-2 md:hidden">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3">
          <Search className="size-4 shrink-0 text-neutral-400" />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Scan atau cari barang..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </label>

        <button
          type="button"
          onClick={onOpenScanner}
          aria-label="Scan dengan kamera"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--accent)]"
        >
          <ScanBarcode className="size-5" />
        </button>
      </div>

      <label className="mb-4 hidden h-11 max-w-xl items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 md:flex lg:hidden">
        <Search className="size-4 shrink-0 text-neutral-400" />

        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Cari SKU, barcode, nama produk..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
      </label>

      {/* Compact category dropdown / mobile sheet */}
      <div className="-mx-4 bg-[var(--background)] px-4 py-2 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden shrink-0 sm:block">
            <p className="text-xl font-semibold text-neutral-950">
              Pilih item produk
            </p>
            <p className="text-[11px] text-[var(--muted)]">
              Menampilkan stok item fisik yang tersedia di outlet
            </p>
          </div>

          <div className="relative flex min-w-0 w-full items-center gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isCategoryPickerOpen}
              onClick={() => onCategoryPickerOpenChange(!isCategoryPickerOpen)}
              className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-left transition-colors hover:border-neutral-300 sm:w-80 sm:flex-none lg:w-96"
            >
              <ListFilter className="size-4 shrink-0 text-[var(--accent)]" />

              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-medium text-[var(--muted)]">
                  Kategori
                </span>
                <span className="block truncate text-sm font-semibold text-neutral-950">
                  {activeCategoryLabel}
                </span>
              </span>

              <span
                className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-600 sm:hidden"
                title={`${filteredItems.length} dari ${totalAvailableItems} item tersedia`}
              >
                {filteredItems.length}/{totalAvailableItems}
              </span>

              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-neutral-400 transition-transform",
                  isCategoryPickerOpen && "rotate-180",
                )}
              />
            </button>

            <span
              className="hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] sm:inline-flex"
              title={`${filteredItems.length} dari ${totalAvailableItems} item tersedia`}
            >
              {filteredItems.length} dari {totalAvailableItems} item
              tersedia
            </span>

            {isCategoryPickerOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Tutup pilihan kategori"
                  onClick={() => onCategoryPickerOpenChange(false)}
                  className="fixed inset-0 z-30 hidden cursor-default md:block"
                />

                <div
                  id="pos-category-picker"
                  role="dialog"
                  aria-label="Pilih kategori produk"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-40 hidden rounded-2xl border border-[var(--border)] bg-white p-3 md:block"
                >
                  <div className="mb-3 flex items-center justify-between gap-3 px-1">
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">
                        Pilih kategori
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        Filter katalog tanpa mengurangi area daftar produk.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onCategoryPickerOpenChange(false)}
                      aria-label="Tutup pilihan kategori"
                      className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-950"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={activeCategoryId === "all"}
                      onClick={() => {
                        onActiveCategoryChange("all");
                        onCategoryPickerOpenChange(false);
                      }}
                      className={cn(
                        "flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                        activeCategoryId === "all"
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border)] text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          Semua kategori
                        </span>
                        <span className="block text-[11px] opacity-75">
                          {totalAvailableItems} item tersedia
                        </span>
                      </span>

                      {activeCategoryId === "all" ? (
                        <Check className="size-4 shrink-0" />
                      ) : null}
                    </button>

                    {categories.map((category) => {
                      const isActive = activeCategoryId === category.id;

                      return (
                        <button
                          key={category.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => {
                            onActiveCategoryChange(category.id);
                            onCategoryPickerOpenChange(false);
                          }}
                          className={cn(
                            "flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                            isActive
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                              : "border-[var(--border)] text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {category.name}
                            </span>
                            <span className="block text-[11px] opacity-75">
                              {category.totalAvailableItems} item tersedia
                            </span>
                          </span>

                          {isActive ? (
                            <Check className="size-4 shrink-0" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {isCategoryPickerOpen ? (
        <div
          id="pos-category-picker-mobile"
          role="dialog"
          aria-modal="true"
          aria-label="Pilih kategori produk"
          className="fixed inset-0 z-50 md:hidden"
        >
          <button
            type="button"
            aria-label="Tutup pilihan kategori"
            onClick={() => onCategoryPickerOpenChange(false)}
            className="absolute inset-0 bg-neutral-950/45"
          />

          <div className="absolute inset-x-0 bottom-0 max-h-[78vh] rounded-t-3xl border-t border-[var(--border)] bg-white">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-neutral-300" />

            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
              <div>
                <p className="text-base font-semibold text-neutral-950">
                  Pilih kategori
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Kategori aktif: {activeCategoryLabel}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onCategoryPickerOpenChange(false)}
                aria-label="Tutup pilihan kategori"
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] text-neutral-500"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="scrollbar-clean max-h-[calc(78vh-5.5rem)] space-y-2 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                aria-pressed={activeCategoryId === "all"}
                onClick={() => {
                  onActiveCategoryChange("all");
                  onCategoryPickerOpenChange(false);
                }}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left",
                  activeCategoryId === "all"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] text-neutral-700",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    Semua kategori
                  </span>
                  <span className="block text-xs opacity-75">
                    {totalAvailableItems} item tersedia
                  </span>
                </span>

                {activeCategoryId === "all" ? (
                  <Check className="size-5 shrink-0" />
                ) : null}
              </button>

              {categories.map((category) => {
                const isActive = activeCategoryId === category.id;

                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      onActiveCategoryChange(category.id);
                      onCategoryPickerOpenChange(false);
                    }}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left",
                      isActive
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-[var(--border)] text-neutral-700",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {category.name}
                      </span>
                      <span className="block text-xs opacity-75">
                        {category.totalAvailableItems} item tersedia
                      </span>
                    </span>

                    {isActive ? (
                      <Check className="size-5 shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {totalAvailableItems >= POS_INITIAL_ITEM_LIMIT ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Menampilkan {POS_INITIAL_ITEM_LIMIT} item terbaru. Gunakan search
          atau scan barcode lama/internal untuk menemukan item yang lebih
          spesifik.
        </p>
      ) : null}

      {/* Product grid */}
      {filteredItems.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredItems.map((item) => {
            const isInCart = cartItemIds.has(item.id);
            const basePriceAmount = calculatePosBasePrice({
              weightGram: item.weightGram,
              pricePerGram: item.activePricePerGram,
            });
            const hasActivePricing = Boolean(basePriceAmount);
            const specChips = getPosItemSpecChips(item);

            return (
              <article
                key={item.id}
                className={cn(
                  "group overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:shadow-md",
                  isInCart
                    ? "border-[var(--accent)] ring-2 ring-[var(--accent-soft)]"
                    : "border-[var(--border)] hover:border-neutral-300",
                )}
              >
                <button
                  type="button"
                  onClick={() => onAddItem(item)}
                  className="block w-full text-left"
                >
                  <div className="relative">
                    <PosItemImage
                      item={item}
                      alt={`${item.productName} ${item.sku}`}
                      className="aspect-[5/4] sm:aspect-[4/3]"
                      iconClassName="size-14 sm:size-16"
                      showCatalogBadge
                    />

                    <span
                      className={cn(
                        "absolute left-3 top-3 rounded-full bg-white/30 px-2 py-1 text-[10px] font-medium backdrop-blur",
                        isInCart
                          ? "text-[var(--accent)]"
                          : "text-neutral-600",
                      )}
                    >
                      {isInCart ? "Di Keranjang" : "Tersedia"}
                    </span>
                  </div>
                </button>

                <div className="space-y-2.5 p-2.5 sm:space-y-3 sm:p-4">
                  <div className="space-y-2">
                    <p className="line-clamp-1 text-xs font-semibold leading-5 text-neutral-950 sm:line-clamp-2 sm:min-h-10 sm:text-[15px]">
                      {item.productName}
                    </p>

                    <div className="flex gap-1.5">
                      <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[8px] font-semibold uppercase text-[var(--accent)] sm:px-2.5 sm:py-1 sm:text-[10px]">
                        {item.categoryName}
                      </span>

                      <span className="inline-flex max-w-full items-center rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[8px] font-medium text-neutral-600 sm:px-2.5 sm:py-1 sm:text-[10px]">
                        <span className="truncate">{item.sku}</span>
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] font-semibold uppercase text-[var(--muted)] sm:text-[10px]">
                      Spesifikasi
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-0.5 sm:mt-2 sm:gap-1">
                      {specChips.length > 0 ? (
                        <>
                          {specChips.map((spec) => (
                            <span
                              key={`${item.id}-${spec}`}
                              className="inline-flex items-center rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[9px] font-medium text-neutral-700 sm:px-2.5 sm:py-1 sm:text-[10px]"
                            >
                              {spec}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-[11px] text-[var(--muted)]">
                          {getPosItemDetail(item)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--accent-soft)] bg-[var(--accent-soft)]/70 p-2.5 sm:items-end sm:gap-3 sm:rounded-2xl sm:p-3">
                    <div className="min-w-0">
                      <p className="hidden text-[10px] font-semibold uppercase text-[var(--muted)] sm:block">
                        Harga dasar saat ini
                      </p>
                      <p className="truncate text-xs font-semibold text-neutral-950 sm:mt-1 sm:text-[15px]">
                        {basePriceAmount
                          ? formatCurrency(basePriceAmount)
                          : "Harga/Gram belum diatur"}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label={
                        isInCart
                          ? `${item.productName} sudah di keranjang`
                          : `Tambahkan ${item.productName}`
                      }
                      onClick={() => onAddItem(item)}
                      disabled={isInCart}
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-xl border bg-white transition sm:size-10 sm:rounded-2xl",
                        isInCart
                          ? "cursor-not-allowed border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : hasActivePricing
                            ? "border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)] hover:bg-white"
                            : "border-amber-200 text-amber-600 hover:border-amber-300 hover:bg-amber-50",
                      )}
                    >
                      <ShoppingBag className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 grid min-h-72 place-items-center rounded-3xl border border-dashed border-[var(--border)] bg-white p-8 text-center">
          <div>
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Gem className="size-7" />
            </div>
            <h2 className="mt-4 font-semibold text-neutral-950">
              Tidak ada item tersedia
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
              Cek filter pencarian, kategori, atau pastikan item inventory
              sudah berstatus tersedia di outlet aktif.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
