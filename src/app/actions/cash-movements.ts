"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditLogs, cashMovements, outlets, registers, shifts } from "@/db/schema";
import {
  isUuid,
  type AdminCashMovementActionState,
  type ManualCashMovementType,
} from "@/features/cash-movements/contracts";
import { notifyManualCashMovementCreated } from "@/features/notifications/cash";
import {
  hasAnyPermission,
  requirePermission,
  type AuthContext,
} from "@/lib/auth/session";
import { parseCashAmountInput } from "@/lib/shifts/cash-reconciliation";

const CASH_DASHBOARD_PATH = "/admin/operasional/kas";
const MAX_CASH_MOVEMENT_AMOUNT = 99_999_999_999;

function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): AdminCashMovementActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function redirectWithMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ type, message });

  redirect(`${CASH_DASHBOARD_PATH}?${params.toString()}`);
}

function readText(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parseManualMovementType(value: string): ManualCashMovementType | null {
  if (value === "cash_in" || value === "cash_out") {
    return value;
  }

  return null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
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

function ensureCashManagementAccess(auth: AuthContext) {
  if (!hasAnyPermission(auth, ["shifts.manage", "payments.manage"])) {
    return false;
  }

  return true;
}

function revalidateCashPages() {
  revalidatePath("/admin");
  revalidatePath(CASH_DASHBOARD_PATH);
  revalidatePath("/admin/operasional/shift");
  revalidatePath("/pos");
}

export async function createAdminCashMovementAction(
  _previousState: AdminCashMovementActionState,
  formData: FormData,
): Promise<AdminCashMovementActionState> {
  const auth = await requirePermission("admin.access");

  if (!ensureCashManagementAccess(auth)) {
    return failure("Akun ini belum memiliki akses untuk mencatat pergerakan kas.");
  }

  const shiftId = readText(formData, "shiftId");
  const type = parseManualMovementType(readText(formData, "type"));
  const amount = parseCashAmountInput(readText(formData, "amount"));
  const reason = readText(formData, "reason").slice(0, 500);

  const fieldErrors: Record<string, string> = {};

  if (!isUuid(shiftId)) {
    fieldErrors.shiftId = "Pilih shift kasir yang valid.";
  }

  if (!type) {
    fieldErrors.type = "Pilih tipe kas masuk atau kas keluar.";
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    fieldErrors.amount = "Nominal kas harus lebih dari 0.";
  } else if (amount > MAX_CASH_MOVEMENT_AMOUNT) {
    fieldErrors.amount = "Nominal kas terlalu besar.";
  }

  if (reason.length < 5) {
    fieldErrors.reason = "Catatan/alasan minimal 5 karakter.";
  }

  if (Object.keys(fieldErrors).length > 0 || !type) {
    return failure("Periksa kembali data pergerakan kas.", fieldErrors);
  }

  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    return failure("Akun ini belum terhubung ke outlet aktif.");
  }

  const shiftRows = await db
    .select({
      id: shifts.id,
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
      registerId: registers.id,
      registerCode: registers.code,
      registerName: registers.name,
      expectedCash: shifts.expectedCash,
    })
    .from(shifts)
    .innerJoin(outlets, eq(shifts.outletId, outlets.id))
    .innerJoin(registers, eq(shifts.registerId, registers.id))
    .where(
      and(
        eq(shifts.id, shiftId),
        eq(shifts.status, "open"),
        eq(outlets.organizationId, auth.organization.id),
        inArray(shifts.outletId, outletIds),
      ),
    )
    .limit(1);

  const shift = shiftRows[0];

  if (!shift) {
    return failure(
      "Shift tidak ditemukan, sudah ditutup, atau bukan bagian dari outlet yang bisa kamu akses.",
      { shiftId: "Pilih shift aktif lain." },
    );
  }

  const requestMetadata = await getRequestMetadata();
  let createdMovementId: string | null = null;

  try {
    createdMovementId = await db.transaction(async (transaction) => {
      const now = new Date();
      const movementRows = await transaction
        .insert(cashMovements)
        .values({
          shiftId: shift.id,
          type,
          amount: String(amount),
          referenceType: "manual",
          referenceId: null,
          reason,
          createdBy: auth.user.id,
          createdAt: now,
        })
        .returning({ id: cashMovements.id });

      const movement = movementRows[0];

      if (!movement) {
        throw new Error("CASH_MOVEMENT_INSERT_FAILED");
      }

      const expectedCashDelta = type === "cash_in" ? amount : -amount;

      await transaction
        .update(shifts)
        .set({
          expectedCash: String(Number(shift.expectedCash ?? 0) + expectedCashDelta),
          updatedAt: now,
        })
        .where(eq(shifts.id, shift.id));

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: shift.outletId,
        actorUserId: auth.user.id,
        action: "cash_movement.create",
        entityType: "cash_movement",
        entityId: movement.id,
        beforeData: null,
        afterData: {
          cashMovementId: movement.id,
          shiftId: shift.id,
          outletId: shift.outletId,
          outletCode: shift.outletCode,
          registerId: shift.registerId,
          registerCode: shift.registerCode,
          type,
          amount,
          reason,
          expectedCashDelta,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "admin.cash_movements.create",
        },
      });

      return movement.id;
    });
  } catch (error) {
    console.error("Failed to create admin cash movement", error);

    return failure(
      "Pergerakan kas belum bisa dicatat karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    );
  }

  if (createdMovementId) {
    await notifyManualCashMovementCreated({
      organizationId: auth.organization.id,
      outletId: shift.outletId,
      shiftId: shift.id,
      movementId: createdMovementId,
      type,
      amount,
      reason,
      outletName: shift.outletName,
      registerName: shift.registerName,
      createdByName: auth.user.fullName,
    });
  }

  revalidateCashPages();

  const directionLabel = type === "cash_in" ? "Kas masuk" : "Kas keluar";

  redirectWithMessage(
    "success",
    `${directionLabel} ${formatMoney(amount)} berhasil dicatat untuk ${shift.outletName} / ${shift.registerName}.`,
  );

  return {
    status: "success",
    message: `Pergerakan kas ${createdMovementId} berhasil dicatat.`,
  };
}
