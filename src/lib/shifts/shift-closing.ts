import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  cashMovements,
  outlets,
  registers,
  shifts,
} from "@/db/schema";
import { notifyShiftClosedWithVariance } from "@/features/notifications/shift";
import type { AuthContext } from "@/lib/auth/session";
import {
  parseCashAmountInput,
  parseCashAmountValue,
  summarizeCashMovements,
} from "@/lib/shifts/cash-reconciliation";

export class ShiftClosingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShiftClosingError";
  }
}

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type CloseShiftInput = {
  auth: AuthContext;
  shiftId: string;
  actualCash: number;
  varianceReason: string | null;
  requestMetadata: RequestMetadata;
  source: "admin.shift_dashboard" | "pos.close_shift";
};

export type CloseShiftResult = {
  id: string;
  outletId: string;
  registerId: string;
  expectedCash: number;
  actualCash: number;
  variance: number;
  outletName: string;
  registerName: string;
  varianceReason: string | null;
};

export function parseShiftClosingActualCash(value: string | null | undefined) {
  return parseCashAmountInput(value);
}

function normalizeVarianceReason(value: string | null | undefined) {
  const trimmedValue = String(value ?? "").trim();

  return trimmedValue ? trimmedValue.slice(0, 500) : null;
}

export function validateShiftClosingInput({
  actualCash,
  varianceReason,
}: {
  actualCash: number;
  varianceReason: string | null | undefined;
}) {
  const normalizedVarianceReason = normalizeVarianceReason(varianceReason);

  if (!Number.isFinite(actualCash) || actualCash < 0) {
    throw new ShiftClosingError(
      "Nominal kas fisik harus berupa angka positif atau nol.",
    );
  }

  if (actualCash > 10_000_000_000) {
    throw new ShiftClosingError("Nominal kas fisik terlalu besar.");
  }

  if (String(varianceReason ?? "").trim().length > 500) {
    throw new ShiftClosingError("Catatan selisih maksimal 500 karakter.");
  }

  return { varianceReason: normalizedVarianceReason };
}

export async function closeShiftWithReconciliation({
  auth,
  shiftId,
  actualCash,
  varianceReason,
  requestMetadata,
  source,
}: CloseShiftInput): Promise<CloseShiftResult> {
  const accessibleOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));
  const normalizedInput = validateShiftClosingInput({
    actualCash,
    varianceReason,
  });

  const result = await db.transaction(async (transaction) => {
    const [shift] = await transaction
      .select({
        id: shifts.id,
        status: shifts.status,
        openingCash: shifts.openingCash,
        expectedCash: shifts.expectedCash,
        outletId: shifts.outletId,
        registerId: shifts.registerId,
        outletCode: outlets.code,
        outletName: outlets.name,
        registerCode: registers.code,
        registerName: registers.name,
      })
      .from(shifts)
      .innerJoin(outlets, eq(shifts.outletId, outlets.id))
      .innerJoin(registers, eq(shifts.registerId, registers.id))
      .where(
        and(
          eq(shifts.id, shiftId),
          eq(outlets.organizationId, auth.organization.id),
        ),
      )
      .limit(1);

    if (!shift || !accessibleOutletIds.has(shift.outletId)) {
      throw new ShiftClosingError("Shift tidak ditemukan atau bukan akses outlet kamu.");
    }

    if (shift.status !== "open") {
      throw new ShiftClosingError(
        "Hanya shift berstatus aktif/open yang bisa ditutup.",
      );
    }

    const movementRows = await transaction
      .select({
        type: cashMovements.type,
        amount: cashMovements.amount,
      })
      .from(cashMovements)
      .where(eq(cashMovements.shiftId, shift.id));

    const cashSummary = summarizeCashMovements(movementRows);
    const hasOpeningBalanceMovement = movementRows.some(
      (movement) => movement.type === "opening_balance",
    );

    if (!hasOpeningBalanceMovement) {
      cashSummary.openingBalance += parseCashAmountValue(shift.openingCash);
      cashSummary.expectedCash += parseCashAmountValue(shift.openingCash);
    }

    const expectedCash = cashSummary.expectedCash;
    const variance = actualCash - expectedCash;

    if (variance !== 0 && !normalizedInput.varianceReason) {
      throw new ShiftClosingError(
        "Catatan selisih wajib diisi jika kas fisik tidak sama dengan expected cash.",
      );
    }

    const now = new Date();

    const [updatedShift] = await transaction
      .update(shifts)
      .set({
        status: "closed",
        closedBy: auth.user.id,
        expectedCash: String(expectedCash),
        actualCash: String(actualCash),
        cashVariance: String(variance),
        varianceReason: normalizedInput.varianceReason,
        closedAt: now,
        updatedAt: now,
      })
      .where(and(eq(shifts.id, shift.id), eq(shifts.status, "open")))
      .returning({
        id: shifts.id,
      });

    if (!updatedShift) {
      throw new ShiftClosingError(
        "Shift sudah berubah status. Refresh halaman lalu cek ulang.",
      );
    }

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: shift.outletId,
      actorUserId: auth.user.id,
      action: "shift.close",
      entityType: "shift",
      entityId: shift.id,
      beforeData: {
        status: "open",
        expectedCash: shift.expectedCash,
      },
      afterData: {
        status: "closed",
        outletId: shift.outletId,
        outletCode: shift.outletCode,
        outletName: shift.outletName,
        registerId: shift.registerId,
        registerCode: shift.registerCode,
        registerName: shift.registerName,
        openingCash: shift.openingCash,
        expectedCash: String(expectedCash),
        actualCash: String(actualCash),
        cashVariance: String(variance),
        varianceReason: normalizedInput.varianceReason,
        cashSummary,
      },
      reason: normalizedInput.varianceReason,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        source,
        closedAt: now.toISOString(),
      },
      createdAt: now,
    });

    return {
      id: shift.id,
      outletId: shift.outletId,
      registerId: shift.registerId,
      expectedCash,
      actualCash,
      variance,
      outletName: shift.outletName,
      registerName: shift.registerName,
      varianceReason: normalizedInput.varianceReason,
    };
  });

  await notifyShiftClosedWithVariance({
    organizationId: auth.organization.id,
    outletId: result.outletId,
    shiftId: result.id,
    outletName: result.outletName,
    registerName: result.registerName,
    expectedCash: result.expectedCash,
    actualCash: result.actualCash,
    variance: result.variance,
    varianceReason: result.varianceReason,
    closedByName: auth.user.fullName,
    source,
  });

  return result;
}
