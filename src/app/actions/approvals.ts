"use server";

import { and, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { approvals, auditLogs } from "@/db/schema";
import {
  getApprovalResolutionAuthorization,
} from "@/features/approvals/authorization";
import {
  isUuid,
  type AdminApprovalActionState,
  type ApprovalStatus,
} from "@/features/approvals/contracts";
import { publishApprovalResolutionNotificationInTransaction } from "@/features/notifications/approvals";
import { requirePermission, type AuthContext } from "@/lib/auth/session";

const APPROVAL_DASHBOARD_PATH = "/admin/operasional/approval";

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): AdminApprovalActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function redirectWithMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ type, message });

  redirect(`${APPROVAL_DASHBOARD_PATH}?${params.toString()}`);
}

function readText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function revalidateApprovalPages() {
  revalidatePath("/admin");
  revalidatePath(APPROVAL_DASHBOARD_PATH);
  revalidatePath("/admin/penjualan");
  revalidatePath("/admin/inventaris");
  revalidatePath("/pos");
}

async function getRequestMetadata() {
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

function getOutletAccessCondition(auth: AuthContext) {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    return isNull(approvals.outletId);
  }

  return or(isNull(approvals.outletId), inArray(approvals.outletId, outletIds));
}

async function resolveApproval({
  auth,
  approvalId,
  nextStatus,
  responseNotes,
}: {
  auth: AuthContext;
  approvalId: string;
  nextStatus: Exclude<ApprovalStatus, "pending">;
  responseNotes: string;
}) {
  const outletAccessCondition = getOutletAccessCondition(auth);

  const [approval] = await db
    .select({
      id: approvals.id,
      organizationId: approvals.organizationId,
      outletId: approvals.outletId,
      type: approvals.type,
      status: approvals.status,
      requestedBy: approvals.requestedBy,
      approvedBy: approvals.approvedBy,
      referenceType: approvals.referenceType,
      referenceId: approvals.referenceId,
      requestData: approvals.requestData,
      notes: approvals.notes,
      responseNotes: approvals.responseNotes,
      createdAt: approvals.createdAt,
      resolvedAt: approvals.resolvedAt,
    })
    .from(approvals)
    .where(
      and(
        eq(approvals.id, approvalId),
        eq(approvals.organizationId, auth.organization.id),
        outletAccessCondition,
      ),
    )
    .limit(1);

  if (!approval) {
    return {
      ok: false,
      message:
        "Approval tidak ditemukan atau bukan bagian dari outlet yang bisa kamu akses.",
    } as const;
  }

  const authorization = getApprovalResolutionAuthorization({
    auth,
    type: approval.type,
    requestedById: approval.requestedBy,
  });

  if (!authorization.allowed) {
    return { ok: false, message: authorization.reason } as const;
  }

  if (approval.status !== "pending") {
    return {
      ok: false,
      message: "Approval ini sudah diproses sebelumnya.",
    } as const;
  }

  const requestMetadata = await getRequestMetadata();
  const now = new Date();

  const result = await db.transaction(async (transaction) => {
    const [resolvedApproval] = await transaction
      .update(approvals)
      .set({
        status: nextStatus,
        approvedBy: auth.user.id,
        responseNotes: responseNotes || null,
        resolvedAt: now,
      })
      .where(
        and(
          eq(approvals.id, approval.id),
          eq(approvals.status, "pending"),
          ne(approvals.requestedBy, auth.user.id),
        ),
      )
      .returning({ id: approvals.id });

    if (!resolvedApproval) {
      return { ok: false } as const;
    }

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: approval.outletId,
      actorUserId: auth.user.id,
      action: nextStatus === "approved" ? "approval.approve" : "approval.reject",
      entityType: "approval",
      entityId: approval.id,
      beforeData: {
        status: approval.status,
        approvedBy: approval.approvedBy,
        responseNotes: approval.responseNotes,
        resolvedAt: approval.resolvedAt?.toISOString() ?? null,
      },
      afterData: {
        status: nextStatus,
        approvedBy: auth.user.id,
        responseNotes: responseNotes || null,
        resolvedAt: now.toISOString(),
        type: approval.type,
        referenceType: approval.referenceType,
        referenceId: approval.referenceId,
      },
      reason: responseNotes || null,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        approvalType: approval.type,
        requestedBy: approval.requestedBy,
        requestData: approval.requestData,
        makerCheckerEnforced: true,
      },
    });

    await publishApprovalResolutionNotificationInTransaction(transaction, {
      organizationId: approval.organizationId,
      outletId: approval.outletId,
      approvalId: approval.id,
      approvalType: approval.type,
      status: nextStatus,
      requestedById: approval.requestedBy,
      resolvedById: auth.user.id,
      responseNotes: responseNotes || null,
      referenceType: approval.referenceType,
      referenceId: approval.referenceId,
      requestData: approval.requestData,
      occurredAt: now,
    });

    return { ok: true } as const;
  });

  if (!result.ok) {
    return {
      ok: false,
      message:
        "Approval sudah diproses oleh user lain atau tidak lagi memenuhi aturan maker-checker. Muat ulang halaman.",
    } as const;
  }

  return {
    ok: true,
    approvalType: approval.type,
  } as const;
}

async function resolveApprovalAction(
  formData: FormData,
  nextStatus: Exclude<ApprovalStatus, "pending">,
): Promise<AdminApprovalActionState> {
  const auth = await requirePermission("admin.access");
  const approvalId = readText(formData, "approvalId");
  const responseNotes = readText(formData, "responseNotes").slice(0, 500);

  if (!isUuid(approvalId)) {
    return failure("Approval tidak valid.", {
      approvalId: "ID approval tidak valid.",
    });
  }

  if (nextStatus === "rejected" && responseNotes.length < 5) {
    return failure("Catatan penolakan minimal 5 karakter.", {
      responseNotes: "Isi alasan penolakan minimal 5 karakter.",
    });
  }

  const result = await resolveApproval({
    auth,
    approvalId,
    nextStatus,
    responseNotes,
  });

  if (!result.ok) {
    return failure(result.message);
  }

  revalidateApprovalPages();

  redirectWithMessage(
    "success",
    nextStatus === "approved"
      ? "Approval berhasil disetujui."
      : "Approval berhasil ditolak.",
  );
}

export async function approveApprovalAction(
  _previousState: AdminApprovalActionState,
  formData: FormData,
): Promise<AdminApprovalActionState> {
  return resolveApprovalAction(formData, "approved");
}

export async function rejectApprovalAction(
  _previousState: AdminApprovalActionState,
  formData: FormData,
): Promise<AdminApprovalActionState> {
  return resolveApprovalAction(formData, "rejected");
}
