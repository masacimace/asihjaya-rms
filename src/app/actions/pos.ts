"use server";

import { createHash, randomUUID } from "node:crypto";

import {
  and,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  approvals,
  auditLogs,
  cashMovements,
  customers,
  hardwareAgents,
  inventoryMovements,
  manualPaymentPolicies,
  manualPaymentProfiles,
  paymentEvidenceUploads,
  outlets,
  payments,
  posHeldCartItems,
  posHeldCarts,
  productCategories,
  productItems,
  productMasters,
  registers,
  saleItems,
  sales,
  shifts,
  users,
} from "@/db/schema";
import {
  type PosCheckoutActionResult,
  type PosCheckoutPayload,
  type PosDiscountApproval,
  type PosDiscountApprovalActionResult,
  type PosDiscountApprovalPayload,
  type PosDiscountApprovalStatusResult,
  type PosManualPaymentApproval,
  type PosManualPaymentApprovalStatusResult,
  type PosPaymentEvidenceUploadResult,
  type PosHeldCartActionResult,
  type PosHeldCartItem,
  type PosHeldCartSummary,
  type PosHoldCartPayload,
  type PosManualPaymentMethod,
  type PosScanLookupResult,
  type PosShiftActionState,
} from "@/features/pos/contracts";
import {
  claimPosCheckoutAttempt,
  getPosCheckoutAttemptByKey,
  markPosCheckoutAttemptCompleted,
  markPosCheckoutAttemptFailed,
} from "@/features/pos/checkout-attempt-service";
import {
  getPosCheckoutRecoveryStatus,
  getPosCheckoutSaleResult,
  POS_CHECKOUT_RECOVERY_RETRY_AFTER_MS,
} from "@/features/pos/checkout-recovery";
import { isValidPosCheckoutIdempotencyKey } from "@/features/pos/checkout-fingerprint";
import {
  DEFAULT_POS_REGISTER_MISSING_MESSAGE,
  DEFAULT_POS_REGISTER_SHIFT_MESSAGE,
  getDefaultPosRegisterCondition,
} from "@/features/pos/context";
import { lookupPosItemByScanValue } from "@/features/pos/queries";
import {
  publishSaleCompletedNotificationInTransaction,
  publishSaleRecoveryNotification,
  publishSaleRecoveryNotificationInTransaction,
} from "@/features/notifications/sales";
import {
  createManualPaymentVerificationFingerprint,
  DEFAULT_MANUAL_PAYMENT_POLICIES,
  getManualPaymentProfileType,
  isNonCashManualPaymentMethod,
  normalizeAndValidateManualPaymentVerification,
  type ManualPaymentPolicy,
  type NonCashManualPaymentMethod,
} from "@/features/pos/manual-payment-verification";
import { requirePermission } from "@/lib/auth/session";
import { buildReceiptDocumentPayloadV2 } from "@/lib/hardware/job-payload-contracts-v2";
import {
  createHardwareJobV2,
  createHardwareJobV2InTransaction,
} from "@/lib/hardware/job-producer-v2";
import {
  deletePaymentEvidenceFile,
  storePaymentEvidenceFile,
} from "@/lib/storage/payment-evidence-storage";
import {
  closeShiftWithReconciliation,
  parseShiftClosingActualCash,
  ShiftClosingError,
} from "@/lib/shifts/shift-closing";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POS_TRANSACTIONS_PATH = "/pos/transaksi";
const POS_CUSTOMERS_PATH = "/pos/pelanggan";
const POS_HELD_CARTS_PATH = "/pos/ditahan";
const HARDWARE_AGENT_ONLINE_WINDOW_MS = 90 * 1000;
const HARDWARE_AGENT_STALE_WINDOW_MS = 5 * 60 * 1000;

const manualPaymentMethodLabels: Record<PosManualPaymentMethod, string> = {
  cash: "Cash",
  qris_manual: "QRIS Manual",
  debit_card: "Debit Card EDC",
  credit_card: "Credit Card EDC",
  bank_transfer: "Bank Transfer",
};

const manualPaymentMethods = Object.keys(
  manualPaymentMethodLabels,
) as PosManualPaymentMethod[];

type NormalizedCheckoutPayment = {
  method: PosManualPaymentMethod;
  amount: number;
  receivedAmount: number | null;
  changeAmount: number;
  provider: string | null;
  reference: string | null;
  note: string | null;
  verificationSource: string | null;
  providerPaidAt: Date | null;
  providerPaidAtIso: string | null;
  evidenceKey: string | null;
  manualPaymentProfileId: string | null;
  manualPaymentProfileName: string | null;
  manualPaymentProfileCode: string | null;
  manualPaymentProfileRegisterId: string | null;
  verificationDetails: Record<string, string | null>;
  normalizedProvider: string | null;
  normalizedReference: string | null;
};

class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): PosShiftActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function success(message: string): PosShiftActionState {
  return {
    status: "success",
    message,
  };
}

function checkoutFailure(
  message: string,
  fieldErrors?: Record<string, string>,
  code: Extract<PosCheckoutActionResult, { status: "error" }>["code"] =
    "validation_error",
): PosCheckoutActionResult {
  return {
    status: "error",
    message,
    code,
    fieldErrors,
  };
}

function getSafePosTransactionsReturnTo(value: string) {
  const trimmedValue = value.trim();

  if (
    !trimmedValue ||
    trimmedValue.includes("\n") ||
    trimmedValue.includes("\r") ||
    !trimmedValue.startsWith(POS_TRANSACTIONS_PATH)
  ) {
    return POS_TRANSACTIONS_PATH;
  }

  return trimmedValue.slice(0, 500);
}

function redirectPosTransactionsWithFeedback({
  returnTo,
  type,
  message,
}: {
  returnTo: string;
  type: "success" | "error" | "info";
  message: string;
}): never {
  const safeReturnTo = getSafePosTransactionsReturnTo(returnTo);
  const queryStartIndex = safeReturnTo.indexOf("?");
  const path =
    queryStartIndex >= 0
      ? safeReturnTo.slice(0, queryStartIndex)
      : safeReturnTo;
  const search =
    queryStartIndex >= 0 ? safeReturnTo.slice(queryStartIndex + 1) : "";
  const params = new URLSearchParams(search);

  params.set("feedbackType", type);
  params.set("feedbackMessage", message);

  redirect(`${path}?${params.toString()}`);
}

function getSafePosCustomersReturnTo(value: string) {
  const trimmedValue = value.trim();

  if (
    !trimmedValue ||
    trimmedValue.includes("\n") ||
    trimmedValue.includes("\r") ||
    !trimmedValue.startsWith(POS_CUSTOMERS_PATH)
  ) {
    return POS_CUSTOMERS_PATH;
  }

  return trimmedValue.slice(0, 500);
}

function redirectPosCustomersWithFeedback({
  returnTo,
  type,
  message,
}: {
  returnTo: string;
  type: "success" | "error" | "info";
  message: string;
}): never {
  const safeReturnTo = getSafePosCustomersReturnTo(returnTo);
  const queryStartIndex = safeReturnTo.indexOf("?");
  const path =
    queryStartIndex >= 0
      ? safeReturnTo.slice(0, queryStartIndex)
      : safeReturnTo;
  const search =
    queryStartIndex >= 0 ? safeReturnTo.slice(queryStartIndex + 1) : "";
  const params = new URLSearchParams(search);

  params.set("feedbackType", type);
  params.set("feedbackMessage", message);

  redirect(`${path}?${params.toString()}`);
}

function getHardwareAgentQueueState(
  agents: Array<{
    status: "online" | "offline" | "disabled";
    lastSeenAt: Date | null;
  }>,
  now: Date,
) {
  const activeAgents = agents.filter((agent) => agent.status !== "disabled");

  if (activeAgents.length === 0) {
    return "not_configured" as const;
  }

  if (
    activeAgents.some(
      (agent) =>
        agent.status === "online" &&
        agent.lastSeenAt &&
        now.getTime() - agent.lastSeenAt.getTime() <=
          HARDWARE_AGENT_ONLINE_WINDOW_MS,
    )
  ) {
    return "online" as const;
  }

  if (
    activeAgents.some(
      (agent) =>
        agent.lastSeenAt &&
        now.getTime() - agent.lastSeenAt.getTime() <=
          HARDWARE_AGENT_STALE_WINDOW_MS,
    )
  ) {
    return "stale" as const;
  }

  return "offline" as const;
}

function getReprintQueuedMessage({
  invoiceNumber,
  duplicate,
  queueState,
}: {
  invoiceNumber: string;
  duplicate: boolean;
  queueState: "online" | "stale" | "offline";
}) {
  if (duplicate) {
    return `Job cetak ulang invoice ${invoiceNumber} masih aktif di antrean. Cek statusnya di bagian Dokumen & Print Job.`;
  }

  if (queueState === "online") {
    return `Job cetak ulang invoice ${invoiceNumber} sudah masuk antrean printer.`;
  }

  if (queueState === "stale") {
    return `Job cetak ulang invoice ${invoiceNumber} sudah masuk antrean, tetapi Hardware Hub terakhir terlihat beberapa menit lalu. Cek Mini PC jika belum tercetak.`;
  }

  return `Job cetak ulang invoice ${invoiceNumber} sudah masuk antrean, tetapi Hardware Hub sedang offline. Nyalakan Mini PC Hardware Hub agar job diproses.`;
}

function getSystemErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const extraDetails: string[] = [];
    const maybeDbError = error as Error & {
      code?: string;
      detail?: string;
      constraint?: string;
      table?: string;
      column?: string;
      cause?: unknown;
    };

    if (maybeDbError.code) {
      extraDetails.push(`code=${maybeDbError.code}`);
    }

    if (maybeDbError.table) {
      extraDetails.push(`table=${maybeDbError.table}`);
    }

    if (maybeDbError.column) {
      extraDetails.push(`column=${maybeDbError.column}`);
    }

    if (maybeDbError.constraint) {
      extraDetails.push(`constraint=${maybeDbError.constraint}`);
    }

    if (maybeDbError.detail) {
      extraDetails.push(maybeDbError.detail);
    }

    const cause = maybeDbError.cause;

    if (cause instanceof Error && cause.message !== error.message) {
      extraDetails.push(`cause=${cause.message}`);
    }

    return [error.message, ...extraDetails].filter(Boolean).join(" | ");
  }

  return String(error);
}

function checkoutSuccess({
  message,
  sale,
  recovery,
}: {
  message: string;
  sale: Extract<PosCheckoutActionResult, { status: "success" }>["sale"];
  recovery: Extract<
    PosCheckoutActionResult,
    { status: "success" }
  >["recovery"];
}): PosCheckoutActionResult {
  return {
    status: "success",
    message,
    sale,
    recovery,
  };
}

function checkoutProcessing(
  idempotencyKey: string,
  message = "Transaksi masih diproses. Jangan membuat transaksi baru.",
): PosCheckoutActionResult {
  return {
    status: "processing",
    message,
    idempotencyKey,
    retryAfterMs: POS_CHECKOUT_RECOVERY_RETRY_AFTER_MS,
  };
}

