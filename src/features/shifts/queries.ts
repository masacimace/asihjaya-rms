import { desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  cashMovements,
  outlets,
  registers,
  shifts,
  users,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";
import {
  parseCashAmountValue,
  summarizeCashMovements,
  type CashMovementLike,
} from "@/lib/shifts/cash-reconciliation";
import type { ShiftDashboardData, ShiftSummary } from "./contracts";

const closedByUsers = alias(users, "closed_by_users");

function createEmptyDashboard(): ShiftDashboardData {
  return {
    activeShifts: [],
    recentShifts: [],
    totals: {
      activeShifts: 0,
      closedShifts: 0,
      expectedCashActive: 0,
      cashSalesActive: 0,
      totalVarianceClosed: 0,
    },
  };
}

export async function getShiftDashboard(
  auth: AuthContext,
): Promise<ShiftDashboardData> {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) {
    return createEmptyDashboard();
  }

  const shiftRows = await db
    .select({
      id: shifts.id,
      status: shifts.status,
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
      registerId: registers.id,
      registerCode: registers.code,
      registerName: registers.name,
      openedByName: users.fullName,
      closedByName: closedByUsers.fullName,
      openingCash: shifts.openingCash,
      expectedCash: shifts.expectedCash,
      actualCash: shifts.actualCash,
      cashVariance: shifts.cashVariance,
      varianceReason: shifts.varianceReason,
      openedAt: shifts.openedAt,
      closedAt: shifts.closedAt,
    })
    .from(shifts)
    .innerJoin(outlets, eq(shifts.outletId, outlets.id))
    .innerJoin(registers, eq(shifts.registerId, registers.id))
    .leftJoin(users, eq(shifts.openedBy, users.id))
    .leftJoin(closedByUsers, eq(shifts.closedBy, closedByUsers.id))
    .where(inArray(shifts.outletId, outletIds))
    .orderBy(desc(shifts.openedAt))
    .limit(40);

  if (shiftRows.length === 0) {
    return createEmptyDashboard();
  }

  const shiftIds = shiftRows.map((shift) => shift.id);
  const movementRows = await db
    .select({
      shiftId: cashMovements.shiftId,
      type: cashMovements.type,
      amount: cashMovements.amount,
    })
    .from(cashMovements)
    .where(inArray(cashMovements.shiftId, shiftIds));

  const movementsByShift = new Map<string, CashMovementLike[]>();

  for (const movement of movementRows) {
    const currentMovements = movementsByShift.get(movement.shiftId) ?? [];
    currentMovements.push({
      type: movement.type,
      amount: movement.amount,
    });
    movementsByShift.set(movement.shiftId, currentMovements);
  }

  const recentShifts: ShiftSummary[] = shiftRows.map((shift) => {
    const shiftMovements = movementsByShift.get(shift.id) ?? [];
    const cashSummary = summarizeCashMovements(shiftMovements);
    const hasOpeningBalanceMovement = shiftMovements.some(
      (movement) => movement.type === "opening_balance",
    );

    if (!hasOpeningBalanceMovement) {
      cashSummary.openingBalance += parseCashAmountValue(shift.openingCash);
      cashSummary.expectedCash += parseCashAmountValue(shift.openingCash);
    }

    return {
      ...shift,
      cashSummary,
    };
  });

  const activeShifts = recentShifts.filter((shift) => shift.status === "open");

  return {
    activeShifts,
    recentShifts,
    totals: {
      activeShifts: activeShifts.length,
      closedShifts: recentShifts.filter((shift) => shift.status === "closed").length,
      expectedCashActive: activeShifts.reduce(
        (total, shift) => total + shift.cashSummary.expectedCash,
        0,
      ),
      cashSalesActive: activeShifts.reduce(
        (total, shift) => total + shift.cashSummary.cashSales,
        0,
      ),
      totalVarianceClosed: recentShifts
        .filter((shift) => shift.status === "closed")
        .reduce(
          (total, shift) => total + parseCashAmountValue(shift.cashVariance),
          0,
        ),
    },
  };
}
