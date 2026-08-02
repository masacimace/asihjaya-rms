import assert from "node:assert/strict";

import type { PosCheckoutSaleResult } from "@/features/pos/contracts";
import { getPosCheckoutReceiptViewState } from "@/features/pos/checkout-result-state";
import { formatCurrency } from "@/features/pos/payment-draft";
import {
  formatPosShiftOpenedAt,
  getPosShiftCashReconciliation,
} from "@/features/pos/shift-view-state";

const saleWithoutPrintJob: PosCheckoutSaleResult = {
  id: "sale-1",
  invoiceNumber: "INV-001",
  totalAmount: "2500000",
  receiptCertificateJobId: null,
};

assert.deepEqual(getPosCheckoutReceiptViewState(saleWithoutPrintJob), {
  href: "/api/sales/sale-1/receipt-certificate",
  hasPrintJob: false,
  printJobShortId: null,
});

assert.deepEqual(
  getPosCheckoutReceiptViewState({
    ...saleWithoutPrintJob,
    receiptCertificateJobId: "abcdef12-3456-7890-abcd-ef1234567890",
  }),
  {
    href: "/api/sales/sale-1/receipt-certificate",
    hasPrintJob: true,
    printJobShortId: "ABCDEF12",
  },
);

assert.deepEqual(
  getPosShiftCashReconciliation({
    expectedCash: "100000",
    actualCashAmount: null,
  }),
  {
    expectedCashAmount: 100000,
    cashVarianceAmount: null,
    cashVarianceLabel:
      "Input nominal uang cash aktual untuk melihat selisih.",
    tone: "neutral",
  },
);

assert.deepEqual(
  getPosShiftCashReconciliation({
    expectedCash: "100000",
    actualCashAmount: 100000,
  }),
  {
    expectedCashAmount: 100000,
    cashVarianceAmount: 0,
    cashVarianceLabel: formatCurrency(0),
    tone: "balanced",
  },
);

assert.deepEqual(
  getPosShiftCashReconciliation({
    expectedCash: "100000",
    actualCashAmount: 125000,
  }),
  {
    expectedCashAmount: 100000,
    cashVarianceAmount: 25000,
    cashVarianceLabel: `+${formatCurrency(25000)}`,
    tone: "surplus",
  },
);

assert.deepEqual(
  getPosShiftCashReconciliation({
    expectedCash: "100000",
    actualCashAmount: 90000,
  }),
  {
    expectedCashAmount: 100000,
    cashVarianceAmount: -10000,
    cashVarianceLabel: `-${formatCurrency(10000)}`,
    tone: "shortage",
  },
);

assert.equal(
  formatPosShiftOpenedAt("not-a-date"),
  "waktu tidak diketahui",
);

const openedAt = new Date(2026, 7, 2, 9, 5, 0);
assert.equal(
  formatPosShiftOpenedAt(openedAt),
  new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(openedAt),
);

console.log("OK: POS checkout result and shift view-state contract passed.");