function posDiscountFailure(
  message: string,
  fieldErrors?: Record<string, string>,
): PosDiscountApprovalActionResult {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function mapPosDiscountApproval(row: {
  id: string;
  status: "pending" | "approved" | "rejected";
  requestData: Record<string, unknown>;
  notes: string | null;
  responseNotes: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}): PosDiscountApproval {
  const rawAmount = row.requestData.discountAmount;
  const discountAmount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string"
        ? Number(rawAmount)
        : 0;

  return {
    id: row.id,
    status: row.status,
    discountAmount: Number.isSafeInteger(discountAmount) ? discountAmount : 0,
    reason: String(row.requestData.reason ?? row.notes ?? "").slice(0, 500),
    responseNotes: row.responseNotes,
    createdAtIso: row.createdAt.toISOString(),
    resolvedAtIso: row.resolvedAt?.toISOString() ?? null,
  };
}

function mapPosManualPaymentApproval(row: {
  id: string;
  status: "pending" | "approved" | "rejected";
  requestData: Record<string, unknown>;
  notes: string | null;
  responseNotes: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}): PosManualPaymentApproval {
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

function checkoutApprovalRequired(
  approval: PosManualPaymentApproval,
  message: string,
): PosCheckoutActionResult {
  return {
    status: "approval_required",
    message,
    approval,
  };
}

async function getManualPaymentPolicyMap(
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
    if (!isNonCashManualPaymentMethod(row.method)) continue;

    policies[row.method] = {
      method: row.method,
      coVerificationThreshold: Number(row.coVerificationThreshold),
      evidenceThreshold: Number(row.evidenceThreshold),
      duplicateLookbackDays: row.duplicateLookbackDays,
      isEnabled: row.isEnabled,
    };
  }

  return policies;
}

type ManualPaymentReviewAssessment = {
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

async function assessManualPaymentReviewRequirement({
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
  const duplicatePayments: ManualPaymentReviewAssessment["duplicatePayments"] = [];
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

async function getOrCreateManualPaymentApproval({
  auth,
  outletId,
  assessment,
  normalizedPayments,
  requestMetadata,
}: {
  auth: Awaited<ReturnType<typeof requirePermission>>;
  outletId: string;
  assessment: ManualPaymentReviewAssessment;
  normalizedPayments: NormalizedCheckoutPayment[];
  requestMetadata: Awaited<ReturnType<typeof getRequestMetadata>>;
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

  let insertedApproval: {
    id: string;
    status: "pending" | "approved" | "rejected";
    requestData: Record<string, unknown>;
    notes: string | null;
    responseNotes: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  } | null = null;

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

  if (!insertedApproval) throw new Error("MANUAL_PAYMENT_APPROVAL_INSERT_FAILED");

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

function createPosCartFingerprint({
  outletId,
  itemIds,
  subtotalAmount,
  discountAmount,
}: {
  outletId: string;
  itemIds: string[];
  subtotalAmount: number;
  discountAmount: number;
}) {
  const source = JSON.stringify({
    outletId,
    itemIds: [...itemIds].sort(),
    subtotalAmount,
    discountAmount,
  });

  return createHash("sha256").update(source).digest("hex");
}

function getDiscountPercent(discountAmount: number, subtotalAmount: number) {
  if (subtotalAmount <= 0) return 0;

  return Number(((discountAmount / subtotalAmount) * 100).toFixed(2));
}

function allocateLineDiscounts({
  itemAmounts,
  discountAmount,
}: {
  itemAmounts: number[];
  discountAmount: number;
}) {
  if (discountAmount <= 0) {
    return itemAmounts.map(() => 0);
  }

  const subtotalAmount = itemAmounts.reduce((total, amount) => total + amount, 0);

  if (subtotalAmount <= 0) {
    return itemAmounts.map(() => 0);
  }

  let allocatedAmount = 0;

  return itemAmounts.map((amount, index) => {
    if (index === itemAmounts.length - 1) {
      return Math.max(0, discountAmount - allocatedAmount);
    }

    const lineDiscount = Math.min(
      amount,
      Math.floor((amount / subtotalAmount) * discountAmount),
    );

    allocatedAmount += lineDiscount;

    return lineDiscount;
  });
}

function readText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseCashAmount(value: string) {
  if (!value) {
    return 0;
  }

  const numericValue = value.replace(/[^0-9]/g, "");

  if (!numericValue) {
    return 0;
  }

  const parsedAmount = Number(numericValue);

  return Number.isSafeInteger(parsedAmount) ? parsedAmount : Number.NaN;
}

function parseDbAmount(amount: string | null) {
  if (!amount) {
    return 0;
  }

  const parsedAmount = Number(amount);

  return Number.isSafeInteger(parsedAmount) ? parsedAmount : 0;
}

function normalizeNullableText(value: string | null | undefined, maxLength: number) {
  const trimmedValue = String(value ?? "").trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.slice(0, maxLength);
}

function normalizeRequiredText(value: string | null | undefined, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeEmail(value: string | null | undefined) {
  const email = normalizeNullableText(value, 254)?.toLowerCase() ?? null;

  if (!email) {
    return null;
  }

  return email;
}

function generateCustomerCode(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const randomSuffix = randomUUID().slice(0, 8).toUpperCase();

  return `CUST-${year}${month}${day}-${randomSuffix}`;
}

function isManualPaymentMethod(
  value: string,
): value is PosManualPaymentMethod {
  return manualPaymentMethods.includes(value as PosManualPaymentMethod);
}

function getPaymentProvider({
  method,
  provider,
}: {
  method: PosManualPaymentMethod;
  provider: string | null;
}) {
  if (provider) {
    return provider;
  }

  return method === "cash" ? "cash" : "manual";
}

function generateInvoiceNumber({
  outletCode,
  date,
}: {
  outletCode: string;
  date: Date;
}) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const randomSuffix = randomUUID().slice(0, 8).toUpperCase();

  return `AJ-${outletCode}-${year}${month}${day}-${randomSuffix}`.slice(0, 80);
}

function generateHoldNumber({
  outletCode,
  date,
}: {
  outletCode: string;
  date: Date;
}) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const randomSuffix = randomUUID().slice(0, 8).toUpperCase();

  return `HOLD-${outletCode}-${year}${month}${day}-${randomSuffix}`.slice(0, 80);
}

function heldCartFailure(
  message: string,
  fieldErrors?: Record<string, string>,
): PosHeldCartActionResult {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function heldCartSuccess({
  message,
  heldCart,
  items,
}: {
  message: string;
  heldCart: PosHeldCartSummary;
  items?: PosHeldCartItem[];
}): PosHeldCartActionResult {
  return {
    status: "success",
    message,
    heldCart,
    items,
  };
}

function isPostgresUniqueViolation(error: unknown, constraintName: string) {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeDbError = error as Error & {
    code?: string;
    constraint?: string;
    cause?: unknown;
  };

  if (maybeDbError.code === "23505" && maybeDbError.constraint === constraintName) {
    return true;
  }

  const cause = maybeDbError.cause as
    | {
        code?: string;
        constraint?: string;
      }
    | undefined;

  return cause?.code === "23505" && cause.constraint === constraintName;
}

function mapHeldCartSummary(row: {
  id: string;
  holdNumber: string;
  status: "active" | "resumed" | "canceled";
  title: string | null;
  note: string | null;
  itemCount: number;
  subtotalAmount: string;
  discountAmount: string;
  totalAmount: string;
  createdAt: Date;
  updatedAt: Date;
  shiftId: string;
  registerId: string;
  customerId: string | null;
  customerCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  heldByUserId: string;
  heldByName: string;
}): PosHeldCartSummary {
  return {
    id: row.id,
    holdNumber: row.holdNumber,
    status: row.status,
    title: row.title,
    note: row.note,
    itemCount: row.itemCount,
    subtotalAmount: row.subtotalAmount,
    discountAmount: row.discountAmount,
    totalAmount: row.totalAmount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    customer: row.customerId
      ? {
          id: row.customerId,
          customerCode: row.customerCode,
          fullName: row.customerName ?? "Customer tanpa nama",
          phone: row.customerPhone,
          email: row.customerEmail,
        }
      : null,
    heldBy: {
      id: row.heldByUserId,
      fullName: row.heldByName,
    },
    shiftId: row.shiftId,
    registerId: row.registerId,
  };
}

async function getRequestMetadata() {
  const headerStore = await headers();

  const forwardedFor = headerStore.get("x-forwarded-for");

  const ipAddress =
    forwardedFor?.split(",")[0]?.trim().slice(0, 64) ??
    headerStore.get("x-real-ip")?.slice(0, 64) ??
    null;

  return {
    ipAddress,
    userAgent: headerStore.get("user-agent"),
  };
}

export async function uploadPosPaymentEvidenceAction(
  formData: FormData,
): Promise<PosPaymentEvidenceUploadResult> {
  const auth = await requirePermission("sales.create");

  if (!auth.permissionCodes.includes("pos.access")) {
    return { status: "error", message: "User ini belum memiliki akses POS." };
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { status: "error", message: "Pilih foto bukti pembayaran." };
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  if (!primaryOutlet) {
    return { status: "error", message: "Outlet POS tidak tersedia." };
  }

  let storedEvidence: Awaited<ReturnType<typeof storePaymentEvidenceFile>> | null =
    null;

  try {
    storedEvidence = await storePaymentEvidenceFile({
      file,
      organizationId: auth.organization.id,
    });

    await db.insert(paymentEvidenceUploads).values({
      organizationId: auth.organization.id,
      outletId: primaryOutlet.id,
      uploadedBy: auth.user.id,
      storageKey: storedEvidence.key,
      originalFilename: file.name.slice(0, 255) || null,
      sizeBytes: storedEvidence.sizeBytes,
      saleId: null,
      attachedAt: null,
      createdAt: new Date(),
    });

    return {
      status: "success",
      message: "Bukti pembayaran berhasil diunggah.",
      evidenceKey: storedEvidence.key,
    };
  } catch (error) {
    if (storedEvidence) {
      await deletePaymentEvidenceFile(storedEvidence.key).catch(() => undefined);
    }

    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Bukti pembayaran gagal diunggah.",
    };
  }
}

export async function getPosManualPaymentApprovalStatusAction(
  approvalId: string,
): Promise<PosManualPaymentApprovalStatusResult> {
  const auth = await requirePermission("pos.access");
  const normalizedApprovalId = String(approvalId ?? "").trim();

  if (!UUID_PATTERN.test(normalizedApprovalId)) {
    return { status: "error", message: "ID approval pembayaran tidak valid." };
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];
  const [approval] = await db
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
        eq(approvals.id, normalizedApprovalId),
        eq(approvals.organizationId, auth.organization.id),
        eq(approvals.requestedBy, auth.user.id),
        eq(approvals.type, "manual_payment_verification"),
        primaryOutlet ? eq(approvals.outletId, primaryOutlet.id) : sql`true`,
      ),
    )
    .limit(1);

  if (!approval) {
    return {
      status: "not_found",
      message: "Approval pembayaran manual tidak ditemukan untuk akun POS ini.",
    };
  }

  const mappedApproval = mapPosManualPaymentApproval(approval);

  return {
    status: "found",
    message:
      mappedApproval.status === "approved"
        ? "Pembayaran manual sudah diverifikasi. Proses checkout kembali."
        : mappedApproval.status === "rejected"
          ? "Verifikasi pembayaran ditolak. Perbaiki data payment sebelum mencoba lagi."
          : "Pembayaran masih menunggu verifikasi manager/finance.",
    approval: mappedApproval,
  };
}

export async function requestPosDiscountApprovalAction(
  payload: PosDiscountApprovalPayload,
): Promise<PosDiscountApprovalActionResult> {
  const auth = await requirePermission("sales.create");

  if (!auth.permissionCodes.includes("pos.access")) {
    return posDiscountFailure("User ini belum memiliki akses POS.");
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  if (!primaryOutlet) {
    return posDiscountFailure(
      "Outlet aktif tidak ditemukan. Hubungi manager/admin untuk mengatur akses outlet staff ini.",
    );
  }

  const fieldErrors: Record<string, string> = {};
  const itemIds = Array.from(new Set(payload.itemIds ?? []));
  const discountAmount = Number(payload.discountAmount);
  const reason = normalizeRequiredText(payload.reason, 500);
  const customerId = normalizeNullableText(payload.customerId, 36);

  if (itemIds.length === 0) {
    fieldErrors.items = "Tambahkan minimal satu item sebelum meminta diskon.";
  }

  if (itemIds.length > 50) {
    fieldErrors.items = "Maksimal 50 item dalam satu request diskon.";
  }

  if (itemIds.some((itemId) => !UUID_PATTERN.test(itemId))) {
    fieldErrors.items = "Ada item diskon yang tidak valid.";
  }

  if (!Number.isSafeInteger(discountAmount) || discountAmount <= 0) {
    fieldErrors.discountAmount = "Nominal diskon harus lebih dari Rp0.";
  }

  if (reason.length < 5) {
    fieldErrors.reason = "Alasan diskon minimal 5 karakter.";
  }

  if (customerId && !UUID_PATTERN.test(customerId)) {
    fieldErrors.customerId = "Customer yang dipilih tidak valid.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return posDiscountFailure("Periksa kembali request diskon POS.", fieldErrors);
  }

  const requestMetadata = await getRequestMetadata();

  try {
    const approval = await db.transaction(async (transaction) => {
      const now = new Date();

      const registerRows = await transaction
        .select({
          id: registers.id,
          code: registers.code,
          name: registers.name,
          outletId: registers.outletId,
        })
        .from(registers)
        .where(getDefaultPosRegisterCondition(primaryOutlet.id))
        .orderBy(registers.name)
        .limit(1);

      const register = registerRows[0];

      if (!register) {
        throw new CheckoutValidationError(DEFAULT_POS_REGISTER_MISSING_MESSAGE);
      }

      const activeShiftRows = await transaction
        .select({ id: shifts.id, status: shifts.status })
        .from(shifts)
        .where(
          and(
            eq(shifts.outletId, primaryOutlet.id),
            eq(shifts.registerId, register.id),
            eq(shifts.status, "open"),
          ),
        )
        .orderBy(sql`${shifts.openedAt} desc`)
        .limit(1);

      const activeShift = activeShiftRows[0];

      if (!activeShift) {
        throw new CheckoutValidationError(
          "Shift aktif belum dibuka. Buka shift terlebih dahulu sebelum meminta diskon.",
        );
      }

      const selectedCustomer = customerId
        ? (
            await transaction
              .select({
                id: customers.id,
                customerCode: customers.customerCode,
                fullName: customers.fullName,
                phone: customers.phone,
                email: customers.email,
              })
              .from(customers)
              .where(
                and(
                  eq(customers.id, customerId),
                  eq(customers.organizationId, auth.organization.id),
                  eq(customers.isActive, true),
                ),
              )
              .limit(1)
          )[0]
        : null;

      if (customerId && !selectedCustomer) {
        throw new CheckoutValidationError(
          "Customer yang dipilih tidak ditemukan atau sudah tidak aktif.",
        );
      }

      const itemRows = await transaction
        .select({
          id: productItems.id,
          sku: productItems.sku,
          barcode: productItems.barcode,
          serialNumber: productItems.serialNumber,
          currentOutletId: productItems.currentOutletId,
          sellingAmount: productItems.sellingAmount,
          availability: productItems.availability,
          condition: productItems.condition,
          locationState: productItems.locationState,
          isActive: productItems.isActive,
          productCode: productMasters.code,
          productName: sql<string>`coalesce(${productItems.displayName}, ${productMasters.name})`,
          productStatus: productMasters.status,
          categoryName: productCategories.name,
          categoryIsActive: productCategories.isActive,
        })
        .from(productItems)
        .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
        .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
        .where(
          and(
            eq(productItems.organizationId, auth.organization.id),
            inArray(productItems.id, itemIds),
          ),
        );

      if (itemRows.length !== itemIds.length) {
        throw new CheckoutValidationError(
          "Sebagian item tidak ditemukan. Refresh POS lalu coba ulang.",
        );
      }

      const itemMap = new Map(itemRows.map((item) => [item.id, item]));
      const orderedItems = itemIds.map((itemId) => itemMap.get(itemId));

      for (const item of orderedItems) {
        if (!item) {
          throw new CheckoutValidationError("Ada item diskon yang tidak ditemukan.");
        }

        if (
          !item.isActive ||
          item.productStatus !== "active" ||
          !item.categoryIsActive ||
          item.currentOutletId !== primaryOutlet.id ||
          item.availability !== "available" ||
          item.condition !== "good" ||
          item.locationState !== "outlet"
        ) {
          throw new CheckoutValidationError(
            `${item.sku} belum memenuhi syarat untuk request diskon POS. Refresh POS lalu coba ulang.`,
          );
        }

        if (parseDbAmount(item.sellingAmount) <= 0) {
          throw new CheckoutValidationError(`${item.sku} belum memiliki harga jual.`);
        }
      }

      const subtotalAmount = orderedItems.reduce(
        (total, item) => total + parseDbAmount(item!.sellingAmount),
        0,
      );

      if (discountAmount >= subtotalAmount) {
        throw new CheckoutValidationError(
          "Nominal diskon harus lebih kecil dari subtotal transaksi.",
        );
      }

      const cartFingerprint = createPosCartFingerprint({
        outletId: primaryOutlet.id,
        itemIds,
        subtotalAmount,
        discountAmount,
      });

      const existingRows = await transaction
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
            eq(approvals.outletId, primaryOutlet.id),
            eq(approvals.requestedBy, auth.user.id),
            eq(approvals.type, "discount"),
            eq(approvals.status, "pending"),
            sql`${approvals.requestData}->>'cartFingerprint' = ${cartFingerprint}`,
          ),
        )
        .orderBy(sql`${approvals.createdAt} desc`)
        .limit(1);

      const existingApproval = existingRows[0];

      if (existingApproval) {
        return mapPosDiscountApproval(existingApproval);
      }

      const requestData = {
        source: "pos.discount_request",
        reason,
        cartFingerprint,
        outletId: primaryOutlet.id,
        outletCode: primaryOutlet.code,
        outletName: primaryOutlet.name,
        registerId: register.id,
        registerCode: register.code,
        registerName: register.name,
        shiftId: activeShift.id,
        requestedBy: auth.user.id,
        requesterName: auth.user.fullName,
        customerId: selectedCustomer?.id ?? null,
        customerCode: selectedCustomer?.customerCode ?? null,
        customerName: selectedCustomer?.fullName ?? null,
        itemCount: orderedItems.length,
        subtotal: subtotalAmount,
        subtotalAmount,
        discountAmount,
        requestedTotalAmount: subtotalAmount - discountAmount,
        discountPercent: getDiscountPercent(discountAmount, subtotalAmount),
        items: orderedItems.map((item) => ({
          id: item!.id,
          sku: item!.sku,
          barcode: item!.barcode,
          serialNumber: item!.serialNumber,
          productCode: item!.productCode,
          productName: item!.productName,
          categoryName: item!.categoryName,
          price: parseDbAmount(item!.sellingAmount),
        })),
      };

      const insertedRows = await transaction
        .insert(approvals)
        .values({
          organizationId: auth.organization.id,
          outletId: primaryOutlet.id,
          type: "discount",
          status: "pending",
          requestedBy: auth.user.id,
          approvedBy: null,
          referenceType: "pos_cart",
          referenceId: null,
          requestData,
          notes: reason,
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

      const insertedApproval = insertedRows[0];

      if (!insertedApproval) {
        throw new Error("POS_DISCOUNT_APPROVAL_INSERT_FAILED");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        actorUserId: auth.user.id,
        action: "approval.request_discount",
        entityType: "approval",
        entityId: insertedApproval.id,
        beforeData: null,
        afterData: {
          status: "pending",
          type: "discount",
          requestData,
        },
        reason,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.discount_request",
          cartFingerprint,
          discountAmount,
          subtotalAmount,
        },
        createdAt: now,
      });

      return mapPosDiscountApproval(insertedApproval);
    });

    revalidatePath("/admin");
    revalidatePath("/admin/operasional/approval");
    revalidatePath("/pos");

    return {
      status: "success",
      message:
        approval.status === "pending"
          ? "Request diskon dikirim. Tunggu manager/owner memproses approval."
          : "Request diskon ditemukan.",
      approval,
    };
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return posDiscountFailure(error.message);
    }

    throw error;
  }
}

export async function getPosDiscountApprovalStatusAction(
  approvalId: string,
): Promise<PosDiscountApprovalStatusResult> {
  const auth = await requirePermission("pos.access");
  const normalizedApprovalId = String(approvalId ?? "").trim();

  if (!UUID_PATTERN.test(normalizedApprovalId)) {
    return {
      status: "error",
      message: "ID approval diskon tidak valid.",
    };
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  const rows = await db
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
        eq(approvals.id, normalizedApprovalId),
        eq(approvals.organizationId, auth.organization.id),
        eq(approvals.requestedBy, auth.user.id),
        eq(approvals.type, "discount"),
        primaryOutlet ? eq(approvals.outletId, primaryOutlet.id) : sql`true`,
      ),
    )
    .limit(1);

  const approval = rows[0];

  if (!approval) {
    return {
      status: "not_found",
      message: "Approval diskon tidak ditemukan untuk akun POS ini.",
    };
  }

  const mappedApproval = mapPosDiscountApproval(approval);

  return {
    status: "found",
    message:
      mappedApproval.status === "approved"
        ? "Diskon sudah disetujui. Diskon bisa diterapkan ke cart."
        : mappedApproval.status === "rejected"
          ? "Request diskon ditolak. Gunakan harga normal atau ajukan ulang."
          : "Request diskon masih menunggu approval manager/owner.",
    approval: mappedApproval,
  };
}

export async function createPosCustomerAction(formData: FormData) {
  const auth = await requirePermission("pos.access");
  const returnTo = readText(formData, "returnTo") || POS_CUSTOMERS_PATH;
  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  const fullName = normalizeRequiredText(readText(formData, "fullName"), 180);
  const phone = normalizeNullableText(readText(formData, "phone"), 32);
  const email = normalizeEmail(readText(formData, "email"));
  const address = normalizeNullableText(readText(formData, "address"), 1000);
  const notes = normalizeNullableText(readText(formData, "notes"), 500);

  if (fullName.length < 2) {
    redirectPosCustomersWithFeedback({
      returnTo,
      type: "error",
      message: "Nama customer wajib diisi minimal 2 karakter.",
    });
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirectPosCustomersWithFeedback({
      returnTo,
      type: "error",
      message: "Format email customer belum valid.",
    });
  }

  const duplicateConditions: SQL[] = [];

  if (phone) {
    duplicateConditions.push(eq(customers.phone, phone));
  }

  if (email) {
    duplicateConditions.push(eq(customers.email, email));
  }

  if (duplicateConditions.length > 0) {
    const duplicateMatch =
      duplicateConditions.length === 1
        ? duplicateConditions[0]
        : or(...duplicateConditions);

    if (duplicateMatch) {
      const duplicateCustomerRows = await db
        .select({
          id: customers.id,
          fullName: customers.fullName,
          customerCode: customers.customerCode,
        })
        .from(customers)
        .where(
          and(
            eq(customers.organizationId, auth.organization.id),
            eq(customers.isActive, true),
            duplicateMatch,
          ),
        )
        .limit(1);

      const duplicateCustomer = duplicateCustomerRows[0];

      if (duplicateCustomer) {
        redirectPosCustomersWithFeedback({
          returnTo,
          type: "info",
          message: `Customer ${duplicateCustomer.fullName} sudah ada (${duplicateCustomer.customerCode ?? "tanpa kode"}). Gunakan data customer tersebut agar tidak dobel.`,
        });
      }
    }
  }

  const requestMetadata = await getRequestMetadata();
  let createdCustomer:
    | {
        id: string;
        customerCode: string | null;
        fullName: string;
      }
    | null = null;

  try {
    createdCustomer = await db.transaction(async (transaction) => {
      const now = new Date();
      const customerCode = generateCustomerCode(now);
      const createdCustomerRows = await transaction
        .insert(customers)
        .values({
          organizationId: auth.organization.id,
          customerCode,
          fullName,
          phone,
          email,
          address,
          notes,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: customers.id,
          customerCode: customers.customerCode,
          fullName: customers.fullName,
        });

      const customer = createdCustomerRows[0];

      if (!customer) {
        throw new Error("CUSTOMER_INSERT_FAILED");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet?.id ?? null,
        actorUserId: auth.user.id,
        action: "customer.create",
        entityType: "customer",
        entityId: customer.id,
        beforeData: null,
        afterData: {
          customerId: customer.id,
          customerCode: customer.customerCode,
          fullName,
          phone,
          email,
          address,
          notes,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.customer.quick_create",
        },
      });

      return customer;
    });
  } catch (error) {
    console.error("Failed to create POS customer", error);

    redirectPosCustomersWithFeedback({
      returnTo,
      type: "error",
      message:
        "Customer belum bisa dibuat karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    });
  }

  revalidatePath("/pos/pelanggan");
  revalidatePath("/admin/pelanggan");

  redirectPosCustomersWithFeedback({
    returnTo: buildPosCustomerCreatedReturnTo(returnTo, createdCustomer?.fullName),
    type: "success",
    message: `Customer ${createdCustomer?.fullName ?? fullName} berhasil dibuat.`,
  });
}

function buildPosCustomerCreatedReturnTo(returnTo: string, fullName?: string | null) {
  const safeReturnTo = getSafePosCustomersReturnTo(returnTo);

  if (!fullName) {
    return safeReturnTo;
  }

  const queryStartIndex = safeReturnTo.indexOf("?");
  const path =
    queryStartIndex >= 0
      ? safeReturnTo.slice(0, queryStartIndex)
      : safeReturnTo;
  const search =
    queryStartIndex >= 0 ? safeReturnTo.slice(queryStartIndex + 1) : "";
  const params = new URLSearchParams(search);

  params.set("q", fullName);

  return `${path}?${params.toString()}`;
}

export async function lookupPosScanValueAction(
  scanValue: string,
): Promise<PosScanLookupResult> {
  const auth = await requirePermission("pos.access");

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  if (!primaryOutlet) {
    return {
      status: "invalid",
      message:
        "Outlet aktif tidak ditemukan. Hubungi manager/admin untuk mengatur akses outlet staff ini.",
    };
  }

  return lookupPosItemByScanValue({
    organizationId: auth.organization.id,
    outletId: primaryOutlet.id,
    scanValue,
  });
}

type HeldCartActionItemRow = {
  id: string;
  sku: string;
  barcode: string;
  qrValue: string | null;
  serialNumber: string | null;
  currentOutletId: string | null;
  weightGram: string | null;
  purityPercent: string | null;
  exchangePurityPercent: string | null;
  size: string | null;
  color: string | null;
  gemstone: string | null;
  sellingAmount: string | null;
  imageKey: string | null;
  outletId: string | null;
  outletCode: string | null;
  outletName: string | null;
  availability: "draft" | "available" | "reserved" | "inspection" | "sold";
  condition: "good" | "damaged" | "lost" | "returned";
  locationState: "outlet" | "warehouse" | "in_transit" | "customer" | "repair";
  isActive: boolean;
  productMasterId: string;
  productCode: string;
  itemDisplayName: string | null;
  masterProductName: string;
  productName: string;
  productImageKey: string | null;
  productStatus: "draft" | "active" | "inactive";
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  categoryIsActive: boolean;
  lineNumber?: number;
  listPriceAmount?: string;
  discountAmount?: string;
  finalPriceAmount?: string;
};

function mapHeldCartActionItem(row: HeldCartActionItemRow): PosHeldCartItem {
  const finalPriceAmount = row.finalPriceAmount ?? row.sellingAmount ?? "0";

  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    qrValue: row.qrValue,
    serialNumber: row.serialNumber,
    productId: row.productMasterId,
    productCode: row.productCode,
    productName: row.productName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    weightGram: row.weightGram,
    purityPercent: row.purityPercent,
    exchangePurityPercent: row.exchangePurityPercent,
    size: row.size,
    color: row.color,
    gemstone: row.gemstone,
    sellingAmount: row.sellingAmount,
    imageKey: row.imageKey,
    productImageKey: row.productImageKey,
    outletId: row.outletId,
    outletCode: row.outletCode,
    outletName: row.outletName,
    lineNumber: row.lineNumber ?? 1,
    listPriceAmount: row.listPriceAmount ?? finalPriceAmount,
    discountAmount: row.discountAmount ?? "0",
    finalPriceAmount,
  };
}

async function getPrimaryPosContextForHeldCart(auth: Awaited<ReturnType<typeof requirePermission>>) {
  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  if (!primaryOutlet) {
    throw new CheckoutValidationError(
      "Outlet aktif tidak ditemukan. Hubungi manager/admin untuk mengatur akses outlet staff ini.",
    );
  }

  const registerRows = await db
    .select({
      id: registers.id,
      code: registers.code,
      name: registers.name,
      outletId: registers.outletId,
    })
    .from(registers)
    .where(getDefaultPosRegisterCondition(primaryOutlet.id))
    .orderBy(registers.name)
    .limit(1);

  const register = registerRows[0];

  if (!register) {
    throw new CheckoutValidationError(DEFAULT_POS_REGISTER_MISSING_MESSAGE);
  }

  return { primaryOutlet, register };
}

export async function holdPosCartAction(
  payload: PosHoldCartPayload,
): Promise<PosHeldCartActionResult> {
  const auth = await requirePermission("sales.create");

  if (!auth.permissionCodes.includes("pos.access")) {
    return heldCartFailure("User ini belum memiliki akses POS.");
  }

  const fieldErrors: Record<string, string> = {};
  const itemIds = Array.from(new Set(payload.itemIds ?? []));
  const customerId = normalizeNullableText(payload.customerId, 36);
  const title = normalizeNullableText(payload.title, 160);
  const note = normalizeNullableText(payload.note, 500);

  if (itemIds.length === 0) {
    fieldErrors.items = "Tambahkan minimal satu item sebelum menahan transaksi.";
  }

  if (itemIds.length > 50) {
    fieldErrors.items = "Maksimal 50 item dalam satu hold cart.";
  }

  if (itemIds.some((itemId) => !UUID_PATTERN.test(itemId))) {
    fieldErrors.items = "Ada item hold yang tidak valid.";
  }

  if (customerId && !UUID_PATTERN.test(customerId)) {
    fieldErrors.customerId = "Customer yang dipilih tidak valid.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return heldCartFailure("Periksa kembali data transaksi ditahan.", fieldErrors);
  }

  const requestMetadata = await getRequestMetadata();

  try {
    const createdHeldCart = await db.transaction(async (transaction) => {
      const now = new Date();
      const { primaryOutlet, register } = await getPrimaryPosContextForHeldCart(auth);

      const activeShiftRows = await transaction
        .select({
          id: shifts.id,
          status: shifts.status,
        })
        .from(shifts)
        .where(
          and(
            eq(shifts.outletId, primaryOutlet.id),
            eq(shifts.registerId, register.id),
            eq(shifts.status, "open"),
          ),
        )
        .orderBy(sql`${shifts.openedAt} desc`)
        .limit(1);

      const activeShift = activeShiftRows[0];

      if (!activeShift) {
        throw new CheckoutValidationError(
          "Shift aktif belum dibuka. Buka shift terlebih dahulu sebelum menahan transaksi.",
        );
      }

      const selectedCustomer = customerId
        ? (
            await transaction
              .select({
                id: customers.id,
                customerCode: customers.customerCode,
                fullName: customers.fullName,
                phone: customers.phone,
                email: customers.email,
              })
              .from(customers)
              .where(
                and(
                  eq(customers.id, customerId),
                  eq(customers.organizationId, auth.organization.id),
                  eq(customers.isActive, true),
                ),
              )
              .limit(1)
          )[0]
        : null;

      if (customerId && !selectedCustomer) {
        throw new CheckoutValidationError(
          "Customer yang dipilih tidak ditemukan atau sudah tidak aktif.",
        );
      }

      const itemRows = await transaction
        .select({
          id: productItems.id,
          sku: productItems.sku,
          barcode: productItems.barcode,
          qrValue: productItems.qrValue,
          serialNumber: productItems.serialNumber,
          currentOutletId: productItems.currentOutletId,
          weightGram: productItems.weightGram,
          purityPercent: productItems.purityPercent,
          exchangePurityPercent: productItems.exchangePurityPercent,
          size: productItems.size,
          color: productItems.color,
          gemstone: productItems.gemstone,
          sellingAmount: productItems.sellingAmount,
          deductionPerGram: productItems.deductionPerGram,
          imageKey: productItems.imageKey,
          outletId: outlets.id,
          outletCode: outlets.code,
          outletName: outlets.name,
          availability: productItems.availability,
          condition: productItems.condition,
          locationState: productItems.locationState,
          isActive: productItems.isActive,
          productMasterId: productMasters.id,
          productCode: productMasters.code,
          itemDisplayName: productItems.displayName,
          masterProductName: productMasters.name,
          productName: sql<string>`coalesce(${productItems.displayName}, ${productMasters.name})`,
          productImageKey: productMasters.imageKey,
          productStatus: productMasters.status,
          categoryId: productCategories.id,
          categoryCode: productCategories.code,
          categoryName: productCategories.name,
          categoryIsActive: productCategories.isActive,
        })
        .from(productItems)
        .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
        .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
        .leftJoin(outlets, eq(productItems.currentOutletId, outlets.id))
        .where(
          and(
            eq(productItems.organizationId, auth.organization.id),
            inArray(productItems.id, itemIds),
          ),
        );

      if (itemRows.length !== itemIds.length) {
        throw new CheckoutValidationError(
          "Sebagian item tidak ditemukan. Refresh POS lalu coba ulang.",
        );
      }

      const activeHeldRows = await transaction
        .select({
          productItemId: posHeldCartItems.productItemId,
          holdNumber: posHeldCarts.holdNumber,
          title: posHeldCarts.title,
        })
        .from(posHeldCartItems)
        .innerJoin(posHeldCarts, eq(posHeldCartItems.heldCartId, posHeldCarts.id))
        .where(
          and(
            inArray(posHeldCartItems.productItemId, itemIds),
            eq(posHeldCartItems.isActive, true),
            eq(posHeldCarts.organizationId, auth.organization.id),
            eq(posHeldCarts.outletId, primaryOutlet.id),
            eq(posHeldCarts.status, "active"),
          ),
        )
        .limit(1);

      const activeHeldItem = activeHeldRows[0];

      if (activeHeldItem) {
        const heldItem = itemRows.find((item) => item.id === activeHeldItem.productItemId);
        throw new CheckoutValidationError(
          `${heldItem?.sku ?? "Item"} sudah ditahan di ${activeHeldItem.holdNumber}${activeHeldItem.title ? ` (${activeHeldItem.title})` : ""}.`,
        );
      }

      const itemMap = new Map(itemRows.map((item) => [item.id, item]));
      const orderedItems = itemIds.map((itemId) => itemMap.get(itemId));

      for (const item of orderedItems) {
        if (!item) {
          throw new CheckoutValidationError("Ada item hold yang tidak ditemukan.");
        }

        if (!item.isActive) {
          throw new CheckoutValidationError(`${item.sku} tidak aktif atau sudah diarsipkan.`);
        }

        if (item.productStatus !== "active" || !item.categoryIsActive) {
          throw new CheckoutValidationError(
            `${item.sku} belum bisa ditahan karena produk/kategori belum aktif.`,
          );
        }

        if (item.currentOutletId !== primaryOutlet.id) {
          throw new CheckoutValidationError(
            `${item.sku} tidak berada di outlet aktif POS ini.`,
          );
        }

        if (
          item.availability !== "available" ||
          item.condition !== "good" ||
          item.locationState !== "outlet"
        ) {
          throw new CheckoutValidationError(
            `${item.sku} sudah tidak tersedia untuk ditahan. Refresh POS lalu cek ulang.`,
          );
        }

        if (parseDbAmount(item.sellingAmount) <= 0) {
          throw new CheckoutValidationError(`${item.sku} belum memiliki harga jual.`);
        }
      }

      const subtotalAmount = orderedItems.reduce(
        (total, item) => total + parseDbAmount(item!.sellingAmount),
        0,
      );
      const totalAmount = subtotalAmount;
      const holdNumber = generateHoldNumber({
        outletCode: primaryOutlet.code,
        date: now,
      });
      const holdTitle =
        title ??
        selectedCustomer?.fullName ??
        `${orderedItems.length} item ditahan`;

      const heldCartRows = await transaction
        .insert(posHeldCarts)
        .values({
          organizationId: auth.organization.id,
          outletId: primaryOutlet.id,
          registerId: register.id,
          shiftId: activeShift.id,
          customerId: selectedCustomer?.id ?? null,
          heldByUserId: auth.user.id,
          holdNumber,
          title: holdTitle,
          note,
          status: "active",
          itemCount: orderedItems.length,
          subtotalAmount: String(subtotalAmount),
          discountAmount: "0",
          totalAmount: String(totalAmount),
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: posHeldCarts.id,
          holdNumber: posHeldCarts.holdNumber,
          status: posHeldCarts.status,
          title: posHeldCarts.title,
          note: posHeldCarts.note,
          itemCount: posHeldCarts.itemCount,
          subtotalAmount: posHeldCarts.subtotalAmount,
          discountAmount: posHeldCarts.discountAmount,
          totalAmount: posHeldCarts.totalAmount,
          createdAt: posHeldCarts.createdAt,
          updatedAt: posHeldCarts.updatedAt,
          shiftId: posHeldCarts.shiftId,
          registerId: posHeldCarts.registerId,
        });

      const heldCart = heldCartRows[0];

      if (!heldCart) {
        throw new Error("POS_HELD_CART_INSERT_FAILED");
      }

      await transaction.insert(posHeldCartItems).values(
        orderedItems.map((item, index) => {
          const finalPriceAmount = parseDbAmount(item!.sellingAmount);

          return {
            heldCartId: heldCart.id,
            productItemId: item!.id,
            lineNumber: index + 1,
            listPriceAmount: String(finalPriceAmount),
            discountAmount: "0",
            finalPriceAmount: String(finalPriceAmount),
            snapshot: {
              sku: item!.sku,
              barcode: item!.barcode,
              qrValue: item!.qrValue,
              serialNumber: item!.serialNumber,
              productMasterId: item!.productMasterId,
              productCode: item!.productCode,
              itemDisplayName: item!.itemDisplayName,
              masterProductName: item!.masterProductName,
              productName: item!.productName,
              categoryId: item!.categoryId,
              categoryCode: item!.categoryCode,
              categoryName: item!.categoryName,
              weightGram: item!.weightGram,
              purityPercent: item!.purityPercent,
              exchangePurityPercent: item!.exchangePurityPercent,
              size: item!.size,
              color: item!.color,
              gemstone: item!.gemstone,
              sellingAmount: item!.sellingAmount,
              deductionPerGram: item!.deductionPerGram,
              imageKey: item!.imageKey,
              productImageKey: item!.productImageKey,
            },
            isActive: true,
            releasedAt: null,
            createdAt: now,
          };
        }),
      );

      await transaction.insert(inventoryMovements).values(
        orderedItems.map((item) => ({
          organizationId: auth.organization.id,
          itemId: item!.id,
          movementType: "reservation" as const,
          fromOutletId: primaryOutlet.id,
          toOutletId: null,
          referenceType: "pos_held_cart",
          referenceId: heldCart.id,
          reason: `Ditahan melalui POS ${holdNumber}.`,
          metadata: {
            holdNumber,
            registerId: register.id,
            shiftId: activeShift.id,
            heldByUserId: auth.user.id,
            sellingAmount: item!.sellingAmount,
          },
          performedBy: auth.user.id,
          approvedBy: null,
          occurredAt: now,
          createdAt: now,
        })),
      );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        actorUserId: auth.user.id,
        action: "pos.held_cart.create",
        entityType: "pos_held_cart",
        entityId: heldCart.id,
        beforeData: null,
        afterData: {
          heldCartId: heldCart.id,
          holdNumber,
          outletId: primaryOutlet.id,
          registerId: register.id,
          shiftId: activeShift.id,
          customerId: selectedCustomer?.id ?? null,
          itemCount: orderedItems.length,
          totalAmount: String(totalAmount),
          itemIds,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.hold_cart",
        },
        createdAt: now,
      });

      return {
        summary: mapHeldCartSummary({
          ...heldCart,
          customerId: selectedCustomer?.id ?? null,
          customerCode: selectedCustomer?.customerCode ?? null,
          customerName: selectedCustomer?.fullName ?? null,
          customerPhone: selectedCustomer?.phone ?? null,
          customerEmail: selectedCustomer?.email ?? null,
          heldByUserId: auth.user.id,
          heldByName: auth.user.fullName,
        }),
        items: orderedItems.map((item, index) =>
          mapHeldCartActionItem({
            ...item!,
            lineNumber: index + 1,
            listPriceAmount: item!.sellingAmount ?? "0",
            discountAmount: "0",
            finalPriceAmount: item!.sellingAmount ?? "0",
          }),
        ),
      };
    });

    revalidatePath("/pos");
    revalidatePath(POS_HELD_CARTS_PATH);

    return heldCartSuccess({
      message: `Transaksi berhasil ditahan sebagai ${createdHeldCart.summary.holdNumber}.`,
      heldCart: createdHeldCart.summary,
      items: createdHeldCart.items,
    });
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return heldCartFailure(error.message);
    }

    if (isPostgresUniqueViolation(error, "pos_held_cart_items_active_item_uq")) {
      return heldCartFailure(
        "Sebagian item sudah ditahan oleh transaksi lain. Refresh POS lalu coba ulang.",
      );
    }

    console.error("Failed to hold POS cart", error);

    return heldCartFailure(
      "Transaksi belum bisa ditahan karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    );
  }
}

