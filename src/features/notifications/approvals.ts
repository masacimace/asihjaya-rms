import type { ApprovalType } from "@/features/approvals/contracts";
import {
  getSaleSensitivePermission,
  type SaleSensitiveAction,
} from "@/features/approvals/authorization";
import {
  publishNotificationEvent,
  publishNotificationEventInTransaction,
  resolveNotificationEventsByEntityInTransaction,
  type NotificationTransaction,
} from "@/features/notifications/event-service";

const APPROVAL_DASHBOARD_PATH = "/admin/operasional/approval";

type ApprovalResolutionStatus = "approved" | "rejected";

export type ApprovalResolutionNotificationInput = {
  organizationId: string;
  outletId: string | null;
  approvalId: string;
  approvalType: ApprovalType;
  status: ApprovalResolutionStatus;
  requestedById: string;
  resolvedById: string;
  responseNotes: string | null;
  referenceType: string | null;
  referenceId: string | null;
  requestData: Record<string, unknown>;
  occurredAt: Date;
};

export type SaleReversalCompletedNotificationInput = {
  organizationId: string;
  outletId: string;
  approvalId: string;
  kind: "void" | "refund";
  requestedById: string;
  approvedById: string;
  executedById: string;
  saleId: string;
  invoiceNumber: string;
  totalAmount: number;
  cashRefundAmount: number;
  paymentRefundCount: number;
  returnCaseId: string | null;
  pendingReturnItemCount: number;
  occurredAt: Date;
};

export type ApprovalExecutionFailedNotificationInput = {
  organizationId: string;
  outletId: string;
  approvalId: string;
  kind: "void" | "refund";
  requestedById: string;
  approvedById: string | null;
  executedById: string;
  saleId: string;
  invoiceNumber: string;
  errorMessage: string;
  occurredAt?: Date;
};

