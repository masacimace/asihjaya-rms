"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditLogs, hardwareAgents, sales } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { createHardwareJobWithDuplicateGuard } from "@/lib/hardware/job-queue";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
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

export async function reprintAdminReceiptCertificateAction(formData: FormData) {
  const auth = await requirePermission("sales.view");
  const saleId = readText(formData, "saleId");
  const returnTo = readText(formData, "returnTo");

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
