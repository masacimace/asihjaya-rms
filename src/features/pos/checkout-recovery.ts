import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  hardwareJobs,
  posCheckoutAttempts,
  sales,
} from "@/db/schema";
import { publishSaleRecoveryNotification } from "@/features/notifications/sales";
import {
  type PosCheckoutRecoveryStatusResult,
  type PosCheckoutSaleResult,
} from "@/features/pos/contracts";
import { isValidPosCheckoutIdempotencyKey } from "@/features/pos/checkout-fingerprint";
import { type AuthContext } from "@/lib/auth/session";

export const POS_CHECKOUT_RECOVERY_RETRY_AFTER_MS = 1_500;

type PosCheckoutSaleRecord = PosCheckoutSaleResult & {
  outletId: string;
  cashierId: string;
};

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

async function getPosCheckoutSaleRecord({
  organizationId,
  cashierId,
  outletIds,
  idempotencyKey,
}: {
  organizationId: string;
  cashierId: string;
  outletIds: string[];
  idempotencyKey: string;
}): Promise<PosCheckoutSaleRecord | null> {
  if (outletIds.length === 0) {
    return null;
  }

  const [sale] = await db
    .select({
      id: sales.id,
      outletId: sales.outletId,
      cashierId: sales.cashierId,
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
  const sale = await getPosCheckoutSaleRecord({
    organizationId,
    cashierId,
    outletIds,
    idempotencyKey,
  });

  if (!sale) return null;

  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    totalAmount: sale.totalAmount,
    receiptCertificateJobId: sale.receiptCertificateJobId,
  };
}

async function publishRecoveryNotificationSafely({
  auth,
  sale,
  idempotencyKey,
  recoveryReason,
}: {
  auth: AuthContext;
  sale: PosCheckoutSaleRecord;
  idempotencyKey: string;
  recoveryReason:
    | "legacy_sale_without_attempt"
    | "completed_attempt_replayed"
    | "attempt_repaired";
}) {
  await publishSaleRecoveryNotification({
    organizationId: auth.organization.id,
    outletId: sale.outletId,
    cashierId: sale.cashierId,
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    totalAmount: sale.totalAmount,
    idempotencyKey,
    recoveryReason,
    source: "pos.checkout.recovery_status",
  }).catch((error) => {
    console.error("Failed to publish POS checkout recovery notification", {
      saleId: sale.id,
      recoveryReason,
      error,
    });
  });
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

  const saleRecord = await getPosCheckoutSaleRecord({
    organizationId: auth.organization.id,
    cashierId: auth.user.id,
    outletIds,
    idempotencyKey,
  });

  if (saleRecord) {
    let attemptRepaired = false;

    if (attempt && (attempt.status !== "completed" || !attempt.saleId)) {
      const now = new Date();
      const [repaired] = await db
        .update(posCheckoutAttempts)
        .set({
          status: "completed",
          saleId: saleRecord.id,
          completedAt: now,
          failedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          updatedAt: now,
        })
        .where(eq(posCheckoutAttempts.id, attempt.id))
        .returning({ id: posCheckoutAttempts.id });

      attemptRepaired = Boolean(repaired);

      if (repaired && recordRepairAudit) {
        await db.insert(auditLogs).values({
          organizationId: auth.organization.id,
          outletId: attempt.outletId,
          actorUserId: auth.user.id,
          action: "pos.checkout.recovery_repaired",
          entityType: "sale",
          entityId: saleRecord.id,
          beforeData: {
            attemptStatus: attempt.status,
            attemptSaleId: attempt.saleId,
          },
          afterData: {
            attemptStatus: "completed",
            saleId: saleRecord.id,
            invoiceNumber: saleRecord.invoiceNumber,
          },
          metadata: {
            source: "pos.checkout.recovery_status",
            idempotencyKey,
          },
          createdAt: now,
        });
      }
    }

    if (recordRepairAudit) {
      await publishRecoveryNotificationSafely({
        auth,
        sale: saleRecord,
        idempotencyKey,
        recoveryReason: attemptRepaired
          ? "attempt_repaired"
          : attempt
            ? "completed_attempt_replayed"
            : "legacy_sale_without_attempt",
      });
    }

    const sale: PosCheckoutSaleResult = {
      id: saleRecord.id,
      invoiceNumber: saleRecord.invoiceNumber,
      totalAmount: saleRecord.totalAmount,
      receiptCertificateJobId: saleRecord.receiptCertificateJobId,
    };

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
