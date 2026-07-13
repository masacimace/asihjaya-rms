"use server";

import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  approvals,
  auditLogs,
  customers,
  hardwareAgents,
  outlets,
  payments,
  registers,
  saleItems,
  saleReturnCases,
  sales,
  shifts,
  users,
} from "@/db/schema";
import {
  getSaleSensitivePermission,
  PAYMENT_REFUND_REQUEST_PERMISSION,
  SALE_VOID_REQUEST_PERMISSION,
} from "@/features/approvals/authorization";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { createHardwareJobWithDuplicateGuard } from "@/lib/hardware/job-queue";
import {
  classifySaleCorrection,
  getCorrectionReasonLabel,
  getSaleCorrectionEligibility,
  type CustomerPresenceAnswer,
  type DeliveryAnswer,
  type PaymentAnswer,
} from "@/features/sales/correction-eligibility";
import {
  executeApprovedSaleReversal,
  SaleReversalTransactionError,
} from "@/features/sales/transaction-service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HARDWARE_AGENT_ONLINE_WINDOW_MS = 90 * 1000;
const HARDWARE_AGENT_STALE_WINDOW_MS = 5 * 60 * 1000;

type FeedbackType = "success" | "error" | "info";
type HardwareQueueState = "online" | "stale" | "offline" | "not_configured";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getSafeAdminSaleReturnTo(returnTo: string, saleId: string) {
  if (!UUID_PATTERN.test(saleId)) {
    return "/admin/penjualan";
  }

  if (returnTo.startsWith(`/admin/penjualan/${saleId}`)) {
    return returnTo;
  }

  return `/admin/penjualan/${saleId}`;
}

function redirectAdminSaleDetailWithFeedback({
  saleId,
  returnTo,
  type,
  message,
}: {
  saleId: string;
  returnTo: string;
  type: FeedbackType;
  message: string;
}): never {
  const safeReturnTo = getSafeAdminSaleReturnTo(returnTo, saleId);
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
): HardwareQueueState {
  const activeAgents = agents.filter((agent) => agent.status !== "disabled");

  if (activeAgents.length === 0) {
    return "not_configured";
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
    return "online";
  }

  if (
    activeAgents.some(
      (agent) =>
        agent.lastSeenAt &&
        now.getTime() - agent.lastSeenAt.getTime() <=
          HARDWARE_AGENT_STALE_WINDOW_MS,
    )
  ) {
    return "stale";
  }

  return "offline";
}

function getReprintQueuedMessage({
  invoiceNumber,
  duplicate,
  queueState,
}: {
  invoiceNumber: string;
  duplicate: boolean;
  queueState: Exclude<HardwareQueueState, "not_configured">;
}) {
  if (duplicate) {
    return `Job cetak ulang nota ${invoiceNumber} masih aktif di antrean. Cek status terbaru di bagian Print Jobs.`;
  }

  if (queueState === "online") {
    return `Job cetak ulang nota ${invoiceNumber} sudah masuk antrean printer.`;
  }

  if (queueState === "stale") {
    return `Job cetak ulang nota ${invoiceNumber} sudah masuk antrean, tetapi Hardware Hub terakhir terlihat beberapa menit lalu. Cek Mini PC jika belum tercetak.`;
  }

  return `Job cetak ulang nota ${invoiceNumber} sudah masuk antrean, tetapi Hardware Hub sedang offline. Nyalakan Mini PC Hardware Hub agar job diproses.`;
}


async function getAdminRequestMetadata() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");

  return {
    ipAddress:
      forwardedFor?.split(",")[0]?.trim().slice(0, 64) ??
      headerStore.get("x-real-ip")?.slice(0, 64) ??
      null,
    userAgent: headerStore.get("user-agent"),
  };
}

type SaleSensitiveApprovalRequestType = "void" | "refund";

function isDeliveryAnswer(value: string): value is DeliveryAnswer {
  return ["not_delivered", "delivered", "unsure"].includes(value);
}

function isPaymentAnswer(value: string): value is PaymentAnswer {
  return ["received", "not_received", "unsure"].includes(value);
}

function isCustomerPresenceAnswer(value: string): value is CustomerPresenceAnswer {
  return ["present", "left", "unsure"].includes(value);
}

