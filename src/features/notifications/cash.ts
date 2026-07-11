import { createAdminNotification } from "@/features/notifications/mutations";

const CASH_DASHBOARD_PATH = "/admin/operasional/kas";
const DEFAULT_LARGE_CASH_OUT_AMOUNT = 1_000_000;
const MIN_LARGE_CASH_OUT_AMOUNT = 1;
const MAX_LARGE_CASH_OUT_AMOUNT = 1_000_000_000;

type ManualCashMovementNotificationInput = {
  organizationId: string;
  outletId: string;
  shiftId: string;
  movementId: string;
  type: "cash_in" | "cash_out";
  amount: number;
  reason: string;
  outletName: string;
  registerName: string;
  createdByName: string;
};

function getLargeCashOutAmount() {
  const value = Number(process.env.LARGE_CASH_OUT_NOTIFICATION_AMOUNT);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_LARGE_CASH_OUT_AMOUNT;
  }

  return Math.min(
    MAX_LARGE_CASH_OUT_AMOUNT,
    Math.max(MIN_LARGE_CASH_OUT_AMOUNT, Math.floor(value)),
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function notifyManualCashMovementCreated({
  organizationId,
  outletId,
  shiftId,
  movementId,
  type,
  amount,
  reason,
  outletName,
  registerName,
  createdByName,
}: ManualCashMovementNotificationInput) {
  const amountText = formatMoney(amount);
  const threshold = getLargeCashOutAmount();
  const isLargeCashOut = type === "cash_out" && amount >= threshold;
  const isCashOut = type === "cash_out";

  try {
    await createAdminNotification({
      organizationId,
      outletId,
      type: "cash",
      severity: isLargeCashOut ? "warning" : isCashOut ? "info" : "success",
      title: isLargeCashOut
        ? "Kas keluar besar dicatat"
        : isCashOut
          ? "Kas keluar dicatat"
          : "Kas masuk dicatat",
      message: isCashOut
        ? `${amountText} keluar dari ${registerName} di ${outletName}. ${reason}`
        : `${amountText} masuk ke ${registerName} di ${outletName}. ${reason}`,
      entityType: "cash_movement",
      entityId: movementId,
      actionUrl: CASH_DASHBOARD_PATH,
      metadata: {
        shiftId,
        type,
        amount,
        reason,
        outletName,
        registerName,
        createdByName,
        largeCashOutThreshold: threshold,
      },
    });
  } catch (error) {
    console.error("Failed to create manual cash movement notification", error);
  }
}
