"use server";

import { randomUUID } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  cashMovements,
  customerDepositLedger,
  customers,
  outlets,
  registers,
  shifts,
} from "@/db/schema";
import { getCustomerDepositBalance } from "@/features/customer-deposits/queries";
import { lockCustomerDepositBalance } from "@/features/customers/deposit-balance-lock";
import { requireAnyPermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseRupiahInput(value: string) {
  const normalizedValue = value.replace(/[^0-9]/g, "");
  if (!normalizedValue) return 0;
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
  const params = new URLSearchParams({ depositStatus: type, depositMessage: message });
  redirect(`/admin/pelanggan/${customerId}?${params.toString()}`);
}

async function getRequestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent"),
  };
}

function revalidateCustomerDepositWithdrawalPages(customerId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/pelanggan");
  revalidatePath(`/admin/pelanggan/${customerId}`);
  revalidatePath("/admin/operasional/kas");
  revalidatePath("/admin/operasional/shift");
}

/**
 * Penarikan Dana Titip langsung berdasarkan permission.
 * Approval workflow sudah tidak digunakan; saldo + cash shift berubah atomik.
 */
export async function withdrawCustomerDepositAction(formData: FormData) {
  const auth = await requireAnyPermission(["payments.manage", "shifts.manage"]);
  const customerId = readText(formData, "customerId");
  const outletId = readText(formData, "outletId");
  const amount = parseRupiahInput(readText(formData, "amount"));
  const reason = readText(formData, "reason").slice(0, 500);

  if (!UUID_PATTERN.test(customerId)) {
    redirectCustomerDepositMessage({ customerId: "invalid", type: "error", message: "Pelanggan tidak valid untuk tarik tunai Dana Titip." });
  }
  if (!UUID_PATTERN.test(outletId)) {
    redirectCustomerDepositMessage({ customerId, type: "error", message: "Outlet tidak valid untuk tarik tunai Dana Titip." });
  }
  if (amount <= 0) {
    redirectCustomerDepositMessage({ customerId, type: "error", message: "Nominal tarik tunai Dana Titip harus lebih dari Rp 0." });
  }
  if (reason.length < 5) {
    redirectCustomerDepositMessage({ customerId, type: "error", message: "Alasan tarik tunai Dana Titip minimal 5 karakter." });
  }

  const accessibleOutletIds = auth.outlets.map((outlet) => outlet.id);
  if (!accessibleOutletIds.includes(outletId)) {
    redirectCustomerDepositMessage({ customerId, type: "error", message: "Outlet Dana Titip tidak termasuk outlet yang bisa kamu akses." });
  }

  const [[customer], [outlet], balance] = await Promise.all([
    db.select({ id: customers.id, customerCode: customers.customerCode, fullName: customers.fullName })
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.organizationId, auth.organization.id)))
      .limit(1),
    db.select({ id: outlets.id, code: outlets.code, name: outlets.name })
      .from(outlets)
      .where(and(eq(outlets.id, outletId), eq(outlets.organizationId, auth.organization.id)))
      .limit(1),
    getCustomerDepositBalance({ organizationId: auth.organization.id, outletId, customerId }),
  ]);

  if (!customer || !outlet) {
    redirectCustomerDepositMessage({ customerId, type: "error", message: "Pelanggan atau outlet Dana Titip tidak ditemukan untuk organisasi ini." });
  }
  if (balance.balance <= 0 || amount > balance.balance) {
    redirectCustomerDepositMessage({ customerId, type: "error", message: amount > balance.balance ? "Nominal tarik tunai melebihi saldo Dana Titip customer di outlet ini." : "Saldo Dana Titip outlet ini masih Rp 0." });
  }

  const now = new Date();
  const operationId = randomUUID();
  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      const currentBalance = await lockCustomerDepositBalance(transaction, {
        organizationId: auth.organization.id,
        outletId,
        customerId,
      });

      if (currentBalance < amount) {
        throw new Error("CUSTOMER_DEPOSIT_BALANCE_INSUFFICIENT");
      }

      const [activeShift] = await transaction
        .select({
          id: shifts.id,
          registerId: shifts.registerId,
          registerCode: registers.code,
          registerName: registers.name,
        })
        .from(shifts)
        .innerJoin(registers, eq(shifts.registerId, registers.id))
        .where(and(eq(shifts.outletId, outletId), eq(shifts.status, "open")))
        .orderBy(desc(shifts.openedAt), desc(shifts.updatedAt))
        .limit(1)
        .for("update");

      if (!activeShift) throw new Error("CUSTOMER_DEPOSIT_ACTIVE_SHIFT_REQUIRED");

      const [cashMovement] = await transaction
        .insert(cashMovements)
        .values({
          shiftId: activeShift.id,
          type: "cash_out",
          amount: String(amount),
          referenceType: "customer_deposit_withdrawal",
          referenceId: operationId,
          reason: `Penarikan Dana Titip customer. ${reason}`.slice(0, 1000),
          createdBy: auth.user.id,
          createdAt: now,
        })
        .returning({ id: cashMovements.id });

      if (!cashMovement) throw new Error("CUSTOMER_DEPOSIT_CASH_MOVEMENT_FAILED");

      const nextBalance = currentBalance - amount;
      const [ledgerEntry] = await transaction
        .insert(customerDepositLedger)
        .values({
          organizationId: auth.organization.id,
          outletId,
          customerId,
          cashMovementId: cashMovement.id,
          entryType: "deposit_withdrawal",
          direction: "debit",
          amount: String(amount),
          balanceAfter: String(nextBalance),
          idempotencyKey: `withdrawal:${operationId}`,
          referenceType: "customer_deposit_withdrawal",
          referenceId: operationId,
          description: reason,
          metadata: {
            source: "admin.customer.deposit_withdrawal_direct",
            operationId,
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

      if (!ledgerEntry) throw new Error("CUSTOMER_DEPOSIT_LEDGER_FAILED");

      await transaction
        .update(shifts)
        .set({ expectedCash: sql`coalesce(${shifts.expectedCash}, 0) - ${amount}`, updatedAt: now })
        .where(eq(shifts.id, activeShift.id));

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId,
        actorUserId: auth.user.id,
        action: "customer_deposit.withdrawal_executed",
        entityType: "customer_deposit_ledger",
        entityId: ledgerEntry.id,
        beforeData: { balance: currentBalance },
        afterData: {
          balance: nextBalance,
          amount,
          operationId,
          cashMovementId: cashMovement.id,
          shiftId: activeShift.id,
          registerId: activeShift.registerId,
        },
        reason,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "admin.customer.detail",
          customerId,
          customerCode: customer.customerCode,
          customerName: customer.fullName,
          outletCode: outlet.code,
          outletName: outlet.name,
          registerCode: activeShift.registerCode,
          registerName: activeShift.registerName,
        },
        createdAt: now,
      });
    });
  } catch (error) {
    console.error("Failed direct customer deposit withdrawal", { customerId, outletId, amount, error });
    const message = error instanceof Error && error.message === "CUSTOMER_DEPOSIT_ACTIVE_SHIFT_REQUIRED"
      ? "Tidak ada shift kas terbuka di outlet ini. Buka shift kas terlebih dahulu sebelum menarik Dana Titip."
      : error instanceof Error && error.message === "CUSTOMER_DEPOSIT_BALANCE_INSUFFICIENT"
        ? "Saldo Dana Titip berubah dan tidak lagi mencukupi. Muat ulang halaman lalu coba lagi."
        : "Tarik tunai Dana Titip belum bisa diproses karena kendala sistem. Tidak ada perubahan saldo yang disimpan.";
    redirectCustomerDepositMessage({ customerId, type: "error", message });
  }

  revalidateCustomerDepositWithdrawalPages(customerId);
  redirectCustomerDepositMessage({
    customerId,
    type: "success",
    message: `Tarik tunai Dana Titip ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)} berhasil diproses.`,
  });
}