export async function cancelPosHeldCartAction({
  heldCartId,
  reason,
}: {
  heldCartId: string;
  reason?: string | null;
}): Promise<PosHeldCartActionResult> {
  const auth = await requirePermission("sales.create");

  if (!auth.permissionCodes.includes("pos.access")) {
    return heldCartFailure("User ini belum memiliki akses POS.");
  }

  if (!UUID_PATTERN.test(heldCartId)) {
    return heldCartFailure("Transaksi ditahan tidak valid.");
  }

  const cancelReason = normalizeNullableText(reason, 500);
  const requestMetadata = await getRequestMetadata();

  try {
    const result = await db.transaction(async (transaction) => {
      const now = new Date();
      const { primaryOutlet, register } = await getPrimaryPosContextForHeldCart(auth);

      const heldCartRows = await transaction
        .select({
          id: posHeldCarts.id,
          holdNumber: posHeldCarts.holdNumber,
          status: posHeldCarts.status,
          title: posHeldCarts.title,
          note: posHeldCarts.note,
          itemCount: posHeldCarts.itemCount,
          subtotalAmount: posHeldCarts.subtotalAmount,
          discountAmount: posHeldCarts.discountAmount,
          totalAmount: posHeldCarts.totalAmount,
          createdAt: posHeldCarts.createdAt,
          updatedAt: posHeldCarts.updatedAt,
          shiftId: posHeldCarts.shiftId,
          registerId: posHeldCarts.registerId,
          customerId: customers.id,
          customerCode: customers.customerCode,
          customerName: customers.fullName,
          customerPhone: customers.phone,
          customerEmail: customers.email,
          heldByUserId: users.id,
          heldByName: users.fullName,
        })
        .from(posHeldCarts)
        .leftJoin(customers, eq(posHeldCarts.customerId, customers.id))
        .innerJoin(users, eq(posHeldCarts.heldByUserId, users.id))
        .where(
          and(
            eq(posHeldCarts.id, heldCartId),
            eq(posHeldCarts.organizationId, auth.organization.id),
            eq(posHeldCarts.outletId, primaryOutlet.id),
            eq(posHeldCarts.registerId, register.id),
            eq(posHeldCarts.status, "active"),
          ),
        )
        .limit(1);

      const heldCart = heldCartRows[0];

      if (!heldCart) {
        throw new CheckoutValidationError(
          "Transaksi ditahan tidak ditemukan, sudah dibatalkan, atau sudah di-resume.",
        );
      }

      await transaction
        .update(posHeldCarts)
        .set({
          status: "canceled",
          canceledAt: now,
          canceledByUserId: auth.user.id,
          cancelReason,
          updatedAt: now,
        })
        .where(eq(posHeldCarts.id, heldCart.id));

      await transaction
        .update(posHeldCartItems)
        .set({
          isActive: false,
          releasedAt: now,
        })
        .where(eq(posHeldCartItems.heldCartId, heldCart.id));

      const heldItemRows = await transaction
        .select({
          productItemId: posHeldCartItems.productItemId,
        })
        .from(posHeldCartItems)
        .where(eq(posHeldCartItems.heldCartId, heldCart.id));

      if (heldItemRows.length > 0) {
        await transaction.insert(inventoryMovements).values(
          heldItemRows.map((item) => ({
            organizationId: auth.organization.id,
            itemId: item.productItemId,
            movementType: "reservation_release" as const,
            fromOutletId: primaryOutlet.id,
            toOutletId: null,
            referenceType: "pos_held_cart",
            referenceId: heldCart.id,
            reason: cancelReason || `Hold ${heldCart.holdNumber} dibatalkan.`,
            metadata: {
              holdNumber: heldCart.holdNumber,
              releaseType: "cancel",
              registerId: register.id,
              canceledByUserId: auth.user.id,
            },
            performedBy: auth.user.id,
            approvedBy: null,
            occurredAt: now,
            createdAt: now,
          })),
        );
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        actorUserId: auth.user.id,
        action: "pos.held_cart.cancel",
        entityType: "pos_held_cart",
        entityId: heldCart.id,
        beforeData: {
          status: "active",
        },
        afterData: {
          status: "canceled",
          heldCartId: heldCart.id,
          holdNumber: heldCart.holdNumber,
          reason: cancelReason,
        },
        reason: cancelReason,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.hold_cart.cancel",
        },
        createdAt: now,
      });

      return mapHeldCartSummary({
        ...heldCart,
        status: "canceled",
        updatedAt: now,
      });
    });

    revalidatePath("/pos");
    revalidatePath(POS_HELD_CARTS_PATH);

    return heldCartSuccess({
      message: `Hold ${result.holdNumber} berhasil dibatalkan.`,
      heldCart: result,
    });
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return heldCartFailure(error.message);
    }

    console.error("Failed to cancel POS held cart", error);

    return heldCartFailure(
      "Transaksi ditahan belum bisa dibatalkan karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    );
  }
}

