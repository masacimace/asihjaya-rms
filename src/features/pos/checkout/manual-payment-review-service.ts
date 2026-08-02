import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  approvals,
  auditLogs,
  manualPaymentPolicies,
  payments,
  sales,
} from "@/db/schema";
import type {
  PosCheckoutPayload,
  PosManualPaymentApproval,
} from "@/features/pos/contracts";
import {
  manualPaymentMethodLabels,
} from "@/features/pos/checkout/payment-methods";
import type { NormalizedCheckoutPayment } from "@/features/pos/checkout/types";
import {
  createManualPaymentVerificationFingerprint,
  DEFAULT_MANUAL_PAYMENT_POLICIES,
  isNonCashManualPaymentMethod,
  type ManualPaymentPolicy,
  type NonCashManualPaymentMethod,
} from "@/features/pos/manual-payment-verification";
import { isPostgresUniqueViolation } from "@/lib/db/postgres-errors";

export type ManualPaymentReviewAssessment = {
  fingerprint: string;
  requiresApproval: boolean;
  triggerReason: string;
  reviewAmount: number;
  duplicatePayments: Array<{
    paymentId: string;
    invoiceNumber: string;
    reference: string | null;
  }>;
};

type ManualPaymentReviewAuth = {
  organization: { id: string };
  user: { id: string; fullName: string };
};

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

