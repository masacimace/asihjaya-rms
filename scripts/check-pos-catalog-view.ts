import assert from "node:assert/strict";

import {
  filterPosCatalogItems,
  formatPosItemDecimal,
  getPosActiveCategoryLabel,
  getPosItemBackground,
  getPosItemDetail,
  getPosItemImageUrl,
  getPosItemSpecChips,
  getPosMediaUrl,
} from "@/features/pos/catalog-state";
import type {
  PosAvailableItem,
  PosCategoryOption,
} from "@/features/pos/contracts";

function createItem(
  overrides: Partial<PosAvailableItem> = {},
): PosAvailableItem {
  return {
    id: "item-1",
    sku: "SKU-CINCIN-001",
    barcode: "899000000001",
    qrValue: "QR-CINCIN-001",
    serialNumber: "SERIAL-CINCIN-001",
    productId: "product-1",
    productCode: "PRD-CINCIN-001",
    productName: "Cincin Emas Kuning",
    categoryId: "category-ring",
    categoryName: "Cincin",
    weightGram: "2.5",
    purityPercent: "70",
    exchangePurityPercent: "75",
    size: "17",
    color: "Kuning",
    gemstone: "Zircon",
    sellingAmount: "2500000",
    imageKey: "items/sku cincin-001.jpg",
    productImageKey: "products/catalog-ring.jpg",
    outletId: "outlet-1",
    outletCode: "OUT-001",
    outletName: "Asihjaya Utama",
    ...overrides,
  };
}

const categories: PosCategoryOption[] = [
  {
    id: "category-ring",
    code: "RING",
    name: "Cincin",
    totalAvailableItems: 2,
  },
  {
    id: "category-bracelet",
    code: "BRACELET",
    name: "Gelang",
    totalAvailableItems: 1,
  },
];

const ring = createItem();
const secondRing = createItem({
  id: "item-2",
  sku: "SKU-RING-002",
  barcode: "899000000002",
  qrValue: null,
  serialNumber: "SERIAL-RING-002",
  productCode: "PRD-RING-002",
  productName: "Cincin Polos",
  imageKey: null,
});
const bracelet = createItem({
  id: "item-3",
  sku: "SKU-GELANG-001",
  barcode: "899000000003",
  qrValue: "QR-GELANG-001",
  serialNumber: "SERIAL-GELANG-001",
  productCode: "PRD-GELANG-001",
  productName: "Gelang Rantai",
  categoryId: "category-bracelet",
  categoryName: "Gelang",
  imageKey: null,
  productImageKey: null,
});
const items = [ring, secondRing, bracelet];

assert.deepEqual(
  filterPosCatalogItems({
    items,
    activeCategoryId: "all",
    searchQuery: "   ",
  }),
  items,
);
assert.deepEqual(
  filterPosCatalogItems({
    items,
    activeCategoryId: "category-ring",
    searchQuery: "",
  }),
  [ring, secondRing],
);
assert.deepEqual(
  filterPosCatalogItems({
    items,
    activeCategoryId: "category-bracelet",
    searchQuery: "cincin",
  }),
  [],
);

for (const searchQuery of [
  "sku-cincin-001",
  "899000000001",
  "qr-cincin-001",
  "serial-cincin-001",
  "prd-cincin-001",
  "emas kuning",
  "CINCIN",
]) {
  assert.deepEqual(
    filterPosCatalogItems({
      items,
      activeCategoryId: "all",
      searchQuery,
    }),
    searchQuery.toLowerCase() === "cincin" ? [ring, secondRing] : [ring],
  );
}

assert.equal(
  getPosActiveCategoryLabel({ categories, activeCategoryId: "all" }),
  "Semua kategori",
);
assert.equal(
  getPosActiveCategoryLabel({
    categories,
    activeCategoryId: "category-bracelet",
  }),
  "Gelang",
);
assert.equal(
  getPosActiveCategoryLabel({
    categories,
    activeCategoryId: "missing-category",
  }),
  "Semua kategori",
);

assert.equal(formatPosItemDecimal("2.500", "gr"), "2,5 gr");
assert.equal(formatPosItemDecimal(null, "gr"), null);
assert.equal(formatPosItemDecimal("invalid", "%"), null);
assert.equal(getPosItemDetail(ring), "2,5 gr · Kadar 75 %");
assert.deepEqual(getPosItemSpecChips(ring), [
  "2,5 gr",
  "Kadar 75 %",
  "Uk. 17",
  "Kuning",
  "Zircon",
]);
assert.equal(
  getPosItemDetail(
    createItem({
      weightGram: null,
      purityPercent: null,
      exchangePurityPercent: null,
    }),
  ),
  "Detail item belum lengkap",
);

assert.equal(
  getPosMediaUrl(" items / sku cincin-001.jpg "),
  "/media/items/sku%20cincin-001.jpg",
);
assert.equal(getPosMediaUrl(" / / "), null);
assert.equal(
  getPosItemImageUrl(ring),
  "/media/items/sku%20cincin-001.jpg",
);
assert.equal(
  getPosItemImageUrl(secondRing),
  "/media/products/catalog-ring.jpg",
);
assert.equal(getPosItemImageUrl(bracelet), null);
assert.equal(getPosItemBackground(ring), getPosItemBackground(ring));
assert.match(getPosItemBackground(ring), /^bg-/);

console.log("POS catalog view-state checks passed.");