export async function resumePosHeldCartAction({
  heldCartId,
}: {
  heldCartId: string;
}): Promise<PosHeldCartActionResult> {
  const auth = await requirePermission("sales.create");

  if (!auth.permissionCodes.includes("pos.access")) {
    return heldCartFailure("User ini belum memiliki akses POS.");
  }

  if (!UUID_PATTERN.test(heldCartId)) {
    return heldCartFailure("Transaksi ditahan tidak valid.");
  }

  const requestMetadata = await getRequestMetadata();

  try {
    const result = await db.transaction(async (transaction) => {
      const now = new Date();
      const { primaryOutlet, register } = await getPrimaryPosContextForHeldCart(auth);

      const heldCartRows = await transaction
        .select({
          id: posHeldCarts.id,
          holdNumber: posHeldCarts.holdNumber,
          status: posHeldCarts.status,
          title: posHeldCarts.title,
          note: posHeldCarts.note,
          itemCount: posHeldCarts.itemCount,
          subtotalAmount: posHeldCarts.subtotalAmount,
          discountAmount: posHeldCarts.discountAmount,
          totalAmount: posHeldCarts.totalAmount,
          createdAt: posHeldCarts.createdAt,
          updatedAt: posHeldCarts.updatedAt,
          shiftId: posHeldCarts.shiftId,
          registerId: posHeldCarts.registerId,
          customerId: customers.id,
          customerCode: customers.customerCode,
          customerName: customers.fullName,
          customerPhone: customers.phone,
          customerEmail: customers.email,
          heldByUserId: users.id,
          heldByName: users.fullName,
        })
        .from(posHeldCarts)
        .leftJoin(customers, eq(posHeldCarts.customerId, customers.id))
        .innerJoin(users, eq(posHeldCarts.heldByUserId, users.id))
        .where(
          and(
            eq(posHeldCarts.id, heldCartId),
            eq(posHeldCarts.organizationId, auth.organization.id),
            eq(posHeldCarts.outletId, primaryOutlet.id),
            eq(posHeldCarts.registerId, register.id),
            eq(posHeldCarts.status, "active"),
          ),
        )
        .limit(1);

      const heldCart = heldCartRows[0];

      if (!heldCart) {
        throw new CheckoutValidationError(
          "Transaksi ditahan tidak ditemukan, sudah dibatalkan, atau sudah di-resume.",
        );
      }

      const itemRows = await transaction
        .select({
          id: productItems.id,
          sku: productItems.sku,
          barcode: productItems.barcode,
          qrValue: productItems.qrValue,
          serialNumber: productItems.serialNumber,
          currentOutletId: productItems.currentOutletId,
          weightGram: productItems.weightGram,
          purityPercent: productItems.purityPercent,
          exchangePurityPercent: productItems.exchangePurityPercent,
          size: productItems.size,
          color: productItems.color,
          gemstone: productItems.gemstone,
          sellingAmount: productItems.sellingAmount,
          imageKey: productItems.imageKey,
          outletId: outlets.id,
          outletCode: outlets.code,
          outletName: outlets.name,
          availability: productItems.availability,
          condition: productItems.condition,
          locationState: productItems.locationState,
          isActive: productItems.isActive,
          productMasterId: productMasters.id,
          productCode: productMasters.code,
          itemDisplayName: productItems.displayName,
          masterProductName: productMasters.name,
          productName: sql<string>`coalesce(${productItems.displayName}, ${productMasters.name})`,
          productImageKey: productMasters.imageKey,
          productStatus: productMasters.status,
          categoryId: productCategories.id,
          categoryCode: productCategories.code,
          categoryName: productCategories.name,
          categoryIsActive: productCategories.isActive,
          lineNumber: posHeldCartItems.lineNumber,
          listPriceAmount: posHeldCartItems.listPriceAmount,
          discountAmount: posHeldCartItems.discountAmount,
          finalPriceAmount: posHeldCartItems.finalPriceAmount,
        })
        .from(posHeldCartItems)
        .innerJoin(productItems, eq(posHeldCartItems.productItemId, productItems.id))
        .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
        .innerJoin(productCategories, eq(productMasters.categoryId, productCategories.id))
        .leftJoin(outlets, eq(productItems.currentOutletId, outlets.id))
        .where(
          and(
            eq(posHeldCartItems.heldCartId, heldCart.id),
            eq(posHeldCartItems.isActive, true),
          ),
        )
        .orderBy(posHeldCartItems.lineNumber);

      if (itemRows.length === 0) {
        throw new CheckoutValidationError(
          "Transaksi ditahan ini tidak memiliki item aktif untuk di-resume.",
        );
      }

      for (const item of itemRows) {
        if (!item.isActive) {
          throw new CheckoutValidationError(`${item.sku} tidak aktif atau sudah diarsipkan.`);
        }

        if (item.productStatus !== "active" || !item.categoryIsActive) {
          throw new CheckoutValidationError(
            `${item.sku} belum bisa di-resume karena produk/kategori belum aktif.`,
          );
        }

        if (item.currentOutletId !== primaryOutlet.id) {
          throw new CheckoutValidationError(
            `${item.sku} tidak berada di outlet aktif POS ini.`,
          );
        }

        if (
          item.availability !== "available" ||
          item.condition !== "good" ||
          item.locationState !== "outlet"
        ) {
          throw new CheckoutValidationError(
            `${item.sku} sudah tidak tersedia untuk dijual. Batalkan hold dan cek inventory.`,
          );
        }
      }

      await transaction
        .update(posHeldCarts)
        .set({
          status: "resumed",
          resumedAt: now,
          resumedByUserId: auth.user.id,
          updatedAt: now,
        })
        .where(eq(posHeldCarts.id, heldCart.id));

      await transaction
        .update(posHeldCartItems)
        .set({
          isActive: false,
          releasedAt: now,
        })
        .where(eq(posHeldCartItems.heldCartId, heldCart.id));

      await transaction.insert(inventoryMovements).values(
        itemRows.map((item) => ({
          organizationId: auth.organization.id,
          itemId: item.id,
          movementType: "reservation_release" as const,
          fromOutletId: primaryOutlet.id,
          toOutletId: null,
          referenceType: "pos_held_cart",
          referenceId: heldCart.id,
          reason: `Hold ${heldCart.holdNumber} di-resume ke cart POS.`,
          metadata: {
            holdNumber: heldCart.holdNumber,
            releaseType: "resume",
            registerId: register.id,
            resumedByUserId: auth.user.id,
          },
          performedBy: auth.user.id,
          approvedBy: null,
          occurredAt: now,
          createdAt: now,
        })),
      );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        actorUserId: auth.user.id,
        action: "pos.held_cart.resume",
        entityType: "pos_held_cart",
        entityId: heldCart.id,
        beforeData: {
          status: "active",
        },
        afterData: {
          status: "resumed",
          heldCartId: heldCart.id,
          holdNumber: heldCart.holdNumber,
          itemCount: itemRows.length,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.hold_cart.resume",
        },
        createdAt: now,
      });

      return {
        summary: mapHeldCartSummary({
          ...heldCart,
          status: "resumed",
          updatedAt: now,
        }),
        items: itemRows.map(mapHeldCartActionItem),
      };
    });

    revalidatePath("/pos");
    revalidatePath(POS_HELD_CARTS_PATH);

    return heldCartSuccess({
      message: `Hold ${result.summary.holdNumber} berhasil di-resume ke cart POS.`,
      heldCart: result.summary,
      items: result.items,
    });
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return heldCartFailure(error.message);
    }

    console.error("Failed to resume POS held cart", error);

    return heldCartFailure(
      "Transaksi ditahan belum bisa di-resume karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    );
  }
}

