import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PosDiscountApproval } from "@/features/pos/contracts";
import type { PosPaymentDraft } from "@/features/pos/payment-draft";
import {
  getPosDiscountAvailability,
  getPosWorkspacePanelContent,
  getPosWorkspaceState,
} from "@/features/pos/workspace-state";

const mobileSidePanelSource = readFileSync(
  resolve("src/components/pos/workspace/pos-mobile-side-panel.tsx"),
  "utf8",
);
const discountDialogSource = readFileSync(
  resolve("src/components/pos/workspace/pos-discount-approval-dialog.tsx"),
  "utf8",
);
const holdCartDialogSource = readFileSync(
  resolve("src/components/pos/workspace/pos-hold-cart-dialog.tsx"),
  "utf8",
);

assert.match(
  mobileSidePanelSource,
  /fixed inset-0 z-50 overflow-y-auto bg-white lg:hidden/,
  "POS mobile side panel harus tetap memakai layer dasar z-50.",
);
assert.match(
  discountDialogSource,
  /fixed inset-0 z-\[70\]/,
  "Dialog approval diskon harus berada di atas mobile side panel.",
);
assert.doesNotMatch(
  discountDialogSource,
  /fixed inset-0 z-50 flex items-end/,
  "Dialog approval diskon tidak boleh berbagi z-index dengan mobile side panel.",
);

assert.match(
  discountDialogSource,
  /fixed inset-0 z-\[70\] flex items-stretch justify-center/,
  "Dialog approval diskon harus memakai viewport penuh pada mobile.",
);
assert.match(
  discountDialogSource,
  /h-\[100dvh\] max-h-\[100dvh\].*sm:max-h-\[calc\(100dvh-3rem\)\]/,
  "Container dialog harus mengikuti dynamic viewport dan tetap dibatasi pada desktop.",
);
assert.match(
  discountDialogSource,
  /pt-\[calc\(1rem\+env\(safe-area-inset-top\)\)\]/,
  "Header dialog harus menghormati safe area bagian atas.",
);
assert.match(
  discountDialogSource,
  /scrollbar-clean min-h-0 flex-1 overflow-y-auto overscroll-contain/,
  "Hanya body dialog yang boleh menjadi area scroll utama.",
);
assert.match(
  discountDialogSource,
  /grid shrink-0 grid-cols-\[0\.85fr_1\.4fr\].*safe-area-inset-bottom/,
  "Action footer harus selalu terlihat, ringkas, dan menghormati safe area bawah.",
);
assert.match(
  discountDialogSource,
  /mt-3 space-y-2 sm:max-h-48 sm:overflow-y-auto/,
  "Daftar item tidak boleh membuat nested scroll pada mobile.",
);
assert.match(
  discountDialogSource,
  /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="pos-discount-approval-title"/,
  "Dialog approval harus memiliki semantic dialog yang dapat diakses.",
);
assert.doesNotMatch(
  discountDialogSource,
  /max-h-\[70vh\] overflow-y-auto/,
  "Body dialog tidak boleh memakai tinggi 70vh yang membuat total modal terpotong.",
);

assert.match(
  holdCartDialogSource,
  /fixed inset-0 z-60 flex items-stretch justify-center/,
  "Dialog hold cart harus memakai viewport penuh pada mobile dan tetap berada di atas mobile side panel.",
);
assert.match(
  holdCartDialogSource,
  /h-\[100dvh\] max-h-\[100dvh\].*sm:max-h-\[calc\(100dvh-3rem\)\]/,
  "Container hold cart harus mengikuti dynamic viewport dan tetap dibatasi pada desktop.",
);
assert.match(
  holdCartDialogSource,
  /pt-\[calc\(1rem\+env\(safe-area-inset-top\)\)\]/,
  "Header hold cart harus menghormati safe area bagian atas.",
);
assert.match(
  holdCartDialogSource,
  /scrollbar-clean min-h-0 flex-1 overflow-y-auto overscroll-contain/,
  "Hanya body hold cart yang boleh menjadi area scroll utama.",
);
assert.match(
  holdCartDialogSource,
  /grid shrink-0 grid-cols-\[0\.85fr_1\.4fr\].*safe-area-inset-bottom/,
  "Action footer hold cart harus selalu terlihat, ringkas, dan menghormati safe area bawah.",
);
assert.match(
  holdCartDialogSource,
  /mt-3 space-y-2 sm:max-h-48 sm:overflow-y-auto/,
  "Daftar item hold tidak boleh membuat nested scroll pada mobile.",
);
assert.match(
  holdCartDialogSource,
  /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="pos-hold-cart-title"/,
  "Dialog hold cart harus memiliki semantic dialog yang dapat diakses.",
);
assert.doesNotMatch(
  holdCartDialogSource,
  /max-h-\[70vh\] overflow-y-auto/,
  "Body hold cart tidak boleh memakai tinggi 70vh yang membuat total modal terpotong.",
);

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

console.log(
  "OK: POS workspace composition-state, layering, serta responsive discount dan hold cart dialog contract passed.",
);
