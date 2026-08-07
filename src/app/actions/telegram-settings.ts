"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  outlets,
  telegramDestinations,
  telegramReportSettings,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";
import {
  getTelegramAdminDeliveryState,
  sendTelegramAdminTestMessage,
} from "@/server/integrations/telegram/telegram-admin-service";
import { manuallyRetryTelegramDelivery } from "@/server/integrations/telegram/telegram-outbox-repository";

const TELEGRAM_ADMIN_PATH = "/admin/integrasi/telegram";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHAT_ID_PATTERN = /^-\d{5,31}$/;

function readText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function redirectWithMessage(type: "success" | "error", message: string): never {
  const params = new URLSearchParams({ type, message: message.slice(0, 240) });
  redirect(`${TELEGRAM_ADMIN_PATH}?${params.toString()}`);
}

function redirectDeliveryWithMessage(
  deliveryId: string,
  type: "success" | "error",
  message: string,
): never {
  const params = new URLSearchParams({ type, message: message.slice(0, 240) });
  redirect(`${TELEGRAM_ADMIN_PATH}/delivery/${deliveryId}?${params.toString()}`);
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("id-ID", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function isUniqueViolation(error: unknown, constraintName: string) {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  return (
    (candidate.code === "23505" && candidate.constraint === constraintName) ||
    (candidate.cause?.code === "23505" && candidate.cause.constraint === constraintName)
  );
}

async function requestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function revalidateTelegramAdmin(deliveryId?: string) {
  revalidatePath(TELEGRAM_ADMIN_PATH);
  if (deliveryId) {
    revalidatePath(`${TELEGRAM_ADMIN_PATH}/delivery/${deliveryId}`);
  }
}

export async function saveTelegramDestinationAction(formData: FormData) {
  const auth = await requirePermission("settings.manage");
  const destinationId = readText(formData, "destinationId", 36);
  const outletId = readText(formData, "outletId", 36);
  const name = readText(formData, "name", 160);
  const chatId = readText(formData, "chatId", 32);
  const timezone = readText(formData, "timezone", 64) || auth.organization.timezone;
  const isActive = formData.get("isActive") === "on";
  const openingEnabled = formData.get("openingEnabled") === "on";
  const closingDailyEnabled = formData.get("closingDailyEnabled") === "on";
  const weeklyEnabled = formData.get("weeklyEnabled") === "on";
  const monthlyEnabled = formData.get("monthlyEnabled") === "on";

  if (destinationId && !UUID_PATTERN.test(destinationId)) {
    redirectWithMessage("error", "ID destination Telegram tidak valid.");
  }
  if (!UUID_PATTERN.test(outletId)) {
    redirectWithMessage("error", "Outlet Telegram tidak valid.");
  }
  if (name.length < 3) {
    redirectWithMessage("error", "Nama destination minimal 3 karakter.");
  }
  if (!CHAT_ID_PATTERN.test(chatId)) {
    redirectWithMessage(
      "error",
      "Chat ID private group harus berupa angka negatif Telegram yang valid.",
    );
  }
  if (!isValidTimeZone(timezone)) {
    redirectWithMessage("error", "Timezone Telegram harus berupa IANA timezone yang valid.");
  }

  const [outlet] = await db
    .select({ id: outlets.id })
    .from(outlets)
    .where(
      and(
        eq(outlets.id, outletId),
        eq(outlets.organizationId, auth.organization.id),
        eq(outlets.isActive, true),
      ),
    )
    .limit(1);
  if (!outlet) {
    redirectWithMessage("error", "Outlet tidak ditemukan dalam organisasi ini.");
  }

  const metadata = await requestMetadata();
  const now = new Date();

  try {
    await db.transaction(async (transaction) => {
      const [beforeDestination] = destinationId
        ? await transaction
            .select()
            .from(telegramDestinations)
            .where(
              and(
                eq(telegramDestinations.id, destinationId),
                eq(telegramDestinations.organizationId, auth.organization.id),
              ),
            )
            .limit(1)
        : [];

      if (destinationId && !beforeDestination) {
        throw new Error("TELEGRAM_DESTINATION_NOT_FOUND");
      }
      if (beforeDestination && beforeDestination.outletId !== outletId) {
        throw new Error("TELEGRAM_DESTINATION_OUTLET_IMMUTABLE");
      }

      if (isActive) {
        await transaction
          .update(telegramDestinations)
          .set({ isActive: false, updatedAt: now, updatedBy: auth.user.id })
          .where(
            and(
              eq(telegramDestinations.organizationId, auth.organization.id),
              eq(telegramDestinations.outletId, outletId),
              eq(telegramDestinations.isActive, true),
            ),
          );
      }

      const [savedDestination] = destinationId
        ? await transaction
            .update(telegramDestinations)
            .set({
              name,
              chatId,
              isActive,
              updatedBy: auth.user.id,
              updatedAt: now,
            })
            .where(
              and(
                eq(telegramDestinations.id, destinationId),
                eq(telegramDestinations.organizationId, auth.organization.id),
              ),
            )
            .returning()
        : await transaction
            .insert(telegramDestinations)
            .values({
              organizationId: auth.organization.id,
              outletId,
              name,
              chatId,
              destinationType: "private_group",
              isActive,
              createdBy: auth.user.id,
              updatedBy: auth.user.id,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

      if (!savedDestination) throw new Error("TELEGRAM_DESTINATION_SAVE_FAILED");

      const [beforeSettings] = beforeDestination
        ? await transaction
            .select()
            .from(telegramReportSettings)
            .where(eq(telegramReportSettings.destinationId, beforeDestination.id))
            .limit(1)
        : [];

      await transaction
        .insert(telegramReportSettings)
        .values({
          destinationId: savedDestination.id,
          openingEnabled,
          closingDailyEnabled,
          weeklyEnabled,
          monthlyEnabled,
          timezone,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: telegramReportSettings.destinationId,
          set: {
            openingEnabled,
            closingDailyEnabled,
            weeklyEnabled,
            monthlyEnabled,
            timezone,
            isActive: true,
            updatedAt: now,
          },
        });

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId,
        actorUserId: auth.user.id,
        action: "telegram.destination.save",
        entityType: "telegram_destination",
        entityId: savedDestination.id,
        beforeData: beforeDestination
          ? {
              name: beforeDestination.name,
              chatId: beforeDestination.chatId,
              isActive: beforeDestination.isActive,
              settings: beforeSettings ?? null,
            }
          : null,
        afterData: {
          name,
          chatId,
          isActive,
          openingEnabled,
          closingDailyEnabled,
          weeklyEnabled,
          monthlyEnabled,
          timezone,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: { source: "admin.integrasi.telegram" },
        createdAt: now,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error, "telegram_destinations_chat_id_uq")) {
      redirectWithMessage("error", "Chat ID tersebut sudah dipakai destination Telegram lain.");
    }
    if (error instanceof Error && error.message === "TELEGRAM_DESTINATION_NOT_FOUND") {
      redirectWithMessage("error", "Destination Telegram tidak ditemukan.");
    }
    throw error;
  }

  revalidateTelegramAdmin();
  redirectWithMessage("success", "Konfigurasi Telegram outlet berhasil disimpan.");
}

export async function sendTelegramTestMessageAction(formData: FormData) {
  const auth = await requirePermission("settings.manage");
  const destinationId = readText(formData, "destinationId", 36);
  if (!UUID_PATTERN.test(destinationId)) {
    redirectWithMessage("error", "Destination test Telegram tidak valid.");
  }

  const metadata = await requestMetadata();
  try {
    const result = await sendTelegramAdminTestMessage({
      organizationId: auth.organization.id,
      destinationId,
      actorUserId: auth.user.id,
      timezone: auth.organization.timezone,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    revalidateTelegramAdmin(result.deliveryId);
    redirectWithMessage(
      "success",
      `Test message berhasil dikirim. Telegram message ID ${result.telegramMessageId}.`,
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "TELEGRAM_BOT_TOKEN_NOT_CONFIGURED") {
        redirectWithMessage("error", "Bot token belum dikonfigurasi pada environment server.");
      }
      if (error.message === "TELEGRAM_DESTINATION_INACTIVE") {
        redirectWithMessage("error", "Aktifkan destination sebelum mengirim test message.");
      }
      if (error.message.startsWith("TELEGRAM_TEST_SEND_FAILED:")) {
        redirectWithMessage("error", error.message.slice("TELEGRAM_TEST_SEND_FAILED:".length));
      }
    }
    throw error;
  }
}

export async function retryTelegramDeliveryAction(formData: FormData) {
  const auth = await requirePermission("settings.manage");
  const deliveryId = readText(formData, "deliveryId", 36);
  if (!UUID_PATTERN.test(deliveryId)) {
    redirectWithMessage("error", "Delivery Telegram tidak valid.");
  }

  const before = await getTelegramAdminDeliveryState({
    organizationId: auth.organization.id,
    deliveryId,
  });
  if (!before) {
    redirectWithMessage("error", "Delivery Telegram tidak ditemukan.");
  }
  if (before.status !== "failed") {
    redirectDeliveryWithMessage(
      deliveryId,
      "error",
      "Manual retry hanya tersedia untuk delivery berstatus failed.",
    );
  }

  const retried = await manuallyRetryTelegramDelivery({
    organizationId: auth.organization.id,
    deliveryId,
  });
  if (!retried) {
    redirectWithMessage("error", "Delivery Telegram tidak ditemukan saat retry.");
  }

  const metadata = await requestMetadata();
  await db.insert(auditLogs).values({
    organizationId: auth.organization.id,
    outletId: before.outletId,
    actorUserId: auth.user.id,
    action: "telegram.delivery.manual_retry",
    entityType: "telegram_delivery_outbox",
    entityId: deliveryId,
    beforeData: {
      status: retried.before.status,
      attemptCount: retried.before.attemptCount,
      maxAttempts: retried.before.maxAttempts,
    },
    afterData: {
      status: retried.after.status,
      attemptCount: retried.after.attemptCount,
      maxAttempts: retried.after.maxAttempts,
      nextAttemptAt: retried.after.nextAttemptAt.toISOString(),
    },
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    metadata: { source: "admin.integrasi.telegram" },
    createdAt: new Date(),
  });

  revalidateTelegramAdmin(deliveryId);
  redirectDeliveryWithMessage(
    deliveryId,
    "success",
    "Delivery dijadwalkan retry pada worker berikutnya menggunakan row yang sama.",
  );
}
