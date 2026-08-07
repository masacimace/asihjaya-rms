import { asc, and, desc, eq, inArray, isNull, lt, lte } from "drizzle-orm";

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
      maxAttempts: input.maxAttempts,
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


export type ClaimedTelegramDelivery = {
  id: string;
  organizationId: string;
  eventKey: string;
  destinationId: string;
  outletId: string;
  reportType: TelegramReportType;
  messageText: string;
  attemptCount: number;
  maxAttempts: number;
  chatId: string;
};

export async function manuallyRetryTelegramDelivery(input: {
  organizationId: string;
  deliveryId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return db.transaction(async (transaction) => {
    const [delivery] = await transaction
      .select({
        id: telegramDeliveryOutbox.id,
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
      .limit(1)
      .for("update");

    if (!delivery) return null;
    if (delivery.status !== "failed") {
      throw new Error("TELEGRAM_MANUAL_RETRY_STATUS_INVALID");
    }

    const nextMaxAttempts =
      delivery.attemptCount >= delivery.maxAttempts
        ? delivery.attemptCount + 1
        : delivery.maxAttempts;

    if (nextMaxAttempts > 50) {
      throw new Error("TELEGRAM_MANUAL_RETRY_LIMIT_REACHED");
    }

    const retried = await transitionTelegramDelivery(transaction, {
      deliveryId: delivery.id,
      from: "failed",
      to: "retry",
      attemptCount: delivery.attemptCount,
      maxAttempts: nextMaxAttempts,
      nextAttemptAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
    });

    return {
      before: delivery,
      after: retried,
    };
  });
}

export async function recoverStaleTelegramDeliveries(input: {
  workerId: string;
  staleBefore: Date;
  now?: Date;
  limit?: number;
}) {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 50;

  if (!input.workerId.trim()) {
    throw new Error("TELEGRAM_WORKER_ID_REQUIRED");
  }
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 200) {
    throw new Error("TELEGRAM_STALE_RECOVERY_LIMIT_INVALID");
  }

  return db.transaction(async (transaction) => {
    const staleRows = await transaction
      .select({
        id: telegramDeliveryOutbox.id,
        attemptCount: telegramDeliveryOutbox.attemptCount,
        maxAttempts: telegramDeliveryOutbox.maxAttempts,
      })
      .from(telegramDeliveryOutbox)
      .where(
        and(
          eq(telegramDeliveryOutbox.status, "processing"),
          lte(telegramDeliveryOutbox.lockedAt, input.staleBefore),
        ),
      )
      .orderBy(asc(telegramDeliveryOutbox.lockedAt))
      .limit(limit)
      .for("update", { skipLocked: true });

    let requeued = 0;
    let ambiguousFailed = 0;
    let exhaustedFailed = 0;

    for (const row of staleRows) {
      const [incompleteAttempt] = await transaction
        .select({
          attemptNumber: telegramDeliveryAttempts.attemptNumber,
        })
        .from(telegramDeliveryAttempts)
        .where(
          and(
            eq(telegramDeliveryAttempts.deliveryId, row.id),
            isNull(telegramDeliveryAttempts.completedAt),
          ),
        )
        .orderBy(desc(telegramDeliveryAttempts.attemptNumber))
        .limit(1);

      if (incompleteAttempt) {
        await transaction
          .update(telegramDeliveryAttempts)
          .set({
            completedAt: now,
            telegramOk: null,
            telegramErrorDescription:
              "Worker berhenti setelah attempt dimulai; hasil pengiriman Telegram tidak dapat dipastikan.",
          })
          .where(
            and(
              eq(telegramDeliveryAttempts.deliveryId, row.id),
              eq(
                telegramDeliveryAttempts.attemptNumber,
                incompleteAttempt.attemptNumber,
              ),
              isNull(telegramDeliveryAttempts.completedAt),
            ),
          );

        await transitionTelegramDelivery(transaction, {
          deliveryId: row.id,
          from: "processing",
          to: "failed",
          attemptCount: Math.max(
            row.attemptCount,
            incompleteAttempt.attemptNumber,
          ),
          maxAttempts: row.maxAttempts,
          lastErrorCode: "AMBIGUOUS_STALE_PROCESSING",
          lastErrorMessage:
            "Worker berhenti setelah dispatch mungkin dimulai; automatic retry dinonaktifkan untuk mencegah duplicate message.",
        });
        ambiguousFailed += 1;
        continue;
      }

      if (row.attemptCount >= row.maxAttempts) {
        await transitionTelegramDelivery(transaction, {
          deliveryId: row.id,
          from: "processing",
          to: "failed",
          attemptCount: row.attemptCount,
          maxAttempts: row.maxAttempts,
          lastErrorCode: "MAX_ATTEMPTS_EXHAUSTED",
          lastErrorMessage:
            "Delivery stale sudah mencapai batas maksimum attempt.",
        });
        exhaustedFailed += 1;
        continue;
      }

      await transitionTelegramDelivery(transaction, {
        deliveryId: row.id,
        from: "processing",
        to: "retry",
        attemptCount: row.attemptCount,
        maxAttempts: row.maxAttempts,
        nextAttemptAt: now,
        lastErrorCode: "STALE_LOCK_RECOVERED",
        lastErrorMessage:
          "Lock worker kedaluwarsa sebelum attempt Telegram dimulai; delivery aman untuk dicoba kembali.",
      });
      requeued += 1;
    }

    return {
      inspected: staleRows.length,
      requeued,
      ambiguousFailed,
      exhaustedFailed,
    };
  });
}

export async function claimTelegramDeliveryBatch(input: {
  workerId: string;
  batchSize?: number;
  now?: Date;
}): Promise<ClaimedTelegramDelivery[]> {
  const workerId = input.workerId.trim();
  const batchSize = input.batchSize ?? 20;
  const now = input.now ?? new Date();

  if (!workerId) {
    throw new Error("TELEGRAM_WORKER_ID_REQUIRED");
  }
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0 || batchSize > 100) {
    throw new Error("TELEGRAM_BATCH_SIZE_INVALID");
  }

  return db.transaction(async (transaction) => {
    const candidates = await transaction
      .select({
        id: telegramDeliveryOutbox.id,
        status: telegramDeliveryOutbox.status,
      })
      .from(telegramDeliveryOutbox)
      .where(
        and(
          inArray(telegramDeliveryOutbox.status, ["pending", "retry"]),
          lte(telegramDeliveryOutbox.nextAttemptAt, now),
          lt(
            telegramDeliveryOutbox.attemptCount,
            telegramDeliveryOutbox.maxAttempts,
          ),
        ),
      )
      .orderBy(
        asc(telegramDeliveryOutbox.nextAttemptAt),
        asc(telegramDeliveryOutbox.createdAt),
      )
      .limit(batchSize)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) return [];

    const candidateIds = candidates.map((row) => row.id);

    await transaction
      .update(telegramDeliveryOutbox)
      .set({
        status: "processing",
        lockedAt: now,
        lockedBy: workerId,
        updatedAt: now,
      })
      .where(inArray(telegramDeliveryOutbox.id, candidateIds));

    const claimed = await transaction
      .select({
        id: telegramDeliveryOutbox.id,
        organizationId: telegramDeliveryOutbox.organizationId,
        eventKey: telegramDeliveryOutbox.eventKey,
        destinationId: telegramDeliveryOutbox.destinationId,
        outletId: telegramDeliveryOutbox.outletId,
        reportType: telegramDeliveryOutbox.reportType,
        messageText: telegramDeliveryOutbox.messageText,
        attemptCount: telegramDeliveryOutbox.attemptCount,
        maxAttempts: telegramDeliveryOutbox.maxAttempts,
        chatId: telegramDestinations.chatId,
      })
      .from(telegramDeliveryOutbox)
      .innerJoin(
        telegramDestinations,
        eq(telegramDestinations.id, telegramDeliveryOutbox.destinationId),
      )
      .where(
        and(
          inArray(telegramDeliveryOutbox.id, candidateIds),
          eq(telegramDeliveryOutbox.status, "processing"),
          eq(telegramDeliveryOutbox.lockedBy, workerId),
        ),
      );

    const byId = new Map(claimed.map((row) => [row.id, row]));
    return candidateIds.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  });
}

