import type {
  PosAvailableItem,
  PosCategoryOption,
} from "@/features/pos/contracts";

const POS_ITEM_BACKGROUNDS = [
  "bg-amber-50",
  "bg-orange-50",
  "bg-yellow-50",
  "bg-rose-50",
  "bg-stone-100",
] as const;

export function formatPosItemDecimal(value: string | null, suffix: string) {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(parsedValue)} ${suffix}`;
}

export function getPosItemBackground(item: PosAvailableItem) {
  const firstCharCode = item.sku.charCodeAt(0) || 0;

  return (
    POS_ITEM_BACKGROUNDS[firstCharCode % POS_ITEM_BACKGROUNDS.length] ??
    "bg-stone-100"
  );
}

export function getPosItemDetail(item: PosAvailableItem) {
  const details = [
    formatPosItemDecimal(item.weightGram, "gr"),
    item.exchangePurityPercent
      ? `Kadar ${formatPosItemDecimal(item.exchangePurityPercent, "%")}`
      : item.purityPercent
        ? `Kadar ${formatPosItemDecimal(item.purityPercent, "%")}`
        : null,
  ].filter(Boolean);

  return details.length > 0 ? details.join(" · ") : "Detail item belum lengkap";
}

export function getPosItemSpecChips(item: PosAvailableItem) {
  const primaryPurity = item.exchangePurityPercent ?? item.purityPercent;

  return [
    item.weightGram
      ? `${formatPosItemDecimal(item.weightGram, "gr")}`
      : null,
    primaryPurity
      ? `Kadar ${formatPosItemDecimal(primaryPurity, "%")}`
      : null,
    item.size ? `Uk. ${item.size}` : null,
    item.color ? item.color : null,
    item.gemstone ? item.gemstone : null,
  ].filter(Boolean) as string[];
}

export function getPosMediaUrl(imageKey: string | null) {
  const normalizedKey = imageKey
    ?.split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

  if (!normalizedKey) {
    return null;
  }

  return `/media/${normalizedKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export function getPosItemImageUrl(item: PosAvailableItem) {
  return getPosMediaUrl(item.imageKey);
}

export function filterPosCatalogItems({
  items,
  activeCategoryId,
  searchQuery,
}: {
  items: PosAvailableItem[];
  activeCategoryId: string;
  searchQuery: string;
}) {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    const matchesCategory =
      activeCategoryId === "all" || item.categoryId === activeCategoryId;

    if (!matchesCategory) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [
      item.sku,
      item.barcode,
      item.qrValue,
      item.serialNumber,
      item.productCode,
      item.productName,
      item.categoryName,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedSearch));
  });
}

export function getPosActiveCategoryLabel({
  categories,
  activeCategoryId,
}: {
  categories: PosCategoryOption[];
  activeCategoryId: string;
}) {
  if (activeCategoryId === "all") {
    return "Semua kategori";
  }

  return (
    categories.find((category) => category.id === activeCategoryId)?.name ??
    "Semua kategori"
  );
}
