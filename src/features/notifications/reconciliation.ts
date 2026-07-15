import {
  publishNotificationEventInTransaction,
  resolveNotificationEventsByEntityInTransaction,
  type NotificationTransaction,
} from "@/features/notifications/event-service";

export type PaymentReconciliationNotificationInput = {
  organizationId: string;
  outletId: string;
  paymentId: string;
  saleId: string;
  status:
    | "pending_settlement"
    | "reconciled"
    | "mismatch"
    | "not_found"
    | "waived";
  expectedAmount: number;
  settlementGrossAmount: number | null;
  differenceAmount: number;
  settlementReference: string | null;
  notes: string | null;
  actorUserId: string;
  occurredAt: Date;
};

export type SettlementImportCompletedNotificationInput = {
  organizationId: string;
  outletId: string;
  batchId: string;
  uploadedById: string;
  fileName: string;
  rowCount: number;
  appliedCount: number;
  ambiguousCount: number;
  mismatchCount: number;
  notFoundCount: number;
  duplicateCount: number;
  failedCount: number;
  unresolvedCount: number;
  occurredAt: Date;
};

function formatIdr(amount: number) {
  return `Rp${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

async function resolvePaymentIssueNotification(
  transaction: NotificationTransaction,
  input: PaymentReconciliationNotificationInput,
  eventType:
    | "payment.reconciliation_mismatch"
    | "payment.reconciliation_not_found",
) {
  return resolveNotificationEventsByEntityInTransaction(transaction, {
    organizationId: input.organizationId,
    category: "payment",
    eventType,
    entityType: "payment",
    entityId: input.paymentId,
    resolvedAt: input.occurredAt,
  });
}

export async function syncPaymentReconciliationNotificationInTransaction(
  transaction: NotificationTransaction,
  input: PaymentReconciliationNotificationInput,
) {
  if (input.status === "mismatch") {
    await resolvePaymentIssueNotification(
      transaction,
      input,
      "payment.reconciliation_not_found",
    );
  } else if (input.status === "not_found") {
    await resolvePaymentIssueNotification(
      transaction,
      input,
      "payment.reconciliation_mismatch",
    );
  } else {
    await resolvePaymentIssueNotification(
      transaction,
      input,
      "payment.reconciliation_mismatch",
    );
    await resolvePaymentIssueNotification(
      transaction,
      input,
      "payment.reconciliation_not_found",
    );
    return null;
  }

  const isMismatch = input.status === "mismatch";
  const differenceText =
    input.settlementGrossAmount == null
      ? "Settlement tidak ditemukan."
      : `Selisih ${formatIdr(Math.abs(input.differenceAmount))} dari payment POS.`;

  return publishNotificationEventInTransaction(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "payment",
    eventType: isMismatch
      ? "payment.reconciliation_mismatch"
      : "payment.reconciliation_not_found",
    severity: isMismatch ? "critical" : "warning",
    title: isMismatch
      ? "Settlement mismatch"
      : "Payment tidak ditemukan di settlement",
    summary: `${differenceText}${input.notes ? ` ${input.notes}` : ""}`,
    entityType: "payment",
    entityId: input.paymentId,
    actionUrl: `/admin/keuangan/rekonsiliasi/${input.paymentId}`,
    requiresAction: true,
    deduplicationKey: `payment.reconciliation_${input.status}:${input.paymentId}`,
    occurredAt: input.occurredAt,
    recipients: {
      requiredAnyPermissionCodes: ["payments.reconciliation.resolve"],
    },
    payload: {
      paymentId: input.paymentId,
      saleId: input.saleId,
      status: input.status,
      expectedAmount: String(input.expectedAmount),
      settlementGrossAmount:
        input.settlementGrossAmount == null
          ? null
          : String(input.settlementGrossAmount),
      differenceAmount: String(input.differenceAmount),
      settlementReference: input.settlementReference,
      notes: input.notes,
      actorUserId: input.actorUserId,
    },
  });
}

export async function syncSettlementImportCompletedNotificationInTransaction(
  transaction: NotificationTransaction,
  input: SettlementImportCompletedNotificationInput,
) {
  const hasIssues = input.unresolvedCount > 0;

  if (!hasIssues) {
    await resolveNotificationEventsByEntityInTransaction(transaction, {
      organizationId: input.organizationId,
      category: "payment",
      eventType: "settlement_import.completed_with_issues",
      entityType: "settlement_import_batch",
      entityId: input.batchId,
      resolvedAt: input.occurredAt,
    });
  }
  const issueSummary = [
    input.ambiguousCount > 0 ? `${input.ambiguousCount} ambigu` : null,
    input.mismatchCount > 0 ? `${input.mismatchCount} mismatch` : null,
    input.notFoundCount > 0 ? `${input.notFoundCount} tidak ditemukan` : null,
    input.duplicateCount > 0 ? `${input.duplicateCount} duplikat` : null,
    input.failedCount > 0 ? `${input.failedCount} gagal` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return publishNotificationEventInTransaction(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "payment",
    eventType: hasIssues
      ? "settlement_import.completed_with_issues"
      : "settlement_import.completed",
    severity: hasIssues ? "warning" : "success",
    title: hasIssues
      ? "Import settlement selesai dengan issue"
      : "Import settlement selesai",
    summary: hasIssues
      ? `${input.fileName} · ${input.appliedCount} baris diterapkan, ${issueSummary || `${input.unresolvedCount} baris perlu ditinjau`}.`
      : `${input.fileName} · seluruh ${input.rowCount} baris selesai diproses.`,
    entityType: "settlement_import_batch",
    entityId: input.batchId,
    actionUrl: `/admin/keuangan/rekonsiliasi/import/${input.batchId}`,
    requiresAction: hasIssues,
    deduplicationKey: hasIssues
      ? `settlement_import.completed_with_issues:${input.batchId}`
      : `settlement_import.completed:${input.batchId}`,
    occurredAt: input.occurredAt,
    recipients: {
      userIds: [input.uploadedById],
      requiredAnyPermissionCodes: hasIssues
        ? [
            "payments.reconciliation.import",
            "payments.reconciliation.resolve",
          ]
        : ["payments.reconciliation.import"],
    },
    payload: {
      batchId: input.batchId,
      fileName: input.fileName,
      rowCount: input.rowCount,
      appliedCount: input.appliedCount,
      ambiguousCount: input.ambiguousCount,
      mismatchCount: input.mismatchCount,
      notFoundCount: input.notFoundCount,
      duplicateCount: input.duplicateCount,
      failedCount: input.failedCount,
      unresolvedCount: input.unresolvedCount,
      uploadedById: input.uploadedById,
    },
  });
}