export async function completePosCheckoutAction(
  payload: PosCheckoutPayload,
): Promise<PosCheckoutActionResult> {
  const auth = await requirePermission("sales.create");

  if (!auth.permissionCodes.includes("pos.access")) {
    return checkoutFailure("User ini belum memiliki akses POS.");
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  if (!primaryOutlet) {
    return checkoutFailure(
      "Outlet aktif tidak ditemukan. Hubungi manager/admin untuk mengatur akses outlet staff ini.",
    );
  }

  const fieldErrors: Record<string, string> = {};
  const itemIds = Array.from(new Set(payload.itemIds ?? []));
  const idempotencyKey = String(payload.idempotencyKey ?? "").trim();
  const customerId = normalizeNullableText(payload.customerId, 36);
  const saleNote = normalizeNullableText(payload.note, 240);
  const discountApprovalId = normalizeNullableText(payload.discountApprovalId, 36);
  const manualPaymentApprovalId = normalizeNullableText(
    payload.manualPaymentApprovalId,
    36,
  );
  const submittedDiscountAmount =
    payload.discountAmount === null || payload.discountAmount === undefined
      ? 0
      : Number(payload.discountAmount);
  const submittedDiscountReason = normalizeNullableText(
    payload.discountReason,
    500,
  );

  if (itemIds.length === 0) {
    fieldErrors.items = "Tambahkan minimal satu item sebelum checkout.";
  }

  if (itemIds.length > 50) {
    fieldErrors.items = "Maksimal 50 item dalam satu transaksi POS.";
  }

  if (itemIds.some((itemId) => !UUID_PATTERN.test(itemId))) {
    fieldErrors.items = "Ada item transaksi yang tidak valid.";
  }

  if (!isValidPosCheckoutIdempotencyKey(idempotencyKey)) {
    fieldErrors.idempotencyKey = "Kode transaksi POS tidak valid.";
  }

  if (customerId && !UUID_PATTERN.test(customerId)) {
    fieldErrors.customerId = "Customer yang dipilih tidak valid.";
  }

  if (!Number.isSafeInteger(submittedDiscountAmount) || submittedDiscountAmount < 0) {
    fieldErrors.discountAmount = "Nominal diskon tidak valid.";
  }

  if (submittedDiscountAmount > 0 && !discountApprovalId) {
    fieldErrors.discountApprovalId = "Diskon POS wajib memakai approval manager/owner.";
  }

  if (discountApprovalId && !UUID_PATTERN.test(discountApprovalId)) {
    fieldErrors.discountApprovalId = "Approval diskon tidak valid.";
  }

  if (manualPaymentApprovalId && !UUID_PATTERN.test(manualPaymentApprovalId)) {
    fieldErrors.manualPaymentApprovalId =
      "Approval verifikasi pembayaran manual tidak valid.";
  }

  const submittedPayments = payload.payments ?? [];

  if (submittedPayments.length === 0) {
    fieldErrors.payments = "Tambahkan minimal satu pembayaran.";
  }

  if (submittedPayments.length > 8) {
    fieldErrors.payments = "Maksimal 8 pembayaran dalam satu transaksi.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return checkoutFailure(
      `Periksa kembali data checkout: ${Object.values(fieldErrors).join(" ")}`,
      fieldErrors,
    );
  }

  let normalizedPayments: NormalizedCheckoutPayment[] = [];
  const manualPaymentPolicyMap = await getManualPaymentPolicyMap(
    auth.organization.id,
  );
  const submittedProfileIds = Array.from(
    new Set(
      submittedPayments
        .filter((payment) => payment.method !== "cash")
        .map((payment) => String(payment.manualPaymentProfileId ?? "").trim())
        .filter((profileId) => UUID_PATTERN.test(profileId)),
    ),
  );
  const profileRows = submittedProfileIds.length
    ? await db
        .select({
          id: manualPaymentProfiles.id,
          profileType: manualPaymentProfiles.profileType,
          code: manualPaymentProfiles.code,
          name: manualPaymentProfiles.name,
          provider: manualPaymentProfiles.provider,
          verificationSource: manualPaymentProfiles.verificationSource,
          merchantId: manualPaymentProfiles.merchantId,
          terminalId: manualPaymentProfiles.terminalId,
          destinationAccount: manualPaymentProfiles.destinationAccount,
          registerId: manualPaymentProfiles.registerId,
        })
        .from(manualPaymentProfiles)
        .where(
          and(
            eq(manualPaymentProfiles.organizationId, auth.organization.id),
            eq(manualPaymentProfiles.outletId, primaryOutlet.id),
            eq(manualPaymentProfiles.isActive, true),
            inArray(manualPaymentProfiles.id, submittedProfileIds),
          ),
        )
    : [];
  const paymentProfilesById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const verificationNowIso = new Date().toISOString();

  try {
    normalizedPayments = submittedPayments.map((payment, index) => {
      const method = String(payment.method ?? "");

      if (!isManualPaymentMethod(method)) {
        throw new CheckoutValidationError(
          `Metode pembayaran baris ${index + 1} tidak valid.`,
        );
      }

      const methodLabel = manualPaymentMethodLabels[method];
      const amount = Number(payment.amount);
      const receivedAmount =
        payment.receivedAmount === null || payment.receivedAmount === undefined
          ? null
          : Number(payment.receivedAmount);
      const changeAmount = Number(payment.changeAmount ?? 0);
      const reference = normalizeNullableText(payment.reference, 160);
      const note = normalizeNullableText(payment.note, 160);

      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new CheckoutValidationError(
          `Nominal pembayaran ${methodLabel} harus lebih dari Rp0.`,
        );
      }

      if (!Number.isSafeInteger(changeAmount) || changeAmount < 0) {
        throw new CheckoutValidationError("Nominal kembalian cash tidak valid.");
      }

      if (method === "cash") {
        if (receivedAmount === null) {
          throw new CheckoutValidationError(
            "Nominal uang diterima cash wajib dikirim dari POS.",
          );
        }

        if (!Number.isSafeInteger(receivedAmount) || receivedAmount < amount) {
          throw new CheckoutValidationError(
            "Nominal uang diterima cash tidak valid.",
          );
        }

        const expectedChange = Math.max(receivedAmount - amount, 0);

        if (changeAmount !== expectedChange) {
          throw new CheckoutValidationError(
            "Nominal kembalian cash tidak sesuai dengan uang diterima.",
          );
        }

        return {
          method,
          amount,
          receivedAmount,
          changeAmount,
          provider: null,
          reference: null,
          note,
          verificationSource: null,
          providerPaidAt: null,
          providerPaidAtIso: null,
          evidenceKey: null,
          manualPaymentProfileId: null,
          manualPaymentProfileName: null,
          manualPaymentProfileCode: null,
          manualPaymentProfileRegisterId: null,
          verificationDetails: {},
          normalizedProvider: null,
          normalizedReference: null,
        };
      }

      if (changeAmount > 0 || receivedAmount !== null) {
        throw new CheckoutValidationError(
          "Kembalian hanya boleh untuk pembayaran cash.",
        );
      }

      try {
        const profileId = String(payment.manualPaymentProfileId ?? "").trim();

        if (!UUID_PATTERN.test(profileId)) {
          throw new Error("Pilih akun/terminal pembayaran yang sudah dikonfigurasi.");
        }

        const profile = paymentProfilesById.get(profileId);

        if (!profile) {
          throw new Error(
            "Akun/terminal pembayaran tidak aktif atau bukan milik outlet ini.",
          );
        }

        if (profile.profileType !== getManualPaymentProfileType(method)) {
          throw new Error("Akun/terminal tidak mendukung metode pembayaran ini.");
        }

        const profileVerificationSource =
          profile.verificationSource === "merchant_app" ||
          profile.verificationSource === "edc_terminal" ||
          profile.verificationSource === "bank_app" ||
          profile.verificationSource === "bank_statement"
            ? profile.verificationSource
            : null;

        const verification = normalizeAndValidateManualPaymentVerification({
          payment: {
            ...payment,
            method,
            amount,
            manualPaymentProfileId: profile.id,
            verificationConfirmed: payment.verificationConfirmed === true,
            provider: profile.provider,
            reference,
            verificationSource: profileVerificationSource,
            providerPaidAtIso: payment.providerPaidAtIso ?? verificationNowIso,
            verificationDetails: {
              ...payment.verificationDetails,
              merchantId: profile.merchantId,
              terminalId: profile.terminalId,
              destinationAccount: profile.destinationAccount,
            },
          },
          organizationId: auth.organization.id,
          policy: manualPaymentPolicyMap[method],
        });

        return {
          method,
          amount,
          receivedAmount: null,
          changeAmount: 0,
          provider: profile.provider,
          reference,
          note,
          verificationSource: verification.verificationSource,
          providerPaidAt: verification.providerPaidAt,
          providerPaidAtIso: verification.providerPaidAt.toISOString(),
          evidenceKey: verification.evidenceKey,
          manualPaymentProfileId: profile.id,
          manualPaymentProfileName: profile.name,
          manualPaymentProfileCode: profile.code,
          manualPaymentProfileRegisterId: profile.registerId,
          verificationDetails: verification.details as Record<
            string,
            string | null
          >,
          normalizedProvider: verification.normalizedProvider,
          normalizedReference: verification.normalizedReference,
        };
      } catch (error) {
        throw new CheckoutValidationError(
          `${methodLabel}: ${
            error instanceof Error ? error.message : "data verifikasi tidak valid"
          }`,
        );
      }
    });
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return checkoutFailure(error.message);
    }

    throw error;
  }

  const submittedManualReferenceKeys = new Set<string>();
  const submittedEvidenceKeys = new Set<string>();

  for (const payment of normalizedPayments) {
    if (!isNonCashManualPaymentMethod(payment.method)) continue;

    const referenceKey = [
      payment.method,
      payment.normalizedProvider,
      payment.normalizedReference,
    ].join(":");

    if (submittedManualReferenceKeys.has(referenceKey)) {
      return checkoutFailure(
        `${manualPaymentMethodLabels[payment.method]} dengan provider dan reference yang sama tidak boleh ditambahkan dua kali dalam satu checkout.`,
      );
    }

    submittedManualReferenceKeys.add(referenceKey);

    if (payment.evidenceKey) {
      if (submittedEvidenceKeys.has(payment.evidenceKey)) {
        return checkoutFailure(
          "Satu bukti pembayaran tidak boleh dipakai untuk lebih dari satu baris payment.",
        );
      }

      submittedEvidenceKeys.add(payment.evidenceKey);
    }
  }

  const evidenceKeys = Array.from(submittedEvidenceKeys);

  if (evidenceKeys.length > 0) {
    const evidenceRows = await db
      .select({ storageKey: paymentEvidenceUploads.storageKey })
      .from(paymentEvidenceUploads)
      .where(
        and(
          eq(paymentEvidenceUploads.organizationId, auth.organization.id),
          eq(paymentEvidenceUploads.outletId, primaryOutlet.id),
          eq(paymentEvidenceUploads.uploadedBy, auth.user.id),
          inArray(paymentEvidenceUploads.storageKey, evidenceKeys),
          or(
            isNotNull(paymentEvidenceUploads.saleId),
            gt(paymentEvidenceUploads.expiresAt, new Date()),
          ),
        ),
      );

    if (evidenceRows.length !== evidenceKeys.length) {
      return checkoutFailure(
        "Bukti pembayaran tidak ditemukan, sudah kedaluwarsa, atau bukan milik sesi POS ini. Unggah ulang bukti payment.",
      );
    }
  }

  const normalizedCheckoutPayload: PosCheckoutPayload = {
    itemIds,
    payments: normalizedPayments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      manualPaymentProfileId: payment.manualPaymentProfileId,
      verificationConfirmed: payment.method === "cash" ? null : true,
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
    idempotencyKey,
    customerId,
    note: saleNote,
    discountApprovalId,
    discountAmount: submittedDiscountAmount || null,
    discountReason: submittedDiscountReason,
    manualPaymentApprovalId,
  };

  const requestMetadata = await getRequestMetadata();
  let manualPaymentVerificationFingerprint: string | null = null;
  let manualPaymentVerifiedApprovalId: string | null = null;
  let manualPaymentCoVerifierId: string | null = null;
  let manualPaymentCoVerifiedAt: Date | null = null;
  let manualPaymentDuplicatePaymentIds: string[] = [];

  try {
    const hasNonCashPayment = normalizedPayments.some(
      (payment) => payment.method !== "cash",
    );

    if (hasNonCashPayment) {
      const assessment = await assessManualPaymentReviewRequirement({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        cashierId: auth.user.id,
        itemIds,
        customerId,
        discountApprovalId,
        payments: normalizedPayments,
        policies: manualPaymentPolicyMap,
      });

      manualPaymentVerificationFingerprint = assessment.fingerprint;
      manualPaymentDuplicatePaymentIds = assessment.duplicatePayments.map(
        (payment) => payment.paymentId,
      );

      if (assessment.requiresApproval) {
        const approvalConditions = [
          eq(approvals.organizationId, auth.organization.id),
          eq(approvals.outletId, primaryOutlet.id),
          eq(approvals.requestedBy, auth.user.id),
          eq(approvals.type, "manual_payment_verification"),
          sql`${approvals.requestData}->>'verificationFingerprint' = ${assessment.fingerprint}`,
        ];

        if (manualPaymentApprovalId) {
          approvalConditions.push(eq(approvals.id, manualPaymentApprovalId));
        }

        const [approvalRow] = await db
          .select({
            id: approvals.id,
            status: approvals.status,
            approvedBy: approvals.approvedBy,
            requestData: approvals.requestData,
            notes: approvals.notes,
            responseNotes: approvals.responseNotes,
            createdAt: approvals.createdAt,
            resolvedAt: approvals.resolvedAt,
          })
          .from(approvals)
          .where(and(...approvalConditions))
          .orderBy(sql`${approvals.createdAt} desc`)
          .limit(1);

        if (!approvalRow) {
          const createdApproval = await getOrCreateManualPaymentApproval({
            auth,
            outletId: primaryOutlet.id,
            assessment,
            normalizedPayments,
            requestMetadata,
          });

          return checkoutApprovalRequired(
            createdApproval,
            "Pembayaran membutuhkan co-verification manager/finance sebelum checkout dapat diselesaikan.",
          );
        }

        const mappedApproval = mapPosManualPaymentApproval(approvalRow);

        if (approvalRow.status !== "approved") {
          return checkoutApprovalRequired(
            mappedApproval,
            approvalRow.status === "rejected"
              ? "Verifikasi pembayaran ditolak. Perbaiki reference, bukti, atau detail payment lalu buat payment baru."
              : "Pembayaran masih menunggu co-verification manager/finance.",
          );
        }

        if (!approvalRow.approvedBy || !approvalRow.resolvedAt) {
          return checkoutFailure(
            "Approval pembayaran tidak lengkap. Hubungi manager untuk memproses ulang approval.",
          );
        }

        manualPaymentVerifiedApprovalId = approvalRow.id;
        manualPaymentCoVerifierId = approvalRow.approvedBy;
        manualPaymentCoVerifiedAt = approvalRow.resolvedAt;
      }
    }
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return checkoutFailure(error.message);
    }

    throw error;
  }

  let claimedAttemptId: string | null = null;
  let claimedAttemptCount: number | null = null;

  try {
    const existingAttempt = await getPosCheckoutAttemptByKey(idempotencyKey);

    if (!existingAttempt) {
      const legacySale = await getPosCheckoutSaleResult({
        organizationId: auth.organization.id,
        cashierId: auth.user.id,
        outletIds: [primaryOutlet.id],
        idempotencyKey,
      });

      if (legacySale) {
        await db.insert(auditLogs).values({
          organizationId: auth.organization.id,
          outletId: primaryOutlet.id,
          actorUserId: auth.user.id,
          action: "pos.checkout.replayed",
          entityType: "sale",
          entityId: legacySale.id,
          beforeData: null,
          afterData: {
            invoiceNumber: legacySale.invoiceNumber,
            recoveryMode: "legacy_sale_without_attempt",
          },
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
          metadata: {
            source: "pos.checkout",
            idempotencyKey,
          },
          createdAt: new Date(),
        });

        await publishSaleRecoveryNotification({
          organizationId: auth.organization.id,
          outletId: primaryOutlet.id,
          cashierId: auth.user.id,
          saleId: legacySale.id,
          invoiceNumber: legacySale.invoiceNumber,
          totalAmount: legacySale.totalAmount,
          idempotencyKey,
          recoveryReason: "legacy_sale_without_attempt",
          source: "pos.checkout.legacy_recovery",
        }).catch((notificationError) => {
          console.error("Failed to publish legacy sale recovery notification", {
            saleId: legacySale.id,
            error: notificationError,
          });
        });

        return checkoutSuccess({
          message: `Transaksi ${legacySale.invoiceNumber} sudah pernah diproses dan berhasil dipulihkan.`,
          sale: legacySale,
          recovery: "replayed",
        });
      }
    }

    let checkoutRegisterId = existingAttempt?.registerId ?? null;
    let checkoutShiftId = existingAttempt?.shiftId ?? null;

    if (!checkoutRegisterId || !checkoutShiftId) {
      const [register] = await db
        .select({
          id: registers.id,
        })
        .from(registers)
        .where(getDefaultPosRegisterCondition(primaryOutlet.id))
        .orderBy(registers.name)
        .limit(1);

      if (!register) {
        throw new CheckoutValidationError(DEFAULT_POS_REGISTER_MISSING_MESSAGE);
      }

      const [activeShift] = await db
        .select({ id: shifts.id })
        .from(shifts)
        .where(
          and(
            eq(shifts.outletId, primaryOutlet.id),
            eq(shifts.registerId, register.id),
            eq(shifts.status, "open"),
          ),
        )
        .orderBy(sql`${shifts.openedAt} desc`)
        .limit(1);

      if (!activeShift) {
        throw new CheckoutValidationError(
          "Shift aktif belum dibuka. Buka shift terlebih dahulu sebelum checkout.",
        );
      }

      checkoutRegisterId = register.id;
      checkoutShiftId = activeShift.id;
    }

    const incompatibleProfile = normalizedPayments.find(
      (payment) =>
        payment.manualPaymentProfileRegisterId &&
        payment.manualPaymentProfileRegisterId !== checkoutRegisterId,
    );

    if (incompatibleProfile) {
      throw new CheckoutValidationError(
        `${incompatibleProfile.manualPaymentProfileName ?? "Terminal pembayaran"} hanya boleh dipakai pada register yang sudah dipetakan.`,
      );
    }

    const claimResult = await claimPosCheckoutAttempt({
      context: {
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        registerId: checkoutRegisterId,
        shiftId: checkoutShiftId,
        cashierId: auth.user.id,
      },
      payload: normalizedCheckoutPayload,
    });

    if (claimResult.status === "conflict") {
      await db.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        actorUserId: auth.user.id,
        action: "pos.checkout.idempotency_conflict",
        entityType: "pos_checkout_attempt",
        entityId: claimResult.attempt.id,
        beforeData: {
          requestFingerprint: claimResult.attempt.requestFingerprint,
          attemptStatus: claimResult.attempt.status,
        },
        afterData: {
          requestFingerprint: claimResult.fingerprint,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.checkout",
          idempotencyKey,
        },
        createdAt: new Date(),
      });

      return checkoutFailure(
        "Kode checkout yang sama digunakan untuk isi transaksi yang berbeda. Reset payment lalu proses sebagai transaksi baru.",
        {
          idempotencyKey: "Checkout attempt bertabrakan dengan payload lain.",
        },
        "idempotency_conflict",
      );
    }

    if (
      claimResult.status === "completed" ||
      claimResult.status === "processing"
    ) {
      const recoveryStatus = await getPosCheckoutRecoveryStatus({
        auth,
        idempotencyKey,
        recordRepairAudit: true,
      });

      if (recoveryStatus.status === "completed") {
        await db.insert(auditLogs).values({
          organizationId: auth.organization.id,
          outletId: primaryOutlet.id,
          actorUserId: auth.user.id,
          action: "pos.checkout.replayed",
          entityType: "sale",
          entityId: recoveryStatus.sale.id,
          beforeData: null,
          afterData: {
            invoiceNumber: recoveryStatus.sale.invoiceNumber,
            attemptId: claimResult.attempt.id,
          },
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
          metadata: {
            source: "pos.checkout",
            idempotencyKey,
          },
          createdAt: new Date(),
        });

        return checkoutSuccess({
          message: `Transaksi ${recoveryStatus.sale.invoiceNumber} sudah berhasil diproses dan dipulihkan.`,
          sale: recoveryStatus.sale,
          recovery: "replayed",
        });
      }

      return checkoutProcessing(idempotencyKey, recoveryStatus.message);
    }

    claimedAttemptId = claimResult.attempt.id;
    claimedAttemptCount = claimResult.attempt.attemptCount;
    const checkoutFingerprint = claimResult.fingerprint;

    const createdSale = await db.transaction(async (transaction) => {
      const now = new Date();

      const [register] = await transaction
        .select({
          id: registers.id,
          code: registers.code,
          name: registers.name,
          outletId: registers.outletId,
        })
        .from(registers)
        .where(
          and(
            eq(registers.id, checkoutRegisterId),
            eq(registers.outletId, primaryOutlet.id),
            eq(registers.isActive, true),
          ),
        )
        .limit(1);

      if (!register) {
        throw new CheckoutValidationError(DEFAULT_POS_REGISTER_MISSING_MESSAGE);
      }

      const [activeShift] = await transaction
        .select({
          id: shifts.id,
          status: shifts.status,
        })
        .from(shifts)
        .where(
          and(
            eq(shifts.id, checkoutShiftId),
            eq(shifts.outletId, primaryOutlet.id),
            eq(shifts.registerId, register.id),
            eq(shifts.status, "open"),
          ),
        )
        .limit(1);

      if (!activeShift) {
        throw new CheckoutValidationError(
          "Shift checkout sudah tidak aktif. Periksa status transaksi sebelum membuat transaksi baru.",
        );
      }

      const activeManualProfileIds = Array.from(
        new Set(
          normalizedPayments
            .map((payment) => payment.manualPaymentProfileId)
            .filter((profileId): profileId is string => Boolean(profileId)),
        ),
      );

      if (activeManualProfileIds.length > 0) {
        const activeProfileRows = await transaction
          .select({ id: manualPaymentProfiles.id })
          .from(manualPaymentProfiles)
          .where(
            and(
              eq(manualPaymentProfiles.organizationId, auth.organization.id),
              eq(manualPaymentProfiles.outletId, primaryOutlet.id),
              eq(manualPaymentProfiles.isActive, true),
              inArray(manualPaymentProfiles.id, activeManualProfileIds),
              or(
                isNull(manualPaymentProfiles.registerId),
                eq(manualPaymentProfiles.registerId, register.id),
              ),
            ),
          );

        if (activeProfileRows.length !== activeManualProfileIds.length) {
          throw new CheckoutValidationError(
            "Salah satu akun/terminal pembayaran sudah dinonaktifkan atau tidak sesuai register. Pilih ulang preset payment.",
          );
        }
      }

      const selectedCustomer = customerId
        ? (
            await transaction
              .select({
                id: customers.id,
                customerCode: customers.customerCode,
                fullName: customers.fullName,
                phone: customers.phone,
                email: customers.email,
              })
              .from(customers)
              .where(
                and(
                  eq(customers.id, customerId),
                  eq(customers.organizationId, auth.organization.id),
                  eq(customers.isActive, true),
                ),
              )
              .limit(1)
          )[0]
        : null;

      if (customerId && !selectedCustomer) {
        throw new CheckoutValidationError(
          "Customer yang dipilih tidak ditemukan atau sudah tidak aktif.",
        );
      }

      const itemRows = await transaction
        .select({
          id: productItems.id,
          sku: productItems.sku,
          barcode: productItems.barcode,
          qrValue: productItems.qrValue,
          serialNumber: productItems.serialNumber,
          currentOutletId: productItems.currentOutletId,
          weightGram: productItems.weightGram,
          purityPercent: productItems.purityPercent,
          exchangePurityPercent: productItems.exchangePurityPercent,
          size: productItems.size,
          color: productItems.color,
          gemstone: productItems.gemstone,
          sellingAmount: productItems.sellingAmount,
          costAmount: productItems.costAmount,
          imageKey: productItems.imageKey,
          availability: productItems.availability,
          condition: productItems.condition,
          locationState: productItems.locationState,
          isActive: productItems.isActive,
          productMasterId: productMasters.id,
          productCode: productMasters.code,
          itemDisplayName: productItems.displayName,
          masterProductName: productMasters.name,
          productName: sql<string>`coalesce(${productItems.displayName}, ${productMasters.name})`,
          productImageKey: productMasters.imageKey,
          productStatus: productMasters.status,
          categoryId: productCategories.id,
          categoryCode: productCategories.code,
          categoryName: productCategories.name,
          categoryIsActive: productCategories.isActive,
        })
        .from(productItems)
        .innerJoin(
          productMasters,
          eq(productItems.productMasterId, productMasters.id),
        )
        .innerJoin(
          productCategories,
          eq(productMasters.categoryId, productCategories.id),
        )
        .where(
          and(
            eq(productItems.organizationId, auth.organization.id),
            inArray(productItems.id, itemIds),
          ),
        );

      if (itemRows.length !== itemIds.length) {
        throw new CheckoutValidationError(
          "Sebagian item tidak ditemukan. Refresh POS lalu coba ulang.",
        );
      }

      const activeHeldRows = await transaction
        .select({
          productItemId: posHeldCartItems.productItemId,
          holdNumber: posHeldCarts.holdNumber,
          title: posHeldCarts.title,
        })
        .from(posHeldCartItems)
        .innerJoin(posHeldCarts, eq(posHeldCartItems.heldCartId, posHeldCarts.id))
        .where(
          and(
            inArray(posHeldCartItems.productItemId, itemIds),
            eq(posHeldCartItems.isActive, true),
            eq(posHeldCarts.organizationId, auth.organization.id),
            eq(posHeldCarts.outletId, primaryOutlet.id),
            eq(posHeldCarts.status, "active"),
          ),
        )
        .limit(1);

      const activeHeldItem = activeHeldRows[0];

      if (activeHeldItem) {
        const heldItem = itemRows.find((item) => item.id === activeHeldItem.productItemId);
        throw new CheckoutValidationError(
          `${heldItem?.sku ?? "Item"} sedang ditahan di ${activeHeldItem.holdNumber}${activeHeldItem.title ? ` (${activeHeldItem.title})` : ""}. Resume atau batalkan hold tersebut sebelum checkout.`,
        );
      }

      const itemMap = new Map(itemRows.map((item) => [item.id, item]));
      const orderedItems = itemIds.map((itemId) => itemMap.get(itemId));

      for (const item of orderedItems) {
        if (!item) {
          throw new CheckoutValidationError(
            "Ada item transaksi yang tidak ditemukan.",
          );
        }

        if (!item.isActive) {
          throw new CheckoutValidationError(
            `${item.sku} tidak aktif atau sudah diarsipkan.`,
          );
        }

        if (item.productStatus !== "active" || !item.categoryIsActive) {
          throw new CheckoutValidationError(
            `${item.sku} belum bisa dijual karena produk/kategori belum aktif.`,
          );
        }

        if (item.currentOutletId !== primaryOutlet.id) {
          throw new CheckoutValidationError(
            `${item.sku} tidak berada di outlet aktif POS ini.`,
          );
        }

        if (
          item.availability !== "available" ||
          item.condition !== "good" ||
          item.locationState !== "outlet"
        ) {
          throw new CheckoutValidationError(
            `${item.sku} sudah tidak tersedia untuk dijual. Refresh POS lalu cek ulang.`,
          );
        }

        if (parseDbAmount(item.sellingAmount) <= 0) {
          throw new CheckoutValidationError(
            `${item.sku} belum memiliki harga jual.`,
          );
        }
      }

      const itemAmounts = orderedItems.map((item) =>
        parseDbAmount(item!.sellingAmount),
      );
      const subtotalAmount = itemAmounts.reduce((total, amount) => total + amount, 0);
      let approvedDiscountAmount = 0;
      let approvedDiscountReason: string | null = null;
      let appliedDiscountApprovalId: string | null = null;

      if (submittedDiscountAmount > 0) {
        if (submittedDiscountAmount >= subtotalAmount) {
          throw new CheckoutValidationError(
            "Nominal diskon harus lebih kecil dari subtotal transaksi.",
          );
        }

        const cartFingerprint = createPosCartFingerprint({
          outletId: primaryOutlet.id,
          itemIds,
          subtotalAmount,
          discountAmount: submittedDiscountAmount,
        });

        const approvalRows = await transaction
          .select({
            id: approvals.id,
            status: approvals.status,
            requestData: approvals.requestData,
            notes: approvals.notes,
            responseNotes: approvals.responseNotes,
            referenceType: approvals.referenceType,
            referenceId: approvals.referenceId,
          })
          .from(approvals)
          .where(
            and(
              eq(approvals.id, discountApprovalId!),
              eq(approvals.organizationId, auth.organization.id),
              eq(approvals.outletId, primaryOutlet.id),
              eq(approvals.requestedBy, auth.user.id),
              eq(approvals.type, "discount"),
              eq(approvals.referenceType, "pos_cart"),
            ),
          )
          .limit(1);

        const approval = approvalRows[0];

        if (!approval) {
          throw new CheckoutValidationError(
            "Approval diskon tidak ditemukan untuk transaksi POS ini.",
          );
        }

        if (approval.status !== "approved") {
          throw new CheckoutValidationError(
            approval.status === "rejected"
              ? "Approval diskon ditolak. Hapus diskon atau ajukan ulang."
              : "Approval diskon masih pending. Tunggu manager/owner approve terlebih dahulu.",
          );
        }

        const approvalDiscountAmount = Number(approval.requestData.discountAmount ?? 0);
        const approvalFingerprint = String(
          approval.requestData.cartFingerprint ?? "",
        );

        if (
          !Number.isSafeInteger(approvalDiscountAmount) ||
          approvalDiscountAmount !== submittedDiscountAmount ||
          approvalFingerprint !== cartFingerprint ||
          approval.referenceId
        ) {
          throw new CheckoutValidationError(
            "Approval diskon tidak cocok dengan cart saat ini. Hapus diskon lalu ajukan ulang.",
          );
        }

        approvedDiscountAmount = submittedDiscountAmount;
        approvedDiscountReason =
          submittedDiscountReason ??
          normalizeNullableText(String(approval.requestData.reason ?? approval.notes ?? ""), 500);
        appliedDiscountApprovalId = approval.id;
      }

      const lineDiscounts = allocateLineDiscounts({
        itemAmounts,
        discountAmount: approvedDiscountAmount,
      });
      const totalAmount = subtotalAmount - approvedDiscountAmount;
      const totalPaidAmount = normalizedPayments.reduce(
        (total, payment) => total + payment.amount,
        0,
      );

      if (totalAmount <= 0) {
        throw new CheckoutValidationError(
          "Total transaksi tidak valid. Periksa harga jual item dan diskon.",
        );
      }

      if (totalPaidAmount !== totalAmount) {
        throw new CheckoutValidationError(
          "Total pembayaran harus sama dengan total transaksi setelah diskon.",
        );
      }

      const nonCashPayments = normalizedPayments.filter((payment) =>
        isNonCashManualPaymentMethod(payment.method),
      );

      for (const payment of [...nonCashPayments].sort((left, right) =>
        `${left.method}:${left.normalizedProvider}:${left.normalizedReference}`.localeCompare(
          `${right.method}:${right.normalizedProvider}:${right.normalizedReference}`,
        ),
      )) {
        const duplicateLockKey = [
          auth.organization.id,
          primaryOutlet.id,
          payment.method,
          payment.normalizedProvider,
          payment.normalizedReference,
        ].join(":");

        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${duplicateLockKey}, 0))`,
        );

        const policy =
          manualPaymentPolicyMap[payment.method as NonCashManualPaymentMethod];
        const lookbackDate = new Date(
          now.getTime() - policy.duplicateLookbackDays * 24 * 60 * 60 * 1000,
        );
        const duplicateRows = await transaction
          .select({
            paymentId: payments.id,
            invoiceNumber: sales.invoiceNumber,
          })
          .from(payments)
          .innerJoin(sales, eq(payments.saleId, sales.id))
          .where(
            and(
              eq(sales.organizationId, auth.organization.id),
              eq(sales.outletId, primaryOutlet.id),
              eq(payments.method, payment.method),
              eq(payments.normalizedReference, payment.normalizedReference!),
              eq(payments.status, "paid"),
              gte(payments.createdAt, lookbackDate),
              sql`upper(regexp_replace(${payments.provider}, '\\s+', ' ', 'g')) = ${payment.normalizedProvider}`,
            ),
          )
          .limit(5);

        if (duplicateRows.length > 0 && !manualPaymentCoVerifierId) {
          throw new CheckoutValidationError(
            `${manualPaymentMethodLabels[payment.method]} memakai reference yang baru saja tercatat pada transaksi lain. Retry checkout untuk membuat co-verification manager/finance.`,
          );
        }

        manualPaymentDuplicatePaymentIds = Array.from(
          new Set([
            ...manualPaymentDuplicatePaymentIds,
            ...duplicateRows.map((row) => row.paymentId),
          ]),
        );
      }

      const invoiceNumber = generateInvoiceNumber({
        outletCode: primaryOutlet.code,
        date: now,
      });

      const saleRows = await transaction
        .insert(sales)
        .values({
          organizationId: auth.organization.id,
          outletId: primaryOutlet.id,
          registerId: register.id,
          shiftId: activeShift.id,
          customerId: selectedCustomer?.id ?? null,
          cashierId: auth.user.id,
          invoiceNumber,
          idempotencyKey,
          checkoutFingerprint,
          status: "completed",
          subtotalAmount: String(subtotalAmount),
          discountAmount: String(approvedDiscountAmount),
          discountReason: approvedDiscountReason,
          additionalFeeAmount: "0",
          totalAmount: String(totalAmount),
          completedAt: now,
          notes: saleNote,
          createdAt: now,
          updatedAt: now,
        })
        .returning({
          id: sales.id,
          invoiceNumber: sales.invoiceNumber,
          totalAmount: sales.totalAmount,
        });

      const sale = saleRows[0];

      if (!sale) {
        throw new Error("SALE_INSERT_FAILED");
      }

      if (appliedDiscountApprovalId) {
        await transaction
          .update(approvals)
          .set({
            referenceType: "sale",
            referenceId: sale.id,
          })
          .where(eq(approvals.id, appliedDiscountApprovalId));
      }

      if (evidenceKeys.length > 0) {
        const attachedEvidenceRows = await transaction
          .update(paymentEvidenceUploads)
          .set({
            saleId: sale.id,
            attachedAt: now,
            expiresAt: null,
          })
          .where(
            and(
              eq(paymentEvidenceUploads.organizationId, auth.organization.id),
              eq(paymentEvidenceUploads.outletId, primaryOutlet.id),
              eq(paymentEvidenceUploads.uploadedBy, auth.user.id),
              inArray(paymentEvidenceUploads.storageKey, evidenceKeys),
              isNull(paymentEvidenceUploads.saleId),
              gt(paymentEvidenceUploads.expiresAt, now),
            ),
          )
          .returning({ storageKey: paymentEvidenceUploads.storageKey });

        if (attachedEvidenceRows.length !== evidenceKeys.length) {
          throw new CheckoutValidationError(
            "Bukti pembayaran sudah dipakai transaksi lain atau kedaluwarsa. Checkout dibatalkan.",
          );
        }
      }

      await transaction.insert(saleItems).values(
        orderedItems.map((item, index) => {
          const listPriceAmount = parseDbAmount(item!.sellingAmount);
          const lineDiscountAmount = lineDiscounts[index] ?? 0;
          const finalPriceAmount = Math.max(listPriceAmount - lineDiscountAmount, 0);

          return {
            saleId: sale.id,
            productItemId: item!.id,
            lineNumber: index + 1,
            listPriceAmount: String(listPriceAmount),
            discountAmount: String(lineDiscountAmount),
            finalPriceAmount: String(finalPriceAmount),
            snapshot: {
              sku: item!.sku,
              barcode: item!.barcode,
              qrValue: item!.qrValue,
              serialNumber: item!.serialNumber,
              productMasterId: item!.productMasterId,
              productCode: item!.productCode,
              itemDisplayName: item!.itemDisplayName,
              masterProductName: item!.masterProductName,
              productName: item!.productName,
              categoryId: item!.categoryId,
              categoryCode: item!.categoryCode,
              categoryName: item!.categoryName,
              weightGram: item!.weightGram,
              purityPercent: item!.purityPercent,
              exchangePurityPercent: item!.exchangePurityPercent,
              size: item!.size,
              color: item!.color,
              gemstone: item!.gemstone,
              sellingAmount: item!.sellingAmount,
              imageKey: item!.imageKey,
              productImageKey: item!.productImageKey,
            },
            createdAt: now,
          };
        }),
      );

      const updatedRows = await transaction
        .update(productItems)
        .set({
          availability: "sold",
          locationState: "customer",
          updatedAt: now,
        })
        .where(
          and(
            eq(productItems.organizationId, auth.organization.id),
            inArray(productItems.id, itemIds),
            eq(productItems.currentOutletId, primaryOutlet.id),
            eq(productItems.isActive, true),
            eq(productItems.availability, "available"),
            eq(productItems.condition, "good"),
            eq(productItems.locationState, "outlet"),
          ),
        )
        .returning({ id: productItems.id });

      if (updatedRows.length !== itemIds.length) {
        throw new CheckoutValidationError(
          "Sebagian item sudah berubah status saat checkout. Transaksi dibatalkan, refresh POS lalu coba ulang.",
        );
      }

      await transaction.insert(inventoryMovements).values(
        orderedItems.map((item) => ({
          organizationId: auth.organization.id,
          itemId: item!.id,
          movementType: "sale" as const,
          fromOutletId: primaryOutlet.id,
          toOutletId: null,
          referenceType: "sale",
          referenceId: sale.id,
          reason: `Terjual melalui POS ${invoiceNumber}.`,
          metadata: {
            invoiceNumber,
            registerId: register.id,
            shiftId: activeShift.id,
            cashierId: auth.user.id,
            sellingAmount: item!.sellingAmount,
          },
          performedBy: auth.user.id,
          approvedBy: null,
          occurredAt: now,
          createdAt: now,
        })),
      );

      await transaction.insert(payments).values(
        normalizedPayments.map((payment) => {
          const isNonCash = isNonCashManualPaymentMethod(payment.method);
          const isCoVerified = isNonCash && Boolean(manualPaymentCoVerifierId);

          return {
            saleId: sale.id,
            method: payment.method,
            provider: getPaymentProvider({
              method: payment.method,
              provider: payment.provider,
            }),
            amount: String(payment.amount),
            status: "paid" as const,
            providerReference: payment.reference,
            normalizedReference: payment.normalizedReference,
            externalOrderId: null,
            verificationStatus: isCoVerified
              ? ("co_verified" as const)
              : ("self_verified" as const),
            verificationSource: payment.verificationSource,
            providerPaidAt: payment.providerPaidAt,
            verificationApprovalId: isCoVerified
              ? manualPaymentVerifiedApprovalId
              : null,
            coVerifiedBy: isCoVerified ? manualPaymentCoVerifierId : null,
            coVerifiedAt: isCoVerified ? manualPaymentCoVerifiedAt : null,
            evidenceKey: payment.evidenceKey,
            manualPaymentProfileId: payment.manualPaymentProfileId,
            settlementStatus: isNonCash
              ? ("unreconciled" as const)
              : ("not_applicable" as const),
            verifiedBy: auth.user.id,
            verifiedAt: now,
            paidAt: payment.providerPaidAt ?? now,
            metadata: {
              source: "pos.manual_payment_verification_v1",
              methodLabel: manualPaymentMethodLabels[payment.method],
              receivedAmount: payment.receivedAmount,
              changeAmount: payment.changeAmount,
              note: payment.note,
              verificationFingerprint: manualPaymentVerificationFingerprint,
              manualPaymentProfile: payment.manualPaymentProfileId
                ? {
                    id: payment.manualPaymentProfileId,
                    code: payment.manualPaymentProfileCode,
                    name: payment.manualPaymentProfileName,
                  }
                : null,
              verificationDetails: payment.verificationDetails,
              duplicatePaymentIds: manualPaymentDuplicatePaymentIds,
              makerCheckerEnforced: isCoVerified,
            },
            createdAt: now,
            updatedAt: now,
          };
        }),
      );

      const cashPaidAmount = normalizedPayments
        .filter((payment) => payment.method === "cash")
        .reduce((total, payment) => total + payment.amount, 0);

      if (cashPaidAmount > 0) {
        await transaction.insert(cashMovements).values({
          shiftId: activeShift.id,
          type: "cash_sale",
          amount: String(cashPaidAmount),
          referenceType: "sale",
          referenceId: sale.id,
          reason: `Pembayaran cash transaksi ${invoiceNumber}.`,
          createdBy: auth.user.id,
          createdAt: now,
        });

        await transaction
          .update(shifts)
          .set({
            expectedCash: sql`coalesce(${shifts.expectedCash}, 0) + ${cashPaidAmount}`,
            updatedAt: now,
          })
          .where(eq(shifts.id, activeShift.id));
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        actorUserId: auth.user.id,
        action: "sale.completed",
        entityType: "sale",
        entityId: sale.id,
        beforeData: null,
        afterData: {
          saleId: sale.id,
          invoiceNumber,
          outletId: primaryOutlet.id,
          outletCode: primaryOutlet.code,
          registerId: register.id,
          registerCode: register.code,
          shiftId: activeShift.id,
          cashierId: auth.user.id,
          customerId: selectedCustomer?.id ?? null,
          customerCode: selectedCustomer?.customerCode ?? null,
          customerName: selectedCustomer?.fullName ?? null,
          itemCount: itemIds.length,
          subtotalAmount: String(subtotalAmount),
          discountAmount: String(approvedDiscountAmount),
          discountReason: approvedDiscountReason,
          discountApprovalId: appliedDiscountApprovalId,
          totalAmount: String(totalAmount),
          payments: normalizedPayments.map((payment) => ({
            method: payment.method,
            amount: String(payment.amount),
            provider: payment.provider,
            reference: payment.reference,
            changeAmount: payment.changeAmount,
          })),
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.checkout",
          idempotencyKey,
          customerId: selectedCustomer?.id ?? null,
          discountApprovalId: appliedDiscountApprovalId,
        },
        createdAt: now,
      });

      const totalWeightGram = orderedItems.reduce((total, item) => {
        const weight = Number(item?.weightGram ?? 0);
        return Number.isFinite(weight) ? total + weight : total;
      }, 0);

      await publishSaleCompletedNotificationInTransaction(transaction, {
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        outletCode: primaryOutlet.code,
        outletName: primaryOutlet.name,
        registerId: register.id,
        registerCode: register.code,
        shiftId: activeShift.id,
        cashierId: auth.user.id,
        cashierName: auth.user.fullName,
        saleId: sale.id,
        invoiceNumber,
        subtotalAmount,
        discountAmount: approvedDiscountAmount,
        totalAmount,
        itemCount: itemIds.length,
        totalWeightGram,
        payments: normalizedPayments.map((payment) => ({
          method: payment.method,
          methodLabel: manualPaymentMethodLabels[payment.method],
          amount: payment.amount,
          provider: payment.provider,
        })),
        occurredAt: now,
      });

      if (claimResult.replay) {
        await publishSaleRecoveryNotificationInTransaction(transaction, {
          organizationId: auth.organization.id,
          outletId: primaryOutlet.id,
          cashierId: auth.user.id,
          saleId: sale.id,
          invoiceNumber,
          totalAmount,
          idempotencyKey,
          recoveryReason: "checkout_retry",
          occurredAt: now,
          source: "pos.checkout.reclaimed_attempt",
        });
      }

      const receiptCertificateJob = await createHardwareJobV2InTransaction(
        transaction,
        {
          organizationId: auth.organization.id,
          outletId: primaryOutlet.id,
          registerId: register.id,
          createdByUserId: auth.user.id,
          jobType: "print_receipt_certificate",
          mode: "automatic",
          payload: buildReceiptDocumentPayloadV2({
            saleId: sale.id,
            invoiceNumber,
            requestSource: "pos.checkout",
            reprint: false,
            requestedAt: now,
          }),
          idempotencyKey: `receipt:${sale.id}:initial`,
          sourceType: "sale",
          sourceId: sale.id,
          now,
          audit: {
            source: "pos.checkout",
            requestId: idempotencyKey,
            ipAddress: requestMetadata.ipAddress,
            userAgent: requestMetadata.userAgent,
          },
        },
      );

      return {
        ...sale,
        receiptCertificateJobId: receiptCertificateJob.job.id,
      };
    });

    try {
      await markPosCheckoutAttemptCompleted({
        attemptId: claimResult.attempt.id,
        attemptCount: claimResult.attempt.attemptCount,
        saleId: createdSale.id,
      });
    } catch (attemptUpdateError) {
      console.error("Failed to finalize POS checkout attempt", {
        attemptId: claimResult.attempt.id,
        saleId: createdSale.id,
        error: attemptUpdateError,
      });
    }

    revalidatePath("/pos");
    revalidatePath("/pos/pelanggan");
    revalidatePath("/pos/transaksi");
    revalidatePath("/admin/pelanggan");
    revalidatePath("/admin/penjualan");
    revalidatePath(`/admin/penjualan/${createdSale.id}`);
    revalidatePath("/admin/inventaris");
    revalidatePath("/admin/operasional/shift");
    revalidatePath("/admin/operasional/kas");
    revalidatePath("/admin/operasional/hardware");
    revalidatePath("/admin");

    return checkoutSuccess({
      message: claimResult.replay
        ? `Transaksi ${createdSale.invoiceNumber} berhasil diproses ulang secara aman.`
        : `Transaksi ${createdSale.invoiceNumber} berhasil diselesaikan.`,
      sale: {
        id: createdSale.id,
        invoiceNumber: createdSale.invoiceNumber,
        totalAmount: createdSale.totalAmount,
        receiptCertificateJobId: createdSale.receiptCertificateJobId,
      },
      recovery: claimResult.replay ? "replayed" : "created",
    });
  } catch (error) {
    if (claimedAttemptId) {
      const recoveryStatus = await getPosCheckoutRecoveryStatus({
        auth,
        idempotencyKey,
        recordRepairAudit: true,
      }).catch(() => null);

      if (recoveryStatus?.status === "completed") {
        return checkoutSuccess({
          message: `Transaksi ${recoveryStatus.sale.invoiceNumber} sebenarnya sudah berhasil dan berhasil dipulihkan.`,
          sale: recoveryStatus.sale,
          recovery: "replayed",
        });
      }
    }

    if (error instanceof CheckoutValidationError) {
      if (claimedAttemptId && claimedAttemptCount !== null) {
        await markPosCheckoutAttemptFailed({
          attemptId: claimedAttemptId,
          attemptCount: claimedAttemptCount,
          errorCode: "validation_error",
          errorMessage: error.message,
        }).catch(() => undefined);
      }

      return checkoutFailure(error.message, undefined, "validation_error");
    }

    const systemErrorMessage = getSystemErrorMessage(error);

    if (claimedAttemptId && claimedAttemptCount !== null) {
      await markPosCheckoutAttemptFailed({
        attemptId: claimedAttemptId,
        attemptCount: claimedAttemptCount,
        errorCode: "system_error",
        errorMessage: systemErrorMessage,
      }).catch(() => undefined);
    }

    console.error("Failed to complete POS checkout", {
      message: systemErrorMessage,
      error,
    });

    if (process.env.NODE_ENV !== "production") {
      return checkoutFailure(
        `Transaksi belum bisa diselesaikan karena terjadi kendala sistem: ${systemErrorMessage}`,
        undefined,
        "system_error",
      );
    }

    return checkoutFailure(
      "Transaksi belum bisa diselesaikan karena terjadi kendala sistem. Periksa status transaksi sebelum mencoba kembali.",
      undefined,
      "system_error",
    );
  }
}



export async function reprintPosReceiptCertificateAction(formData: FormData) {
  const auth = await requirePermission("pos.access");
  const saleId = readText(formData, "saleId");
  const requestId = readText(formData, "requestId");
  const returnTo = readText(formData, "returnTo");

  if (!UUID_PATTERN.test(saleId)) {
    redirectPosTransactionsWithFeedback({
      returnTo,
      type: "error",
      message: "Transaksi tidak valid untuk cetak ulang invoice.",
    });
  }

  if (!UUID_PATTERN.test(requestId)) {
    redirectPosTransactionsWithFeedback({
      returnTo,
      type: "error",
      message: "Request cetak ulang invoice tidak valid.",
    });
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  if (!primaryOutlet) {
    redirectPosTransactionsWithFeedback({
      returnTo,
      type: "error",
      message:
        "Outlet aktif tidak ditemukan. Hubungi manager/admin untuk mengatur akses outlet staff ini.",
    });
  }

  const [sale] = await db
    .select({
      id: sales.id,
      outletId: sales.outletId,
      registerId: sales.registerId,
      invoiceNumber: sales.invoiceNumber,
      totalAmount: sales.totalAmount,
      status: sales.status,
    })
    .from(sales)
    .where(
      and(
        eq(sales.id, saleId),
        eq(sales.organizationId, auth.organization.id),
        eq(sales.outletId, primaryOutlet.id),
        eq(sales.status, "completed"),
      ),
    )
    .limit(1);

  if (!sale) {
    redirectPosTransactionsWithFeedback({
      returnTo,
      type: "error",
      message:
        "Transaksi tidak ditemukan untuk outlet aktif ini, atau statusnya belum completed.",
    });
  }

  const now = new Date();
  const agentRows = await db
    .select({
      id: hardwareAgents.id,
      status: hardwareAgents.status,
      isActive: hardwareAgents.isActive,
      lastSeenAt: hardwareAgents.lastSeenAt,
    })
    .from(hardwareAgents)
    .where(
      and(
        eq(hardwareAgents.organizationId, auth.organization.id),
        eq(hardwareAgents.outletId, sale.outletId),
        eq(hardwareAgents.registerId, sale.registerId),
        eq(hardwareAgents.isActive, true),
      ),
    );

  const queueState = getHardwareAgentQueueState(agentRows, now);

  if (queueState === "not_configured") {
    redirectPosTransactionsWithFeedback({
      returnTo,
      type: "error",
      message:
        "Belum ada Hardware Hub aktif untuk register transaksi ini. Hubungkan Mini PC Hardware Hub sebelum cetak ulang invoice.",
    });
  }

  let feedbackType: "success" | "info";
  let feedbackMessage: string;

  try {
    const result = await createHardwareJobV2({
      organizationId: auth.organization.id,
      outletId: sale.outletId,
      registerId: sale.registerId,
      createdByUserId: auth.user.id,
      jobType: "print_receipt_certificate",
      mode: "manual",
      payload: buildReceiptDocumentPayloadV2({
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        requestSource: "pos.transaction_detail",
        reprint: true,
        requestedAt: now,
      }),
      idempotencyKey: `receipt:${sale.id}:reprint:${requestId}`,
      sourceType: "sale",
      sourceId: sale.id,
      now,
      audit: {
        source: "pos.transaction_detail",
        requestId,
        reason: `Cetak ulang invoice ${sale.invoiceNumber}.`,
      },
    });

    revalidatePath(POS_TRANSACTIONS_PATH);
    revalidatePath("/admin/operasional/hardware");
    revalidatePath("/admin");

    feedbackType = queueState === "online" ? "success" : "info";
    feedbackMessage = getReprintQueuedMessage({
      invoiceNumber: sale.invoiceNumber,
      duplicate: result.duplicate,
      queueState,
    });
  } catch (error) {
    console.error("Failed to queue POS receipt/certificate reprint", error);

    redirectPosTransactionsWithFeedback({
      returnTo,
      type: "error",
      message:
        "Cetak ulang invoice belum bisa dibuat karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    });
  }

  redirectPosTransactionsWithFeedback({
    returnTo,
    type: feedbackType,
    message: feedbackMessage,
  });
}

export async function closePosShiftAction(
  _previousState: PosShiftActionState,
  formData: FormData,
): Promise<PosShiftActionState> {
  const auth = await requirePermission("shifts.manage");

  const shiftId = readText(formData, "shiftId");
  const registerId = readText(formData, "registerId");
  const actualCashInput = readText(formData, "actualCash");
  const varianceReason = readText(formData, "varianceReason");
  const actualCash = parseShiftClosingActualCash(actualCashInput);

  const fieldErrors: Record<string, string> = {};

  if (!UUID_PATTERN.test(shiftId)) {
    fieldErrors.shiftId = "Shift POS tidak valid.";
  }

  if (!UUID_PATTERN.test(registerId)) {
    fieldErrors.registerId = "Register POS tidak valid.";
  }

  if (!Number.isFinite(actualCash) || actualCash < 0) {
    fieldErrors.actualCash = "Kas fisik aktual harus berupa nominal positif atau nol.";
  }

  if (actualCash > 10_000_000_000) {
    fieldErrors.actualCash = "Kas fisik aktual terlalu besar.";
  }

  if (varianceReason.length > 500) {
    fieldErrors.varianceReason = "Catatan selisih maksimal 500 karakter.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data tutup shift.", fieldErrors);
  }

  const requestMetadata = await getRequestMetadata();

  try {
    await closeShiftWithReconciliation({
      auth,
      shiftId,
      actualCash,
      varianceReason,
      requestMetadata,
      source: "pos.close_shift",
    });
  } catch (error) {
    if (error instanceof ShiftClosingError) {
      return failure(error.message);
    }

    console.error("Failed to close POS shift", error);

    return failure(
      "Shift belum bisa ditutup karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    );
  }

  revalidatePath("/pos");
  revalidatePath("/admin/operasional/shift");
  revalidatePath("/admin/operasional/kas");

  return success("Shift berhasil ditutup dan kas sudah direkonsiliasi.");
}

export async function openPosShiftAction(
  _previousState: PosShiftActionState,
  formData: FormData,
): Promise<PosShiftActionState> {
  const auth = await requirePermission("shifts.manage");

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  if (!primaryOutlet) {
    return failure(
      "Outlet aktif tidak ditemukan. Hubungi manager/admin untuk mengatur akses outlet staff ini.",
    );
  }

  const registerId = readText(formData, "registerId");
  const openingCashInput = readText(formData, "openingCash");
  const note = readText(formData, "note");
  const openingCash = parseCashAmount(openingCashInput);

  const fieldErrors: Record<string, string> = {};

  if (!UUID_PATTERN.test(registerId)) {
    fieldErrors.registerId = "Register POS tidak valid.";
  }

  if (!Number.isFinite(openingCash) || openingCash < 0) {
    fieldErrors.openingCash = "Modal kas awal harus berupa nominal positif.";
  }

  if (openingCash > 1_000_000_000) {
    fieldErrors.openingCash = "Modal kas awal terlalu besar untuk dibuka dari POS.";
  }

  if (note.length > 240) {
    fieldErrors.note = "Catatan maksimal 240 karakter.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure("Periksa kembali data buka shift.", fieldErrors);
  }

  const registerRows = await db
    .select({
      id: registers.id,
      code: registers.code,
      name: registers.name,
      outletId: registers.outletId,
    })
    .from(registers)
    .where(
      and(
        eq(registers.id, registerId),
        eq(registers.outletId, primaryOutlet.id),
        eq(registers.isActive, true),
        eq(registers.isHardwareHub, true),
      ),
    )
    .limit(1);

  const register = registerRows[0];

  if (!register) {
    return failure(DEFAULT_POS_REGISTER_SHIFT_MESSAGE);
  }

  const activeShiftRows = await db
    .select({
      id: shifts.id,
      status: shifts.status,
    })
    .from(shifts)
    .where(
      and(
        eq(shifts.outletId, primaryOutlet.id),
        eq(shifts.registerId, register.id),
        inArray(shifts.status, ["open", "closing"]),
      ),
    )
    .limit(1);

  if (activeShiftRows[0]) {
    revalidatePath("/pos");

    return success("Shift untuk register ini sudah aktif. POS akan diperbarui.");
  }

  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      const now = new Date();
      const openingCashAmount = String(openingCash);

      const shiftRows = await transaction
        .insert(shifts)
        .values({
          outletId: primaryOutlet.id,
          registerId: register.id,
          openedBy: auth.user.id,
          status: "open",
          openingCash: openingCashAmount,
          expectedCash: openingCashAmount,
          openedAt: now,
          updatedAt: now,
        })
        .returning({ id: shifts.id });

      const shift = shiftRows[0];

      if (!shift) {
        throw new Error("SHIFT_INSERT_FAILED");
      }

      await transaction.insert(cashMovements).values({
        shiftId: shift.id,
        type: "opening_balance",
        amount: openingCashAmount,
        referenceType: "shift",
        referenceId: shift.id,
        reason: note || "Modal kas awal shift POS.",
        createdBy: auth.user.id,
        createdAt: now,
      });

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet.id,
        actorUserId: auth.user.id,
        action: "shift.open",
        entityType: "shift",
        entityId: shift.id,
        beforeData: null,
        afterData: {
          shiftId: shift.id,
          outletId: primaryOutlet.id,
          outletCode: primaryOutlet.code,
          registerId: register.id,
          registerCode: register.code,
          registerName: register.name,
          openingCash: openingCashAmount,
          note: note || null,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "pos.open_shift",
        },
      });
    });
  } catch (error) {
    console.error("Failed to open POS shift", error);

    return failure(
      "Shift belum bisa dibuka karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    );
  }

  revalidatePath("/pos");
  revalidatePath("/admin/operasional/shift");
  revalidatePath("/admin/operasional/kas");

  return success(`Shift ${register.name} berhasil dibuka.`);
}
