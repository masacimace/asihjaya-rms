import assert from "node:assert/strict";

import type { PosDiscountApproval } from "@/features/pos/contracts";
import type { PosPaymentDraft } from "@/features/pos/payment-draft";
import {
  getPosDiscountAvailability,
  getPosWorkspacePanelContent,
  getPosWorkspaceState,
} from "@/features/pos/workspace-state";

function createPaymentDraft(
  overrides: Partial<PosPaymentDraft> = {},
): PosPaymentDraft {
  return {
    id: "payment-1",
    method: "cash",
    methodLabel: "Cash",
    amount: 100_000,
    manualPaymentProfileId: null,
    manualPaymentProfileName: null,
    verificationConfirmed: false,
    receivedAmount: 100_000,
    changeAmount: 0,
    provider: null,
    reference: null,
    note: null,
    verificationSource: null,
    providerPaidAtIso: null,
    evidenceKey: null,
    evidenceFileName: null,
    verificationDetails: {},
    ...overrides,
  };
}

const approvedDiscount: PosDiscountApproval = {
  id: "discount-1",
  status: "approved",
  discountAmount: 50_000,
  reason: "Promo loyal customer",
  responseNotes: null,
  createdAtIso: "2026-08-02T10:00:00.000Z",
  resolvedAtIso: "2026-08-02T10:01:00.000Z",
};

assert.deepEqual(
  getPosDiscountAvailability({
    panelMode: "cart",
    itemCount: 1,
    paymentCount: 0,
    subtotalAmount: 500_000,
    discountApproval: null,
    hasRegister: true,
    hasActiveShift: true,
  }),
  {
    canRequestDiscount: true,
    discountDisabledReason: "Minta approval diskon manager/owner.",
  },
);

assert.deepEqual(
  getPosDiscountAvailability({
    panelMode: "payment",
    itemCount: 1,
    paymentCount: 1,
    subtotalAmount: 500_000,
    discountApproval: null,
    hasRegister: true,
    hasActiveShift: true,
  }),
  {
    canRequestDiscount: false,
    discountDisabledReason:
      "Diskon harus diajukan sebelum payment ditambahkan.",
  },
);

assert.deepEqual(
  getPosWorkspaceState({
    panelMode: "payment",
    itemCount: 2,
    subtotalAmount: 1_000_000,
    payments: [
      createPaymentDraft({ amount: 700_000 }),
      createPaymentDraft({
        id: "payment-2",
        amount: 200_000,
        receivedAmount: 225_000,
        changeAmount: 25_000,
      }),
    ],
    discountApproval: approvedDiscount,
    rawCustomerDepositUsedAmount: 100_000,
    rawCustomerDepositInAmount: 50_000,
    customerDepositBalance: 200_000,
    hasSelectedCustomer: true,
    hasRegister: true,
    hasActiveShift: true,
  }),
  {
    approvedDiscountAmount: 50_000,
    totalAmount: 950_000,
    hasPendingDiscountApproval: false,
    canRequestDiscount: false,
    discountDisabledReason:
      "Diskon harus diajukan sebelum payment ditambahkan.",
    customerDepositUsedAmount: 100_000,
    customerDepositInAmount: 50_000,
    externalPaymentDueAmount: 900_000,
    paidAmount: 900_000,
    remainingAmount: 0,
    totalChangeAmount: 25_000,
    canCheckout: true,
    checkoutDisabledReason: "Lanjutkan ke pembayaran manual.",
    canFinalizePayment: true,
  },
);

assert.deepEqual(
  getPosWorkspaceState({
    panelMode: "cart",
    itemCount: 1,
    subtotalAmount: 500_000,
    payments: [],
    discountApproval: {
      ...approvedDiscount,
      status: "pending",
    },
    rawCustomerDepositUsedAmount: 0,
    rawCustomerDepositInAmount: 0,
    customerDepositBalance: 0,
    hasSelectedCustomer: false,
    hasRegister: true,
    hasActiveShift: true,
  }),
  {
    approvedDiscountAmount: 0,
    totalAmount: 500_000,
    hasPendingDiscountApproval: true,
    canRequestDiscount: false,
    discountDisabledReason:
      "Selesaikan atau reset request diskon yang sedang aktif.",
    customerDepositUsedAmount: 0,
    customerDepositInAmount: 0,
    externalPaymentDueAmount: 500_000,
    paidAmount: 0,
    remainingAmount: 500_000,
    totalChangeAmount: 0,
    canCheckout: false,
    checkoutDisabledReason:
      "Request diskon masih pending. Cek status approval atau reset request.",
    canFinalizePayment: false,
  },
);

assert.equal(getPosWorkspacePanelContent("cart", false), "cart");
assert.equal(getPosWorkspacePanelContent("payment", false), "payment");
assert.equal(getPosWorkspacePanelContent("success", true), "success");
assert.equal(getPosWorkspacePanelContent("success", false), "cart");

console.log("OK: POS workspace composition-state contract passed.");
