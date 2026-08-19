import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  cashMovements,
  inventoryMovements,
  paymentRefunds,
  payments,
  productItems,
  registers,
  saleItems,
  saleReturnCases,
  saleReturnItems,
  sales,
  shifts,
} from "@/db/schema";
import { publishSaleReversalCompletedNotificationInTransaction } from "@/features/notifications/sale-reversals";
import { publishReturnAwaitingReceiptNotificationInTransaction } from "@/features/notifications/returns";

export type SaleReversalKind = "void" | "refund";

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type ExecuteSaleReversalInput = {
  kind: SaleReversalKind;
  saleId: string;
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

export type ExecuteSaleReversalResult = {
  invoiceNumber: string;
  returnedItemCount: number;
  cashRefundAmount: number;
  paidAmount: number;
  paymentRefundCount: number;
  refundShiftId: string | null;
  returnCaseId: string | null;
  pendingReturnItemCount: number;
  idempotentReplay: boolean;
};

export class SaleReversalTransactionError extends Error {
  readonly code:
    | "NOT_FOUND"
    | "INVALID_STATE"
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
    finalSaleStatus: "voided" as const,
    inventoryMovementType: "reversal" as const,
    inventoryReferenceType: "sale_void",
    cashReferenceType: "sale_void",
    auditAction: "sale.void_executed",
    notePrefix: "VOID",
    defaultReason: "Void transaksi langsung oleh user berizin.",
    source: "admin.sales.void_direct",
  },
  refund: {
    finalSaleStatus: "refunded" as const,
    inventoryMovementType: "sale_return" as const,
    inventoryReferenceType: "sale_refund",
    cashReferenceType: "sale_refund",
    auditAction: "sale.refund_executed",
    notePrefix: "REFUND",
    defaultReason: "Refund penuh langsung oleh user berizin.",
    source: "admin.sales.refund_direct",
  },
} satisfies Record<
  SaleReversalKind,
  {
    finalSaleStatus: "voided" | "refunded";
    inventoryMovementType: "reversal" | "sale_return";
    inventoryReferenceType: "sale_void" | "sale_refund";
    cashReferenceType: "sale_void" | "sale_refund";
    auditAction: "sale.void_executed" | "sale.refund_executed";
    notePrefix: "VOID" | "REFUND";
    defaultReason: string;
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

function createExecutionIdempotencyKey(kind: SaleReversalKind, saleId: string) {
  return `sale-${kind}:${saleId}`;
}

function createPaymentRefundIdempotencyKey(
  kind: SaleReversalKind,
  saleId: string,
  paymentId: string,
) {
  return `sale-${kind}:${saleId}:${paymentId}`;
}

/**
 * Menjalankan full-sale void/refund secara atomik tanpa approval workflow.
 * Permission diperiksa oleh server action sebelum service ini dipanggil.
 */
export async function executeSaleReversal(
  input: ExecuteSaleReversalInput,
): Promise<ExecuteSaleReversalResult> {
  const config = REVERSAL_CONFIG[input.kind];
  const now = input.now ?? new Date();
  const executionIdempotencyKey = createExecutionIdempotencyKey(
    input.kind,
    input.saleId,
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
          serialNumber: productItems.serialNumber,
          weightGram: productItems.weightGram,
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
      input.executionNote?.trim() || config.defaultReason;

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
    let returnedItemCount = 0;
    let returnCaseId: string | null = null;
    let pendingReturnItemCount = 0;

    if (input.kind === "void") {
      const returnedItems = await tx
        .update(productItems)
        .set({
          availability: "available",
          condition: "good",
          locationState: "outlet",
          currentOutletId: sale.outletId,
          locationCode: null,
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

      returnedItemCount = returnedItems.length;

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
            executionIdempotencyKey,
          },
          performedBy: input.actor.id,
          approvedBy: null,
          occurredAt: now,
          createdAt: now,
        })),
      );
    } else {
      const validatedRefundItems = await tx
        .update(productItems)
        .set({
          updatedAt: sql`${productItems.updatedAt}`,
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

      if (validatedRefundItems.length !== productItemIds.length) {
        throw new SaleReversalTransactionError(
          "INVENTORY_STATE_CONFLICT",
          "Sebagian item tidak lagi berada pada status sold/customer. Refund dibatalkan sebelum return case dibentuk.",
        );
      }

      const [returnCase] = await tx
        .insert(saleReturnCases)
        .values({
          organizationId: input.organizationId,
          outletId: sale.outletId,
          saleId: sale.id,
          approvalId: null,
          status: "awaiting_receipt",
          expectedItemCount: itemRows.length,
          receivedItemCount: 0,
          inspectedItemCount: 0,
          notes: reason,
          createdBy: input.actor.id,
          metadata: {
            source: config.source,
            invoiceNumber: sale.invoiceNumber,
            executionIdempotencyKey,
            financialRefundCompletedAt: now.toISOString(),
          },
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: saleReturnCases.id });

      if (!returnCase) {
        throw new SaleReversalTransactionError(
          "CONCURRENT_STATE_CHANGE",
          "Kasus retur gagal dibentuk. Seluruh eksekusi dibatalkan.",
        );
      }

      const insertedReturnItems = await tx
        .insert(saleReturnItems)
        .values(
          itemRows.map((item) => ({
            organizationId: input.organizationId,
            outletId: sale.outletId,
            returnCaseId: returnCase.id,
            saleItemId: item.id,
            productItemId: item.productItemId,
            status: "awaiting_receipt" as const,
            expectedSku: item.sku,
            expectedBarcode: item.barcode,
            expectedSerialNumber: item.serialNumber,
            expectedWeightGram: item.weightGram,
            metadata: {
              source: config.source,
              saleId: sale.id,
              invoiceNumber: sale.invoiceNumber,
              lineNumber: item.lineNumber,
              finalPriceAmount: parseMoney(item.finalPriceAmount),
              executionIdempotencyKey,
            },
            createdAt: now,
            updatedAt: now,
          })),
        )
        .returning({ id: saleReturnItems.id });

      if (insertedReturnItems.length !== itemRows.length) {
        throw new SaleReversalTransactionError(
          "CONCURRENT_STATE_CHANGE",
          "Daftar item retur tidak terbentuk lengkap. Seluruh eksekusi dibatalkan.",
        );
      }

      returnCaseId = returnCase.id;
      pendingReturnItemCount = insertedReturnItems.length;
    }

    const insertedRefunds = await tx
      .insert(paymentRefunds)
      .values(
        paidPayments.map((payment) => ({
          organizationId: input.organizationId,
          outletId: sale.outletId,
          saleId: sale.id,
          paymentId: payment.id,
          approvalId: null,
          originalShiftId: sale.originalShiftId,
          refundShiftId:
            payment.method === "cash" ? (refundShift?.id ?? null) : null,
          amount: payment.amount,
          method: payment.method,
          provider: payment.provider,
          providerReference: null,
          reason,
          status: "confirmed" as const,
          idempotencyKey: createPaymentRefundIdempotencyKey(input.kind, sale.id, payment.id),
          requestedBy: input.actor.id,
          approvedBy: null,
          executedBy: input.actor.id,
          confirmedBy: input.actor.id,
          requestedAt: now,
          approvedAt: null,
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
          reversalOperationId: executionIdempotencyKey,
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
        refundMode: "full",
        returnedItemCount,
        pendingReturnItemCount,
        returnCaseId,
        cashRefundAmount: cashPaidAmount,
        refundShiftId: refundShift?.id ?? null,
        paymentStatus: "refunded",
        paymentRefundCount: insertedRefunds.length,
      },
      reason,
      ipAddress: input.requestMetadata.ipAddress,
      userAgent: input.requestMetadata.userAgent,
      metadata: {
        source: config.source,
        operation: input.kind,
        invoiceNumber: sale.invoiceNumber,
        executionStatus: "direct_execution",
        executionIdempotencyKey,
        originalShiftId: sale.originalShiftId,
        refundShiftId: refundShift?.id ?? null,
      },
      createdAt: now,
    });

    await publishSaleReversalCompletedNotificationInTransaction(tx, {
      organizationId: input.organizationId,
      outletId: sale.outletId,
      kind: input.kind,
      executedById: input.actor.id,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      totalAmount: saleTotalAmount,
      cashRefundAmount: cashPaidAmount,
      paymentRefundCount: insertedRefunds.length,
      returnCaseId,
      pendingReturnItemCount,
      occurredAt: now,
    });

    if (input.kind === "refund" && returnCaseId) {
      await publishReturnAwaitingReceiptNotificationInTransaction(tx, {
        organizationId: input.organizationId,
        outletId: sale.outletId,
        returnCaseId,
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        itemCount: pendingReturnItemCount,
        createdById: input.actor.id,
        occurredAt: now,
      });
    }

    return {
      invoiceNumber: sale.invoiceNumber,
      returnedItemCount,
      cashRefundAmount: cashPaidAmount,
      paidAmount,
      paymentRefundCount: insertedRefunds.length,
      refundShiftId: refundShift?.id ?? null,
      returnCaseId,
      pendingReturnItemCount,
      idempotentReplay: false,
    };
  });
}
