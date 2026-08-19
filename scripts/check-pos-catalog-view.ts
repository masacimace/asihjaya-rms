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
import type { PosAvailableItem, PosCategoryOption } from "@/features/pos/contracts";
import { calculatePosBasePrice } from "@/features/pos/transaction-pricing";

function createItem(overrides: Partial<PosAvailableItem> = {}): PosAvailableItem {
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
    exchangePurityPercent: "375",
    size: "17",
    color: "Kuning",
    gemstone: "Zircon",
    deductionPerGram: "25000",
    sellingAmount: "2500000",
    activePricePerGram: "1000000",
    imageKey: "items/sku cincin-001.jpg",
    productImageKey: null,
    outletId: "outlet-1",
    outletCode: "OUT-001",
    outletName: "Asihjaya Utama",
    ...overrides,
  };
}

const categories: PosCategoryOption[] = [
  { id: "category-ring", code: "RING", name: "Cincin", totalAvailableItems: 2 },
  { id: "category-bracelet", code: "BRACELET", name: "Gelang", totalAvailableItems: 1 },
];
const ring = createItem();
const secondRing = createItem({ id: "item-2", sku: "SKU-RING-002", barcode: "899000000002", imageKey: null });
const bracelet = createItem({ id: "item-3", sku: "SKU-GELANG-001", barcode: "899000000003", productName: "Gelang Rantai", categoryId: "category-bracelet", categoryName: "Gelang", imageKey: null });
const items = [ring, secondRing, bracelet];

assert.deepEqual(filterPosCatalogItems({ items, activeCategoryId: "category-ring", searchQuery: "" }), [ring, secondRing]);
assert.deepEqual(filterPosCatalogItems({ items, activeCategoryId: "all", searchQuery: "899000000001" }), [ring]);
assert.equal(getPosActiveCategoryLabel({ categories, activeCategoryId: "category-bracelet" }), "Gelang");
assert.equal(formatPosItemDecimal("2.500", "gr"), "2,5 gr");
assert.equal(getPosItemDetail(ring), "2,5 gr · Kadar 70 %");
assert.deepEqual(getPosItemSpecChips(ring), ["2,5 gr", "Kadar 70 %", "Tukaran 375", "Uk. 17", "Kuning", "Zircon"]);
assert.equal(calculatePosBasePrice({ weightGram: ring.weightGram, pricePerGram: ring.activePricePerGram }), 2_500_000);
assert.equal(getPosMediaUrl(" items / sku cincin-001.jpg "), "/media/items/sku%20cincin-001.jpg");
assert.equal(getPosItemImageUrl(ring), "/media/items/sku%20cincin-001.jpg");
assert.equal(getPosItemBackground(ring), getPosItemBackground(ring));

console.log("POS catalog dynamic pricing view-state checks passed.");
