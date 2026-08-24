import assert from "node:assert/strict";

import type {
  PosCartItem,
  PosCustomerOption,
  PosHeldCartSummary,
} from "@/features/pos/contracts";
import {
  createQuickCustomerFormState,
  createQuickCustomerPayload,
  getCustomerContactLabel,
  getCustomerSearchText,
  mergeCustomerOptions,
  rememberCustomerOption,
  searchCustomerOptions,
} from "@/features/pos/customer-state";
import {
  createPendingHeldCartResumeState,
  getHeldCartAvailability,
  getHeldCartDraftValidationMessage,
  getHeldCartErrorMessage,
  parsePendingHeldCartResumeState,
} from "@/features/pos/held-cart-state";

function createCustomer(
  overrides: Partial<PosCustomerOption> = {},
): PosCustomerOption {
  return {
    id: "customer-1",
    customerCode: "CUS-001",
    fullName: "Pelanggan Uji",
    phone: "081234567890",
    email: "pelanggan@example.com",
    customerDepositBalanceAmount: "0",
    customerDepositBalance: 0,
    customerDepositLastLedgerEntryAt: null,
    ...overrides,
  };
}

function createItem(
  overrides: Partial<PosCartItem> = {},
): PosCartItem {
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
    transactionWeightGram: "2.500",
    purityPercent: "75",
    exchangePurityPercent: null,
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
    discountAmount: "0",
    laborAmount: "0",
    adjustmentAmount: "0",
    finalPriceAmount: "2500000",
    ...overrides,
  };
}

const baseCustomer = createCustomer();
const phoneForm = createQuickCustomerFormState(
  "Budi Santoso 0812 3456 7890",
);
assert.equal(phoneForm.fullName, "Budi Santoso");
assert.equal(phoneForm.phone, "0812 3456 7890");
assert.deepEqual(createQuickCustomerPayload(phoneForm), {
  fullName: "Budi Santoso",
  phone: "0812 3456 7890",
  email: null,
  notes: null,
});

const numericForm = createQuickCustomerFormState("081234567890");
assert.equal(numericForm.fullName, "");
assert.equal(numericForm.phone, "081234567890");
assert.equal(getCustomerContactLabel(createCustomer({ phone: null })), "pelanggan@example.com");
assert.equal(
  getCustomerSearchText(baseCustomer),
  "cus-001 pelanggan uji 081234567890 pelanggan@example.com",
);

const createdCustomer = createCustomer({
  fullName: "Pelanggan Uji Terbaru",
  customerDepositBalance: 25_000,
});
const secondCustomer = createCustomer({
  id: "customer-2",
  customerCode: "CUS-002",
  fullName: "Siti Emas",
  phone: "081298765432",
  email: null,
});
const mergedCustomers = mergeCustomerOptions({
  customers: [baseCustomer, secondCustomer],
  createdCustomers: [createdCustomer],
});
assert.equal(mergedCustomers.length, 2);
assert.equal(mergedCustomers[0]?.fullName, "Pelanggan Uji Terbaru");
assert.deepEqual(
  searchCustomerOptions({ customers: mergedCustomers, query: "siti" }),
  [secondCustomer],
);
assert.deepEqual(
  searchCustomerOptions({ customers: mergedCustomers, query: "CUS-001" }),
  [createdCustomer],
);
assert.deepEqual(
  rememberCustomerOption([baseCustomer, secondCustomer], secondCustomer),
  [secondCustomer, baseCustomer],
);

const heldCart: PosHeldCartSummary = {
  id: "held-cart-1",
  holdNumber: "HOLD-001",
  status: "active",
  title: "Pelanggan Uji",
  note: null,
  itemCount: 1,
  subtotalAmount: "2500000",
  discountAmount: "0",
  totalAmount: "2500000",
  createdAt: new Date("2026-08-02T07:00:00.000Z"),
  updatedAt: new Date("2026-08-02T07:00:00.000Z"),
  customer: baseCustomer,
  heldBy: {
    id: "user-1",
    fullName: "Kasir Uji",
  },
  shiftId: "shift-1",
  registerId: "register-1",
};
const heldItem = {
  ...createItem(),
  lineNumber: 1,
  listPriceAmount: "2500000",
  discountAmount: "0",
  finalPriceAmount: "2500000",
};

assert.deepEqual(
  createPendingHeldCartResumeState({
    heldCart,
    items: [heldItem],
    updatedAt: "2026-08-02T07:30:00.000Z",
  }),
  {
    version: 1,
    heldCart,
    items: [heldItem],
    updatedAt: "2026-08-02T07:30:00.000Z",
  },
);

assert.deepEqual(
  parsePendingHeldCartResumeState(
    {
      heldCart,
      items: [heldItem, { id: "invalid" }],
    },
    "2026-08-02T08:00:00.000Z",
  ),
  {
    version: 1,
    heldCart,
    items: [heldItem],
    updatedAt: "2026-08-02T08:00:00.000Z",
  },
);
assert.equal(
  parsePendingHeldCartResumeState({ heldCart, items: [] }),
  null,
);
assert.equal(parsePendingHeldCartResumeState({ items: [heldItem] }), null);

assert.deepEqual(
  getHeldCartAvailability({
    panelMode: "cart",
    itemCount: 1,
    paymentCount: 0,
    hasRegister: true,
    hasActiveShift: true,
  }),
  {
    canHoldCart: true,
    disabledReason: "Transaksi bisa ditahan.",
  },
);
assert.equal(
  getHeldCartAvailability({
    panelMode: "cart",
    itemCount: 0,
    paymentCount: 0,
    hasRegister: true,
    hasActiveShift: true,
  }).disabledReason,
  "Tambahkan minimal satu item sebelum transaksi bisa ditahan.",
);
assert.equal(
  getHeldCartAvailability({
    panelMode: "cart",
    itemCount: 1,
    paymentCount: 1,
    hasRegister: true,
    hasActiveShift: true,
  }).disabledReason,
  "Transaksi yang sudah memiliki payment tidak bisa ditahan. Reset payment terlebih dahulu.",
);
assert.equal(
  getHeldCartAvailability({
    panelMode: "payment",
    itemCount: 1,
    paymentCount: 0,
    hasRegister: true,
    hasActiveShift: true,
  }).canHoldCart,
  false,
);

assert.equal(
  getHeldCartDraftValidationMessage({ title: "a".repeat(161), note: "" }),
  "Nama hold maksimal 160 karakter.",
);
assert.equal(
  getHeldCartDraftValidationMessage({ title: "", note: "a".repeat(501) }),
  "Catatan hold maksimal 500 karakter.",
);
assert.equal(
  getHeldCartDraftValidationMessage({ title: "Valid", note: "Valid" }),
  null,
);
assert.equal(
  getHeldCartErrorMessage({
    status: "error",
    message: "Hold gagal.",
    fieldErrors: {
      itemIds: "Item tidak tersedia.",
      note: "Catatan tidak valid.",
    },
  }),
  "Hold gagal. Item tidak tersedia. Catatan tidak valid.",
);

console.log("POS customer selection and held-cart checks passed.");