function formatIdr(amount: number) {
  return `Rp${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function approvalTypeLabel(type: ApprovalType) {
  if (type === "discount") return "Diskon transaksi";
  if (type === "void_receipt") return "Pembatalan transaksi";
  if (type === "refund_transaction") return "Refund transaksi";
  if (type === "manual_payment_verification") {
    return "Verifikasi pembayaran manual";
  }
  if (type === "stock_adjustment") return "Penyesuaian inventaris";
  return "Permintaan operasional";
}

function actionUrlForApproval(input: ApprovalResolutionNotificationInput) {
  if (input.referenceType === "sale" && input.referenceId) {
    return `/admin/penjualan/${input.referenceId}`;
  }

  if (input.approvalType === "manual_payment_verification") {
    return "/pos";
  }

  return APPROVAL_DASHBOARD_PATH;
}

function createSafeApprovalSnapshot(requestData: Record<string, unknown>) {
  const allowedKeys = [
    "invoiceNumber",
    "outletName",
    "registerName",
    "requesterName",
    "reason",
    "reasonLabel",
    "totalAmount",
    "impactAmount",
    "discountAmount",
    "itemCount",
    "paymentMethodsLabel",
    "profileName",
    "provider",
    "verificationSource",
  ] as const;
  const snapshot: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    const value = requestData[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      snapshot[key] = value;
    }
  }

  return snapshot;
}

function getSensitiveAction(
  approvalType: ApprovalType,
): SaleSensitiveAction | null {
  if (approvalType === "void_receipt") return "void";
  if (approvalType === "refund_transaction") return "refund";
  return null;
}

export function publishApprovalResolutionNotificationInTransaction(
  transaction: NotificationTransaction,
  input: ApprovalResolutionNotificationInput,
) {
  const label = approvalTypeLabel(input.approvalType);
  const sensitiveAction = getSensitiveAction(input.approvalType);
  const isExecutionReady = input.status === "approved" && sensitiveAction;
  const eventType = isExecutionReady
    ? "approval.execution_ready"
    : input.status === "approved"
      ? "approval.approved"
      : "approval.rejected";
  const title = isExecutionReady
    ? `${label} siap dieksekusi`
    : input.status === "approved"
      ? `${label} disetujui`
      : `${label} ditolak`;
  const responseText = input.responseNotes?.trim()
    ? ` Catatan: ${input.responseNotes.trim()}`
    : "";
  const summary = isExecutionReady
    ? `${label} telah disetujui dan menunggu eksekusi.${responseText}`
    : `${label} telah ${input.status === "approved" ? "disetujui" : "ditolak"}.${responseText}`;

  return publishNotificationEventInTransaction(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "approval_result",
    eventType,
    severity:
      input.status === "rejected"
        ? "warning"
        : isExecutionReady
          ? "warning"
          : "success",
    title,
    summary,
    entityType: "approval",
    entityId: input.approvalId,
    actionUrl: actionUrlForApproval(input),
    requiresAction: Boolean(isExecutionReady),
    deduplicationKey: `${eventType}:${input.approvalId}`,
    occurredAt: input.occurredAt,
    recipients: isExecutionReady
      ? {
          userIds: [input.requestedById],
          requiredAnyPermissionCodes: [
            getSaleSensitivePermission(sensitiveAction, "execute"),
          ],
        }
      : {
          userIds: [input.requestedById],
        },
    payload: {
      approvalId: input.approvalId,
      approvalType: input.approvalType,
      status: input.status,
      requestedById: input.requestedById,
      resolvedById: input.resolvedById,
      responseNotes: input.responseNotes,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      requestSnapshot: createSafeApprovalSnapshot(input.requestData),
      executionRequired: Boolean(isExecutionReady),
    },
  });
}

export async function publishSaleReversalCompletedNotificationInTransaction(
  transaction: NotificationTransaction,
  input: SaleReversalCompletedNotificationInput,
) {
  await resolveNotificationEventsByEntityInTransaction(transaction, {
    organizationId: input.organizationId,
    category: "approval_result",
    eventType: "approval.execution_ready",
    entityType: "approval",
    entityId: input.approvalId,
    resolvedAt: input.occurredAt,
  });
  await resolveNotificationEventsByEntityInTransaction(transaction, {
    organizationId: input.organizationId,
    category: "approval_result",
    eventType: "approval.execution_failed",
    entityType: "approval",
    entityId: input.approvalId,
    resolvedAt: input.occurredAt,
  });

  const isRefund = input.kind === "refund";
  const title = isRefund
    ? "Refund transaksi berhasil"
    : "Void transaksi berhasil";
  const returnText =
    isRefund && input.pendingReturnItemCount > 0
      ? ` ${input.pendingReturnItemCount} item menunggu penerimaan fisik.`
      : "";

  return publishNotificationEventInTransaction(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "approval_result",
    eventType: isRefund ? "approval.refund_completed" : "approval.void_completed",
    severity: "success",
    title,
    summary: `${input.invoiceNumber} · ${formatIdr(input.totalAmount)} berhasil ${isRefund ? "direfund" : "dibatalkan"}.${returnText}`,
    entityType: "approval",
    entityId: input.approvalId,
    actionUrl: `/admin/penjualan/${input.saleId}`,
    requiresAction: false,
    deduplicationKey: `approval.${input.kind}_completed:${input.approvalId}`,
    occurredAt: input.occurredAt,
    recipients: {
      userIds: [
        input.requestedById,
        input.approvedById,
        input.executedById,
      ],
    },
    payload: {
      approvalId: input.approvalId,
      kind: input.kind,
      saleId: input.saleId,
      invoiceNumber: input.invoiceNumber,
      totalAmount: String(input.totalAmount),
      cashRefundAmount: String(input.cashRefundAmount),
      paymentRefundCount: input.paymentRefundCount,
      returnCaseId: input.returnCaseId,
      pendingReturnItemCount: input.pendingReturnItemCount,
      requestedById: input.requestedById,
      approvedById: input.approvedById,
      executedById: input.executedById,
    },
  });
}

export function publishApprovalExecutionFailedNotification(
  input: ApprovalExecutionFailedNotificationInput,
) {
  const isRefund = input.kind === "refund";
  const recipientIds = [
    input.requestedById,
    input.approvedById,
    input.executedById,
  ].filter((value): value is string => Boolean(value));

  return publishNotificationEvent({
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "approval_result",
    eventType: "approval.execution_failed",
    severity: "critical",
    title: isRefund ? "Eksekusi refund gagal" : "Eksekusi void gagal",
    summary: `${input.invoiceNumber} belum berubah. ${input.errorMessage}`,
    entityType: "approval",
    entityId: input.approvalId,
    actionUrl: `/admin/penjualan/${input.saleId}`,
    requiresAction: true,
    deduplicationKey: `approval.execution_failed:${input.approvalId}`,
    occurredAt: input.occurredAt ?? new Date(),
    recipients: {
      userIds: recipientIds,
      requiredAnyPermissionCodes: [
        getSaleSensitivePermission(input.kind, "execute"),
      ],
    },
    payload: {
      approvalId: input.approvalId,
      kind: input.kind,
      saleId: input.saleId,
      invoiceNumber: input.invoiceNumber,
      errorMessage: input.errorMessage,
      requestedById: input.requestedById,
      approvedById: input.approvedById,
      executedById: input.executedById,
    },
  });
}
