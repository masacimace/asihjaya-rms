"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  paymentReconciliations,
  payments,
  sales,
} from "@/db/schema";
import type { ReconciliationStatus } from "@/features/reconciliation/contracts";
import {
  hasPermission,
  requirePermission,
} from "@/lib/auth/session";
import {
  deleteReconciliationEvidenceFile,
  storeReconciliationEvidenceFile,
} from "@/lib/storage/reconciliation-evidence-storage";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ActionableReconciliationStatus = Exclude<
  ReconciliationStatus,
  "unreconciled"
>;

const ACTIONABLE_STATUSES = [
  "pending_settlement",
  "reconciled",
  "mismatch",
  "not_found",
  "waived",
] as const satisfies readonly ActionableReconciliationStatus[];

function readText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function parseOptionalMoney(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").replace(/\D/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function parseSettlementDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDetailPath(paymentId: string) {
  return `/admin/keuangan/rekonsiliasi/${paymentId}`;
}

function redirectWithMessage(
  paymentId: string,
  type: "success" | "error",
  message: string,
): never {
  const query = new URLSearchParams({ type, message });
  redirect(`${getDetailPath(paymentId)}?${query.toString()}`);
}

async function getRequestMetadata() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");

  return {
    ipAddress:
      forwardedFor?.split(",")[0]?.trim().slice(0, 64) ??
      headerStore.get("x-real-ip")?.slice(0, 64) ??
      null,
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function requiresResolvePermission({
  currentStatus,
  nextStatus,
}: {
  currentStatus: string;
  nextStatus: ReconciliationStatus;
}) {
  if (nextStatus === "waived") return true;

  return (
    (currentStatus === "mismatch" ||
      currentStatus === "not_found" ||
      currentStatus === "waived") &&
    currentStatus !== nextStatus
  );
}

export async function savePaymentReconciliationAction(formData: FormData) {
  const auth = await requirePermission("payments.reconciliation.manage");
  const paymentId = readText(formData, "paymentId", 36);
  const statusValue = readText(formData, "status", 40);

  if (!UUID_PATTERN.test(paymentId)) {
    redirectWithMessage(paymentId || "invalid", "error", "Payment tidak valid.");
  }

  if (
    !ACTIONABLE_STATUSES.includes(
      statusValue as ActionableReconciliationStatus,
    )
  ) {
    redirectWithMessage(paymentId, "error", "Status rekonsiliasi tidak valid.");
  }

  const status = statusValue as ActionableReconciliationStatus;
  const settlementReference =
    readText(formData, "settlementReference", 160) || null;
  const settlementDateInput = readText(formData, "settlementDate", 10);
  const settlementDate = settlementDateInput
    ? parseSettlementDate(settlementDateInput)
    : null;
  const notes = readText(formData, "notes", 1200) || null;
  const removeEvidence = formData.get("removeEvidence") === "on";
  const evidence = formData.get("evidence");

  let settlementGrossAmount = parseOptionalMoney(
    formData.get("settlementGrossAmount"),
  );
  let feeAmount = parseOptionalMoney(formData.get("feeAmount")) ?? 0;
  let taxAmount = parseOptionalMoney(formData.get("taxAmount")) ?? 0;

  if (
    Number.isNaN(settlementGrossAmount) ||
    Number.isNaN(feeAmount) ||
    Number.isNaN(taxAmount)
  ) {
    redirectWithMessage(
      paymentId,
      "error",
      "Nominal settlement, biaya, atau pajak tidak valid.",
    );
  }

  const outletIds = auth.outlets.map((outlet) => outlet.id);
  if (outletIds.length === 0) {
    redirectWithMessage(paymentId, "error", "Akses outlet tidak tersedia.");
  }

  const [preview] = await db
    .select({
      paymentId: payments.id,
      saleId: sales.id,
      organizationId: sales.organizationId,
      outletId: sales.outletId,
      amount: payments.amount,
      settlementStatus: payments.settlementStatus,
      reconciliationId: paymentReconciliations.id,
      reconciliationEvidenceKey: paymentReconciliations.evidenceKey,
    })
    .from(payments)
    .innerJoin(sales, eq(payments.saleId, sales.id))
    .leftJoin(
      paymentReconciliations,
      eq(payments.id, paymentReconciliations.paymentId),
    )
    .where(
      and(
        eq(payments.id, paymentId),
        eq(sales.organizationId, auth.organization.id),
        inArray(sales.outletId, outletIds),
        ne(payments.settlementStatus, "not_applicable"),
      ),
    )
    .limit(1);

  if (!preview) {
    redirectWithMessage(
      paymentId,
      "error",
      "Payment tidak ditemukan atau tidak dapat direkonsiliasi.",
    );
  }

  if (
    requiresResolvePermission({
      currentStatus: preview.settlementStatus,
      nextStatus: status,
    }) &&
    !hasPermission(auth, "payments.reconciliation.resolve")
  ) {
    redirectWithMessage(
      paymentId,
      "error",
      "Penyelesaian mismatch membutuhkan permission resolve.",
    );
  }

  const expectedAmount = Number(preview.amount);
  if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0) {
    redirectWithMessage(paymentId, "error", "Nominal payment tidak valid.");
  }

  if (status === "pending_settlement") {
    settlementGrossAmount = null;
    feeAmount = 0;
    taxAmount = 0;
  }

  if (status === "not_found" || status === "waived") {
    settlementGrossAmount = null;
    feeAmount = 0;
    taxAmount = 0;

    if (!notes || notes.length < 8) {
      redirectWithMessage(
        paymentId,
        "error",
        "Jelaskan alasan minimal 8 karakter.",
      );
    }
  }

  if (status === "reconciled" || status === "mismatch") {
    if (settlementGrossAmount == null) {
      redirectWithMessage(
        paymentId,
        "error",
        "Nominal gross settlement wajib diisi.",
      );
    }

    if (!settlementDate || !settlementReference) {
      redirectWithMessage(
        paymentId,
        "error",
        "Tanggal dan reference settlement wajib diisi.",
      );
    }

    if (feeAmount + taxAmount > settlementGrossAmount) {
      redirectWithMessage(
        paymentId,
        "error",
        "Biaya dan pajak tidak boleh melebihi gross settlement.",
      );
    }
  }

  const differenceAmount =
    settlementGrossAmount == null
      ? 0
      : settlementGrossAmount - expectedAmount;
  const netSettlementAmount =
    settlementGrossAmount == null
      ? null
      : settlementGrossAmount - feeAmount - taxAmount;

  if (status === "reconciled" && differenceAmount !== 0) {
    redirectWithMessage(
      paymentId,
      "error",
      "Gross settlement harus sama dengan nominal payment untuk status direkonsiliasi.",
    );
  }

  if (status === "mismatch") {
    if (differenceAmount === 0) {
      redirectWithMessage(
        paymentId,
        "error",
        "Gunakan status direkonsiliasi karena tidak ada selisih nominal.",
      );
    }

    if (!notes || notes.length < 8) {
      redirectWithMessage(
        paymentId,
        "error",
        "Jelaskan penyebab mismatch minimal 8 karakter.",
      );
    }
  }

  let uploadedEvidenceKey: string | null = null;
  if (evidence instanceof File && evidence.size > 0) {
    try {
      const stored = await storeReconciliationEvidenceFile({
        file: evidence,
        organizationId: auth.organization.id,
      });
      uploadedEvidenceKey = stored.key;
    } catch (error) {
      redirectWithMessage(
        paymentId,
        "error",
        error instanceof Error
          ? error.message
          : "Bukti settlement gagal diunggah.",
      );
    }
  }

  const requestMetadata = await getRequestMetadata();
  const now = new Date();
  let previousEvidenceKey: string | null = null;

  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`payment-reconciliation:${paymentId}`}))`,
      );

      const [current] = await transaction
        .select({
          paymentId: payments.id,
          saleId: sales.id,
          organizationId: sales.organizationId,
          outletId: sales.outletId,
          amount: payments.amount,
          paymentStatus: payments.status,
          settlementStatus: payments.settlementStatus,
          reconciliationId: paymentReconciliations.id,
          reconciliationStatus: paymentReconciliations.status,
          settlementGrossAmount:
            paymentReconciliations.settlementGrossAmount,
          feeAmount: paymentReconciliations.feeAmount,
          taxAmount: paymentReconciliations.taxAmount,
          netSettlementAmount:
            paymentReconciliations.netSettlementAmount,
          differenceAmount: paymentReconciliations.differenceAmount,
          settlementDate: paymentReconciliations.settlementDate,
          settlementReference: paymentReconciliations.settlementReference,
          evidenceKey: paymentReconciliations.evidenceKey,
          notes: paymentReconciliations.notes,
          reconciledBy: paymentReconciliations.reconciledBy,
          reconciledAt: paymentReconciliations.reconciledAt,
          resolvedBy: paymentReconciliations.resolvedBy,
          resolvedAt: paymentReconciliations.resolvedAt,
        })
        .from(payments)
        .innerJoin(sales, eq(payments.saleId, sales.id))
        .leftJoin(
          paymentReconciliations,
          eq(payments.id, paymentReconciliations.paymentId),
        )
        .where(
          and(
            eq(payments.id, paymentId),
            eq(sales.organizationId, auth.organization.id),
            inArray(sales.outletId, outletIds),
            ne(payments.settlementStatus, "not_applicable"),
          ),
        )
        .limit(1);

      if (!current) {
        throw new Error(
          "Payment berubah atau tidak lagi dapat direkonsiliasi.",
        );
      }

      if (
        !["paid", "partially_refunded", "refunded"].includes(
          current.paymentStatus,
        )
      ) {
        throw new Error("Payment belum berada pada status finansial yang valid.");
      }

      if (
        requiresResolvePermission({
          currentStatus: current.settlementStatus,
          nextStatus: status,
        }) &&
        !hasPermission(auth, "payments.reconciliation.resolve")
      ) {
        throw new Error(
          "Penyelesaian mismatch membutuhkan permission resolve.",
        );
      }

      previousEvidenceKey = current.evidenceKey;
      const nextEvidenceKey = uploadedEvidenceKey
        ? uploadedEvidenceKey
        : removeEvidence
          ? null
          : current.evidenceKey;
      const isResolved = status === "waived";

      const [saved] = await transaction
        .insert(paymentReconciliations)
        .values({
          organizationId: current.organizationId,
          outletId: current.outletId,
          paymentId,
          status,
          expectedAmount: String(expectedAmount),
          settlementGrossAmount:
            settlementGrossAmount == null
              ? null
              : String(settlementGrossAmount),
          feeAmount: String(feeAmount),
          taxAmount: String(taxAmount),
          netSettlementAmount:
            netSettlementAmount == null
              ? null
              : String(netSettlementAmount),
          differenceAmount: String(differenceAmount),
          settlementDate,
          settlementReference,
          evidenceKey: nextEvidenceKey,
          notes,
          reconciledBy: auth.user.id,
          reconciledAt: now,
          resolvedBy: isResolved ? auth.user.id : null,
          resolvedAt: isResolved ? now : null,
          metadata: {
            source: "manual_reconciliation_v1",
            paymentStatusAtReconciliation: current.paymentStatus,
          },
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: paymentReconciliations.paymentId,
          set: {
            status,
            expectedAmount: String(expectedAmount),
            settlementGrossAmount:
              settlementGrossAmount == null
                ? null
                : String(settlementGrossAmount),
            feeAmount: String(feeAmount),
            taxAmount: String(taxAmount),
            netSettlementAmount:
              netSettlementAmount == null
                ? null
                : String(netSettlementAmount),
            differenceAmount: String(differenceAmount),
            settlementDate,
            settlementReference,
            evidenceKey: nextEvidenceKey,
            notes,
            reconciledBy: auth.user.id,
            reconciledAt: now,
            resolvedBy: isResolved ? auth.user.id : null,
            resolvedAt: isResolved ? now : null,
            metadata: {
              source: "manual_reconciliation_v1",
              paymentStatusAtReconciliation: current.paymentStatus,
            },
            updatedAt: now,
          },
        })
        .returning({ id: paymentReconciliations.id });

      const [updatedPayment] = await transaction
        .update(payments)
        .set({ settlementStatus: status, updatedAt: now })
        .where(
          and(
            eq(payments.id, paymentId),
            ne(payments.settlementStatus, "not_applicable"),
          ),
        )
        .returning({ id: payments.id });

      if (!updatedPayment || !saved) {
        throw new Error("Status payment gagal diperbarui secara atomik.");
      }

      await transaction.insert(auditLogs).values({
        organizationId: current.organizationId,
        outletId: current.outletId,
        actorUserId: auth.user.id,
        action: current.reconciliationId
          ? "payment.reconciliation.update"
          : "payment.reconciliation.create",
        entityType: "payment_reconciliation",
        entityId: saved.id,
        beforeData: current.reconciliationId
          ? {
              status: current.reconciliationStatus,
              settlementGrossAmount: current.settlementGrossAmount,
              feeAmount: current.feeAmount,
              taxAmount: current.taxAmount,
              netSettlementAmount: current.netSettlementAmount,
              differenceAmount: current.differenceAmount,
              settlementDate: current.settlementDate,
              settlementReference: current.settlementReference,
              evidenceKey: current.evidenceKey,
              notes: current.notes,
              reconciledBy: current.reconciledBy,
              reconciledAt: current.reconciledAt,
              resolvedBy: current.resolvedBy,
              resolvedAt: current.resolvedAt,
            }
          : null,
        afterData: {
          paymentId,
          status,
          expectedAmount,
          settlementGrossAmount,
          feeAmount,
          taxAmount,
          netSettlementAmount,
          differenceAmount,
          settlementDate,
          settlementReference,
          evidenceKey: nextEvidenceKey,
          notes,
          reconciledBy: auth.user.id,
          reconciledAt: now,
          resolvedBy: isResolved ? auth.user.id : null,
          resolvedAt: isResolved ? now : null,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "admin.finance.manual_reconciliation",
          saleId: current.saleId,
          paymentId,
        },
        createdAt: now,
      });
    });
  } catch (error) {
    if (uploadedEvidenceKey) {
      await deleteReconciliationEvidenceFile(uploadedEvidenceKey).catch(
        () => undefined,
      );
    }

    redirectWithMessage(
      paymentId,
      "error",
      error instanceof Error
        ? error.message
        : "Rekonsiliasi pembayaran gagal disimpan.",
    );
  }

  if (
    previousEvidenceKey &&
    (removeEvidence || uploadedEvidenceKey) &&
    previousEvidenceKey !== uploadedEvidenceKey
  ) {
    await deleteReconciliationEvidenceFile(previousEvidenceKey).catch(
      () => undefined,
    );
  }

  revalidatePath("/admin/keuangan/rekonsiliasi");
  revalidatePath(getDetailPath(paymentId));
  revalidatePath(`/admin/penjualan/${preview.saleId}`);
  revalidatePath("/admin");

  redirectWithMessage(
    paymentId,
    "success",
    status === "reconciled"
      ? "Payment berhasil direkonsiliasi."
      : "Status rekonsiliasi berhasil disimpan.",
  );
}
