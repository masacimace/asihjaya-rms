import assert from "node:assert/strict";

import {
  createPosCheckoutRequestFingerprint,
  isValidPosCheckoutIdempotencyKey,
} from "@/features/pos/checkout-fingerprint";
import { type PosCheckoutPayload } from "@/features/pos/contracts";

const context = {
  organizationId: "org-1",
  outletId: "outlet-1",
  registerId: "register-1",
  shiftId: "shift-1",
  cashierId: "cashier-1",
};

const basePayload: PosCheckoutPayload = {
  itemIds: ["item-b", "item-a"],
  payments: [
    {
      method: "cash",
      amount: 1_000_000,
      receivedAmount: 1_000_000,
      changeAmount: 0,
    },
  ],
  idempotencyKey: "pos_12345678",
  customerId: "customer-1",
  discountAmount: 0,
};

const baseFingerprint = createPosCheckoutRequestFingerprint({
  context,
  payload: basePayload,
});

assert.equal(
  baseFingerprint,
  createPosCheckoutRequestFingerprint({
    context,
    payload: {
      ...basePayload,
      itemIds: ["item-a", "item-b"],
      idempotencyKey: "pos_different_key",
    },
  }),
  "Urutan item dan idempotency key tidak boleh mengubah fingerprint intent.",
);

assert.notEqual(
  baseFingerprint,
  createPosCheckoutRequestFingerprint({
    context,
    payload: {
      ...basePayload,
      payments: [
        {
          method: "cash",
          amount: 999_999,
          receivedAmount: 999_999,
          changeAmount: 0,
        },
      ],
    },
  }),
  "Perubahan nominal payment wajib mengubah fingerprint.",
);

assert.notEqual(
  baseFingerprint,
  createPosCheckoutRequestFingerprint({
    context: { ...context, shiftId: "shift-2" },
    payload: basePayload,
  }),
  "Perubahan shift wajib mengubah fingerprint.",
);

assert.equal(isValidPosCheckoutIdempotencyKey("pos_12345678"), true);
assert.equal(isValidPosCheckoutIdempotencyKey("bad"), false);
assert.equal(
  isValidPosCheckoutIdempotencyKey(`pos_${"a".repeat(117)}`),
  false,
);

console.log("P0-D checkout fingerprint dan idempotency smoke test berhasil.");
