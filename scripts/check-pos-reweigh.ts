import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { PosCheckoutPayload } from "@/features/pos/contracts";
import { createPosCheckoutRequestFingerprint } from "@/features/pos/checkout-fingerprint";
import {
  buildPosCartItem,
  getPosWeightSource,
  normalizePosTransactionWeight,
} from "@/features/pos/transaction-pricing";

assert.equal(normalizePosTransactionWeight("2,15"), "2.150");
assert.equal(normalizePosTransactionWeight("2.125"), "2.125");
assert.equal(normalizePosTransactionWeight("0"), null);
assert.equal(normalizePosTransactionWeight("2.1234"), null);
assert.equal(
  getPosWeightSource({
    storedWeightGram: "2.120",
    transactionWeightGram: "2.12",
  }),
  "stored",
);
assert.equal(
  getPosWeightSource({
    storedWeightGram: "2.120",
    transactionWeightGram: "2.150",
  }),
  "reweighed",
);
assert.equal(
  getPosWeightSource({
    storedWeightGram: null,
    transactionWeightGram: "1.875",
  }),
  "reweighed",
);

const baseItem = {
  id: "item-1",
  sku: "SKU-001",
  barcode: "899000000001",
  qrValue: null,
  serialNumber: null,
  productId: "product-1",
  productCode: "PRD-001",
  productName: "Cincin Uji",
  categoryId: "category-1",
  categoryName: "Cincin",
  weightGram: "2.120",
  purityPercent: "30",
  exchangePurityPercent: "35",
  size: null,
  color: "Poles",
  gemstone: null,
  deductionPerGram: "0",
  sellingAmount: null,
  activePricePerGram: "1000000",
  imageKey: null,
  productImageKey: null,
  outletId: "outlet-1",
  outletCode: "OUT-1",
  outletName: "Outlet Uji",
};

const reweighed = buildPosCartItem(baseItem, {
  transactionWeightGram: "2,150",
  pricePerGram: "1000000",
  discountAmount: 50_000,
  laborAmount: 25_000,
  adjustmentAmount: 5_000,
});
assert.equal(reweighed.status, "success");
if (reweighed.status === "success") {
  assert.equal(reweighed.item.weightGram, "2.120");
  assert.equal(reweighed.item.transactionWeightGram, "2.150");
  assert.equal(reweighed.item.basePriceAmount, "2150000");
  assert.equal(reweighed.item.finalPriceAmount, "2130000");
}

const missingStored = buildPosCartItem(
  { ...baseItem, weightGram: null },
  {
    transactionWeightGram: "1.875",
    pricePerGram: "1000000",
    discountAmount: 0,
    laborAmount: 0,
    adjustmentAmount: 0,
  },
);
assert.equal(missingStored.status, "success");

const context = {
  organizationId: "org-1",
  outletId: "outlet-1",
  registerId: "register-1",
  shiftId: "shift-1",
  cashierId: "cashier-1",
};
const payload: PosCheckoutPayload = {
  itemIds: ["item-1"],
  itemPricing: [
    {
      itemId: "item-1",
      transactionWeightGram: "2.120",
      priceSource: "global",
      pricePerGram: "1000000",
      discountAmount: 0,
      laborAmount: 0,
      adjustmentAmount: 0,
    },
  ],
  payments: [{ method: "cash", amount: 2_120_000 }],
  idempotencyKey: "pos_reweigh01",
};
const originalFingerprint = createPosCheckoutRequestFingerprint({ context, payload });
const changedFingerprint = createPosCheckoutRequestFingerprint({
  context,
  payload: {
    ...payload,
    itemPricing: payload.itemPricing.map((item) => ({
      ...item,
      transactionWeightGram: "2.150",
    })),
  },
});
assert.notEqual(originalFingerprint, changedFingerprint);

const [dialogSource, actionSource, heldQuerySource] = await Promise.all([
  readFile("src/components/pos/workspace/pos-item-pricing-dialog.tsx", "utf8"),
  readFile("src/app/actions/pos.ts", "utf8"),
  readFile("src/features/pos/queries.ts", "utf8"),
]);

assert.ok(dialogSource.includes("Berat Transaksi"));
assert.ok(dialogSource.includes("Ditimbang ulang"));
assert.ok(dialogSource.includes("transactionWeightGram"));
assert.ok(actionSource.includes('action: "product_item.weight_reweighed_at_sale"'));
assert.ok(actionSource.includes("weightGram: pricing.transactionWeightGram"));
assert.ok(actionSource.includes("storedWeightGram: pricing.storedWeightGram"));
assert.ok(actionSource.includes("transactionWeightGram: pricing.transactionWeightGram"));
assert.ok(actionSource.includes("const totalWeightGram = resolvedPricing.reduce"));
assert.ok(heldQuerySource.includes("posHeldCartItems.snapshot}->>'weightGram'"));
assert.ok(
  heldQuerySource.includes("cast(${productItems.weightGram} as text)"),
  "Held Cart query must cast numeric stored weight to text before COALESCE with JSON text.",
);

console.log("POS transaction reweigh contracts passed.");