function getSaleSensitiveApprovalConfig(
  requestType: SaleSensitiveApprovalRequestType,
) {
  if (requestType === "void") {
    return {
      approvalType: "void_receipt" as const,
      action: "sale.void_approval_requested",
      label: "pembatalan transaksi",
      successMessage: "Pengajuan pembatalan transaksi berhasil dibuat dan menunggu persetujuan manager/owner.",
      duplicateMessage:
        "Transaksi ini sudah memiliki pengajuan koreksi yang masih menunggu atau sudah disetujui.",
    };
  }

  return {
    approvalType: "refund_transaction" as const,
    action: "sale.refund_approval_requested",
    label: "retur dan pengembalian dana",
    successMessage: "Pengajuan retur dan pengembalian dana berhasil dibuat dan menunggu persetujuan manager/owner.",
    duplicateMessage:
      "Transaksi ini sudah memiliki pengajuan koreksi yang masih menunggu atau sudah disetujui.",
  };
}

function parseNumber(value: string | null | undefined) {
  if (!value) return 0;

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatPaymentMethodLabel(method: string) {
  return method.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function requestSaleVoidRefundApprovalAction(formData: FormData) {
  const saleId = readText(formData, "saleId");
  const returnTo = readText(formData, "returnTo");
  const deliveryAnswerRaw = readText(formData, "deliveryAnswer");
  const paymentAnswerRaw = readText(formData, "paymentAnswer");
  const customerPresenceRaw = readText(formData, "customerPresence");
  const reasonCode = readText(formData, "reasonCode");
  const reasonDetails = readText(formData, "reasonDetails").slice(0, 1000);

  if (!UUID_PATTERN.test(saleId)) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo: "/admin/penjualan",
      type: "error",
      message: "Transaksi tidak valid untuk request void/refund.",
    });
  }

  if (
    !isDeliveryAnswer(deliveryAnswerRaw) ||
    !isPaymentAnswer(paymentAnswerRaw) ||
    !isCustomerPresenceAnswer(customerPresenceRaw)
  ) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message: "Jawaban kondisi transaksi belum lengkap atau tidak valid.",
    });
  }

  const auth = await requireAnyPermission([
    SALE_VOID_REQUEST_PERMISSION,
    PAYMENT_REFUND_REQUEST_PERMISSION,
  ]);
  const accessibleOutletIds = auth.outlets.map((outlet) => outlet.id);

  if (accessibleOutletIds.length === 0) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message:
        "Outlet yang bisa diakses tidak ditemukan. Hubungi owner/admin untuk mengatur akses outlet.",
    });
  }

  const [sale] = await db
    .select({
      id: sales.id,
      organizationId: sales.organizationId,
      outletId: sales.outletId,
      registerId: sales.registerId,
      shiftId: sales.shiftId,
      cashierId: sales.cashierId,
      invoiceNumber: sales.invoiceNumber,
      status: sales.status,
      subtotalAmount: sales.subtotalAmount,
      discountAmount: sales.discountAmount,
      totalAmount: sales.totalAmount,
      completedAt: sales.completedAt,
      createdAt: sales.createdAt,
      shiftStatus: shifts.status,
      outletCode: outlets.code,
      outletName: outlets.name,
      registerCode: registers.code,
      registerName: registers.name,
      cashierName: users.fullName,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      customerPhone: customers.phone,
    })
    .from(sales)
    .innerJoin(outlets, eq(sales.outletId, outlets.id))
    .innerJoin(registers, eq(sales.registerId, registers.id))
    .innerJoin(users, eq(sales.cashierId, users.id))
    .leftJoin(shifts, eq(sales.shiftId, shifts.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(
      and(
        eq(sales.id, saleId),
        eq(sales.organizationId, auth.organization.id),
        inArray(sales.outletId, accessibleOutletIds),
      ),
    )
    .limit(1);

  if (!sale) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message:
        "Transaksi tidak ditemukan atau bukan bagian dari outlet yang bisa kamu akses.",
    });
  }

  if (sale.status !== "completed") {
    redirectAdminSaleDetailWithFeedback({
      saleId: sale.id,
      returnTo,
      type: "error",
      message: "Koreksi hanya bisa diajukan untuk transaksi yang sudah selesai.",
    });
  }

  const [existingReturnCase] = await db
    .select({ id: saleReturnCases.id })
    .from(saleReturnCases)
    .where(eq(saleReturnCases.saleId, sale.id))
    .limit(1);

  const eligibility = getSaleCorrectionEligibility({
    saleStatus: sale.status,
    shiftStatus: sale.shiftStatus,
    completedAt: sale.completedAt,
    hasReturnCase: Boolean(existingReturnCase),
  });

  if (!eligibility.canRequestCorrection) {
    redirectAdminSaleDetailWithFeedback({
      saleId: sale.id,
      returnTo,
      type: "error",
      message: eligibility.blockers[0] ?? "Transaksi ini tidak dapat dikoreksi.",
    });
  }

  const requestTypeRaw = classifySaleCorrection({
    eligibility,
    deliveryAnswer: deliveryAnswerRaw,
  });
  const requiredPermission = getSaleSensitivePermission(requestTypeRaw, "request");

  if (!auth.permissionCodes.includes(requiredPermission)) {
    redirectAdminSaleDetailWithFeedback({
      saleId: sale.id,
      returnTo,
      type: "error",
      message: "Akun ini tidak memiliki izin untuk mengajukan jenis koreksi yang ditentukan sistem.",
    });
  }

  const reasonLabel = getCorrectionReasonLabel(requestTypeRaw, reasonCode);
  if (!reasonLabel) {
    redirectAdminSaleDetailWithFeedback({
      saleId: sale.id,
      returnTo,
      type: "error",
      message: "Alasan koreksi tidak valid.",
    });
  }

  if (reasonCode === "other" && reasonDetails.length < 8) {
    redirectAdminSaleDetailWithFeedback({
      saleId: sale.id,
      returnTo,
      type: "error",
      message: "Jelaskan alasan lainnya minimal 8 karakter.",
    });
  }

  const reason = reasonDetails ? `${reasonLabel}: ${reasonDetails}` : reasonLabel;
  const config = getSaleSensitiveApprovalConfig(requestTypeRaw);

  const existingApprovalRows = await db
    .select({
      id: approvals.id,
      status: approvals.status,
      createdAt: approvals.createdAt,
    })
    .from(approvals)
    .where(
      and(
        eq(approvals.organizationId, auth.organization.id),
        inArray(approvals.type, ["void_receipt", "refund_transaction"]),
        eq(approvals.referenceType, "sale"),
        eq(approvals.referenceId, sale.id),
        inArray(approvals.status, ["pending", "approved"]),
      ),
    )
    .orderBy(desc(approvals.createdAt))
    .limit(1);

  if (existingApprovalRows[0]) {
    redirectAdminSaleDetailWithFeedback({
      saleId: sale.id,
      returnTo,
      type: "info",
      message: config.duplicateMessage,
    });
  }

  const [paymentRows, itemRows] = await Promise.all([
    db
      .select({
        method: payments.method,
        amount: payments.amount,
        status: payments.status,
      })
      .from(payments)
      .where(eq(payments.saleId, sale.id)),
    db
      .select({
        id: saleItems.id,
      })
      .from(saleItems)
      .where(eq(saleItems.saleId, sale.id)),
  ]);

  const paidPayments = paymentRows.filter((payment) => payment.status === "paid");
  const paidAmount = paidPayments.reduce(
    (total, payment) => total + parseNumber(payment.amount),
    0,
  );
  const paymentMethods = Array.from(
    new Set(paidPayments.map((payment) => payment.method)),
  );
  const now = new Date();
  const requestMetadata = await getAdminRequestMetadata();

  const [approval] = await db
    .insert(approvals)
    .values({
      organizationId: auth.organization.id,
      outletId: sale.outletId,
      type: config.approvalType,
      status: "pending",
      requestedBy: auth.user.id,
      referenceType: "sale",
      referenceId: sale.id,
      requestData: {
        requestType: requestTypeRaw,
        correctionUxVersion: "p1-b.1",
        deliveryAnswer: deliveryAnswerRaw,
        paymentAnswer: paymentAnswerRaw,
        customerPresence: customerPresenceRaw,
        reasonCode,
        reasonLabel,
        reasonDetails: reasonDetails || null,
        eligibility: {
          voidEligibleBySystem: eligibility.voidEligibleBySystem,
          blockers: eligibility.blockers,
        },
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        saleStatus: sale.status,
        outletId: sale.outletId,
        outletCode: sale.outletCode,
        outletName: sale.outletName,
        registerId: sale.registerId,
        registerCode: sale.registerCode,
        registerName: sale.registerName,
        cashierId: sale.cashierId,
        cashierName: sale.cashierName,
        customerCode: sale.customerCode,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        requesterName: auth.user.fullName,
        subtotalAmount: parseNumber(sale.subtotalAmount),
        discountAmount: parseNumber(sale.discountAmount),
        totalAmount: parseNumber(sale.totalAmount),
        paidAmount,
        impactAmount: requestTypeRaw === "refund" ? paidAmount : parseNumber(sale.totalAmount),
        itemCount: itemRows.length,
        paymentMethods,
        paymentMethodsLabel:
          paymentMethods.length > 0
            ? paymentMethods.map(formatPaymentMethodLabel).join(", ")
            : "Belum ada payment paid",
        completedAt: sale.completedAt?.toISOString() ?? null,
        requestedAt: now.toISOString(),
        reason,
        executionStatus: "awaiting_r3c_2",
      },
      notes: reason,
      createdAt: now,
    })
    .returning({ id: approvals.id });

  if (!approval) {
    redirectAdminSaleDetailWithFeedback({
      saleId: sale.id,
      returnTo,
      type: "error",
      message: "Approval belum bisa dibuat karena terjadi kendala sistem.",
    });
  }

  await db.insert(auditLogs).values({
    organizationId: auth.organization.id,
    outletId: sale.outletId,
    actorUserId: auth.user.id,
    action: config.action,
    entityType: "sale",
    entityId: sale.id,
    beforeData: {
      status: sale.status,
      totalAmount: sale.totalAmount,
      paidAmount,
    },
    afterData: {
      approvalId: approval.id,
      approvalType: config.approvalType,
      requestType: requestTypeRaw,
      status: "pending",
      reason,
    },
    reason,
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
    metadata: {
      source: "admin.sales.detail",
      approvalId: approval.id,
      invoiceNumber: sale.invoiceNumber,
      executionStatus: "awaiting_r3c_2",
    },
    createdAt: now,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/penjualan");
  revalidatePath(`/admin/penjualan/${sale.id}`);
  revalidatePath("/admin/operasional/approval");

  redirectAdminSaleDetailWithFeedback({
    saleId: sale.id,
    returnTo,
    type: "success",
    message: config.successMessage,
  });
}


async function executeApprovedSaleReversalAction({
  formData,
  kind,
}: {
  formData: FormData;
  kind: "void" | "refund";
}) {
  const auth = await requirePermission(
    getSaleSensitivePermission(kind, "execute"),
  );
  const saleId = readText(formData, "saleId");
  const approvalId = readText(formData, "approvalId");
  const returnTo = readText(formData, "returnTo");
  const executionNote = readText(formData, "executionNote").slice(0, 1000);

  if (!UUID_PATTERN.test(saleId) || !UUID_PATTERN.test(approvalId)) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo: "/admin/penjualan",
      type: "error",
      message: `Transaksi atau approval ${kind === "void" ? "void" : "refund"} tidak valid untuk dieksekusi.`,
    });
  }

  const accessibleOutletIds = auth.outlets.map((outlet) => outlet.id);

  if (accessibleOutletIds.length === 0) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message:
        "Outlet yang bisa diakses tidak ditemukan. Hubungi owner/admin untuk mengatur akses outlet.",
    });
  }

  const requestMetadata = await getAdminRequestMetadata();

  let result: Awaited<ReturnType<typeof executeApprovedSaleReversal>>;

  try {
    result = await executeApprovedSaleReversal({
      kind,
      saleId,
      approvalId,
      organizationId: auth.organization.id,
      accessibleOutletIds,
      actor: {
        id: auth.user.id,
        fullName: auth.user.fullName,
      },
      executionNote,
      requestMetadata,
    });
  } catch (error) {
    const message =
      error instanceof SaleReversalTransactionError
        ? error.message
        : `Eksekusi ${kind === "void" ? "void" : "refund"} gagal karena kendala sistem. Tidak ada perubahan finansial yang disimpan.`;

    console.error(`Failed to execute approved sale ${kind}`, {
      saleId,
      approvalId,
      error,
    });

    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/penjualan");
  revalidatePath(`/admin/penjualan/${saleId}`);
  revalidatePath("/admin/inventaris");
  revalidatePath("/admin/operasional/kas");
  revalidatePath("/admin/operasional/shift");
  revalidatePath("/admin/operasional/approval");
  revalidatePath("/pos");

  const replayMessage = result.idempotentReplay
    ? " Request sebelumnya sudah berhasil dan hasil yang sama dikembalikan tanpa membuat reversal kedua."
    : "";
  const shiftMessage =
    result.cashRefundAmount > 0 && result.refundShiftId
      ? " Refund cash dicatat pada shift register yang sedang open, bukan shift transaksi lama."
      : "";

  const returnWorkflowMessage =
    kind === "refund" && result.returnCaseId
      ? ` ${result.pendingReturnItemCount} item menunggu penerimaan fisik dan pemeriksaan sebelum dapat kembali ke stok.`
      : "";

  redirectAdminSaleDetailWithFeedback({
    saleId,
    returnTo,
    type: "success",
    message:
      kind === "void"
        ? `Void ${result.invoiceNumber} berhasil dieksekusi secara atomik.${shiftMessage}${replayMessage}`
        : `Refund penuh ${result.invoiceNumber} berhasil dieksekusi secara atomik.${shiftMessage}${returnWorkflowMessage}${replayMessage}`,
  });
}

