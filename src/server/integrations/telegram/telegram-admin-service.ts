import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  outlets,
  telegramDeliveryOutbox,
  telegramDestinations,
} from "@/db/schema";
import { TelegramClient } from "@/server/integrations/telegram/telegram-client";
import { isTelegramClientError } from "@/server/integrations/telegram/telegram-errors";
import {
  beginTelegramDeliveryAttempt,
  completeTelegramDeliveryAttempt,
  enqueueTelegramDelivery,
  transitionTelegramDelivery,
} from "@/server/integrations/telegram/telegram-outbox-repository";
import { getTelegramDeliveryWorkerRuntimeConfig } from "@/server/integrations/telegram/telegram-runtime-config";

export type TelegramAdminBotStatus =
  | { state: "not_configured"; username: null; message: string }
  | { state: "reachable"; username: string | null; message: string }
  | { state: "unreachable"; username: null; message: string };

function formatAdminTimestamp(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function makeAdminClient() {
  const runtime = getTelegramDeliveryWorkerRuntimeConfig();
  if (!runtime.botToken) return null;

  return new TelegramClient({
    apiBaseUrl: runtime.apiBaseUrl,
    botToken: runtime.botToken,
    timeoutMs: runtime.requestTimeoutMs,
  });
}

export async function getTelegramAdminBotStatus(): Promise<TelegramAdminBotStatus> {
  try {
    const client = makeAdminClient();
    if (!client) {
      return {
        state: "not_configured",
        username: null,
        message: "Bot token belum dikonfigurasi pada environment server.",
      };
    }

    const bot = await client.getMe();
    return {
      state: "reachable",
      username: bot.username ? `@${bot.username}` : null,
      message: "Telegram Bot API dapat dijangkau dari server.",
    };
  } catch (error) {
    return {
      state: "unreachable",
      username: null,
      message: isTelegramClientError(error)
        ? error.message
        : "Telegram Bot API tidak dapat diverifikasi saat ini.",
    };
  }
}

export async function sendTelegramAdminTestMessage(input: {
  organizationId: string;
  destinationId: string;
  actorUserId: string;
  timezone: string;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const [destination] = await db
    .select({
      id: telegramDestinations.id,
      outletId: telegramDestinations.outletId,
      destinationName: telegramDestinations.name,
      chatId: telegramDestinations.chatId,
      isActive: telegramDestinations.isActive,
      outletName: outlets.name,
      outletCode: outlets.code,
    })
    .from(telegramDestinations)
    .innerJoin(outlets, eq(outlets.id, telegramDestinations.outletId))
    .where(
      and(
        eq(telegramDestinations.id, input.destinationId),
        eq(telegramDestinations.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!destination) throw new Error("TELEGRAM_DESTINATION_NOT_FOUND");
  if (!destination.isActive) throw new Error("TELEGRAM_DESTINATION_INACTIVE");

  const client = makeAdminClient();
  if (!client) throw new Error("TELEGRAM_BOT_TOKEN_NOT_CONFIGURED");

  const now = new Date();
  const messageText = [
    "✅ ASIHJAYA RMS Telegram Integration",
    "",
    "Test message berhasil dikirim dari halaman admin.",
    `Outlet: ${destination.outletName}`,
    `Waktu: ${formatAdminTimestamp(now, input.timezone)}`,
  ].join("\n");
  const eventKey = `test:${destination.id}:${randomUUID()}`;
  const workerId = `admin-test:${input.actorUserId}`.slice(0, 120);

  const queued = await db.transaction(async (transaction) => {
    const result = await enqueueTelegramDelivery(transaction, {
      organizationId: input.organizationId,
      eventKey,
      destinationId: destination.id,
      outletId: destination.outletId,
      reportType: "test",
      payloadSnapshot: {
        schemaVersion: 1,
        reportType: "test",
        outlet: {
          id: destination.outletId,
          code: destination.outletCode,
          name: destination.outletName,
        },
        destination: {
          id: destination.id,
          name: destination.destinationName,
        },
        requestedAt: now.toISOString(),
        requestedBy: input.actorUserId,
      },
      messageText,
      maxAttempts: 1,
      nextAttemptAt: now,
    });

    await transitionTelegramDelivery(transaction, {
      deliveryId: result.delivery.id,
      from: "pending",
      to: "processing",
      attemptCount: 0,
      maxAttempts: 1,
      lockedAt: now,
      lockedBy: workerId,
    });
    await beginTelegramDeliveryAttempt(transaction, {
      deliveryId: result.delivery.id,
      attemptNumber: 1,
      maxAttempts: 1,
      requestedAt: now,
    });

    return result.delivery.id;
  });

  let telegramAccepted = false;

  try {
    const sent = await client.sendMessage({
      chatId: destination.chatId,
      text: messageText,
    });
    telegramAccepted = true;
    const completedAt = new Date();

    await db.transaction(async (transaction) => {
      await completeTelegramDeliveryAttempt(transaction, {
        deliveryId: queued,
        attemptNumber: 1,
        completedAt,
        httpStatus: 200,
        telegramOk: true,
        telegramMessageId: String(sent.messageId),
        durationMs: Math.max(0, completedAt.getTime() - now.getTime()),
      });
      await transitionTelegramDelivery(transaction, {
        deliveryId: queued,
        from: "processing",
        to: "sent",
        attemptCount: 1,
        maxAttempts: 1,
        sentAt: completedAt,
        telegramMessageId: String(sent.messageId),
      });
      await transaction.insert(auditLogs).values({
        organizationId: input.organizationId,
        outletId: destination.outletId,
        actorUserId: input.actorUserId,
        action: "telegram.test_message.sent",
        entityType: "telegram_delivery_outbox",
        entityId: queued,
        beforeData: null,
        afterData: {
          destinationId: destination.id,
          reportType: "test",
          telegramMessageId: String(sent.messageId),
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: { source: "admin.integrasi.telegram" },
        createdAt: completedAt,
      });
    });

    return { deliveryId: queued, telegramMessageId: String(sent.messageId) };
  } catch (error) {
    const completedAt = new Date();
    const errorCode = telegramAccepted
      ? "TELEGRAM_TEST_AMBIGUOUS_AFTER_SEND"
      : isTelegramClientError(error)
        ? error.telegramErrorCode !== null
          ? `TELEGRAM_${error.telegramErrorCode}`
          : `TELEGRAM_${error.kind.toUpperCase()}`
        : "TELEGRAM_TEST_UNEXPECTED_ERROR";
    const errorMessage = telegramAccepted
      ? "Telegram menerima respons sukses, tetapi audit database gagal diselesaikan. Periksa group sebelum manual retry karena hasil pengiriman bersifat ambiguous."
      : isTelegramClientError(error)
        ? error.message
        : "Test message gagal karena error internal yang tidak diklasifikasikan.";

    await db.transaction(async (transaction) => {
      await completeTelegramDeliveryAttempt(transaction, {
        deliveryId: queued,
        attemptNumber: 1,
        completedAt,
        httpStatus: isTelegramClientError(error) ? error.httpStatus : null,
        telegramOk: isTelegramClientError(error) && error.kind === "api" ? false : null,
        telegramErrorCode: isTelegramClientError(error)
          ? error.telegramErrorCode
          : null,
        telegramErrorDescription: errorMessage,
        durationMs: isTelegramClientError(error)
          ? error.durationMs
          : Math.max(0, completedAt.getTime() - now.getTime()),
      });
      await transitionTelegramDelivery(transaction, {
        deliveryId: queued,
        from: "processing",
        to: "failed",
        attemptCount: 1,
        maxAttempts: 1,
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
      });
      await transaction.insert(auditLogs).values({
        organizationId: input.organizationId,
        outletId: destination.outletId,
        actorUserId: input.actorUserId,
        action: "telegram.test_message.failed",
        entityType: "telegram_delivery_outbox",
        entityId: queued,
        beforeData: null,
        afterData: { destinationId: destination.id, reportType: "test", errorCode },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: { source: "admin.integrasi.telegram" },
        createdAt: completedAt,
      });
    });

    throw new Error(`TELEGRAM_TEST_SEND_FAILED:${errorMessage}`);
  }
}

export async function getTelegramAdminDeliveryState(input: {
  organizationId: string;
  deliveryId: string;
}) {
  const [row] = await db
    .select({
      id: telegramDeliveryOutbox.id,
      outletId: telegramDeliveryOutbox.outletId,
      status: telegramDeliveryOutbox.status,
      attemptCount: telegramDeliveryOutbox.attemptCount,
      maxAttempts: telegramDeliveryOutbox.maxAttempts,
    })
    .from(telegramDeliveryOutbox)
    .where(
      and(
        eq(telegramDeliveryOutbox.id, input.deliveryId),
        eq(telegramDeliveryOutbox.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  return row ?? null;
}