export async function beginTelegramDeliveryAttempt(
  transaction: TelegramRepositoryTransaction,
  input: {
    deliveryId: string;
    attemptNumber: number;
    maxAttempts: number;
    requestedAt: Date;
  },
) {
  assertTelegramDeliveryAttemptNumber(input);

  const rows = await transaction
    .insert(telegramDeliveryAttempts)
    .values({
      deliveryId: input.deliveryId,
      attemptNumber: input.attemptNumber,
      requestedAt: input.requestedAt,
      completedAt: null,
      httpStatus: null,
      telegramOk: null,
      telegramErrorCode: null,
      telegramErrorDescription: null,
      telegramMessageId: null,
      durationMs: null,
      createdAt: input.requestedAt,
    })
    .returning();

  if (!rows[0]) {
    throw new Error("TELEGRAM_DELIVERY_ATTEMPT_INSERT_FAILED");
  }

  return rows[0];
}

export async function completeTelegramDeliveryAttempt(
  transaction: TelegramRepositoryTransaction,
  input: {
    deliveryId: string;
    attemptNumber: number;
    completedAt: Date;
    httpStatus?: number | null;
    telegramOk?: boolean | null;
    telegramErrorCode?: number | null;
    telegramErrorDescription?: string | null;
    telegramMessageId?: string | null;
    durationMs?: number | null;
  },
) {
  const rows = await transaction
    .update(telegramDeliveryAttempts)
    .set({
      completedAt: input.completedAt,
      httpStatus: input.httpStatus ?? null,
      telegramOk: input.telegramOk ?? null,
      telegramErrorCode: input.telegramErrorCode ?? null,
      telegramErrorDescription: input.telegramErrorDescription ?? null,
      telegramMessageId: input.telegramMessageId ?? null,
      durationMs: input.durationMs ?? null,
    })
    .where(
      and(
        eq(telegramDeliveryAttempts.deliveryId, input.deliveryId),
        eq(telegramDeliveryAttempts.attemptNumber, input.attemptNumber),
        isNull(telegramDeliveryAttempts.completedAt),
      ),
    )
    .returning();

  if (!rows[0]) {
    throw new Error("TELEGRAM_DELIVERY_ATTEMPT_COMPLETE_CONFLICT");
  }

  return rows[0];
}