type ManualPaymentApprovalRow = {
  id: string;
  status: "pending" | "approved" | "rejected";
  requestData: Record<string, unknown>;
  notes: string | null;
  responseNotes: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

export function mapPosManualPaymentApproval(
  row: ManualPaymentApprovalRow,
): PosManualPaymentApproval {
  return {
    id: row.id,
    status: row.status,
    reason: String(
      row.requestData.triggerReason ?? row.requestData.reason ?? row.notes ?? "",
    ).slice(0, 500),
    responseNotes: row.responseNotes,
    createdAtIso: row.createdAt.toISOString(),
    resolvedAtIso: row.resolvedAt?.toISOString() ?? null,
  };
}

export async function getManualPaymentPolicyMap(
  organizationId: string,
): Promise<Record<NonCashManualPaymentMethod, ManualPaymentPolicy>> {
  const rows = await db
    .select({
      method: manualPaymentPolicies.method,
      coVerificationThreshold: manualPaymentPolicies.coVerificationThreshold,
      evidenceThreshold: manualPaymentPolicies.evidenceThreshold,
      duplicateLookbackDays: manualPaymentPolicies.duplicateLookbackDays,
      isEnabled: manualPaymentPolicies.isEnabled,
    })
    .from(manualPaymentPolicies)
    .where(eq(manualPaymentPolicies.organizationId, organizationId));

  const policies = structuredClone(DEFAULT_MANUAL_PAYMENT_POLICIES);

  for (const row of rows) {
    const method = String(row.method);

    if (!isNonCashManualPaymentMethod(method)) continue;

    policies[method] = {
      method,
      coVerificationThreshold: Number(row.coVerificationThreshold),
      evidenceThreshold: Number(row.evidenceThreshold),
      duplicateLookbackDays: row.duplicateLookbackDays,
      isEnabled: row.isEnabled,
    };
  }

  return policies;
}

export async function assessManualPaymentReviewRequirement({
  organizationId,
  outletId,
  cashierId,
  itemIds,
  customerId,
  discountApprovalId,
  payments: normalizedPayments,
  policies,
}: {
  organizationId: string;
  outletId: string;
  cashierId: string;
  itemIds: string[];
  customerId: string | null;
  discountApprovalId: string | null;
  payments: NormalizedCheckoutPayment[];
  policies: Record<NonCashManualPaymentMethod, ManualPaymentPolicy>;
}): Promise<ManualPaymentReviewAssessment> {
  const nonCashPayments = normalizedPayments.filter((payment) =>
    isNonCashManualPaymentMethod(payment.method),
  );
  const duplicatePayments: ManualPaymentReviewAssessment["duplicatePayments"] =
    [];
  const thresholdMethods = new Set<string>();

  for (const payment of nonCashPayments) {
    const policy = policies[payment.method as NonCashManualPaymentMethod];

    if (payment.amount >= policy.coVerificationThreshold) {
      thresholdMethods.add(manualPaymentMethodLabels[payment.method]);
    }

    const lookbackDate = new Date(
      Date.now() - policy.duplicateLookbackDays * 24 * 60 * 60 * 1000,
    );
    const duplicateRows = await db
      .select({
        paymentId: payments.id,
        invoiceNumber: sales.invoiceNumber,
        reference: payments.providerReference,
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .where(
        and(
          eq(sales.organizationId, organizationId),
          eq(sales.outletId, outletId),
          eq(payments.method, payment.method),
          eq(payments.normalizedReference, payment.normalizedReference!),
          eq(payments.status, "paid"),
          gte(payments.createdAt, lookbackDate),
          sql`upper(regexp_replace(${payments.provider}, '\\s+', ' ', 'g')) = ${payment.normalizedProvider}`,
        ),
      )
      .limit(5);

    duplicatePayments.push(...duplicateRows);
  }

  const reasons: string[] = [];

  if (thresholdMethods.size > 0) {
    reasons.push(
      `Nominal ${Array.from(thresholdMethods).join(", ")} melewati threshold co-verification.`,
    );
  }

  if (duplicatePayments.length > 0) {
    reasons.push(
      `${duplicatePayments.length} reference pembayaran sudah pernah digunakan.`,
    );
  }

  const fingerprint = createManualPaymentVerificationFingerprint({
    organizationId,
    outletId,
    cashierId,
    itemIds,
    customerId,
    discountApprovalId,
    payments: normalizedPayments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      receivedAmount: payment.receivedAmount,
      changeAmount: payment.changeAmount,
      provider: payment.provider,
      reference: payment.reference,
      note: payment.note,
      verificationSource:
        payment.verificationSource as PosCheckoutPayload["payments"][number]["verificationSource"],
      providerPaidAtIso: payment.providerPaidAtIso,
      evidenceKey: payment.evidenceKey,
      verificationDetails: payment.verificationDetails,
    })),
  });

  return {
    fingerprint,
    requiresApproval: reasons.length > 0,
    triggerReason: reasons.join(" "),
    reviewAmount: nonCashPayments.reduce(
      (total, payment) => total + payment.amount,
      0,
    ),
    duplicatePayments,
  };
}

