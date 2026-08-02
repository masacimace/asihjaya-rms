import assert from "node:assert/strict";

import type {
  PosCustomerOption,
  PosQuickCustomerActionResult,
} from "@/features/pos/contracts";
import {
  getDiscountApprovalDialogState,
  getQuickCustomerDialogState,
} from "@/features/pos/dialog-state";

const duplicateCustomer: PosCustomerOption = {
  id: "customer-1",
  customerCode: "CUS-001",
  fullName: "Pelanggan Uji",
  phone: "081234567890",
  email: "pelanggan@example.com",
  customerDepositBalanceAmount: "0",
  customerDepositBalance: 0,
  customerDepositLastLedgerEntryAt: null,
};

const errorResult: PosQuickCustomerActionResult = {
  status: "error",
  message: "Data customer belum valid.",
  fieldErrors: {
    fullName: "Nama wajib diisi.",
    phone: "Nomor telepon wajib diisi.",
  },
};
const errorState = getQuickCustomerDialogState(errorResult);
assert.deepEqual(errorState.fieldErrors, errorResult.fieldErrors);
assert.equal(errorState.duplicateCustomer, null);

const duplicateResult: PosQuickCustomerActionResult = {
  status: "duplicate",
  message: "Customer sudah terdaftar.",
  customer: duplicateCustomer,
};
const duplicateState = getQuickCustomerDialogState(duplicateResult);
assert.equal(duplicateState.fieldErrors, null);
assert.equal(duplicateState.duplicateCustomer, duplicateCustomer);

assert.deepEqual(getQuickCustomerDialogState(null), {
  fieldErrors: null,
  duplicateCustomer: null,
});

assert.deepEqual(
  getDiscountApprovalDialogState({
    subtotalAmount: 2_500_000,
    amountInput: "Rp250.000",
  }),
  {
    parsedDiscountAmount: 250_000,
    projectedTotalAmount: 2_250_000,
    discountIsTooHigh: false,
  },
);

assert.deepEqual(
  getDiscountApprovalDialogState({
    subtotalAmount: 2_500_000,
    amountInput: "2.500.000",
  }),
  {
    parsedDiscountAmount: 2_500_000,
    projectedTotalAmount: 0,
    discountIsTooHigh: true,
  },
);

assert.deepEqual(
  getDiscountApprovalDialogState({
    subtotalAmount: 0,
    amountInput: "100.000",
  }),
  {
    parsedDiscountAmount: 100_000,
    projectedTotalAmount: 0,
    discountIsTooHigh: false,
  },
);

console.log("OK: POS dialog derived-state contract passed.");
