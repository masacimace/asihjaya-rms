"use server";

import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
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
  outlets,
  payments,
  productItems,
  registers,
  saleItems,
  sales,
  shifts,
  users,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { createHardwareJobWithDuplicateGuard } from "@/lib/hardware/job-queue";

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

function isSaleSensitiveApprovalRequestType(
  value: string,
): value is SaleSensitiveApprovalRequestType {
  return value === "void" || value === "refund";
}

function getSaleSensitiveApprovalConfig(
  requestType: SaleSensitiveApprovalRequestType,
) {
  if (requestType === "void") {
    return {
      approvalType: "void_receipt" as const,
      action: "sale.void_approval_requested",
      label: "void transaksi",
      successMessage: "Request void transaksi berhasil dibuat dan menunggu approval manager/owner.",
      duplicateMessage:
        "Transaksi ini sudah memiliki request void yang masih menunggu atau sudah disetujui.",
    };
  }

  return {
    approvalType: "refund_transaction" as const,
    action: "sale.refund_approval_requested",
    label: "refund transaksi",
    successMessage: "Request refund transaksi berhasil dibuat dan menunggu approval manager/owner.",
    duplicateMessage:
      "Transaksi ini sudah memiliki request refund yang masih menunggu atau sudah disetujui.",
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
  const auth = await requirePermission("sales.view");
  const saleId = readText(formData, "saleId");
  const returnTo = readText(formData, "returnTo");
  const requestTypeRaw = readText(formData, "requestType");
  const reason = readText(formData, "reason").slice(0, 1000);

  if (!UUID_PATTERN.test(saleId)) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo: "/admin/penjualan",
      type: "error",
      message: "Transaksi tidak valid untuk request void/refund.",
    });
  }

  if (!isSaleSensitiveApprovalRequestType(requestTypeRaw)) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message: "Jenis request void/refund tidak valid.",
    });
  }

  if (reason.length < 8) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message: "Alasan request minimal 8 karakter agar approval bisa ditinjau dengan jelas.",
    });
  }

  const config = getSaleSensitiveApprovalConfig(requestTypeRaw);
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
      message:
        "Request void/refund hanya bisa dibuat untuk transaksi yang sudah completed.",
    });
  }

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
        eq(approvals.type, config.approvalType),
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


type VoidExecutionRequestData = Record<string, unknown> & {
  executionStatus?: string;
};

function getRequestDataExecutionStatus(requestData: Record<string, unknown>) {
  const value = requestData.executionStatus;

  return typeof value === "string" ? value : null;
}

function getCashPaidAmount(
  paymentRows: Array<{ method: string; status: string; amount: string }>,
) {
  return paymentRows.reduce((total, payment) => {
    if (payment.method !== "cash" || payment.status !== "paid") {
      return total;
    }

    return total + parseNumber(payment.amount);
  }, 0);
}

function getPaidAmount(
  paymentRows: Array<{ status: string; amount: string }>,
) {
  return paymentRows.reduce((total, payment) => {
    if (payment.status !== "paid") {
      return total;
    }

    return total + parseNumber(payment.amount);
  }, 0);
}

