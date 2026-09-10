"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditLogs, productColorPresets } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const SETTINGS_PATH = "/admin/pengaturan/warna-produk";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNIQUE_CONSTRAINT = "product_color_presets_org_name_ci_uq";

function readName(formData: FormData) {
  return String(formData.get("name") ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 64);
}

function readDescription(formData: FormData) {
  const value = String(formData.get("description") ?? "").trim();
  return value ? value.slice(0, 500) : null;
}

function redirectWithMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ type, message });
  redirect(`${SETTINGS_PATH}?${params.toString()}`);
}

function isUniqueViolation(error: unknown) {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };

  return (
    (candidate.code === "23505" && candidate.constraint === UNIQUE_CONSTRAINT) ||
    (candidate.cause?.code === "23505" &&
      candidate.cause.constraint === UNIQUE_CONSTRAINT)
  );
}

async function getRequestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function revalidateColorPresetConsumers() {
  revalidatePath("/admin/pengaturan");
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/admin/produk/tambah");
  revalidatePath("/admin/inventaris");
  revalidatePath("/pos/produk/tambah");
  revalidatePath("/pos/buyback");
  revalidatePath("/pos/buyback/pemrosesan");
}

export async function saveProductColorPresetAction(formData: FormData) {
  const auth = await requirePermission("settings.manage");
  const presetId = String(formData.get("presetId") ?? "").trim();
  const rawName = String(formData.get("name") ?? "").trim();
  const rawDescription = String(formData.get("description") ?? "").trim();
  const name = readName(formData);
  const description = readDescription(formData);
  const isActive = formData.get("isActive") === "on";

  if (presetId && !UUID_PATTERN.test(presetId)) {
    redirectWithMessage("error", "ID preset warna tidak valid.");
  }

  if (name.length < 1) {
    redirectWithMessage("error", "Nama warna wajib diisi.");
  }

  if (rawName.length > 64) {
    redirectWithMessage("error", "Nama warna maksimal 64 karakter.");
  }

  if (rawDescription.length > 500) {
    redirectWithMessage("error", "Deskripsi warna maksimal 500 karakter.");
  }

  const requestMetadata = await getRequestMetadata();
  const now = new Date();

  try {
    await db.transaction(async (transaction) => {
      const [before] = presetId
        ? await transaction
            .select({
              id: productColorPresets.id,
              name: productColorPresets.name,
              description: productColorPresets.description,
              isActive: productColorPresets.isActive,
            })
            .from(productColorPresets)
            .where(
              and(
                eq(productColorPresets.id, presetId),
                eq(productColorPresets.organizationId, auth.organization.id),
              ),
            )
            .limit(1)
        : [];

      if (presetId && !before) {
        throw new Error("PRODUCT_COLOR_PRESET_NOT_FOUND");
      }

      const values = {
        organizationId: auth.organization.id,
        name,
        description,
        isActive,
        updatedAt: now,
      };

      const [saved] = presetId
        ? await transaction
            .update(productColorPresets)
            .set(values)
            .where(
              and(
                eq(productColorPresets.id, presetId),
                eq(productColorPresets.organizationId, auth.organization.id),
              ),
            )
            .returning({ id: productColorPresets.id })
        : await transaction
            .insert(productColorPresets)
            .values({ ...values, createdAt: now })
            .returning({ id: productColorPresets.id });

      if (!saved) {
        throw new Error("PRODUCT_COLOR_PRESET_SAVE_FAILED");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        action: presetId
          ? "settings.product_color_preset.update"
          : "settings.product_color_preset.create",
        entityType: "product_color_preset",
        entityId: saved.id,
        beforeData: before
          ? {
              name: before.name,
              description: before.description,
              isActive: before.isActive,
            }
          : null,
        afterData: {
          name,
          description,
          isActive,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      redirectWithMessage(
        "error",
        `Preset warna \"${name}\" sudah tersedia. Nama warna harus unik.`,
      );
    }

    if (error instanceof Error && error.message === "PRODUCT_COLOR_PRESET_NOT_FOUND") {
      redirectWithMessage("error", "Preset warna tidak ditemukan.");
    }

    console.error("Gagal menyimpan preset warna produk:", error);
    redirectWithMessage(
      "error",
      "Preset warna belum bisa disimpan karena terjadi kendala sistem.",
    );
  }

  revalidateColorPresetConsumers();
  redirectWithMessage(
    "success",
    presetId
      ? `Preset warna \"${name}\" berhasil diperbarui.`
      : `Preset warna \"${name}\" berhasil ditambahkan.`,
  );
}
