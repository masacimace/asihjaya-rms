"use server";

import { revalidatePath } from "next/cache";

import {
  HardwareInstallerSettingsError,
  updateHardwareInstallerSettings,
} from "@/features/hardware/installer-settings";
import { requirePermission } from "@/lib/auth/session";

export type HardwareInstallerSettingsState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string; downloadUrl: string };

export async function updateHardwareInstallerSettingsAction(
  _previous: HardwareInstallerSettingsState,
  formData: FormData,
): Promise<HardwareInstallerSettingsState> {
  const auth = await requirePermission("hardware.agents.manage");
  if (!auth.permissionCodes.includes("admin.access")) {
    return { status: "error", message: "Tidak memiliki izin untuk mengubah link installer." };
  }
  const input = formData.get("downloadUrl");
  if (typeof input !== "string") return { status: "error", message: "Isi link download installer." };
  try {
    const downloadUrl = await updateHardwareInstallerSettings({
      organizationId: auth.organization.id,
      actorUserId: auth.user.id,
      downloadUrl: input,
    });
    revalidatePath("/admin/operasional/hardware");
    return { status: "success", message: "Link installer tersimpan dan langsung digunakan untuk download.", downloadUrl };
  } catch (error) {
    if (error instanceof HardwareInstallerSettingsError) return { status: "error", message: error.message };
    console.error("[hardware] Installer link update failed.");
    return { status: "error", message: "Link installer gagal disimpan. Silakan coba kembali." };
  }
}
