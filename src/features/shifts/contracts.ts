import type { CashReconciliationSummary } from "@/lib/shifts/cash-reconciliation";

export type ShiftStatus = "open" | "closing" | "closed";

export type ShiftSummary = {
  id: string;
  status: ShiftStatus;
  outletId: string;
  outletCode: string;
  outletName: string;
  registerId: string;
  registerCode: string;
  registerName: string;
  openedByName: string | null;
  closedByName: string | null;
  openingCash: string;
  expectedCash: string | null;
  actualCash: string | null;
  cashVariance: string | null;
  varianceReason: string | null;
  openedAt: Date;
  closedAt: Date | null;
  cashSummary: CashReconciliationSummary;
};

export type ShiftDashboardTotals = {
  activeShifts: number;
  closedShifts: number;
  expectedCashActive: number;
  cashSalesActive: number;
  totalVarianceClosed: number;
};

export type ShiftDashboardData = {
  activeShifts: ShiftSummary[];
  recentShifts: ShiftSummary[];
  totals: ShiftDashboardTotals;
};
