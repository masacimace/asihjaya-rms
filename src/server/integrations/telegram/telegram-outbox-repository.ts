import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  telegramDeliveryAttempts,
  telegramDeliveryOutbox,
  telegramDestinations,
  telegramReportSettings,
} from "@/db/schema";
import {
  assertTelegramDeliveryAttemptNumber,
  assertTelegramDeliveryTransition,
  assertTelegramMessageText,
  assertTelegramReportPeriod,
  normalizeTelegramEventKey,
  type TelegramDeliveryStatus,
  type TelegramReportType,
} from "@/server/integrations/telegram/telegram-outbox-contract";

export type TelegramRepositoryTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export type EnqueueTelegramDeliveryInput = {
  organizationId: string;
  eventKey: string;
  destinationId: string;
  outletId: string;
  reportType: TelegramReportType;
  businessDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  payloadSnapshot: Record<string, unknown>;
  messageText: string;
  maxAttempts?: number;
  nextAttemptAt?: Date;
};

export async function enqueueTelegramDelivery(
  transaction: TelegramRepositoryTransaction,
  input: EnqueueTelegramDeliveryInput,
) {
  const eventKey = normalizeTelegramEventKey(input.eventKey);
  assertTelegramMessageText(input.messageText);
  assertTelegramReportPeriod(input);

  const maxAttempts = input.maxAttempts ?? 5;
  assertTelegramDeliveryAttemptNumber({ attemptNumber: 1, maxAttempts });

  const now = new Date();
  const inserted = await transaction
    .insert(telegramDeliveryOutbox)
    .values({
      organizationId: input.organizationId,
      eventKey,
      destinationId: input.destinationId,
      outletId: input.outletId,
      reportType: input.reportType,
      businessDate: input.businessDate ?? null,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      payloadSnapshotJson: input.payloadSnapshot,
      messageText: input.messageText,
      status: "pending",
      attemptCount: 0,
      maxAttempts,
      nextAttemptAt: input.nextAttemptAt ?? now,
      lockedAt: null,
      lockedBy: null,
      sentAt: null,
      telegramMessageId: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [telegramDeliveryOutbox.eventKey, telegramDeliveryOutbox.destinationId],
    })
    .returning();

  if (inserted[0]) {
    return { created: true as const, delivery: inserted[0] };
  }

  const existing = await transaction.query.telegramDeliveryOutbox.findFirst({
    where: and(
      eq(telegramDeliveryOutbox.eventKey, eventKey),
      eq(telegramDeliveryOutbox.destinationId, input.destinationId),
    ),
  });

  if (!existing) {
    throw new Error("TELEGRAM_OUTBOX_IDEMPOTENCY_LOOKUP_FAILED");
  }

  return { created: false as const, delivery: existing };
}

