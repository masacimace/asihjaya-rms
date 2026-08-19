"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  customers,
  hardwareAgents,
  outlets,
  registers,
  saleReturnCases,
  sales,
  shifts,
  users,
} from "@/db/schema";
import { getClientIp } from "@/lib/http/client-ip";
import { requireAnyPermission, requirePermission } from "@/lib/auth/session";
import { RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY } from "@/features/sales/documents/receipt-certificate-render-modes";
import { buildReceiptDocumentPayloadV2 } from "@/lib/hardware/job-payload-contracts-v2";
import { createHardwareJobV2 } from "@/lib/hardware/job-producer-v2";
import {
  classifySaleCorrection,
  getCorrectionReasonLabel,
  getSaleCorrectionEligibility,
  type CustomerPresenceAnswer,
  type DeliveryAnswer,
  type PaymentAnswer,
} from "@/features/sales/correction-eligibility";
import {
  getSaleSensitivePermission,
  PAYMENT_REFUND_EXECUTE_PERMISSION,
  SALE_VOID_EXECUTE_PERMISSION,
} from "@/features/sales/sensitive-permissions";
import {
  executeSaleReversal,
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
  if (!UUID_PATTERN.test(saleId)) return "/admin/penjualan";
  if (returnTo.startsWith(`/admin/penjualan/${saleId}`)) return returnTo;
  return `/admin/penjualan/${saleId}`;
}

function redirectAdminSaleDetailWithFeedback({
  saleId, returnTo, type, message,
}: { saleId: string; returnTo: string; type: FeedbackType; message: string }): never {
  const safeReturnTo = getSafeAdminSaleReturnTo(returnTo, saleId);
  const queryStartIndex = safeReturnTo.indexOf("?");
  const path = queryStartIndex >= 0 ? safeReturnTo.slice(0, queryStartIndex) : safeReturnTo;
  const search = queryStartIndex >= 0 ? safeReturnTo.slice(queryStartIndex + 1) : "";
  const params = new URLSearchParams(search);
  params.set("feedbackType", type);
  params.set("feedbackMessage", message);
  redirect(`${path}?${params.toString()}`);
}

function getHardwareAgentQueueState(
  agents: Array<{ status: "online" | "offline" | "disabled"; lastSeenAt: Date | null }>,
  now: Date,
): HardwareQueueState {
  const activeAgents = agents.filter((agent) => agent.status !== "disabled");
  if (activeAgents.length === 0) return "not_configured";
  if (activeAgents.some((agent) => agent.status === "online" && agent.lastSeenAt && now.getTime() - agent.lastSeenAt.getTime() <= HARDWARE_AGENT_ONLINE_WINDOW_MS)) return "online";
  if (activeAgents.some((agent) => agent.lastSeenAt && now.getTime() - agent.lastSeenAt.getTime() <= HARDWARE_AGENT_STALE_WINDOW_MS)) return "stale";
  return "offline";
}

function getReprintQueuedMessage({
  invoiceNumber, duplicate, queueState,
}: { invoiceNumber: string; duplicate: boolean; queueState: Exclude<HardwareQueueState, "not_configured"> }) {
  if (duplicate) return `Job cetak ulang nota ${invoiceNumber} masih aktif di antrean. Cek status terbaru di bagian Print Jobs.`;
  if (queueState === "online") return `Job cetak ulang nota ${invoiceNumber} sudah masuk antrean printer.`;
  if (queueState === "stale") return `Job cetak ulang nota ${invoiceNumber} sudah masuk antrean, tetapi Hardware Hub terakhir terlihat beberapa menit lalu. Cek Mini PC jika belum tercetak.`;
  return `Job cetak ulang nota ${invoiceNumber} sudah masuk antrean, tetapi Hardware Hub sedang offline. Nyalakan Mini PC Hardware Hub agar job diproses.`;
}

async function getAdminRequestMetadata() {
  const headerStore = await headers();
  return { ipAddress: getClientIp(headerStore), userAgent: headerStore.get("user-agent") };
}

