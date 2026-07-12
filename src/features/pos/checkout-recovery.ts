import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  hardwareJobs,
  posCheckoutAttempts,
  sales,
} from "@/db/schema";
import {
  type PosCheckoutRecoveryStatusResult,
  type PosCheckoutSaleResult,
} from "@/features/pos/contracts";
import { isValidPosCheckoutIdempotencyKey } from "@/features/pos/checkout-fingerprint";
import { type AuthContext } from "@/lib/auth/session";

export const POS_CHECKOUT_RECOVERY_RETRY_AFTER_MS = 1_500;

async function getReceiptCertificateJobId(saleId: string) {
  const [job] = await db
    .select({ id: hardwareJobs.id })
    .from(hardwareJobs)
    .where(
      and(
        eq(hardwareJobs.sourceType, "sale"),
        eq(hardwareJobs.sourceId, saleId),
        eq(hardwareJobs.jobType, "print_receipt_certificate"),
      ),
    )
    .orderBy(desc(hardwareJobs.createdAt))
    .limit(1);

  return job?.id ?? null;
}

export async function getPosCheckoutSaleResult({
  organizationId,
  cashierId,
  outletIds,
  idempotencyKey,
}: {
  organizationId: string;
  cashierId: string;
  outletIds: string[];
  idempotencyKey: string;
}): Promise<PosCheckoutSaleResult | null> {
  if (outletIds.length === 0) {
    return null;
  }

  const [sale] = await db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      totalAmount: sales.totalAmount,
    })
    .from(sales)
    .where(
      and(
        eq(sales.organizationId, organizationId),
        eq(sales.cashierId, cashierId),
        inArray(sales.outletId, outletIds),
        eq(sales.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  if (!sale) {
    return null;
  }

  return {
    ...sale,
    receiptCertificateJobId: await getReceiptCertificateJobId(sale.id),
  };
}

export async function getPosCheckoutRecoveryStatus({
  auth,
  idempotencyKey,
  recordRepairAudit = false,
}: {
  auth: AuthContext;
  idempotencyKey: string;
  recordRepairAudit?: boolean;
}): Promise<PosCheckoutRecoveryStatusResult> {
  if (!isValidPosCheckoutIdempotencyKey(idempotencyKey)) {
    return {
      status: "not_found",
      message: "Checkout attempt tidak ditemukan.",
    };
  }

  const outletIds = auth.outlets.map((outlet) => outlet.id);

  const [attempt] = await db
    .select({
      id: posCheckoutAttempts.id,
      organizationId: posCheckoutAttempts.organizationId,
      outletId: posCheckoutAttempts.outletId,
      cashierId: posCheckoutAttempts.cashierId,
      status: posCheckoutAttempts.status,
      saleId: posCheckoutAttempts.saleId,
      lastErrorCode: posCheckoutAttempts.lastErrorCode,
      lastErrorMessage: posCheckoutAttempts.lastErrorMessage,
    })
    .from(posCheckoutAttempts)
    .where(eq(posCheckoutAttempts.idempotencyKey, idempotencyKey))
    .limit(1);

  if (
    attempt &&
    (attempt.organizationId !== auth.organization.id ||
      attempt.cashierId !== auth.user.id ||
      !outletIds.includes(attempt.outletId))
  ) {
    return {
      status: "not_found",
      message: "Checkout attempt tidak ditemukan.",
    };
  }

  const sale = await getPosCheckoutSaleResult({
    organizationId: auth.organization.id,
    cashierId: auth.user.id,
    outletIds,
    idempotencyKey,
  });

  if (sale) {
    if (attempt && (attempt.status !== "completed" || !attempt.saleId)) {
      const now = new Date();
      const [repaired] = await db
        .update(posCheckoutAttempts)
        .set({
          status: "completed",
          saleId: sale.id,
          completedAt: now,
          failedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          updatedAt: now,
        })
        .where(eq(posCheckoutAttempts.id, attempt.id))
        .returning({ id: posCheckoutAttempts.id });

      if (repaired && recordRepairAudit) {
        await db.insert(auditLogs).values({
          organizationId: auth.organization.id,
          outletId: attempt.outletId,
          actorUserId: auth.user.id,
          action: "pos.checkout.recovery_repaired",
          entityType: "sale",
          entityId: sale.id,
          beforeData: {
            attemptStatus: attempt.status,
            attemptSaleId: attempt.saleId,
          },
          afterData: {
            attemptStatus: "completed",
            saleId: sale.id,
            invoiceNumber: sale.invoiceNumber,
          },
          metadata: {
            source: "pos.checkout.recovery_status",
            idempotencyKey,
          },
          createdAt: now,
        });
      }
    }

    return {
      status: "completed",
      message: `Transaksi ${sale.invoiceNumber} sudah berhasil diproses.`,
      sale,
    };
  }

  if (!attempt) {
    return {
      status: "not_found",
      message: "Checkout attempt belum tercatat di server.",
    };
  }

  if (attempt.status === "failed") {
    return {
      status: "failed",
      message:
        attempt.lastErrorMessage ??
        "Checkout attempt sebelumnya gagal dan dapat dicoba kembali.",
      errorCode: attempt.lastErrorCode,
      retryable: attempt.lastErrorCode !== "idempotency_conflict",
    };
  }

  return {
    status: "processing",
    message: "Transaksi masih diproses. Jangan membuat transaksi baru.",
    retryAfterMs: POS_CHECKOUT_RECOVERY_RETRY_AFTER_MS,
  };
}
