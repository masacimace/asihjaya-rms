import {
  publishNotificationEventInTransaction,
  resolveNotificationEventsByEntityInTransaction,
  type NotificationTransaction,
} from "@/features/notifications/event-service";

export type ReturnAwaitingReceiptNotificationInput = {
  organizationId: string;
  outletId: string;
  returnCaseId: string;
  saleId: string;
  invoiceNumber: string;
  itemCount: number;
  createdById: string;
  occurredAt: Date;
};

export type ReturnPendingInspectionNotificationInput = {
  organizationId: string;
  outletId: string;
  returnCaseId: string;
  saleId: string;
  invoiceNumber: string;
  itemCount: number;
  receivedById: string;
  occurredAt: Date;
};

export type ReturnCompletedNotificationInput = {
  organizationId: string;
  outletId: string;
  returnCaseId: string;
  saleId: string;
  invoiceNumber: string;
  itemCount: number;
  attentionItemCount: number;
  completedById: string;
  occurredAt: Date;
};

function returnPath(saleId: string) {
  return `/admin/penjualan/${saleId}/retur`;
}

export function publishReturnAwaitingReceiptNotificationInTransaction(
  transaction: NotificationTransaction,
  input: ReturnAwaitingReceiptNotificationInput,
) {
  return publishNotificationEventInTransaction(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "inventory_return",
    eventType: "return.awaiting_receipt",
    severity: "warning",
    title: "Barang retur menunggu penerimaan",
    summary: `${input.invoiceNumber} · ${input.itemCount} item harus diterima dan dipindai sebelum pemeriksaan.`,
    entityType: "sale_return_case",
    entityId: input.returnCaseId,
    actionUrl: returnPath(input.saleId),
    requiresAction: true,
    deduplicationKey: `return.awaiting_receipt:${input.returnCaseId}`,
    occurredAt: input.occurredAt,
    recipients: {
      requiredAnyPermissionCodes: ["returns.receive"],
    },
    payload: {
      returnCaseId: input.returnCaseId,
      saleId: input.saleId,
      invoiceNumber: input.invoiceNumber,
      itemCount: input.itemCount,
      createdById: input.createdById,
    },
  });
}

export async function publishReturnPendingInspectionNotificationInTransaction(
  transaction: NotificationTransaction,
  input: ReturnPendingInspectionNotificationInput,
) {
  await resolveNotificationEventsByEntityInTransaction(transaction, {
    organizationId: input.organizationId,
    category: "inventory_return",
    eventType: "return.awaiting_receipt",
    entityType: "sale_return_case",
    entityId: input.returnCaseId,
    resolvedAt: input.occurredAt,
  });

  return publishNotificationEventInTransaction(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "inventory_return",
    eventType: "return.pending_inspection",
    severity: "warning",
    title: "Barang retur siap diperiksa",
    summary: `${input.invoiceNumber} · seluruh ${input.itemCount} item sudah diterima dan menunggu keputusan pemeriksaan.`,
    entityType: "sale_return_case",
    entityId: input.returnCaseId,
    actionUrl: returnPath(input.saleId),
    requiresAction: true,
    deduplicationKey: `return.pending_inspection:${input.returnCaseId}`,
    occurredAt: input.occurredAt,
    recipients: {
      requiredAnyPermissionCodes: ["returns.inspect"],
    },
    payload: {
      returnCaseId: input.returnCaseId,
      saleId: input.saleId,
      invoiceNumber: input.invoiceNumber,
      itemCount: input.itemCount,
      receivedById: input.receivedById,
    },
  });
}

export async function publishReturnCompletedNotificationInTransaction(
  transaction: NotificationTransaction,
  input: ReturnCompletedNotificationInput,
) {
  await resolveNotificationEventsByEntityInTransaction(transaction, {
    organizationId: input.organizationId,
    category: "inventory_return",
    eventType: "return.pending_inspection",
    entityType: "sale_return_case",
    entityId: input.returnCaseId,
    resolvedAt: input.occurredAt,
  });

  const needsAttention = input.attentionItemCount > 0;

  return publishNotificationEventInTransaction(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "inventory_return",
    eventType: "return.completed",
    severity: needsAttention ? "warning" : "success",
    title: needsAttention
      ? "Pemeriksaan retur selesai dengan tindak lanjut"
      : "Pemeriksaan retur selesai",
    summary: needsAttention
      ? `${input.invoiceNumber} · ${input.attentionItemCount} dari ${input.itemCount} item memerlukan repair, penanganan rusak, atau pengembalian ke customer.`
      : `${input.invoiceNumber} · seluruh ${input.itemCount} item selesai diperiksa.`,
    entityType: "sale_return_case",
    entityId: input.returnCaseId,
    actionUrl: returnPath(input.saleId),
    requiresAction: needsAttention,
    deduplicationKey: `return.completed:${input.returnCaseId}`,
    occurredAt: input.occurredAt,
    recipients: {
      requiredAnyPermissionCodes: needsAttention
        ? ["returns.inspect", "inventory.manage"]
        : ["returns.view"],
    },
    payload: {
      returnCaseId: input.returnCaseId,
      saleId: input.saleId,
      invoiceNumber: input.invoiceNumber,
      itemCount: input.itemCount,
      attentionItemCount: input.attentionItemCount,
      completedById: input.completedById,
    },
  });
}
