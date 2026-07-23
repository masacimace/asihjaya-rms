"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { approvals, auditLogs, customers, outlets } from "@/db/schema";
import { getCustomerDepositBalance } from "@/features/customer-deposits/queries";
import { requirePermission } from "@/lib/auth/session";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseRupiahInput(value: string) {
  const normalizedValue = value.replace(/[^0-9]/g, "");

  if (!normalizedValue) {
    return 0;
  }

  const amount = Number(normalizedValue);

  return Number.isSafeInteger(amount) ? amount : 0;
}

function redirectCustomerDepositMessage({
  customerId,
  message,
  type,
}: {
  customerId: string;
  message: string;
  type: "success" | "error";
}): never {
  const params = new URLSearchParams({
    depositStatus: type,
    depositMessage: message,
  });

  redirect(`/admin/pelanggan/${customerId}?${params.toString()}`);
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

function revalidateCustomerDepositWithdrawalPages(customerId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/pelanggan");
  revalidatePath(`/admin/pelanggan/${customerId}`);
  revalidatePath("/admin/operasional/approval");
}

export async function requestCustomerDepositWithdrawalApprovalAction(
  formData: FormData,
) {
  const auth = await requirePermission("admin.access");
  const customerId = readText(formData, "customerId");
  const outletId = readText(formData, "outletId");
  const amount = parseRupiahInput(readText(formData, "amount"));
  const reason = readText(formData, "reason").slice(0, 500);

  if (!UUID_PATTERN.test(customerId)) {
    redirectCustomerDepositMessage({
      customerId: "invalid",
      type: "error",
      message: "Pelanggan tidak valid untuk pengajuan tarik tunai Dana Titip.",
    });
  }

  if (!UUID_PATTERN.test(outletId)) {
    redirectCustomerDepositMessage({
      customerId,
      type: "error",
      message: "Outlet tidak valid untuk pengajuan tarik tunai Dana Titip.",
    });
  }

  if (amount <= 0) {
    redirectCustomerDepositMessage({
      customerId,
      type: "error",
      message: "Nominal tarik tunai Dana Titip harus lebih dari Rp 0.",
    });
  }

  if (reason.length < 5) {
    redirectCustomerDepositMessage({
      customerId,
      type: "error",
      message: "Alasan tarik tunai Dana Titip minimal 5 karakter.",
    });
  }

  const accessibleOutletIds = auth.outlets.map((outlet) => outlet.id);

  if (!accessibleOutletIds.includes(outletId)) {
    redirectCustomerDepositMessage({
      customerId,
      type: "error",
      message:
        "Outlet Dana Titip tidak termasuk outlet yang bisa kamu akses.",
    });
  }

  const [customer, outlet, existingApproval] = await Promise.all([
    db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        fullName: customers.fullName,
        phone: customers.phone,
      })
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.organizationId, auth.organization.id),
        ),
      )
      .limit(1),

    db
      .select({
        id: outlets.id,
        code: outlets.code,
        name: outlets.name,
      })
      .from(outlets)
      .where(
        and(
          eq(outlets.id, outletId),
          eq(outlets.organizationId, auth.organization.id),
        ),
      )
      .limit(1),

    db
      .select({ id: approvals.id })
      .from(approvals)
      .where(
        and(
          eq(approvals.organizationId, auth.organization.id),
          eq(approvals.type, "customer_deposit_withdrawal"),
          eq(approvals.status, "pending"),
          eq(approvals.referenceType, "customer"),
          eq(approvals.referenceId, customerId),
          eq(approvals.outletId, outletId),
        ),
      )
      .limit(1),
  ]);

  const customerRow = customer[0] ?? null;
  const outletRow = outlet[0] ?? null;

  if (!customerRow || !outletRow) {
    redirectCustomerDepositMessage({
      customerId,
      type: "error",
      message:
        "Pelanggan atau outlet Dana Titip tidak ditemukan untuk organisasi ini.",
    });
  }

  if (existingApproval[0]) {
    redirectCustomerDepositMessage({
      customerId,
      type: "error",
      message:
        "Outlet ini masih memiliki pengajuan tarik tunai Dana Titip yang menunggu approval.",
    });
  }

  const balance = await getCustomerDepositBalance({
    organizationId: auth.organization.id,
    outletId,
    customerId,
  });

  if (balance.balance <= 0) {
    redirectCustomerDepositMessage({
      customerId,
      type: "error",
      message: "Saldo Dana Titip outlet ini masih Rp 0.",
    });
  }

  if (amount > balance.balance) {
    redirectCustomerDepositMessage({
      customerId,
      type: "error",
      message:
        "Nominal tarik tunai melebihi saldo Dana Titip customer di outlet ini.",
    });
  }

  const now = new Date();
  const requestMetadata = await getRequestMetadata();

  const [approval] = await db.transaction(async (transaction) => {
    const approvalRows = await transaction
      .insert(approvals)
      .values({
        organizationId: auth.organization.id,
        outletId,
        type: "customer_deposit_withdrawal",
        status: "pending",
        requestedBy: auth.user.id,
        referenceType: "customer",
        referenceId: customerId,
        requestData: {
          flowVersion: "p4.5-a",
          source: "admin.customer.detail",
          customerId,
          customerCode: customerRow.customerCode,
          customerName: customerRow.fullName,
          customerPhone: customerRow.phone,
          outletId,
          outletCode: outletRow.code,
          outletName: outletRow.name,
          requesterId: auth.user.id,
          requesterName: auth.user.fullName,
          withdrawalAmount: amount,
          depositAmount: amount,
          balanceBefore: balance.balance,
          balanceAfterIfApproved: balance.balance - amount,
          reason,
          requestedAt: now.toISOString(),
          executionRequired: true,
          executionStage: "awaiting_approval",
        },
        notes: reason,
        createdAt: now,
      })
      .returning({ id: approvals.id });

    const createdApproval = approvalRows[0];

    if (!createdApproval) {
      throw new Error("CUSTOMER_DEPOSIT_WITHDRAWAL_APPROVAL_INSERT_FAILED");
    }

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId,
      actorUserId: auth.user.id,
      action: "customer_deposit.withdrawal_approval_requested",
      entityType: "customer",
      entityId: customerId,
      beforeData: {
        balance: balance.balance,
      },
      afterData: {
        approvalId: createdApproval.id,
        approvalType: "customer_deposit_withdrawal",
        withdrawalAmount: amount,
        balanceAfterIfApproved: balance.balance - amount,
        status: "pending",
      },
      reason,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        source: "admin.customer.detail",
        approvalId: createdApproval.id,
        customerCode: customerRow.customerCode,
        customerName: customerRow.fullName,
        outletCode: outletRow.code,
        outletName: outletRow.name,
      },
      createdAt: now,
    });

    return approvalRows;
  });

  if (!approval) {
    redirectCustomerDepositMessage({
      customerId,
      type: "error",
      message:
        "Pengajuan tarik tunai Dana Titip belum bisa dibuat. Coba ulang.",
    });
  }

  revalidateCustomerDepositWithdrawalPages(customerId);

  redirectCustomerDepositMessage({
    customerId,
    type: "success",
    message:
      "Pengajuan tarik tunai Dana Titip berhasil dibuat dan menunggu approval admin.",
  });
}