export async function findEnabledTelegramDestinationForOutlet(
  transaction: TelegramRepositoryTransaction,
  input: {
    organizationId: string;
    outletId: string;
    reportType: TelegramReportType;
  },
) {
  const rows = await transaction
    .select({
      destinationId: telegramDestinations.id,
      chatId: telegramDestinations.chatId,
      timezone: telegramReportSettings.timezone,
      openingEnabled: telegramReportSettings.openingEnabled,
      closingDailyEnabled: telegramReportSettings.closingDailyEnabled,
      weeklyEnabled: telegramReportSettings.weeklyEnabled,
      monthlyEnabled: telegramReportSettings.monthlyEnabled,
    })
    .from(telegramDestinations)
    .innerJoin(
      telegramReportSettings,
      eq(telegramReportSettings.destinationId, telegramDestinations.id),
    )
    .where(
      and(
        eq(telegramDestinations.organizationId, input.organizationId),
        eq(telegramDestinations.outletId, input.outletId),
        eq(telegramDestinations.isActive, true),
        eq(telegramReportSettings.isActive, true),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const enabled =
    input.reportType === "opening"
      ? row.openingEnabled
      : input.reportType === "closing_daily"
        ? row.closingDailyEnabled
        : input.reportType === "weekly"
          ? row.weeklyEnabled
          : input.reportType === "monthly"
            ? row.monthlyEnabled
            : true;

  if (!enabled) return null;

  return {
    destinationId: row.destinationId,
    chatId: row.chatId,
    timezone: row.timezone,
  };
}

export async function transitionTelegramDelivery(
  transaction: TelegramRepositoryTransaction,
  input: {
    deliveryId: string;
    from: TelegramDeliveryStatus;
    to: TelegramDeliveryStatus;
    attemptCount: number;
    maxAttempts: number;
    nextAttemptAt?: Date;
    lockedAt?: Date | null;
    lockedBy?: string | null;
    sentAt?: Date | null;
    telegramMessageId?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  },
) {
  assertTelegramDeliveryTransition(input.from, input.to);

  if (!Number.isInteger(input.attemptCount) || input.attemptCount < 0) {
    throw new Error("TELEGRAM_ATTEMPT_COUNT_INVALID");
  }

  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts <= 0) {
    throw new Error("TELEGRAM_MAX_ATTEMPTS_INVALID");
  }

  if (input.attemptCount > input.maxAttempts) {
    throw new Error("TELEGRAM_ATTEMPT_COUNT_EXCEEDS_MAX");
  }

  if (input.to === "processing" && (!input.lockedAt || !input.lockedBy?.trim())) {
    throw new Error("TELEGRAM_PROCESSING_LOCK_REQUIRED");
  }

  if (input.to === "retry" && !input.nextAttemptAt) {
    throw new Error("TELEGRAM_RETRY_SCHEDULE_REQUIRED");
  }

  if (input.to === "sent" && (!input.sentAt || !input.telegramMessageId?.trim())) {
    throw new Error("TELEGRAM_SENT_METADATA_REQUIRED");
  }

  const now = new Date();
  const rows = await transaction
    .update(telegramDeliveryOutbox)
    .set({
      status: input.to,
      attemptCount: input.attemptCount,
      nextAttemptAt: input.nextAttemptAt ?? now,
      lockedAt: input.to === "processing" ? (input.lockedAt ?? null) : null,
      lockedBy: input.to === "processing" ? (input.lockedBy?.trim() ?? null) : null,
      sentAt: input.to === "sent" ? (input.sentAt ?? null) : null,
      telegramMessageId:
        input.to === "sent" ? (input.telegramMessageId?.trim() ?? null) : null,
      lastErrorCode: input.lastErrorCode ?? null,
      lastErrorMessage: input.lastErrorMessage ?? null,
      updatedAt: now,
    })
    .where(
      and(
        eq(telegramDeliveryOutbox.id, input.deliveryId),
        eq(telegramDeliveryOutbox.status, input.from),
      ),
    )
    .returning();

  if (!rows[0]) {
    throw new Error("TELEGRAM_DELIVERY_STATE_CONFLICT");
  }

  return rows[0];
}

export async function appendTelegramDeliveryAttempt(
  transaction: TelegramRepositoryTransaction,
  input: {
    deliveryId: string;
    attemptNumber: number;
    maxAttempts: number;
    requestedAt: Date;
    completedAt?: Date | null;
    httpStatus?: number | null;
    telegramOk?: boolean | null;
    telegramErrorCode?: number | null;
    telegramErrorDescription?: string | null;
    telegramMessageId?: string | null;
    durationMs?: number | null;
  },
) {
  assertTelegramDeliveryAttemptNumber(input);

  const rows = await transaction
    .insert(telegramDeliveryAttempts)
    .values({
      deliveryId: input.deliveryId,
      attemptNumber: input.attemptNumber,
      requestedAt: input.requestedAt,
      completedAt: input.completedAt ?? null,
      httpStatus: input.httpStatus ?? null,
      telegramOk: input.telegramOk ?? null,
      telegramErrorCode: input.telegramErrorCode ?? null,
      telegramErrorDescription: input.telegramErrorDescription ?? null,
      telegramMessageId: input.telegramMessageId ?? null,
      durationMs: input.durationMs ?? null,
      createdAt: new Date(),
    })
    .returning();

  if (!rows[0]) {
    throw new Error("TELEGRAM_DELIVERY_ATTEMPT_INSERT_FAILED");
  }

  return rows[0];
}