export async function executeApprovedSaleVoidAction(formData: FormData) {
  return executeApprovedSaleReversalAction({ formData, kind: "void" });
}

export async function executeApprovedSaleRefundAction(formData: FormData) {
  return executeApprovedSaleReversalAction({ formData, kind: "refund" });
}

export async function reprintAdminReceiptCertificateAction(
  saleIdOrFormData: string | FormData,
  returnToArg?: string,
  formData?: FormData,
) {
  const auth = await requirePermission("sales.view");
  const isBoundAction = typeof saleIdOrFormData === "string";
  const saleId = isBoundAction
    ? saleIdOrFormData.trim()
    : readText(saleIdOrFormData, "saleId");
  const boundReturnTo = (returnToArg ?? "").trim();
  const submittedReturnTo = formData ? readText(formData, "returnTo") : "";
  const returnTo = isBoundAction
    ? boundReturnTo || submittedReturnTo || `/admin/penjualan/${saleId}`
    : readText(saleIdOrFormData, "returnTo");

  if (!UUID_PATTERN.test(saleId)) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo: "/admin/penjualan",
      type: "error",
      message: "Transaksi tidak valid untuk cetak ulang nota.",
    });
  }

  const accessibleOutletIds = auth.outlets.map((outlet) => outlet.id);

  if (accessibleOutletIds.length === 0) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message:
        "Outlet yang bisa diakses tidak ditemukan. Hubungi owner/admin untuk mengatur akses outlet.",
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
        inArray(sales.outletId, accessibleOutletIds),
        eq(sales.status, "completed"),
      ),
    )
    .limit(1);

  if (!sale) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message:
        "Transaksi tidak ditemukan, tidak termasuk outlet yang bisa kamu akses, atau statusnya belum completed.",
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
    redirectAdminSaleDetailWithFeedback({
      saleId: sale.id,
      returnTo,
      type: "error",
      message:
        "Belum ada Hardware Hub aktif untuk register transaksi ini. Hubungkan Mini PC Hardware Hub sebelum cetak ulang nota.",
    });
  }

  let feedbackType: Extract<FeedbackType, "success" | "info">;
  let feedbackMessage: string;

  try {
    const result = await createHardwareJobWithDuplicateGuard({
      organizationId: auth.organization.id,
      outletId: sale.outletId,
      registerId: sale.registerId,
      agentId: null,
      createdByUserId: auth.user.id,
      jobType: "print_receipt_certificate",
      deviceType: "document_printer",
      targetDevice: "document_printer",
      status: "pending",
      priority: 25,
      maxAttempts: 2,
      payload: {
        pdfUrl: `/api/sales/${sale.id}/receipt-certificate`,
        title: `Cetak Ulang Nota ${sale.invoiceNumber}`,
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        totalAmount: sale.totalAmount,
        requestSource: "admin.sales.detail",
        reprint: true,
        documentMode: "one_page_per_item",
        requestedAt: now.toISOString(),
      },
      idempotencyKey: `receipt_certificate_admin_reprint:${sale.id}:${randomUUID()}`,
      sourceType: "sale",
      sourceId: sale.id,
      availableAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: sale.outletId,
      actorUserId: auth.user.id,
      action: result.duplicate
        ? "sale.receipt_reprint_duplicate"
        : "sale.receipt_reprint_requested",
      entityType: "sale",
      entityId: sale.id,
      beforeData: null,
      afterData: {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        hardwareJobId: result.job.id,
        duplicate: result.duplicate,
        queueState,
      },
      metadata: {
        source: "admin.sales.detail",
        jobType: "print_receipt_certificate",
        documentMode: "one_page_per_item",
      },
      createdAt: now,
    });

    revalidatePath("/admin/penjualan");
    revalidatePath(`/admin/penjualan/${sale.id}`);
    revalidatePath("/admin/operasional/hardware");

    feedbackType = queueState === "online" ? "success" : "info";
    feedbackMessage = getReprintQueuedMessage({
      invoiceNumber: sale.invoiceNumber,
      duplicate: result.duplicate,
      queueState,
    });
  } catch (error) {
    console.error("Failed to queue admin receipt/certificate reprint", error);

    redirectAdminSaleDetailWithFeedback({
      saleId: sale.id,
      returnTo,
      type: "error",
      message:
        "Cetak ulang nota belum bisa dibuat karena terjadi kendala sistem. Coba ulang atau cek Hardware Hub.",
    });
  }

  redirectAdminSaleDetailWithFeedback({
    saleId: sale.id,
    returnTo,
    type: feedbackType,
    message: feedbackMessage,
  });
}