export async function releaseClaimedTelegramDelivery(input: {
  deliveryId: string;
  workerId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return db.transaction(async (transaction) => {
    const [delivery] = await transaction
      .select({
        attemptCount: telegramDeliveryOutbox.attemptCount,
        maxAttempts: telegramDeliveryOutbox.maxAttempts,
      })
      .from(telegramDeliveryOutbox)
      .where(
        and(
          eq(telegramDeliveryOutbox.id, input.deliveryId),
          eq(telegramDeliveryOutbox.status, "processing"),
          eq(telegramDeliveryOutbox.lockedBy, input.workerId),
        ),
      )
      .limit(1)
      .for("update");

    if (!delivery) return false;

    const [incompleteAttempt] = await transaction
      .select({ id: telegramDeliveryAttempts.id })
      .from(telegramDeliveryAttempts)
      .where(
        and(
          eq(telegramDeliveryAttempts.deliveryId, input.deliveryId),
          isNull(telegramDeliveryAttempts.completedAt),
        ),
      )
      .limit(1);

    if (incompleteAttempt) {
      return false;
    }

    await transitionTelegramDelivery(transaction, {
      deliveryId: input.deliveryId,
      from: "processing",
      to: "retry",
      attemptCount: delivery.attemptCount,
      maxAttempts: delivery.maxAttempts,
      nextAttemptAt: now,
      lastErrorCode: "WORKER_GRACEFUL_RELEASE",
      lastErrorMessage:
        "Worker dihentikan sebelum attempt dimulai; delivery dilepas kembali secara aman.",
    });

    return true;
  });
}
