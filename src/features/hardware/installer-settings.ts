import { eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, organizations } from "@/db/schema";
import {
  collectHardwareInstallerEnvironmentIssues,
  resolveConfiguredHardwareInstallerUrl,
  type HardwareInstallerEnvironmentSource,
} from "@/lib/hardware-installer-environment";

export class HardwareInstallerSettingsError extends Error {}

export async function getHardwareInstallerSettings(
  organizationId: string,
  environment: HardwareInstallerEnvironmentSource = process.env,
) {
  const [row] = await db.select({ savedUrl: organizations.hardwareInstallerDownloadUrl })
    .from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!row) throw new HardwareInstallerSettingsError("Organisasi tidak ditemukan.");
  return {
    savedUrl: row.savedUrl,
    downloadUrl: resolveConfiguredHardwareInstallerUrl(row.savedUrl, environment)?.href ?? null,
  };
}

export async function updateHardwareInstallerSettings({
  organizationId, actorUserId, downloadUrl,
}: {
  organizationId: string;
  actorUserId: string;
  downloadUrl: string;
}) {
  const value = downloadUrl.trim();
  const issues = collectHardwareInstallerEnvironmentIssues(
    { HARDWARE_HUB_INSTALLER_DOWNLOAD_URL: value }, { required: true },
  );
  if (issues.length > 0) {
    throw new HardwareInstallerSettingsError(`Link installer ${issues[0]!.message}`);
  }
  const normalizedUrl = new URL(value).href;
  if (normalizedUrl.length > 2048) throw new HardwareInstallerSettingsError("Link installer maksimal 2048 karakter.");

  await db.transaction(async (tx) => {
    const [row] = await tx.select({ previousUrl: organizations.hardwareInstallerDownloadUrl })
      .from(organizations).where(eq(organizations.id, organizationId)).limit(1).for("update");
    if (!row) throw new HardwareInstallerSettingsError("Organisasi tidak ditemukan.");
    if (row.previousUrl === normalizedUrl) return;
    await tx.update(organizations)
      .set({ hardwareInstallerDownloadUrl: normalizedUrl, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId));
    await tx.insert(auditLogs).values({
      organizationId,
      actorUserId,
      action: "hardware.installer_download_url_updated",
      entityType: "organization",
      entityId: organizationId,
      beforeData: { downloadUrl: row.previousUrl },
      afterData: { downloadUrl: normalizedUrl },
      reason: "Admin mengubah link download installer Hardware Hub.",
    });
  });
  return normalizedUrl;
}
