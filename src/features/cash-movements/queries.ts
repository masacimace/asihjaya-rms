import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  cashMovements,
  outlets,
  registers,
  sales,
  shifts,
  users,
} from "@/db/schema";
import {
  ADMIN_CASH_MOVEMENTS_PAGE_SIZE,
  type AdminCashMovementActiveShift,
  type AdminCashMovementFilters,
  type AdminCashMovementListData,
  type AdminCashMovementRow,
  type CashMovementType,
} from "@/features/cash-movements/contracts";
import type { AuthContext } from "@/lib/auth/session";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseAmount(value: string | null | undefined) {
  if (!value) return 0;

  const amount = Number(value);

  return Number.isFinite(amount) ? amount : 0;
}

function getJakartaDateParts(date: Date) {
  const shiftedDate = new Date(date.getTime() + JAKARTA_OFFSET_MS);

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth(),
    day: shiftedDate.getUTCDate(),
  };
}

function getJakartaDayStartUtc(date: Date) {
  const parts = getJakartaDateParts(date);

  return new Date(
    Date.UTC(parts.year, parts.month, parts.day) - JAKARTA_OFFSET_MS,
  );
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);

  return result;
}

function getRangeBounds(filters: AdminCashMovementFilters) {
  if (filters.range === "all") {
    return {
      start: null,
      end: null,
      label: "Semua periode",
    };
  }

  const todayStart = getJakartaDayStartUtc(new Date());

  if (filters.range === "7d") {
    return {
      start: addDays(todayStart, -6),
      end: addDays(todayStart, 1),
      label: "7 hari terakhir",
    };
  }

  if (filters.range === "30d") {
    return {
      start: addDays(todayStart, -29),
      end: addDays(todayStart, 1),
      label: "30 hari terakhir",
    };
  }

  return {
    start: todayStart,
    end: addDays(todayStart, 1),
    label: "Hari ini",
  };
}

function getAccessibleOutletIds(auth: AuthContext, requestedOutletId: string | null) {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (!requestedOutletId) {
    return outletIds;
  }

  return outletIds.includes(requestedOutletId) ? [requestedOutletId] : [];
}

function createSearchCondition(search: string) {
  if (!search) {
    return null;
  }

  const pattern = `%${search}%`;

  return or(
    ilike(cashMovements.reason, pattern),
    ilike(cashMovements.referenceType, pattern),
    ilike(outlets.code, pattern),
    ilike(outlets.name, pattern),
    ilike(registers.code, pattern),
    ilike(registers.name, pattern),
    ilike(users.fullName, pattern),
    ilike(sales.invoiceNumber, pattern),
  );
}

function createMovementConditions({
  auth,
  filters,
  outletIds,
}: {
  auth: AuthContext;
  filters: AdminCashMovementFilters;
  outletIds: string[];
}) {
  const conditions: SQL[] = [eq(outlets.organizationId, auth.organization.id)];

  if (outletIds.length === 0) {
    conditions.push(sql`false`);
  } else {
    conditions.push(inArray(shifts.outletId, outletIds));
  }

  if (filters.type !== "all") {
    conditions.push(eq(cashMovements.type, filters.type));
  }

  const rangeBounds = getRangeBounds(filters);

  if (rangeBounds.start) {
    conditions.push(gte(cashMovements.createdAt, rangeBounds.start));
  }

  if (rangeBounds.end) {
    conditions.push(lte(cashMovements.createdAt, rangeBounds.end));
  }

  const searchCondition = createSearchCondition(filters.search);

  if (searchCondition) {
    conditions.push(searchCondition);
  }

  return {
    conditions,
    periodLabel: rangeBounds.label,
  };
}

function getSignedMovementAmount(type: CashMovementType, amount: number) {
  if (type === "cash_out" || type === "cash_refund") {
    return -Math.abs(amount);
  }

  return amount;
}

