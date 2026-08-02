import type { PosCheckoutSaleResult } from "@/features/pos/contracts";

export type PosCheckoutReceiptViewState = {
  href: string;
  hasPrintJob: boolean;
  printJobShortId: string | null;
};

export function getPosCheckoutReceiptViewState(
  sale: PosCheckoutSaleResult,
): PosCheckoutReceiptViewState {
  const printJobId = sale.receiptCertificateJobId ?? null;

  return {
    href: `/api/sales/${sale.id}/receipt-certificate`,
    hasPrintJob: Boolean(printJobId),
    printJobShortId: printJobId?.slice(0, 8).toUpperCase() ?? null,
  };
}
