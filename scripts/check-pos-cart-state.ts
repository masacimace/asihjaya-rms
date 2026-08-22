import assert from "node:assert/strict";

import {
  getPosCartAddIssue,
  getPosCartItemIds,
  getPosCartSummary,
  removePosCartItem,
} from "@/features/pos/cart-state";
import {
  createStoredPosCartState,
  isStoredPosCartItem,
  parseStoredPosCartStateValue,
} from "@/features/pos/cart-storage";
import type {
  PosCartItem,
  PosCustomerOption,
} from "@/features/pos/contracts";
import { buildPosCartItem } from "@/features/pos/transaction-pricing";

function createItem(overrides: Partial<PosCartItem> = {}): PosCartItem {
  return {
    id: "item-1",
    sku: "SKU-001",
    barcode: "899000000001",
    qrValue: null,
    serialNumber: "SERIAL-001",
    productId: "product-1",
    productCode: "PRD-001",
    productName: "Cincin Emas",
    categoryId: "category-1",
    categoryName: "Cincin",
    weightGram: "2.5",
    purityPercent: "75",
    exchangePurityPercent: "375",
    size: "17",
    color: "Kuning",
    gemstone: null,
    deductionPerGram: "25000",
    sellingAmount: "2500000",
    activePricePerGram: "1000000",
    imageKey: null,
    productImageKey: null,
    outletId: "outlet-1",
    outletCode: "OUT-001",
    outletName: "Asihjaya Utama",
    priceSource: "global",
    pricePerGram: "1000000",
    basePriceAmount: "2500000",
    discountAmount: "100000",
    laborAmount: "50000",
    adjustmentAmount: "25000",
    finalPriceAmount: "2475000",
    ...overrides,
  };
}

const customer: PosCustomerOption = {
  id: "customer-1",
  customerCode: "CUS-001",
  fullName: "Pelanggan Uji",
  phone: "081234567890",
  email: null,
  customerDepositBalanceAmount: "0",
  customerDepositBalance: 0,
  customerDepositLastLedgerEntryAt: null,
};

const pricingExample = buildPosCartItem(
  createItem({
    weightGram: "1",
    purityPercent: "30",
    activePricePerGram: "1010000",
  }),
  { discountAmount: 5_000, laborAmount: 35_000, adjustmentAmount: 10_000 },
);
assert.equal(pricingExample.status, "success");
if (pricingExample.status === "success") {
  assert.equal(pricingExample.item.priceSource, "global");
  assert.equal(pricingExample.item.basePriceAmount, "1010000");
  assert.equal(pricingExample.item.finalPriceAmount, "1050000");
}

const manualOverrideExample = buildPosCartItem(
  createItem({
    weightGram: "2",
    purityPercent: "30",
    activePricePerGram: "1000000",
  }),
  {
    pricePerGram: "1100000",
    discountAmount: 0,
    laborAmount: 0,
    adjustmentAmount: 0,
  },
);
assert.equal(manualOverrideExample.status, "success");
if (manualOverrideExample.status === "success") {
  assert.equal(manualOverrideExample.item.priceSource, "manual_override");
  assert.equal(manualOverrideExample.item.pricePerGram, "1100000");
  assert.equal(manualOverrideExample.item.basePriceAmount, "2200000");
}

const manualThenResetToGlobalExample = buildPosCartItem(
  createItem({
    weightGram: "2",
    purityPercent: "30",
    activePricePerGram: "1000000",
  }),
  {
    priceSource: "manual_override",
    pricePerGram: "1000000",
    discountAmount: 0,
    laborAmount: 0,
    adjustmentAmount: 0,
  },
);
assert.equal(manualThenResetToGlobalExample.status, "success");
if (manualThenResetToGlobalExample.status === "success") {
  assert.equal(manualThenResetToGlobalExample.item.priceSource, "global");
  assert.equal(manualThenResetToGlobalExample.item.pricePerGram, "1000000");
}

const missingGlobalRateExample = buildPosCartItem(
  createItem({
    weightGram: "1.5",
    purityPercent: "38",
    activePricePerGram: null,
  }),
  {
    pricePerGram: "1200000",
    discountAmount: 0,
    laborAmount: 0,
    adjustmentAmount: 0,
  },
);
assert.equal(missingGlobalRateExample.status, "success");
if (missingGlobalRateExample.status === "success") {
  assert.equal(missingGlobalRateExample.item.priceSource, "manual_override");
  assert.equal(missingGlobalRateExample.item.basePriceAmount, "1800000");
}

const firstItem = createItem();
const secondItem = createItem({
  id: "item-2",
  sku: "SKU-002",
  barcode: "899000000002",
  basePriceAmount: "1250000",
  discountAmount: "0",
  laborAmount: "0",
  adjustmentAmount: "0",
  finalPriceAmount: "1250000",
});

assert.equal(isStoredPosCartItem(firstItem), true);
assert.equal(isStoredPosCartItem({ id: "incomplete" }), false);
const legacyStoredItem: Partial<PosCartItem> = { ...firstItem };
delete legacyStoredItem.priceSource;
const legacyStoredState = parseStoredPosCartStateValue({
  version: 2,
  items: [legacyStoredItem],
  customer: null,
  updatedAt: "2026-08-20T00:00:00.000Z",
});
assert.equal(legacyStoredState?.items[0]?.priceSource, "global");

const itemIds = getPosCartItemIds([firstItem, secondItem]);
assert.equal(itemIds.has("item-1"), true);
assert.equal(itemIds.has("item-2"), true);
assert.deepEqual(getPosCartSummary([firstItem, secondItem]), {
  subtotalAmount: 3_750_000,
  discountAmount: 100_000,
  laborAmount: 50_000,
  adjustmentAmount: 25_000,
  totalAmount: 3_725_000,
});

assert.deepEqual(getPosCartAddIssue({ item: firstItem, itemIds }), {
  type: "duplicate",
  message:
    "SKU-001 sudah ada di keranjang. Gunakan Edit Harga jika ingin mengubah Harga/Gram, Diskon, Ongkos, atau Round.",
});
assert.equal(
  getPosCartAddIssue({
    item: createItem({ id: "item-3", sku: "SKU-003" }),
    itemIds,
  }),
  null,
);

const removedResult = removePosCartItem([firstItem, secondItem], "item-1");
assert.equal(removedResult.status, "removed");
assert.deepEqual(removedResult.items, [secondItem]);
assert.equal(removedResult.removedItem?.sku, "SKU-001");

const storedState = createStoredPosCartState({
  items: [firstItem],
  customer,
  updatedAt: "2026-08-02T07:00:00.000Z",
});
assert.equal(storedState.version, 2);
assert.deepEqual(parseStoredPosCartStateValue(storedState), storedState);
assert.equal(parseStoredPosCartStateValue({ version: 1, items: [firstItem] }), null);
assert.equal(
  parseStoredPosCartStateValue({ version: 2, items: [{ id: "invalid" }] }),
  null,
);

console.log("POS per-item cart pricing state and storage checks passed.");
