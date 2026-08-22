import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const contractsSource = readFileSync(
  resolve("src/features/pos/contracts.ts"),
  "utf8",
);
const querySource = readFileSync(
  resolve("src/features/pos/queries.ts"),
  "utf8",
);
const catalogHookSource = readFileSync(
  resolve("src/features/pos/use-pos-catalog.ts"),
  "utf8",
);
const catalogPanelSource = readFileSync(
  resolve("src/components/pos/workspace/pos-catalog-panel.tsx"),
  "utf8",
);
const itemImageSource = readFileSync(
  resolve("src/components/pos/workspace/pos-item-image.tsx"),
  "utf8",
);
const scannerHookSource = readFileSync(
  resolve("src/features/pos/use-pos-scanner.ts"),
  "utf8",
);
const posShellSource = readFileSync(
  resolve("src/components/layout/pos-shell.tsx"),
  "utf8",
);

assert.match(contractsSource, /POS_CATALOG_PAGE_SIZE = 120/);
assert.match(querySource, /export async function getPosCatalogPage/);
assert.match(querySource, /limit\(POS_CATALOG_PAGE_SIZE \+ 1\)/);
assert.match(querySource, /lt\(productItems\.updatedAt, cursorUpdatedAt\)/);
assert.match(querySource, /gt\(productItems\.sku, cursor\.sku\)/);
assert.match(querySource, /ilike\(productItems\.sku, searchPattern\)/);
assert.match(querySource, /eq\(productCategories\.id, normalizedCategoryId\)/);
assert.match(catalogHookSource, /POS_CATALOG_SEARCH_DEBOUNCE_MS = 300/);
assert.match(catalogHookSource, /requestVersionRef/);
assert.match(catalogHookSource, /mergeUniqueCatalogItems/);
assert.match(catalogPanelSource, /new IntersectionObserver/);
assert.match(catalogPanelSource, /rootMargin: "600px 0px"/);
assert.match(itemImageSource, /loading="lazy"/);
assert.match(itemImageSource, /decoding="async"/);
assert.doesNotMatch(
  scannerHookSource,
  /setSearchQuery\(normalizedScanValue\)/,
);
assert.match(scannerHookSource, /callbackRef\.current\.onItemFound\(result\.item\)/);
assert.match(catalogPanelSource, /aria-label="Hapus pencarian produk"/);
assert.match(catalogPanelSource, /onSearchQueryChange\(""\)/);
assert.match(posShellSource, /function clearTopbarSearch\(\)/);
assert.match(posShellSource, /sendPosWorkspaceCommand\(\{ type: "search", value: "" \}\)/);
assert.doesNotMatch(posShellSource, /type="search"/);
assert.doesNotMatch(catalogPanelSource, /type="search"/);

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

console.log(
  "POS catalog infinite-scroll + scan/search UX contracts passed.",
);
