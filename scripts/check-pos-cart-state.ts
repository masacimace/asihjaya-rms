import assert from "node:assert/strict";

import {
  getPosCartAddIssue,
  getPosCartItemIds,
  getPosCartSubtotal,
  removePosCartItem,
} from "@/features/pos/cart-state";
import {
  createStoredPosCartState,
  isStoredPosAvailableItem,
  parseStoredPosCartStateValue,
} from "@/features/pos/cart-storage";
import type {
  PosAvailableItem,
  PosCustomerOption,
} from "@/features/pos/contracts";

function createItem(
  overrides: Partial<PosAvailableItem> = {},
): PosAvailableItem {
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
    exchangePurityPercent: null,
    size: "17",
    color: "Kuning",
    gemstone: null,
    sellingAmount: "2500000",
    imageKey: null,
    productImageKey: null,
    outletId: "outlet-1",
    outletCode: "OUT-001",
    outletName: "Asihjaya Utama",
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

const firstItem = createItem();
const secondItem = createItem({
  id: "item-2",
  sku: "SKU-002",
  barcode: "899000000002",
  sellingAmount: "1250000",
});

assert.equal(isStoredPosAvailableItem(firstItem), true);
assert.equal(isStoredPosAvailableItem({ id: "incomplete" }), false);

const itemIds = getPosCartItemIds([firstItem, secondItem]);
assert.equal(itemIds.has("item-1"), true);
assert.equal(itemIds.has("item-2"), true);
assert.equal(getPosCartSubtotal([firstItem, secondItem]), 3_750_000);
assert.equal(
  getPosCartSubtotal([
    createItem({ sellingAmount: null }),
    createItem({ id: "invalid", sellingAmount: "not-a-number" }),
  ]),
  0,
);

assert.deepEqual(
  getPosCartAddIssue({ item: firstItem, itemIds }),
  {
    type: "duplicate",
    message: "SKU-001 sudah ada di keranjang.",
  },
);
assert.deepEqual(
  getPosCartAddIssue({
    item: createItem({
      id: "item-no-price",
      sku: "SKU-NO-PRICE",
      sellingAmount: null,
    }),
    itemIds,
  }),
  {
    type: "invalid_price",
    message:
      "SKU-NO-PRICE belum memiliki harga jual. Lengkapi harga sebelum transaksi.",
  },
);
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

const missingResult = removePosCartItem(
  [firstItem, secondItem],
  "missing-item",
);
assert.equal(missingResult.status, "not_found");
assert.deepEqual(missingResult.items, [firstItem, secondItem]);
assert.equal(missingResult.removedItem, null);

const storedState = createStoredPosCartState({
  items: [firstItem],
  customer,
  updatedAt: "2026-08-02T07:00:00.000Z",
});
assert.equal(storedState.version, 1);
assert.equal(storedState.updatedAt, "2026-08-02T07:00:00.000Z");

assert.deepEqual(
  parseStoredPosCartStateValue(storedState),
  storedState,
);
assert.deepEqual(
  parseStoredPosCartStateValue(
    {
      items: [firstItem, { id: "invalid" }],
      customer,
    },
    "2026-08-02T08:00:00.000Z",
  ),
  {
    version: 1,
    items: [firstItem],
    customer,
    updatedAt: "2026-08-02T08:00:00.000Z",
  },
);
assert.equal(
  parseStoredPosCartStateValue({ items: [], customer: null }),
  null,
);
assert.equal(parseStoredPosCartStateValue({ items: "invalid" }), null);

console.log("POS cart state and storage checks passed.");