export async function executeApprovedSaleVoidAction(formData: FormData) {
  const auth = await requirePermission("sales.view");
  const saleId = readText(formData, "saleId");
  const approvalId = readText(formData, "approvalId");
  const returnTo = readText(formData, "returnTo");
  const executionNote = readText(formData, "executionNote").slice(0, 1000);

  if (!UUID_PATTERN.test(saleId) || !UUID_PATTERN.test(approvalId)) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo: "/admin/penjualan",
      type: "error",
      message: "Transaksi atau approval void tidak valid untuk dieksekusi.",
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
  const now = new Date();
  let invoiceNumber = "transaksi";

  const result = await db.transaction(async (tx) => {
    const [sale] = await tx
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
        additionalFeeAmount: sales.additionalFeeAmount,
        totalAmount: sales.totalAmount,
        completedAt: sales.completedAt,
        cancelledAt: sales.cancelledAt,
        notes: sales.notes,
      })
      .from(sales)
      .where(
        and(
          eq(sales.id, saleId),
          eq(sales.organizationId, auth.organization.id),
          inArray(sales.outletId, accessibleOutletIds),
        ),
      )
      .limit(1);

    if (!sale) {
      return {
        ok: false as const,
        message:
          "Transaksi tidak ditemukan atau bukan bagian dari outlet yang bisa kamu akses.",
      };
    }

    invoiceNumber = sale.invoiceNumber;

    if (sale.status !== "completed") {
      return {
        ok: false as const,
        message: "Void hanya bisa dieksekusi untuk transaksi yang masih completed.",
      };
    }

    const [approval] = await tx
      .select({
        id: approvals.id,
        type: approvals.type,
        status: approvals.status,
        requestedBy: approvals.requestedBy,
        approvedBy: approvals.approvedBy,
        referenceType: approvals.referenceType,
        referenceId: approvals.referenceId,
        requestData: approvals.requestData,
        notes: approvals.notes,
        responseNotes: approvals.responseNotes,
        resolvedAt: approvals.resolvedAt,
      })
      .from(approvals)
      .where(
        and(
          eq(approvals.id, approvalId),
          eq(approvals.organizationId, auth.organization.id),
          eq(approvals.outletId, sale.outletId),
          eq(approvals.type, "void_receipt"),
          eq(approvals.referenceType, "sale"),
          eq(approvals.referenceId, sale.id),
        ),
      )
      .limit(1);

    if (!approval) {
      return {
        ok: false as const,
        message:
          "Approval void tidak ditemukan untuk transaksi ini. Ajukan approval void terlebih dahulu.",
      };
    }

    if (approval.status !== "approved") {
      return {
        ok: false as const,
        message:
          "Approval void belum disetujui. Tunggu manager/owner approve sebelum eksekusi void.",
      };
    }

    const approvalRequestData = approval.requestData as VoidExecutionRequestData;
    const executionStatus = getRequestDataExecutionStatus(approvalRequestData);

    if (executionStatus === "void_executed") {
      return {
        ok: false as const,
        message: "Void untuk transaksi ini sudah pernah dieksekusi.",
      };
    }

    const [paymentRows, itemRows] = await Promise.all([
      tx
        .select({
          id: payments.id,
          method: payments.method,
          amount: payments.amount,
          status: payments.status,
          metadata: payments.metadata,
        })
        .from(payments)
        .where(eq(payments.saleId, sale.id)),
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
        .where(eq(saleItems.saleId, sale.id)),
    ]);

    if (itemRows.length === 0) {
      return {
        ok: false as const,
        message: "Transaksi ini tidak memiliki item, sehingga void belum bisa dieksekusi.",
      };
    }

    const productItemIds = itemRows.map((item) => item.productItemId);
    const cashPaidAmount = getCashPaidAmount(paymentRows);
    const paidAmount = getPaidAmount(paymentRows);
    const reason =
      executionNote ||
      approval.notes ||
      approval.responseNotes ||
      "Void transaksi setelah approval manager/owner.";

    await tx
      .update(sales)
      .set({
        status: "voided",
        cancelledAt: now,
        updatedAt: now,
        notes: sale.notes
          ? `${sale.notes}\n\n[VOID ${now.toISOString()}] ${reason}`
          : `[VOID ${now.toISOString()}] ${reason}`,
      })
      .where(eq(sales.id, sale.id));

    await tx
      .update(productItems)
      .set({
        availability: "available",
        locationState: "outlet",
        currentOutletId: sale.outletId,
        updatedAt: now,
      })
      .where(inArray(productItems.id, productItemIds));

    await tx.insert(inventoryMovements).values(
      itemRows.map((item) => ({
        organizationId: auth.organization.id,
        itemId: item.productItemId,
        movementType: "reversal" as const,
        fromOutletId: null,
        toOutletId: sale.outletId,
        referenceType: "sale_void",
        referenceId: sale.id,
        reason,
        metadata: {
          source: "admin.sales.void_execution",
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          saleItemId: item.id,
          lineNumber: item.lineNumber,
          finalPriceAmount: parseNumber(item.finalPriceAmount),
          previousAvailability: item.availability,
          previousLocationState: item.locationState,
          previousOutletId: item.currentOutletId,
          approvalId: approval.id,
        },
        performedBy: auth.user.id,
        approvedBy: approval.approvedBy,
        occurredAt: now,
        createdAt: now,
      })),
    );

    if (paymentRows.length > 0) {
      await tx
        .update(payments)
        .set({
          status: "refunded",
          updatedAt: now,
          metadata: sql`coalesce(${payments.metadata}, '{}'::jsonb) || ${JSON.stringify({
            voidedAt: now.toISOString(),
            voidedBy: auth.user.id,
            voidApprovalId: approval.id,
            previousSaleStatus: sale.status,
            voidReason: reason,
          })}::jsonb`,
        })
        .where(
          and(
            eq(payments.saleId, sale.id),
            inArray(payments.status, ["paid", "pending"]),
          ),
        );
    }

    if (cashPaidAmount > 0) {
      await tx.insert(cashMovements).values({
        shiftId: sale.shiftId,
        type: "cash_refund",
        amount: String(cashPaidAmount),
        referenceType: "sale_void",
        referenceId: sale.id,
        reason: `Void ${sale.invoiceNumber}: ${reason}`.slice(0, 2000),
        createdBy: auth.user.id,
        createdAt: now,
      });

      await tx
        .update(shifts)
        .set({
          expectedCash: sql`coalesce(${shifts.expectedCash}, 0) - ${String(cashPaidAmount)}`,
          updatedAt: now,
        })
        .where(eq(shifts.id, sale.shiftId));
    }

    await tx
      .update(approvals)
      .set({
        requestData: {
          ...approvalRequestData,
          executionStatus: "void_executed",
          executedAt: now.toISOString(),
          executedBy: auth.user.id,
          executedByName: auth.user.fullName,
          executionNote: reason,
          saleStatusBefore: sale.status,
          saleStatusAfter: "voided",
          cashRefundAmount: cashPaidAmount,
          paidAmount,
          returnedItemCount: itemRows.length,
        },
        responseNotes: approval.responseNotes
          ? `${approval.responseNotes}\n\nEksekusi void: ${reason}`
          : `Eksekusi void: ${reason}`,
      })
      .where(eq(approvals.id, approval.id));

    await tx.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: sale.outletId,
      actorUserId: auth.user.id,
      action: "sale.void_executed",
      entityType: "sale",
      entityId: sale.id,
      beforeData: {
        status: sale.status,
        totalAmount: sale.totalAmount,
        paidAmount,
        cashPaidAmount,
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
        status: "voided",
        approvalId: approval.id,
        returnedItemCount: itemRows.length,
        cashRefundAmount: cashPaidAmount,
        paymentStatus: "refunded",
      },
      reason,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        source: "admin.sales.detail",
        approvalId: approval.id,
        invoiceNumber: sale.invoiceNumber,
        executionStatus: "void_executed",
      },
      createdAt: now,
    });

    return {
      ok: true as const,
      invoiceNumber: sale.invoiceNumber,
      returnedItemCount: itemRows.length,
      cashRefundAmount: cashPaidAmount,
    };
  });

  if (!result.ok) {
    redirectAdminSaleDetailWithFeedback({
      saleId,
      returnTo,
      type: "error",
      message: result.message,
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

  redirectAdminSaleDetailWithFeedback({
    saleId,
    returnTo,
    type: "success",
    message: `Void ${invoiceNumber} berhasil dieksekusi. Item kembali tersedia dan reversal kas cash sudah dicatat jika ada pembayaran cash.`,
  });
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