function isDeliveryAnswer(value: string): value is DeliveryAnswer {
  return ["not_delivered", "delivered", "unsure"].includes(value);
}
function isPaymentAnswer(value: string): value is PaymentAnswer {
  return ["received", "not_received", "unsure"].includes(value);
}
function isCustomerPresenceAnswer(value: string): value is CustomerPresenceAnswer {
  return ["present", "left", "unsure"].includes(value);
}

/**
 * Koreksi transaksi sekarang dieksekusi langsung berdasarkan permission.
 * Tidak ada lagi request/approve/execute approval workflow.
 */
export async function executeSaleCorrectionAction(formData: FormData) {
  const saleId = readText(formData, "saleId");
  const returnTo = readText(formData, "returnTo");
  const deliveryAnswerRaw = readText(formData, "deliveryAnswer");
  const paymentAnswerRaw = readText(formData, "paymentAnswer");
  const customerPresenceRaw = readText(formData, "customerPresence");
  const reasonCode = readText(formData, "reasonCode");
  const reasonDetails = readText(formData, "reasonDetails").slice(0, 1000);

  if (!UUID_PATTERN.test(saleId)) {
    redirectAdminSaleDetailWithFeedback({ saleId, returnTo: "/admin/penjualan", type: "error", message: "Transaksi tidak valid untuk dikoreksi." });
  }
  if (!isDeliveryAnswer(deliveryAnswerRaw) || !isPaymentAnswer(paymentAnswerRaw) || !isCustomerPresenceAnswer(customerPresenceRaw)) {
    redirectAdminSaleDetailWithFeedback({ saleId, returnTo, type: "error", message: "Jawaban kondisi transaksi belum lengkap atau tidak valid." });
  }

  const auth = await requireAnyPermission([SALE_VOID_EXECUTE_PERMISSION, PAYMENT_REFUND_EXECUTE_PERMISSION]);
  const accessibleOutletIds = auth.outlets.map((outlet) => outlet.id);
  if (accessibleOutletIds.length === 0) {
    redirectAdminSaleDetailWithFeedback({ saleId, returnTo, type: "error", message: "Outlet yang bisa diakses tidak ditemukan. Hubungi owner/admin untuk mengatur akses outlet." });
  }

  const [sale] = await db
    .select({
      id: sales.id, outletId: sales.outletId, invoiceNumber: sales.invoiceNumber, status: sales.status,
      completedAt: sales.completedAt, shiftStatus: shifts.status,
      outletName: outlets.name, registerName: registers.name, cashierName: users.fullName, customerName: customers.fullName,
    })
    .from(sales)
    .innerJoin(outlets, eq(sales.outletId, outlets.id))
    .innerJoin(registers, eq(sales.registerId, registers.id))
    .innerJoin(users, eq(sales.cashierId, users.id))
    .leftJoin(shifts, eq(sales.shiftId, shifts.id))
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(and(eq(sales.id, saleId), eq(sales.organizationId, auth.organization.id), inArray(sales.outletId, accessibleOutletIds)))
    .limit(1);

  if (!sale) {
    redirectAdminSaleDetailWithFeedback({ saleId, returnTo, type: "error", message: "Transaksi tidak ditemukan atau bukan bagian dari outlet yang bisa kamu akses." });
  }
  if (sale.status !== "completed") {
    redirectAdminSaleDetailWithFeedback({ saleId, returnTo, type: "error", message: "Koreksi hanya bisa dilakukan untuk transaksi yang masih berstatus selesai." });
  }

  const [existingReturnCase] = await db.select({ id: saleReturnCases.id }).from(saleReturnCases).where(eq(saleReturnCases.saleId, sale.id)).limit(1);
  const eligibility = getSaleCorrectionEligibility({
    saleStatus: sale.status, shiftStatus: sale.shiftStatus, completedAt: sale.completedAt,
    hasReturnCase: Boolean(existingReturnCase), timeZone: auth.organization.timezone,
  });
  if (!eligibility.canRequestCorrection) {
    redirectAdminSaleDetailWithFeedback({ saleId, returnTo, type: "error", message: eligibility.blockers[0] ?? "Transaksi ini tidak dapat dikoreksi." });
  }

  const kind = classifySaleCorrection({ eligibility, deliveryAnswer: deliveryAnswerRaw });
  const requiredPermission = getSaleSensitivePermission(kind);
  if (!auth.permissionCodes.includes(requiredPermission)) {
    redirectAdminSaleDetailWithFeedback({ saleId, returnTo, type: "error", message: `Akun ini tidak memiliki izin untuk ${kind === "void" ? "membatalkan transaksi" : "memproses refund"}.` });
  }

  const reasonLabel = getCorrectionReasonLabel(kind, reasonCode);
  if (!reasonLabel) {
    redirectAdminSaleDetailWithFeedback({ saleId, returnTo, type: "error", message: "Alasan koreksi tidak valid." });
  }
  if (reasonCode === "other" && reasonDetails.length < 8) {
    redirectAdminSaleDetailWithFeedback({ saleId, returnTo, type: "error", message: "Jelaskan alasan lainnya minimal 8 karakter." });
  }

  const reason = reasonDetails ? `${reasonLabel}: ${reasonDetails}` : reasonLabel;
  const requestMetadata = await getAdminRequestMetadata();

  try {
    const result = await executeSaleReversal({
      kind, saleId, organizationId: auth.organization.id, accessibleOutletIds,
      actor: { id: auth.user.id, fullName: auth.user.fullName },
      executionNote: reason, requestMetadata,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/penjualan");
    revalidatePath(`/admin/penjualan/${saleId}`);
    revalidatePath("/admin/inventaris");
    revalidatePath("/admin/operasional/kas");
    revalidatePath("/admin/operasional/shift");
    revalidatePath("/pos");

    const shiftMessage = result.cashRefundAmount > 0 && result.refundShiftId
      ? " Refund cash dicatat pada shift register yang sedang open."
      : "";
    const returnWorkflowMessage = kind === "refund" && result.returnCaseId
      ? ` ${result.pendingReturnItemCount} item menunggu penerimaan fisik dan pemeriksaan retur.`
      : "";

    redirectAdminSaleDetailWithFeedback({
      saleId, returnTo, type: "success",
      message: kind === "void"
        ? `Transaksi ${result.invoiceNumber} berhasil dibatalkan.${shiftMessage}`
        : `Refund penuh ${result.invoiceNumber} berhasil diproses.${shiftMessage}${returnWorkflowMessage}`,
    });
  } catch (error) {
    const message = error instanceof SaleReversalTransactionError
      ? error.message
      : `Koreksi transaksi gagal karena kendala sistem. Tidak ada perubahan finansial yang disimpan.`;
    console.error("Failed to execute direct sale correction", { saleId, error });
    redirectAdminSaleDetailWithFeedback({ saleId, returnTo, type: "error", message });
  }
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
  const requestId = isBoundAction && formData
    ? readText(formData, "requestId")
    : readText(saleIdOrFormData as FormData, "requestId");
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

  if (!UUID_PATTERN.test(requestId)) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message: "Request cetak ulang nota tidak valid.",
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
    const requestMetadata = await getAdminRequestMetadata();
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
        requestSource: "admin.sales.detail",
        reprint: true,
        requestedAt: now,
        renderMode: RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
      }),
      idempotencyKey: `receipt:${sale.id}:reprint:${requestId}`,
      sourceType: "sale",
      sourceId: sale.id,
      now,
      audit: {
        source: "admin.sales.detail",
        requestId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        reason: `Cetak ulang nota ${sale.invoiceNumber} memakai overlay kertas custom.`,
      },
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
        renderMode: RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
      },
      metadata: {
        source: "admin.sales.detail",
        jobType: "print_receipt_certificate",
        documentMode: "one_page_per_item",
        renderMode: RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
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
