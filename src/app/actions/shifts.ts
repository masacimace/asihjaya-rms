"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/session";
import {
  closeShiftWithReconciliation,
  parseShiftClosingActualCash,
  ShiftClosingError,
} from "@/lib/shifts/shift-closing";

const SHIFT_DASHBOARD_PATH = "/admin/operasional/shift";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function redirectWithMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ type, message });

  redirect(`${SHIFT_DASHBOARD_PATH}?${params.toString()}`);
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

export async function closeShiftFromDashboardAction(formData: FormData) {
  const auth = await requirePermission("shifts.manage");
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const actualCash = parseShiftClosingActualCash(
    String(formData.get("actualCash") ?? ""),
  );
  const varianceReason = String(formData.get("varianceReason") ?? "").trim();

  if (!UUID_PATTERN.test(shiftId)) {
    redirectWithMessage("error", "Shift tidak valid.");
  }

  const requestMetadata = await getRequestMetadata();

  try {
    const result = await closeShiftWithReconciliation({
      auth,
      shiftId,
      actualCash,
      varianceReason,
      requestMetadata,
      source: "admin.shift_dashboard",
    });

    revalidatePath(SHIFT_DASHBOARD_PATH);
    revalidatePath("/admin/operasional/kas");
    revalidatePath("/pos");

    const varianceText =
      result.variance === 0
        ? "Kas cocok."
        : `Selisih kas ${result.variance > 0 ? "+" : ""}${result.variance.toLocaleString("id-ID")}.`;

    redirectWithMessage(
      "success",
      `Shift berhasil ditutup. Expected cash Rp${result.expectedCash.toLocaleString("id-ID")}, aktual Rp${result.actualCash.toLocaleString("id-ID")}. ${varianceText}`,
    );
  } catch (error) {
    if (error instanceof ShiftClosingError) {
      redirectWithMessage("error", error.message);
    }

    console.error("Failed to close shift from dashboard", error);
    redirectWithMessage(
      "error",
      "Shift belum bisa ditutup karena terjadi kendala sistem. Coba ulang atau hubungi admin.",
    );
  }
}
