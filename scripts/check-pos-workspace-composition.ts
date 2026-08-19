import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PosPaymentDraft } from "@/features/pos/payment-draft";
import { getPosWorkspacePanelContent, getPosWorkspaceState } from "@/features/pos/workspace-state";

const mobileSidePanelSource = readFileSync(resolve("src/components/pos/workspace/pos-mobile-side-panel.tsx"), "utf8");
const pricingDialogSource = readFileSync(resolve("src/components/pos/workspace/pos-item-pricing-dialog.tsx"), "utf8");
const holdCartDialogSource = readFileSync(resolve("src/components/pos/workspace/pos-hold-cart-dialog.tsx"), "utf8");

assert.match(mobileSidePanelSource, /fixed inset-0 z-50 overflow-y-auto bg-white lg:hidden/);
assert.match(pricingDialogSource, /fixed inset-0 z-\[75\] flex items-stretch justify-center/);
assert.match(pricingDialogSource, /aria-labelledby="pos-item-pricing-title"/);
assert.match(pricingDialogSource, /Harga \/ Gram Aktif/);
assert.match(pricingDialogSource, /Diskon/);
assert.match(pricingDialogSource, /Ongkos/);
assert.match(pricingDialogSource, /Round/);
assert.match(holdCartDialogSource, /fixed inset-0 z-60 flex items-stretch justify-center/);

function payment(overrides: Partial<PosPaymentDraft> = {}): PosPaymentDraft {
  return {
    id: "payment-1",
    method: "cash",
    methodLabel: "Cash",
    amount: 900_000,
    manualPaymentProfileId: null,
    manualPaymentProfileName: null,
    verificationConfirmed: false,
    receivedAmount: 900_000,
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

assert.deepEqual(
  getPosWorkspaceState({
    panelMode: "payment",
    itemCount: 2,
    totalAmount: 950_000,
    payments: [payment()],
    rawCustomerDepositUsedAmount: 100_000,
    rawCustomerDepositInAmount: 50_000,
    customerDepositBalance: 200_000,
    hasSelectedCustomer: true,
    hasRegister: true,
    hasActiveShift: true,
  }),
  {
    customerDepositUsedAmount: 100_000,
    customerDepositInAmount: 50_000,
    externalPaymentDueAmount: 900_000,
    paidAmount: 900_000,
    remainingAmount: 0,
    totalChangeAmount: 0,
    canCheckout: true,
    checkoutDisabledReason: "Lanjutkan ke pembayaran.",
    canFinalizePayment: true,
  },
);

assert.equal(getPosWorkspacePanelContent("cart", false), "cart");
assert.equal(getPosWorkspacePanelContent("payment", false), "payment");
assert.equal(getPosWorkspacePanelContent("success", true), "success");

console.log("OK: POS workspace transaction-pricing composition contracts passed.");
