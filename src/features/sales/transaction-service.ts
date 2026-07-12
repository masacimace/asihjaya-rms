import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  approvals,
  auditLogs,
  cashMovements,
  inventoryMovements,
  paymentRefunds,
  payments,
  productItems,
  registers,
  saleItems,
  sales,
  shifts,
} from "@/db/schema";

export type SaleReversalKind = "void" | "refund";

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type ExecuteApprovedSaleReversalInput = {
  kind: SaleReversalKind;
  saleId: string;
  approvalId: string;
  organizationId: string;
  accessibleOutletIds: string[];
  actor: {
    id: string;
    fullName: string;
  };
  executionNote?: string | null;
  requestMetadata: RequestMetadata;
  now?: Date;
};

export type ExecuteApprovedSaleReversalResult = {
  invoiceNumber: string;
  returnedItemCount: number;
  cashRefundAmount: number;
  paidAmount: number;
  paymentRefundCount: number;
  refundShiftId: string | null;
  idempotentReplay: boolean;
};

export class SaleReversalTransactionError extends Error {
  readonly code:
    | "NOT_FOUND"
    | "INVALID_STATE"
    | "APPROVAL_NOT_READY"
    | "EXECUTION_IN_PROGRESS"
    | "ACTIVE_SHIFT_REQUIRED"
    | "PAYMENT_MISMATCH"
    | "INVENTORY_STATE_CONFLICT"
    | "CONCURRENT_STATE_CHANGE";

  constructor(
    code: SaleReversalTransactionError["code"],
    message: string,
  ) {
    super(message);
    this.name = "SaleReversalTransactionError";
    this.code = code;
  }
}

const REVERSAL_CONFIG = {
  void: {
    approvalType: "void_receipt" as const,
    finalSaleStatus: "voided" as const,
    inventoryMovementType: "reversal" as const,
    inventoryReferenceType: "sale_void",
    cashReferenceType: "sale_void",
    auditAction: "sale.void_executed",
    legacyExecutionStatus: "void_executed",
    notePrefix: "VOID",
    defaultReason: "Void transaksi setelah approval manager/owner.",
    responseNotePrefix: "Eksekusi void",
    source: "admin.sales.void_execution",
  },
  refund: {
    approvalType: "refund_transaction" as const,
    finalSaleStatus: "refunded" as const,
    inventoryMovementType: "sale_return" as const,
    inventoryReferenceType: "sale_refund",
    cashReferenceType: "sale_refund",
    auditAction: "sale.refund_executed",
    legacyExecutionStatus: "refund_executed",
    notePrefix: "REFUND",
    defaultReason: "Refund penuh setelah approval manager/owner.",
    responseNotePrefix: "Eksekusi refund penuh",
    source: "admin.sales.refund_execution",
  },
} satisfies Record<
  SaleReversalKind,
  {
    approvalType: "void_receipt" | "refund_transaction";
    finalSaleStatus: "voided" | "refunded";
    inventoryMovementType: "reversal" | "sale_return";
    inventoryReferenceType: "sale_void" | "sale_refund";
    cashReferenceType: "sale_void" | "sale_refund";
    auditAction: "sale.void_executed" | "sale.refund_executed";
    legacyExecutionStatus: "void_executed" | "refund_executed";
    notePrefix: "VOID" | "REFUND";
    defaultReason: string;
    responseNotePrefix: string;
    source: string;
  }
>;

function parseMoney(value: string | null | undefined): number {
  if (!value) return 0;

  const amount = Number(value);

  if (!Number.isSafeInteger(amount)) {
    throw new SaleReversalTransactionError(
      "PAYMENT_MISMATCH",
      "Nilai transaksi berada di luar rentang aman untuk diproses. Hubungi administrator.",
    );
  }

  return amount;
}

