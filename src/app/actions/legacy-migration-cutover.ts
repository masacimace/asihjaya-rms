"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LEGACY_CUTOVER_CONFIRMATION } from "@/features/legacy-migration/cutover-contracts";
import { getLegacyMigrationCutoverData } from "@/features/legacy-migration/cutover-queries";
import {
  executeLegacyMigrationCutover,
  explainLegacyMigrationCutoverError,
} from "@/features/legacy-migration/cutover-service";
import { parseLegacyMigrationUuid } from "@/features/legacy-migration/safety";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

function readText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "").trim().slice(0, maxLength);
}

function cutoverPath(batchId: string) {
  return `/admin/migrasi-produk/${batchId}/cutover`;
}

function redirectWithMessage(
  path: string,
  type: "success" | "error",
  message: string,
): never {
  redirect(`${path}?${new URLSearchParams({ type, message }).toString()}`);
}

export async function executeLegacyMigrationCutoverAction(
  formData: FormData,
) {
  const auth = await requirePermission("migration.cutover.execute");
  const batchId = parseLegacyMigrationUuid(
    readText(formData, "batchId", 36),
  );
  const sessionId = parseLegacyMigrationUuid(
    readText(formData, "sessionId", 36),
  );
  const confirmation = readText(formData, "confirmation", 40).toUpperCase();

  if (!batchId || !sessionId) {
    redirectWithMessage(
      "/admin/migrasi-produk",
      "error",
      "Batch atau sesi cutover tidak valid.",
    );
  }
  if (confirmation !== LEGACY_CUTOVER_CONFIRMATION) {
    redirectWithMessage(
      cutoverPath(batchId),
      "error",
      `Ketik ${LEGACY_CUTOVER_CONFIRMATION} untuk menjalankan aktivasi.`,
    );
  }

  const preflight = await getLegacyMigrationCutoverData(auth, batchId);
  const selectedPreflight = preflight?.sessions.find(
    (session) => session.id === sessionId,
  );
  if (!preflight || !selectedPreflight) {
    redirectWithMessage(
      "/admin/migrasi-produk",
      "error",
      "Batch atau sesi migrasi tidak ditemukan.",
    );
  }
  if (selectedPreflight.cutoverRun) {
    redirectWithMessage(
      cutoverPath(batchId),
      "success",
      "Sesi tersebut sudah pernah diaktifkan. Tidak ada perubahan kedua yang dibuat.",
    );
  }
  if (!selectedPreflight.canExecute) {
    redirectWithMessage(
      cutoverPath(batchId),
      "error",
      "Preflight belum siap. Selesaikan blocker rekonsiliasi sebelum aktivasi.",
    );
  }

  const headerStore = await headers();

  let result: Awaited<ReturnType<typeof executeLegacyMigrationCutover>>;
  try {
    result = await executeLegacyMigrationCutover({
      organizationId: auth.organization.id,
      actorUserId: auth.user.id,
      batchId,
      sessionId,
      requestMetadata: {
        ipAddress: getClientIp(headerStore),
        userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    redirectWithMessage(
      cutoverPath(batchId),
      "error",
      explainLegacyMigrationCutoverError(error),
    );
  }

  revalidatePath(cutoverPath(batchId));
  revalidatePath(`/admin/migrasi-produk/${batchId}/rekonsiliasi`);
  revalidatePath(`/admin/migrasi-produk/${batchId}`);
  revalidatePath(`/admin/inventaris`);
  revalidatePath(`/pos`);

  redirectWithMessage(
    cutoverPath(batchId),
    "success",
    result.alreadyExecuted
      ? `Sesi ${result.sessionName} sudah pernah diaktifkan; tidak ada duplikasi.`
      : result.itemCount > 0
        ? `${result.itemCount} item pada sesi ${result.sessionName} berhasil diaktifkan menjadi stok tersedia.`
        : `Sesi ${result.sessionName} diselesaikan tanpa item stok yang perlu diaktifkan.`,
  );
}
