import { createAdminNotification } from "@/features/notifications/mutations";

const SHIFT_DASHBOARD_PATH = "/admin/operasional/shift";
const DEFAULT_CRITICAL_VARIANCE_AMOUNT = 100_000;
const MIN_CRITICAL_VARIANCE_AMOUNT = 1;
const MAX_CRITICAL_VARIANCE_AMOUNT = 1_000_000_000;

type ShiftVarianceNotificationInput = {
  organizationId: string;
  outletId: string;
  shiftId: string;
  outletName: string;
  registerName: string;
  expectedCash: number;
  actualCash: number;
  variance: number;
  varianceReason: string | null;
  closedByName: string;
  source: string;
};

function getCriticalVarianceAmount() {
  const value = Number(process.env.SHIFT_CASH_VARIANCE_CRITICAL_AMOUNT);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_CRITICAL_VARIANCE_AMOUNT;
  }

  return Math.min(
    MAX_CRITICAL_VARIANCE_AMOUNT,
    Math.max(MIN_CRITICAL_VARIANCE_AMOUNT, Math.floor(value)),
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedMoney(value: number) {
  const prefix = value > 0 ? "+" : "";

  return `${prefix}${formatMoney(value)}`;
}

export async function notifyShiftClosedWithVariance({
  organizationId,
  outletId,
  shiftId,
  outletName,
  registerName,
  expectedCash,
  actualCash,
  variance,
  varianceReason,
  closedByName,
  source,
}: ShiftVarianceNotificationInput) {
  if (variance === 0) {
    return;
  }

  const absVariance = Math.abs(variance);
  const criticalAmount = getCriticalVarianceAmount();
  const isCritical = absVariance >= criticalAmount;
  const signedVariance = formatSignedMoney(variance);

  try {
    await createAdminNotification({
      organizationId,
      outletId,
      type: "shift",
      severity: isCritical ? "critical" : "warning",
      title: isCritical ? "Selisih kas besar terdeteksi" : "Selisih kas terdeteksi",
      message: `${registerName} di ${outletName} ditutup dengan selisih ${signedVariance}. Expected ${formatMoney(expectedCash)}, aktual ${formatMoney(actualCash)}.`,
      entityType: "shift",
      entityId: shiftId,
      actionUrl: SHIFT_DASHBOARD_PATH,
      metadata: {
        expectedCash,
        actualCash,
        variance,
        varianceReason,
        closedByName,
        source,
        criticalAmount,
      },
    });
  } catch (error) {
    console.error("Failed to create shift variance notification", error);
  }
}
