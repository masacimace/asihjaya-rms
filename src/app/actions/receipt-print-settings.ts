"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditLogs, outlets } from "@/db/schema";
import {
  isOutletReceiptPrintMode,
  type OutletReceiptPrintMode,
} from "@/features/hardware/receipt-print-settings";
import { requirePermission } from "@/lib/auth/session";

const HARDWARE_PATH = "/admin/operasional/hardware";

export async function updateOutletReceiptPrintModeAction(formData: FormData) {
  const auth = await requirePermission("admin.access");
  if (!auth.permissionCodes.includes("hardware.agents.manage")) {
    throw new Error("Tidak memiliki izin untuk mengubah mode cetak nota.");
  }

  const outletId = formData.get("outletId");
  const proposedMode = formData.get("mode");
  const confirmed = formData.get("confirmPaper") === "yes";
  if (typeof outletId !== "string" || !auth.outlets.some((outlet) => outlet.id === outletId)) {
    throw new Error("Outlet tidak tersedia untuk pengguna ini.");
  }
  if (!isOutletReceiptPrintMode(proposedMode) || !confirmed) {
    throw new Error("Pilih mode valid dan konfirmasi penggantian kertas.");
  }
  const mode: OutletReceiptPrintMode = proposedMode;

  await db.transaction(async (tx) => {
    const [row] = await tx.select({
      id: outlets.id,
      name: outlets.name,
      previousMode: outlets.receiptPrintMode,
    }).from(outlets).where(and(
      eq(outlets.organizationId, auth.organization.id),
      eq(outlets.id, outletId),
    )).limit(1).for("update");
    if (!row) throw new Error("Outlet tidak ditemukan.");
    if (row.previousMode === mode) return;
    await tx.update(outlets).set({ receiptPrintMode: mode })
      .where(and(eq(outlets.organizationId, auth.organization.id), eq(outlets.id, outletId)));
    await tx.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId,
      actorUserId: auth.user.id,
      action: "hardware.receipt_print_mode_updated",
      entityType: "outlet",
      entityId: outletId,
      beforeData: { mode: row.previousMode, source: row.previousMode === null ? "env" : "outlet" },
      afterData: { mode, source: "outlet" },
      reason: "Admin mengubah media cetak nota pada dashboard Hardware Hub.",
    });
  });

  revalidatePath(HARDWARE_PATH);
  redirect(`${HARDWARE_PATH}?type=success&message=${encodeURIComponent("Mode cetak nota tersimpan. Hanya berlaku untuk job baru; sesuaikan kertas printer.")}`);
}