function createEmptyData(
  auth: AuthContext,
  filters: AdminCashMovementFilters,
  periodLabel: string,
): AdminCashMovementListData {
  return {
    filters,
    outlets: auth.outlets,
    activeShifts: [],
    rows: [],
    summary: {
      totalMovements: 0,
      openingBalance: 0,
      cashSales: 0,
      manualCashIn: 0,
      manualCashOut: 0,
      cashRefunds: 0,
      closingAdjustments: 0,
      netMovement: 0,
      activeShiftCount: 0,
    },
    total: 0,
    page: 1,
    pageCount: 1,
    pageSize: ADMIN_CASH_MOVEMENTS_PAGE_SIZE,
    periodLabel,
  };
}

export async function getAdminCashMovementListData(
  auth: AuthContext,
  filters: AdminCashMovementFilters,
): Promise<AdminCashMovementListData> {
  const outletIds = getAccessibleOutletIds(auth, filters.outletId);
  const { conditions, periodLabel } = createMovementConditions({
    auth,
    filters,
    outletIds,
  });
  const whereClause = and(...conditions);

  if (!whereClause) {
    return createEmptyData(auth, filters, periodLabel);
  }

  const activeShiftRowsPromise =
    outletIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: shifts.id,
            outletId: outlets.id,
            outletCode: outlets.code,
            outletName: outlets.name,
            registerId: registers.id,
            registerCode: registers.code,
            registerName: registers.name,
            openedByName: users.fullName,
            openedAt: shifts.openedAt,
            expectedCash: shifts.expectedCash,
          })
          .from(shifts)
          .innerJoin(outlets, eq(shifts.outletId, outlets.id))
          .innerJoin(registers, eq(shifts.registerId, registers.id))
          .innerJoin(users, eq(shifts.openedBy, users.id))
          .where(
            and(
              eq(outlets.organizationId, auth.organization.id),
              inArray(shifts.outletId, outletIds),
              eq(shifts.status, "open"),
            ),
          )
          .orderBy(desc(shifts.openedAt));

  const [totalRows, summaryRows, activeShiftRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(cashMovements)
      .innerJoin(shifts, eq(cashMovements.shiftId, shifts.id))
      .innerJoin(outlets, eq(shifts.outletId, outlets.id))
      .innerJoin(registers, eq(shifts.registerId, registers.id))
      .innerJoin(users, eq(cashMovements.createdBy, users.id))
      .leftJoin(
        sales,
        and(
          eq(cashMovements.referenceId, sales.id),
          eq(cashMovements.referenceType, "sale"),
        ),
      )
      .where(whereClause),

    db
      .select({
        totalMovements: count(),
        openingBalance: sql<string>`coalesce(sum(case when ${cashMovements.type} = 'opening_balance' then ${cashMovements.amount}::numeric else 0 end), 0)`,
        cashSales: sql<string>`coalesce(sum(case when ${cashMovements.type} = 'cash_sale' then ${cashMovements.amount}::numeric else 0 end), 0)`,
        manualCashIn: sql<string>`coalesce(sum(case when ${cashMovements.type} = 'cash_in' then ${cashMovements.amount}::numeric else 0 end), 0)`,
        manualCashOut: sql<string>`coalesce(sum(case when ${cashMovements.type} = 'cash_out' then ${cashMovements.amount}::numeric else 0 end), 0)`,
        cashRefunds: sql<string>`coalesce(sum(case when ${cashMovements.type} = 'cash_refund' then ${cashMovements.amount}::numeric else 0 end), 0)`,
        closingAdjustments: sql<string>`coalesce(sum(case when ${cashMovements.type} = 'closing_adjustment' then ${cashMovements.amount}::numeric else 0 end), 0)`,
      })
      .from(cashMovements)
      .innerJoin(shifts, eq(cashMovements.shiftId, shifts.id))
      .innerJoin(outlets, eq(shifts.outletId, outlets.id))
      .innerJoin(registers, eq(shifts.registerId, registers.id))
      .innerJoin(users, eq(cashMovements.createdBy, users.id))
      .leftJoin(
        sales,
        and(
          eq(cashMovements.referenceId, sales.id),
          eq(cashMovements.referenceType, "sale"),
        ),
      )
      .where(whereClause),

    activeShiftRowsPromise,
  ]);

  const total = totalRows[0]?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_CASH_MOVEMENTS_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const offset = (page - 1) * ADMIN_CASH_MOVEMENTS_PAGE_SIZE;

  const rows = await db
    .select({
      id: cashMovements.id,
      shiftId: cashMovements.shiftId,
      type: cashMovements.type,
      amount: cashMovements.amount,
      referenceType: cashMovements.referenceType,
      referenceId: cashMovements.referenceId,
      reason: cashMovements.reason,
      createdAt: cashMovements.createdAt,
      createdByName: users.fullName,
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
      registerId: registers.id,
      registerCode: registers.code,
      registerName: registers.name,
      shiftStatus: shifts.status,
      shiftOpenedAt: shifts.openedAt,
      saleInvoiceNumber: sales.invoiceNumber,
    })
    .from(cashMovements)
    .innerJoin(shifts, eq(cashMovements.shiftId, shifts.id))
    .innerJoin(outlets, eq(shifts.outletId, outlets.id))
    .innerJoin(registers, eq(shifts.registerId, registers.id))
    .innerJoin(users, eq(cashMovements.createdBy, users.id))
    .leftJoin(
      sales,
      and(
        eq(cashMovements.referenceId, sales.id),
        eq(cashMovements.referenceType, "sale"),
      ),
    )
    .where(whereClause)
    .orderBy(desc(cashMovements.createdAt))
    .limit(ADMIN_CASH_MOVEMENTS_PAGE_SIZE)
    .offset(offset);

  const summaryRow = summaryRows[0];
  const openingBalance = parseAmount(summaryRow?.openingBalance);
  const cashSales = parseAmount(summaryRow?.cashSales);
  const manualCashIn = parseAmount(summaryRow?.manualCashIn);
  const manualCashOut = parseAmount(summaryRow?.manualCashOut);
  const cashRefunds = parseAmount(summaryRow?.cashRefunds);
  const closingAdjustments = parseAmount(summaryRow?.closingAdjustments);
  const netMovement =
    openingBalance +
    cashSales +
    manualCashIn +
    closingAdjustments -
    manualCashOut -
    cashRefunds;

  const mappedRows: AdminCashMovementRow[] = rows.map((row) => ({
    id: row.id,
    shiftId: row.shiftId,
    type: row.type,
    amount: row.amount,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    referenceLabel:
      row.saleInvoiceNumber ??
      (row.referenceType === "shift" ? "Shift kasir" : row.referenceType),
    reason: row.reason,
    createdAt: row.createdAt,
    createdByName: row.createdByName,
    outletId: row.outletId,
    outletCode: row.outletCode,
    outletName: row.outletName,
    registerId: row.registerId,
    registerCode: row.registerCode,
    registerName: row.registerName,
    shiftStatus: row.shiftStatus,
    shiftOpenedAt: row.shiftOpenedAt,
  }));

  const activeShifts: AdminCashMovementActiveShift[] = activeShiftRows.map(
    (shift) => ({
      ...shift,
      expectedCash: shift.expectedCash,
    }),
  );

  return {
    filters,
    outlets: auth.outlets,
    activeShifts,
    rows: mappedRows,
    summary: {
      totalMovements: summaryRow?.totalMovements ?? 0,
      openingBalance,
      cashSales,
      manualCashIn,
      manualCashOut,
      cashRefunds,
      closingAdjustments,
      netMovement,
      activeShiftCount: activeShifts.length,
    },
    total,
    page,
    pageCount,
    pageSize: ADMIN_CASH_MOVEMENTS_PAGE_SIZE,
    periodLabel,
  };
}

export function getCashMovementSignedAmount(row: Pick<AdminCashMovementRow, "type" | "amount">) {
  return getSignedMovementAmount(row.type, parseAmount(row.amount));
}
