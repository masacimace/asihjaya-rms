import {
  publishNotificationEventInTransaction,
  type NotificationTransaction,
} from "@/features/notifications/event-service";

export type SaleReversalCompletedNotificationInput = {
  organizationId: string;
  outletId: string;
  saleId: string;
  invoiceNumber: string;
  kind: "void" | "refund";
  executedById: string;
  totalAmount: number;
  cashRefundAmount: number;
  paymentRefundCount: number;
  returnCaseId: string | null;
  pendingReturnItemCount: number;
  occurredAt: Date;
};

export function publishSaleReversalCompletedNotificationInTransaction(
  transaction: NotificationTransaction,
  input: SaleReversalCompletedNotificationInput,
) {
  const isVoid = input.kind === "void";

  return publishNotificationEventInTransaction(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "sales",
    eventType: isVoid ? "sale.void_completed" : "sale.refund_completed",
    severity: "success",
    title: isVoid ? "Transaksi berhasil dibatalkan" : "Refund berhasil diproses",
    summary: isVoid
      ? `${input.invoiceNumber} sudah dibatalkan oleh user berizin.`
      : `${input.invoiceNumber} sudah diproses sebagai refund penuh.`,
    entityType: "sale",
    entityId: input.saleId,
    actionUrl: `/admin/penjualan/${input.saleId}`,
    requiresAction: false,
    deduplicationKey: `${isVoid ? "sale.void_completed" : "sale.refund_completed"}:${input.saleId}`,
    occurredAt: input.occurredAt,
    recipients: {
      userIds: [input.executedById],
    },
    payload: {
      saleId: input.saleId,
      invoiceNumber: input.invoiceNumber,
      kind: input.kind,
      executedById: input.executedById,
      totalAmount: input.totalAmount,
      cashRefundAmount: input.cashRefundAmount,
      paymentRefundCount: input.paymentRefundCount,
      returnCaseId: input.returnCaseId,
      pendingReturnItemCount: input.pendingReturnItemCount,
      source: "admin.sales.direct_correction",
    },
  });
}