export async function getOrCreateManualPaymentApproval({
  auth,
  outletId,
  assessment,
  normalizedPayments,
  requestMetadata,
}: {
  auth: ManualPaymentReviewAuth;
  outletId: string;
  assessment: ManualPaymentReviewAssessment;
  normalizedPayments: NormalizedCheckoutPayment[];
  requestMetadata: RequestMetadata;
}) {
  const existingRows = await db
    .select({
      id: approvals.id,
      status: approvals.status,
      requestData: approvals.requestData,
      notes: approvals.notes,
      responseNotes: approvals.responseNotes,
      createdAt: approvals.createdAt,
      resolvedAt: approvals.resolvedAt,
    })
    .from(approvals)
    .where(
      and(
        eq(approvals.organizationId, auth.organization.id),
        eq(approvals.outletId, outletId),
        eq(approvals.requestedBy, auth.user.id),
        eq(approvals.type, "manual_payment_verification"),
        sql`${approvals.requestData}->>'verificationFingerprint' = ${assessment.fingerprint}`,
      ),
    )
    .orderBy(sql`${approvals.createdAt} desc`)
    .limit(1);

  if (existingRows[0]) return mapPosManualPaymentApproval(existingRows[0]);

  const now = new Date();
  const paymentMethodsLabel = Array.from(
    new Set(
      normalizedPayments
        .filter((payment) => payment.method !== "cash")
        .map((payment) => manualPaymentMethodLabels[payment.method]),
    ),
  ).join(", ");
  const requestData = {
    source: "pos.manual_payment_verification",
    verificationFingerprint: assessment.fingerprint,
    triggerReason: assessment.triggerReason,
    reviewAmount: assessment.reviewAmount,
    totalNonCashAmount: assessment.reviewAmount,
    paymentMethodsLabel,
    duplicateCount: assessment.duplicatePayments.length,
    duplicatePayments: assessment.duplicatePayments,
    requesterName: auth.user.fullName,
    payments: normalizedPayments
      .filter((payment) => payment.method !== "cash")
      .map((payment) => ({
        method: payment.method,
        methodLabel: manualPaymentMethodLabels[payment.method],
        amount: payment.amount,
        provider: payment.provider,
        reference: payment.reference,
        verificationSource: payment.verificationSource,
        providerPaidAtIso: payment.providerPaidAtIso,
        evidenceKey: payment.evidenceKey,
        verificationDetails: payment.verificationDetails,
      })),
  };

  let insertedApproval: ManualPaymentApprovalRow | null = null;

  try {
    const insertedRows = await db
      .insert(approvals)
      .values({
        organizationId: auth.organization.id,
        outletId,
        type: "manual_payment_verification",
        status: "pending",
        requestedBy: auth.user.id,
        approvedBy: null,
        referenceType: "pos_manual_payment",
        referenceId: null,
        requestData,
        notes: assessment.triggerReason,
        responseNotes: null,
        createdAt: now,
        resolvedAt: null,
      })
      .returning({
        id: approvals.id,
        status: approvals.status,
        requestData: approvals.requestData,
        notes: approvals.notes,
        responseNotes: approvals.responseNotes,
        createdAt: approvals.createdAt,
        resolvedAt: approvals.resolvedAt,
      });

    insertedApproval = insertedRows[0] ?? null;
  } catch (error) {
    if (
      !isPostgresUniqueViolation(
        error,
        "approvals_manual_payment_fingerprint_uq",
      )
    ) {
      throw error;
    }

    const [concurrentApproval] = await db
      .select({
        id: approvals.id,
        status: approvals.status,
        requestData: approvals.requestData,
        notes: approvals.notes,
        responseNotes: approvals.responseNotes,
        createdAt: approvals.createdAt,
        resolvedAt: approvals.resolvedAt,
      })
      .from(approvals)
      .where(
        and(
          eq(approvals.organizationId, auth.organization.id),
          eq(approvals.outletId, outletId),
          eq(approvals.requestedBy, auth.user.id),
          eq(approvals.type, "manual_payment_verification"),
          sql`${approvals.requestData}->>'verificationFingerprint' = ${assessment.fingerprint}`,
        ),
      )
      .limit(1);

    if (concurrentApproval) {
      return mapPosManualPaymentApproval(concurrentApproval);
    }

    throw error;
  }

  if (!insertedApproval) {
    throw new Error("MANUAL_PAYMENT_APPROVAL_INSERT_FAILED");
  }

  await db.insert(auditLogs).values({
    organizationId: auth.organization.id,
    outletId,
    actorUserId: auth.user.id,
    action: "approval.request_manual_payment_verification",
    entityType: "approval",
    entityId: insertedApproval.id,
    beforeData: null,
    afterData: {
      status: "pending",
      type: "manual_payment_verification",
      requestData,
    },
    reason: assessment.triggerReason,
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
    metadata: {
      verificationFingerprint: assessment.fingerprint,
      duplicateCount: assessment.duplicatePayments.length,
      reviewAmount: assessment.reviewAmount,
    },
    createdAt: now,
  });

  revalidatePath("/admin/operasional/approval");
  revalidatePath("/admin");

  return mapPosManualPaymentApproval(insertedApproval);
}