function getRequestDataNumber(
  requestData: Record<string, unknown>,
  key: string,
): number {
  const value = requestData[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getRequestDataString(
  requestData: Record<string, unknown>,
  key: string,
): string | null {
  const value = requestData[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function createExecutionIdempotencyKey(
  kind: SaleReversalKind,
  approvalId: string,
) {
  return `sale-${kind}:${approvalId}`;
}

function createPaymentRefundIdempotencyKey(
  kind: SaleReversalKind,
  approvalId: string,
  paymentId: string,
) {
  return `sale-${kind}:${approvalId}:${paymentId}`;
}

function buildReplayResult({
  invoiceNumber,
  requestData,
}: {
  invoiceNumber: string;
  requestData: Record<string, unknown>;
}): ExecuteApprovedSaleReversalResult {
  return {
    invoiceNumber,
    returnedItemCount: getRequestDataNumber(requestData, "returnedItemCount"),
    cashRefundAmount: getRequestDataNumber(requestData, "cashRefundAmount"),
    paidAmount: getRequestDataNumber(requestData, "paidAmount"),
    paymentRefundCount: getRequestDataNumber(
      requestData,
      "paymentRefundCount",
    ),
    refundShiftId: getRequestDataString(requestData, "refundShiftId"),
    idempotentReplay: true,
  };
}

/**
 * Atomically executes an approved full-sale void/refund.
 *
 * All financial and inventory mutations are committed together. Any business
 * conflict throws and rolls the transaction back, including the approval claim.
 */
export async function executeApprovedSaleReversal(
  input: ExecuteApprovedSaleReversalInput,
): Promise<ExecuteApprovedSaleReversalResult> {
  const config = REVERSAL_CONFIG[input.kind];
  const now = input.now ?? new Date();
  const executionIdempotencyKey = createExecutionIdempotencyKey(
    input.kind,
    input.approvalId,
  );

  if (input.accessibleOutletIds.length === 0) {
    throw new SaleReversalTransactionError(
      "NOT_FOUND",
      "Outlet yang bisa diakses tidak ditemukan.",
    );
  }

  return db.transaction(async (tx) => {
    const [sale] = await tx
      .select({
        id: sales.id,
        organizationId: sales.organizationId,
        outletId: sales.outletId,
        registerId: sales.registerId,
        originalShiftId: sales.shiftId,
        invoiceNumber: sales.invoiceNumber,
        status: sales.status,
        totalAmount: sales.totalAmount,
        notes: sales.notes,
        registerCode: registers.code,
        registerName: registers.name,
      })
      .from(sales)
      .innerJoin(registers, eq(sales.registerId, registers.id))
      .where(
        and(
          eq(sales.id, input.saleId),
          eq(sales.organizationId, input.organizationId),
          inArray(sales.outletId, input.accessibleOutletIds),
        ),
      )
      .limit(1);

    if (!sale) {
      throw new SaleReversalTransactionError(
        "NOT_FOUND",
        "Transaksi tidak ditemukan atau bukan bagian dari outlet yang bisa kamu akses.",
      );
    }

    const [approval] = await tx
      .select({
        id: approvals.id,
        status: approvals.status,
        requestedBy: approvals.requestedBy,
        approvedBy: approvals.approvedBy,
        requestData: approvals.requestData,
        notes: approvals.notes,
        responseNotes: approvals.responseNotes,
        resolvedAt: approvals.resolvedAt,
        createdAt: approvals.createdAt,
        executionStatus: approvals.executionStatus,
        executionIdempotencyKey: approvals.executionIdempotencyKey,
      })
      .from(approvals)
      .where(
        and(
          eq(approvals.id, input.approvalId),
          eq(approvals.organizationId, input.organizationId),
          eq(approvals.outletId, sale.outletId),
          eq(approvals.type, config.approvalType),
          eq(approvals.referenceType, "sale"),
          eq(approvals.referenceId, sale.id),
        ),
      )
      .limit(1);

    if (!approval) {
      throw new SaleReversalTransactionError(
        "APPROVAL_NOT_READY",
        `Approval ${input.kind === "void" ? "void" : "refund"} tidak ditemukan untuk transaksi ini.`,
      );
    }

    if (approval.status !== "approved" || !approval.approvedBy) {
      throw new SaleReversalTransactionError(
        "APPROVAL_NOT_READY",
        `Approval ${input.kind === "void" ? "void" : "refund"} belum disetujui. Tunggu manager/owner approve sebelum eksekusi.`,
      );
    }

    if (approval.requestedBy === approval.approvedBy) {
      throw new SaleReversalTransactionError(
        "APPROVAL_NOT_READY",
        "Approval tidak memenuhi aturan maker-checker karena requester dan approver adalah user yang sama. Buat request baru dan minta user lain yang berwenang untuk memprosesnya.",
      );
    }

    if (approval.executionStatus === "completed") {
      const completedOperation = getRequestDataString(
        approval.requestData,
        "executionStatus",
      );

      if (
        approval.executionIdempotencyKey === executionIdempotencyKey ||
        completedOperation === config.legacyExecutionStatus
      ) {
        return buildReplayResult({
          invoiceNumber: sale.invoiceNumber,
          requestData: approval.requestData,
        });
      }

      throw new SaleReversalTransactionError(
        "INVALID_STATE",
        "Approval ini sudah selesai dieksekusi oleh operasi yang berbeda.",
      );
    }

    if (approval.executionStatus === "executing") {
      throw new SaleReversalTransactionError(
        "EXECUTION_IN_PROGRESS",
        "Eksekusi sedang diproses oleh request lain. Muat ulang halaman untuk melihat status terbaru.",
      );
    }

    if (
      approval.executionStatus === "cancelled" ||
      !["not_started", "failed"].includes(approval.executionStatus)
    ) {
      throw new SaleReversalTransactionError(
        "INVALID_STATE",
        "Approval tidak berada pada status yang dapat dieksekusi.",
      );
    }

    if (sale.status !== "completed") {
      throw new SaleReversalTransactionError(
        "INVALID_STATE",
        `${input.kind === "void" ? "Void" : "Refund penuh"} hanya bisa dieksekusi untuk transaksi yang masih completed.`,
      );
    }

    const [paymentRows, itemRows] = await Promise.all([
      tx
        .select({
          id: payments.id,
          method: payments.method,
          provider: payments.provider,
          providerReference: payments.providerReference,
          amount: payments.amount,
          status: payments.status,
          metadata: payments.metadata,
        })
        .from(payments)
        .where(eq(payments.saleId, sale.id))
        .orderBy(payments.createdAt),
      tx
        .select({
          id: saleItems.id,
          productItemId: saleItems.productItemId,
          lineNumber: saleItems.lineNumber,
          finalPriceAmount: saleItems.finalPriceAmount,
          sku: productItems.sku,
          barcode: productItems.barcode,
          currentOutletId: productItems.currentOutletId,
          availability: productItems.availability,
          locationState: productItems.locationState,
        })
        .from(saleItems)
        .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
        .where(eq(saleItems.saleId, sale.id))
        .orderBy(saleItems.lineNumber),
    ]);

    if (itemRows.length === 0) {
      throw new SaleReversalTransactionError(
        "INVENTORY_STATE_CONFLICT",
        "Transaksi ini tidak memiliki item, sehingga reversal belum bisa dieksekusi.",
      );
    }

    const paidPayments = paymentRows.filter(
      (payment) => payment.status === "paid",
    );
    const paidAmount = paidPayments.reduce(
      (total, payment) => total + parseMoney(payment.amount),
      0,
    );
    const saleTotalAmount = parseMoney(sale.totalAmount);
    const cashPaidAmount = paidPayments.reduce(
      (total, payment) =>
        payment.method === "cash"
          ? total + parseMoney(payment.amount)
          : total,
      0,
    );

    if (paidAmount <= 0 || paidAmount !== saleTotalAmount) {
      throw new SaleReversalTransactionError(
        "PAYMENT_MISMATCH",
        `Total payment paid (${paidAmount}) tidak cocok dengan total transaksi (${saleTotalAmount}). Eksekusi dihentikan untuk pemeriksaan manual.`,
      );
    }

    let refundShift: {
      id: string;
      expectedCash: string | null;
    } | null = null;

    if (cashPaidAmount > 0) {
      const refundShiftRows = await tx
        .select({
          id: shifts.id,
          expectedCash: shifts.expectedCash,
        })
        .from(shifts)
        .where(
          and(
            eq(shifts.outletId, sale.outletId),
            eq(shifts.registerId, sale.registerId),
            eq(shifts.status, "open"),
          ),
        )
        .orderBy(desc(shifts.openedAt))
        .limit(1);

      refundShift = refundShiftRows[0] ?? null;

      if (!refundShift) {
        throw new SaleReversalTransactionError(
          "ACTIVE_SHIFT_REQUIRED",
          `Pembayaran cash hanya dapat direfund melalui shift open pada register ${sale.registerCode} — ${sale.registerName}. Buka shift register tersebut terlebih dahulu.`,
        );
      }
    }

    const reason =
      input.executionNote?.trim() ||
      approval.notes ||
      approval.responseNotes ||
      config.defaultReason;

    const [claimedApproval] = await tx
      .update(approvals)
      .set({
        executionStatus: "executing",
        executionIdempotencyKey,
        executionStartedAt: now,
        executionError: null,
      })
      .where(
        and(
          eq(approvals.id, approval.id),
          eq(approvals.status, "approved"),
          inArray(approvals.executionStatus, ["not_started", "failed"]),
          or(
            isNull(approvals.executionIdempotencyKey),
            eq(
              approvals.executionIdempotencyKey,
              executionIdempotencyKey,
            ),
          ),
        ),
      )
      .returning({ id: approvals.id });

    if (!claimedApproval) {
      throw new SaleReversalTransactionError(
        "EXECUTION_IN_PROGRESS",
        "Approval sudah diklaim atau dieksekusi oleh request lain. Muat ulang halaman untuk melihat status terbaru.",
      );
    }

    const [transitionedSale] = await tx
      .update(sales)
      .set({
        status: config.finalSaleStatus,
        cancelledAt: now,
        updatedAt: now,
        notes: sale.notes
          ? `${sale.notes}\n\n[${config.notePrefix} ${now.toISOString()}] ${reason}`
          : `[${config.notePrefix} ${now.toISOString()}] ${reason}`,
      })
      .where(
        and(
          eq(sales.id, sale.id),
          eq(sales.organizationId, input.organizationId),
          eq(sales.status, "completed"),
        ),
      )
      .returning({ id: sales.id });

    if (!transitionedSale) {
      throw new SaleReversalTransactionError(
        "CONCURRENT_STATE_CHANGE",
        "Status transaksi berubah saat eksekusi. Tidak ada perubahan finansial yang disimpan.",
      );
    }

    const productItemIds = itemRows.map((item) => item.productItemId);
    const returnedItems = await tx
      .update(productItems)
      .set({
        availability: "available",
        locationState: "outlet",
        currentOutletId: sale.outletId,
        updatedAt: now,
      })
      .where(
        and(
          eq(productItems.organizationId, input.organizationId),
          inArray(productItems.id, productItemIds),
          eq(productItems.currentOutletId, sale.outletId),
          eq(productItems.availability, "sold"),
          eq(productItems.locationState, "customer"),
        ),
      )
      .returning({ id: productItems.id });

    if (returnedItems.length !== productItemIds.length) {
      throw new SaleReversalTransactionError(
        "INVENTORY_STATE_CONFLICT",
        "Sebagian item tidak lagi berada pada status sold/customer. Seluruh eksekusi dibatalkan untuk mencegah perubahan stok yang salah.",
      );
    }

    await tx.insert(inventoryMovements).values(
      itemRows.map((item) => ({
        organizationId: input.organizationId,
        itemId: item.productItemId,
        movementType: config.inventoryMovementType,
        fromOutletId: null,
        toOutletId: sale.outletId,
        referenceType: config.inventoryReferenceType,
        referenceId: sale.id,
        reason,
        metadata: {
          source: config.source,
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          saleItemId: item.id,
          lineNumber: item.lineNumber,
          finalPriceAmount: parseMoney(item.finalPriceAmount),
          previousAvailability: item.availability,
          previousLocationState: item.locationState,
          previousOutletId: item.currentOutletId,
          approvalId: approval.id,
          executionIdempotencyKey,
        },
        performedBy: input.actor.id,
        approvedBy: approval.approvedBy,
        occurredAt: now,
        createdAt: now,
      })),
    );

    const insertedRefunds = await tx
      .insert(paymentRefunds)
      .values(
        paidPayments.map((payment) => ({
          organizationId: input.organizationId,
          outletId: sale.outletId,
          saleId: sale.id,
          paymentId: payment.id,
          approvalId: approval.id,
          originalShiftId: sale.originalShiftId,
          refundShiftId:
            payment.method === "cash" ? (refundShift?.id ?? null) : null,
          amount: payment.amount,
          method: payment.method,
          provider: payment.provider,
          providerReference: null,
          reason,
          status: "confirmed" as const,
          idempotencyKey: createPaymentRefundIdempotencyKey(
            input.kind,
            approval.id,
            payment.id,
          ),
          requestedBy: approval.requestedBy,
          approvedBy: approval.approvedBy,
          executedBy: input.actor.id,
          confirmedBy: input.actor.id,
          requestedAt: approval.createdAt,
          approvedAt: approval.resolvedAt,
          executedAt: now,
          confirmedAt: now,
          metadata: {
            source: config.source,
            operation: input.kind,
            saleId: sale.id,
            invoiceNumber: sale.invoiceNumber,
            originalPaymentStatus: payment.status,
            originalProvider: payment.provider,
            originalProviderReference: payment.providerReference,
            originalPaymentMetadata: payment.metadata,
            originalShiftId: sale.originalShiftId,
            refundShiftId:
              payment.method === "cash" ? (refundShift?.id ?? null) : null,
            executionIdempotencyKey,
          },
          createdAt: now,
          updatedAt: now,
        })),
      )
      .returning({ id: paymentRefunds.id });

    if (insertedRefunds.length !== paidPayments.length) {
      throw new SaleReversalTransactionError(
        "CONCURRENT_STATE_CHANGE",
        "Ledger refund tidak terbentuk lengkap. Seluruh eksekusi dibatalkan.",
      );
    }

    const updatedPayments = await tx
      .update(payments)
      .set({
        status: "refunded",
        updatedAt: now,
        metadata: sql`coalesce(${payments.metadata}, '{}'::jsonb) || ${JSON.stringify({
          reversalOperation: input.kind,
          reversedAt: now.toISOString(),
          reversedBy: input.actor.id,
          reversalApprovalId: approval.id,
          reversalReason: reason,
          reversalMode: "full",
          executionIdempotencyKey,
        })}::jsonb`,
      })
      .where(
        and(
          eq(payments.saleId, sale.id),
          inArray(
            payments.id,
            paidPayments.map((payment) => payment.id),
          ),
          eq(payments.status, "paid"),
        ),
      )
      .returning({ id: payments.id });

    if (updatedPayments.length !== paidPayments.length) {
      throw new SaleReversalTransactionError(
        "CONCURRENT_STATE_CHANGE",
        "Status payment berubah saat eksekusi. Seluruh eksekusi dibatalkan.",
      );
    }

    if (cashPaidAmount > 0 && refundShift) {
      await tx.insert(cashMovements).values({
        shiftId: refundShift.id,
        type: "cash_refund",
        amount: String(cashPaidAmount),
        referenceType: config.cashReferenceType,
        referenceId: sale.id,
        reason: `${input.kind === "void" ? "Void" : "Refund penuh"} ${sale.invoiceNumber}: ${reason}`.slice(
          0,
          2000,
        ),
        createdBy: input.actor.id,
        createdAt: now,
      });

      const updatedShifts = await tx
        .update(shifts)
        .set({
          expectedCash: sql`coalesce(${shifts.expectedCash}, 0) - ${String(cashPaidAmount)}`,
          updatedAt: now,
        })
        .where(and(eq(shifts.id, refundShift.id), eq(shifts.status, "open")))
        .returning({ id: shifts.id });

      if (updatedShifts.length !== 1) {
        throw new SaleReversalTransactionError(
          "CONCURRENT_STATE_CHANGE",
          "Shift refund berubah status saat eksekusi. Seluruh eksekusi dibatalkan.",
        );
      }
    }

    const completedRequestData = {
      ...approval.requestData,
      executionStatus: config.legacyExecutionStatus,
      executedAt: now.toISOString(),
      executedBy: input.actor.id,
      executedByName: input.actor.fullName,
      executionNote: reason,
      executionIdempotencyKey,
      saleStatusBefore: sale.status,
      saleStatusAfter: config.finalSaleStatus,
      cashRefundAmount: cashPaidAmount,
      paidAmount,
      refundMode: "full",
      returnedItemCount: itemRows.length,
      paymentRefundCount: insertedRefunds.length,
      originalShiftId: sale.originalShiftId,
      refundShiftId: refundShift?.id ?? null,
    };

    const completedApprovals = await tx
      .update(approvals)
      .set({
        executionStatus: "completed",
        executedAt: now,
        executedBy: input.actor.id,
        executionError: null,
        requestData: completedRequestData,
        responseNotes: approval.responseNotes
          ? `${approval.responseNotes}\n\n${config.responseNotePrefix}: ${reason}`
          : `${config.responseNotePrefix}: ${reason}`,
      })
      .where(
        and(
          eq(approvals.id, approval.id),
          eq(approvals.executionStatus, "executing"),
          eq(
            approvals.executionIdempotencyKey,
            executionIdempotencyKey,
          ),
        ),
      )
      .returning({ id: approvals.id });

    if (completedApprovals.length !== 1) {
      throw new SaleReversalTransactionError(
        "CONCURRENT_STATE_CHANGE",
        "Approval berubah saat finalisasi. Seluruh eksekusi dibatalkan.",
      );
    }

    await tx.insert(auditLogs).values({
      organizationId: input.organizationId,
      outletId: sale.outletId,
      actorUserId: input.actor.id,
      action: config.auditAction,
      entityType: "sale",
      entityId: sale.id,
      beforeData: {
        status: sale.status,
        totalAmount: sale.totalAmount,
        paidAmount,
        cashPaidAmount,
        originalShiftId: sale.originalShiftId,
        paymentStatuses: paymentRows.map((payment) => ({
          id: payment.id,
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
        })),
        itemStates: itemRows.map((item) => ({
          productItemId: item.productItemId,
          availability: item.availability,
          locationState: item.locationState,
          currentOutletId: item.currentOutletId,
        })),
      },
      afterData: {
        status: config.finalSaleStatus,
        approvalId: approval.id,
        refundMode: "full",
        returnedItemCount: itemRows.length,
        cashRefundAmount: cashPaidAmount,
        refundShiftId: refundShift?.id ?? null,
        paymentStatus: "refunded",
        paymentRefundCount: insertedRefunds.length,
      },
      reason,
      ipAddress: input.requestMetadata.ipAddress,
      userAgent: input.requestMetadata.userAgent,
      metadata: {
        source: "admin.sales.detail",
        operation: input.kind,
        approvalId: approval.id,
        invoiceNumber: sale.invoiceNumber,
        executionStatus: config.legacyExecutionStatus,
        executionIdempotencyKey,
        originalShiftId: sale.originalShiftId,
        refundShiftId: refundShift?.id ?? null,
      },
      createdAt: now,
    });

    return {
      invoiceNumber: sale.invoiceNumber,
      returnedItemCount: itemRows.length,
      cashRefundAmount: cashPaidAmount,
      paidAmount,
      paymentRefundCount: insertedRefunds.length,
      refundShiftId: refundShift?.id ?? null,
      idempotentReplay: false,
    };
  });
}
