"use server";

import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  approvals,
  auditLogs,
  cashMovements,
  customerDepositLedger,
  registers,
  shifts,
} from "@/db/schema";
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

type AppDbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CustomerDepositWithdrawalRequestData = Record<string, unknown> & {
  customerId?: unknown;
  customerCode?: unknown;
  customerName?: unknown;
  outletId?: unknown;
  outletCode?: unknown;
  outletName?: unknown;
  withdrawalAmount?: unknown;
  depositAmount?: unknown;
  amount?: unknown;
  balanceBefore?: unknown;
  balanceAfterIfApproved?: unknown;
  reason?: unknown;
};

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
  revalidatePath("/admin/pelanggan");
  revalidatePath("/admin/operasional/kas");
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

function parsePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.replace(/[^0-9]/g, "");
    const parsedValue = Number(normalizedValue);

    if (Number.isSafeInteger(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  return null;
}

function parseLedgerAmount(value: string | null | undefined) {
  const parsedValue = Number(value ?? 0);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function readRequestString(
  requestData: CustomerDepositWithdrawalRequestData,
  key: keyof CustomerDepositWithdrawalRequestData,
) {
  const value = requestData[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function createCustomerDepositScopeLockKey({
  customerId,
  organizationId,
  outletId,
}: {
  organizationId: string;
  outletId: string;
  customerId: string;
}) {
  return [organizationId, outletId, customerId].join(":");
}

async function executeCustomerDepositWithdrawalApproval({
  approval,
  auth,
  now,
  requestMetadata,
  transaction,
}: {
  auth: AuthContext;
  approval: {
    id: string;
    organizationId: string;
    outletId: string | null;
    referenceId: string | null;
    requestData: Record<string, unknown>;
    notes: string | null;
  };
  now: Date;
  requestMetadata: Awaited<ReturnType<typeof getRequestMetadata>>;
  transaction: AppDbTransaction;
}) {
  const requestData =
    approval.requestData as CustomerDepositWithdrawalRequestData;
  const customerId = readRequestString(requestData, "customerId") ?? approval.referenceId;
  const outletId = readRequestString(requestData, "outletId") ?? approval.outletId;
  const amount = parsePositiveInteger(
    requestData.withdrawalAmount ?? requestData.depositAmount ?? requestData.amount,
  );
  const reason =
    readRequestString(requestData, "reason") ??
    approval.notes ??
    "Penarikan tunai Dana Titip customer.";

  if (!customerId || !outletId || !amount) {
    return {
      ok: false,
      message:
        "Data approval tarik tunai Dana Titip tidak lengkap. Tolak request ini lalu buat pengajuan baru.",
    } as const;
  }

  if (approval.outletId && approval.outletId !== outletId) {
    return {
      ok: false,
      message:
        "Outlet approval tidak sesuai dengan data tarik tunai Dana Titip.",
    } as const;
  }

  if (approval.referenceId && approval.referenceId !== customerId) {
    return {
      ok: false,
      message:
        "Customer approval tidak sesuai dengan data tarik tunai Dana Titip.",
    } as const;
  }

  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtext(${createCustomerDepositScopeLockKey({
      organizationId: approval.organizationId,
      outletId,
      customerId,
    })}))`,
  );

  const [existingLedgerEntry] = await transaction
    .select({ id: customerDepositLedger.id })
    .from(customerDepositLedger)
    .where(
      and(
        eq(customerDepositLedger.organizationId, approval.organizationId),
        eq(customerDepositLedger.approvalId, approval.id),
        eq(customerDepositLedger.entryType, "deposit_withdrawal"),
      ),
    )
    .limit(1)
    .for("update");

  if (existingLedgerEntry) {
    return {
      ok: false,
      message:
        "Approval tarik tunai Dana Titip ini sudah pernah dieksekusi.",
    } as const;
  }

  const [latestLedgerEntry] = await transaction
    .select({
      balanceAfter: customerDepositLedger.balanceAfter,
    })
    .from(customerDepositLedger)
    .where(
      and(
        eq(customerDepositLedger.organizationId, approval.organizationId),
        eq(customerDepositLedger.outletId, outletId),
        eq(customerDepositLedger.customerId, customerId),
      ),
    )
    .orderBy(
      desc(customerDepositLedger.occurredAt),
      desc(customerDepositLedger.createdAt),
    )
    .limit(1)
    .for("update");

  const currentBalance = parseLedgerAmount(latestLedgerEntry?.balanceAfter);

  if (currentBalance < amount) {
    return {
      ok: false,
      message:
        "Saldo Dana Titip customer tidak mencukupi untuk menjalankan penarikan ini.",
    } as const;
  }

  const [activeShift] = await transaction
    .select({
      id: shifts.id,
      registerId: shifts.registerId,
      registerCode: registers.code,
      registerName: registers.name,
      expectedCash: shifts.expectedCash,
      openedAt: shifts.openedAt,
    })
    .from(shifts)
    .innerJoin(registers, eq(shifts.registerId, registers.id))
    .where(and(eq(shifts.outletId, outletId), eq(shifts.status, "open")))
    .orderBy(desc(shifts.openedAt), desc(shifts.updatedAt))
    .limit(1)
    .for("update");

  if (!activeShift) {
    return {
      ok: false,
      message:
        "Tidak ada shift kas terbuka di outlet ini. Buka shift kas terlebih dahulu sebelum menyetujui penarikan Dana Titip.",
    } as const;
  }

  const cashMovementRows = await transaction
    .insert(cashMovements)
    .values({
      shiftId: activeShift.id,
      type: "cash_out",
      amount: String(amount),
      referenceType: "customer_deposit_withdrawal",
      referenceId: approval.id,
      reason: `Penarikan Dana Titip customer. ${reason}`.slice(0, 1000),
      createdBy: auth.user.id,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: cashMovements.id });

  const createdCashMovement = cashMovementRows[0];

  if (!createdCashMovement) {
    return {
      ok: false,
      message:
        "Kas keluar untuk approval ini sudah pernah dicatat. Muat ulang halaman sebelum melanjutkan.",
    } as const;
  }

  const nextBalance = currentBalance - amount;

  const ledgerRows = await transaction
    .insert(customerDepositLedger)
    .values({
      organizationId: approval.organizationId,
      outletId,
      customerId,
      cashMovementId: createdCashMovement.id,
      approvalId: approval.id,
      entryType: "deposit_withdrawal",
      direction: "debit",
      amount: String(amount),
      balanceAfter: String(nextBalance),
      idempotencyKey: `approval:${approval.id}:customer_deposit_withdrawal`,
      referenceType: "approval",
      referenceId: approval.id,
      description: reason,
      metadata: {
        source: "approval.customer_deposit_withdrawal",
        approvalId: approval.id,
        shiftId: activeShift.id,
        registerId: activeShift.registerId,
        registerCode: activeShift.registerCode,
        balanceBefore: currentBalance,
        balanceAfter: nextBalance,
      },
      createdBy: auth.user.id,
      occurredAt: now,
      createdAt: now,
    })
    .returning({ id: customerDepositLedger.id });

  const createdLedgerEntry = ledgerRows[0];

  if (!createdLedgerEntry) {
    return {
      ok: false,
      message: "Mutasi Dana Titip belum bisa dibuat untuk approval ini.",
    } as const;
  }

  await transaction
    .update(shifts)
    .set({
      expectedCash: sql`coalesce(${shifts.expectedCash}, 0) - ${amount}`,
      updatedAt: now,
    })
    .where(eq(shifts.id, activeShift.id));

  await transaction.insert(auditLogs).values({
    organizationId: approval.organizationId,
    outletId,
    actorUserId: auth.user.id,
    action: "customer_deposit.withdrawal_executed",
    entityType: "customer_deposit_ledger",
    entityId: createdLedgerEntry.id,
    beforeData: {
      balance: currentBalance,
      approvalStatus: "pending",
    },
    afterData: {
      balance: nextBalance,
      amount,
      approvalId: approval.id,
      cashMovementId: createdCashMovement.id,
      ledgerEntryId: createdLedgerEntry.id,
      shiftId: activeShift.id,
      registerId: activeShift.registerId,
    },
    reason,
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
    metadata: {
      source: "approval.resolve",
      approvalType: "customer_deposit_withdrawal",
      customerId,
      outletId,
      registerCode: activeShift.registerCode,
      registerName: activeShift.registerName,
    },
    createdAt: now,
  });

  return {
    ok: true,
    requestData: {
      ...requestData,
      executionStage: "executed",
      executionRequired: false,
      executedAt: now.toISOString(),
      executedById: auth.user.id,
      executedByName: auth.user.fullName,
      cashMovementId: createdCashMovement.id,
      ledgerEntryId: createdLedgerEntry.id,
      shiftId: activeShift.id,
      registerId: activeShift.registerId,
      registerCode: activeShift.registerCode,
      balanceBeforeAtExecution: currentBalance,
      balanceAfter: nextBalance,
    },
  } as const;
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
    const [lockedApproval] = await transaction
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
        resolvedAt: approvals.resolvedAt,
      })
      .from(approvals)
      .where(
        and(
          eq(approvals.id, approval.id),
          eq(approvals.status, "pending"),
          ne(approvals.requestedBy, auth.user.id),
        ),
      )
      .limit(1)
      .for("update");

    if (!lockedApproval) {
      return { ok: false } as const;
    }

    let nextRequestData = lockedApproval.requestData;
    let executionResult:
      | Awaited<ReturnType<typeof executeCustomerDepositWithdrawalApproval>>
      | null = null;

    if (
      nextStatus === "approved" &&
      lockedApproval.type === "customer_deposit_withdrawal"
    ) {
      executionResult = await executeCustomerDepositWithdrawalApproval({
        approval: lockedApproval,
        auth,
        now,
        requestMetadata,
        transaction,
      });

      if (!executionResult.ok) {
        return executionResult;
      }

      nextRequestData = executionResult.requestData;
    }

    const [resolvedApproval] = await transaction
      .update(approvals)
      .set({
        status: nextStatus,
        approvedBy: auth.user.id,
        responseNotes: responseNotes || null,
        resolvedAt: now,
        requestData: nextRequestData,
        ...(lockedApproval.type === "customer_deposit_withdrawal"
          ? nextStatus === "approved"
            ? {
                executionStatus: "completed" as const,
                executionIdempotencyKey: `approval:${lockedApproval.id}:customer_deposit_withdrawal`,
                executionStartedAt: now,
                executedAt: now,
                executedBy: auth.user.id,
                executionError: null,
              }
            : {
                executionStatus: "cancelled" as const,
                executionError: null,
              }
          : {}),
      })
      .where(eq(approvals.id, lockedApproval.id))
      .returning({ id: approvals.id });

    if (!resolvedApproval) {
      return { ok: false } as const;
    }

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: lockedApproval.outletId,
      actorUserId: auth.user.id,
      action: nextStatus === "approved" ? "approval.approve" : "approval.reject",
      entityType: "approval",
      entityId: lockedApproval.id,
      beforeData: {
        status: lockedApproval.status,
        approvedBy: lockedApproval.approvedBy,
        responseNotes: lockedApproval.responseNotes,
        resolvedAt: lockedApproval.resolvedAt?.toISOString() ?? null,
      },
      afterData: {
        status: nextStatus,
        approvedBy: auth.user.id,
        responseNotes: responseNotes || null,
        resolvedAt: now.toISOString(),
        type: lockedApproval.type,
        referenceType: lockedApproval.referenceType,
        referenceId: lockedApproval.referenceId,
        executionStage: executionResult?.ok
          ? executionResult.requestData.executionStage
          : null,
      },
      reason: responseNotes || null,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        approvalType: lockedApproval.type,
        requestedBy: lockedApproval.requestedBy,
        requestData: nextRequestData,
        makerCheckerEnforced: true,
      },
    });

    await publishApprovalResolutionNotificationInTransaction(transaction, {
      organizationId: lockedApproval.organizationId,
      outletId: lockedApproval.outletId,
      approvalId: lockedApproval.id,
      approvalType: lockedApproval.type,
      status: nextStatus,
      requestedById: lockedApproval.requestedBy,
      resolvedById: auth.user.id,
      responseNotes: responseNotes || null,
      referenceType: lockedApproval.referenceType,
      referenceId: lockedApproval.referenceId,
      requestData: nextRequestData,
      occurredAt: now,
    });

    return { ok: true } as const;
  });

  if (!result.ok) {
    return {
      ok: false,
      message:
        "message" in result
          ? result.message
          : "Approval sudah diproses oleh user lain atau tidak lagi memenuhi aturan maker-checker. Muat ulang halaman.",
    } as const;
  }

  return {
    ok: true,
    approvalType: approval.type,
    referenceType: approval.referenceType,
    referenceId: approval.referenceId,
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

  if (result.referenceType === "customer" && result.referenceId) {
    revalidatePath(`/admin/pelanggan/${result.referenceId}`);
  }

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
