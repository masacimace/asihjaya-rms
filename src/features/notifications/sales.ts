import type { PublishNotificationEventInput } from "@/features/notifications/contracts";
import {
  publishNotificationEvent,
  publishNotificationEventInTransaction,
  type NotificationTransaction,
} from "@/features/notifications/event-service";

export const DEFAULT_HIGH_VALUE_SALE_THRESHOLD_IDR = 30_000_000;

const SALE_NOTIFICATION_ORGANIZATION_ROLE_CODES = [
  "owner",
  "system_admin",
] as const;
const SALE_NOTIFICATION_OUTLET_ROLE_CODES = ["manager"] as const;

export type SaleNotificationPayment = {
  method: string;
  methodLabel: string;
  amount: number;
  provider?: string | null;
};

export type SaleCompletedNotificationInput = {
  organizationId: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  registerId: string;
  registerCode: string;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  saleId: string;
  invoiceNumber: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  itemCount: number;
  totalWeightGram: number;
  payments: SaleNotificationPayment[];
  occurredAt: Date;
  source?: string;
  highValueThreshold?: number;
};

export type SaleRecoveryNotificationInput = {
  organizationId: string;
  outletId: string;
  cashierId: string;
  saleId: string;
  invoiceNumber: string;
  totalAmount: number | string;
  idempotencyKey: string;
  recoveryReason:
    | "legacy_sale_without_attempt"
    | "completed_attempt_replayed"
    | "attempt_repaired"
    | "checkout_retry"
    | "post_commit_recovery";
  occurredAt?: Date;
  source?: string;
};

function formatIdr(amount: number) {
  return `Rp${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function normalizeWeight(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Number(value.toFixed(3));
}

function getSaleRecipients(cashierId: string) {
  return {
    organizationRoleCodes: [...SALE_NOTIFICATION_ORGANIZATION_ROLE_CODES],
    outletRoleCodes: [...SALE_NOTIFICATION_OUTLET_ROLE_CODES],
    excludeUserIds: [cashierId],
  };
}

export function buildSaleCompletedNotification(
  input: SaleCompletedNotificationInput,
): PublishNotificationEventInput {
  const highValueThreshold =
    input.highValueThreshold ?? DEFAULT_HIGH_VALUE_SALE_THRESHOLD_IDR;
  const isHighValue = input.totalAmount >= highValueThreshold;
  const isSplitPayment = input.payments.length > 1;

  return {
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "sales",
    eventType: "sale.completed",
    severity: isHighValue ? "warning" : "info",
    title: isHighValue
      ? "Transaksi bernilai besar berhasil"
      : "Transaksi berhasil",
    summary: `${input.invoiceNumber} · ${formatIdr(input.totalAmount)} · ${input.cashierName}`,
    entityType: "sale",
    entityId: input.saleId,
    actionUrl: `/admin/penjualan/${input.saleId}`,
    requiresAction: false,
    deduplicationKey: `sale.completed:${input.saleId}`,
    occurredAt: input.occurredAt,
    recipients: getSaleRecipients(input.cashierId),
    payload: {
      source: input.source ?? "pos.checkout",
      saleId: input.saleId,
      invoiceNumber: input.invoiceNumber,
      outletId: input.outletId,
      outletCode: input.outletCode,
      outletName: input.outletName,
      registerId: input.registerId,
      registerCode: input.registerCode,
      shiftId: input.shiftId,
      cashierId: input.cashierId,
      cashierName: input.cashierName,
      subtotalAmount: String(input.subtotalAmount),
      discountAmount: String(input.discountAmount),
      totalAmount: String(input.totalAmount),
      itemCount: input.itemCount,
      totalWeightGram: normalizeWeight(input.totalWeightGram),
      isSplitPayment,
      isHighValue,
      highValueThreshold: String(highValueThreshold),
      payments: input.payments.map((payment) => ({
        method: payment.method,
        methodLabel: payment.methodLabel,
        amount: String(payment.amount),
        provider: payment.provider?.trim() || null,
      })),
    },
  };
}

export function publishSaleCompletedNotificationInTransaction(
  transaction: NotificationTransaction,
  input: SaleCompletedNotificationInput,
) {
  return publishNotificationEventInTransaction(
    transaction,
    buildSaleCompletedNotification(input),
  );
}

export function buildSaleRecoveryNotification(
  input: SaleRecoveryNotificationInput,
): PublishNotificationEventInput {
  const totalAmount = Number(input.totalAmount);
  const safeTotalAmount = Number.isFinite(totalAmount) ? totalAmount : 0;

  return {
    organizationId: input.organizationId,
    outletId: input.outletId,
    category: "sales",
    eventType: "sale.recovery_completed",
    severity: "warning",
    title: "Transaksi berhasil dipulihkan",
    summary: `${input.invoiceNumber} · ${formatIdr(safeTotalAmount)} · status transaksi telah dikonfirmasi`,
    entityType: "sale",
    entityId: input.saleId,
    actionUrl: `/admin/penjualan/${input.saleId}`,
    requiresAction: false,
    deduplicationKey: `sale.recovery_completed:${input.saleId}`,
    occurredAt: input.occurredAt ?? new Date(),
    recipients: getSaleRecipients(input.cashierId),
    payload: {
      source: input.source ?? "pos.checkout.recovery",
      saleId: input.saleId,
      invoiceNumber: input.invoiceNumber,
      totalAmount: String(input.totalAmount),
      cashierId: input.cashierId,
      idempotencyKey: input.idempotencyKey,
      recoveryReason: input.recoveryReason,
    },
  };
}

export function publishSaleRecoveryNotification(
  input: SaleRecoveryNotificationInput,
) {
  return publishNotificationEvent(buildSaleRecoveryNotification(input));
}

export function publishSaleRecoveryNotificationInTransaction(
  transaction: NotificationTransaction,
  input: SaleRecoveryNotificationInput,
) {
  return publishNotificationEventInTransaction(
    transaction,
    buildSaleRecoveryNotification(input),
  );
}
