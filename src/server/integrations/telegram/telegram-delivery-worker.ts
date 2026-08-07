import { hostname } from "node:os";

import { db } from "@/db";
import type { TelegramClient } from "@/server/integrations/telegram/telegram-client";
import {
  TELEGRAM_DELIVERY_BATCH_SIZE,
  TELEGRAM_STALE_PROCESSING_MS,
  telegramRetryDelayMs,
} from "@/server/integrations/telegram/telegram-delivery-policy";
import {
  isTelegramClientError,
  type TelegramClientError,
} from "@/server/integrations/telegram/telegram-errors";
import {
  beginTelegramDeliveryAttempt,
  claimTelegramDeliveryBatch,
  completeTelegramDeliveryAttempt,
  recoverStaleTelegramDeliveries,
  releaseClaimedTelegramDelivery,
  transitionTelegramDelivery,
  type ClaimedTelegramDelivery,
} from "@/server/integrations/telegram/telegram-outbox-repository";

export type TelegramDeliveryClient = Pick<TelegramClient, "sendMessage">;

export type TelegramDeliveryWorkerLogEntry = {
  event: "telegram_delivery_worker";
  deliveryId: string | null;
  destinationId: string | null;
  reportType: string | null;
  outcome:
    | "sent"
    | "retry"
    | "failed"
    | "released"
    | "recovery"
    | "idle";
  attempt: number | null;
  httpStatus: number | null;
  telegramErrorCode: number | null;
  durationMs: number | null;
  errorCode: string | null;
};

export type TelegramDeliveryWorkerLogger = (
  entry: TelegramDeliveryWorkerLogEntry,
) => void;

export type RunTelegramDeliveryBatchOptions = {
  client: TelegramDeliveryClient;
  workerId?: string;
  batchSize?: number;
  staleProcessingMs?: number;
  logger?: TelegramDeliveryWorkerLogger;
  shouldStop?: () => boolean;
  now?: () => Date;
};

export type TelegramDeliveryBatchResult = {
  claimed: number;
  sent: number;
  retry: number;
  failed: number;
  released: number;
  recovered: number;
  ambiguousFailed: number;
};

function normalizeWorkerId(value: string | undefined): string {
  const normalized = value?.trim();
  if (normalized) return normalized.slice(0, 120);
  return `${hostname()}:${process.pid}`.slice(0, 120);
}

function safeEmit(
  logger: TelegramDeliveryWorkerLogger | undefined,
  entry: TelegramDeliveryWorkerLogEntry,
) {
  if (!logger) return;
  try {
    logger(entry);
  } catch {
    // Logging tidak boleh mengubah state delivery.
  }
}

function errorMetadata(error: TelegramClientError) {
  return {
    httpStatus: error.httpStatus,
    telegramErrorCode: error.telegramErrorCode,
    durationMs: error.durationMs,
    errorCode:
      error.telegramErrorCode !== null
        ? `TELEGRAM_${error.telegramErrorCode}`
        : `TELEGRAM_${error.kind.toUpperCase()}`,
    errorMessage: error.message,
  };
}

async function processClaimedDelivery(
  delivery: ClaimedTelegramDelivery,
  input: {
    client: TelegramDeliveryClient;
    logger?: TelegramDeliveryWorkerLogger;
    now: () => Date;
  },
): Promise<"sent" | "retry" | "failed"> {
  const attemptNumber = delivery.attemptCount + 1;
  const requestedAt = input.now();

  await db.transaction(async (transaction) => {
    await beginTelegramDeliveryAttempt(transaction, {
      deliveryId: delivery.id,
      attemptNumber,
      maxAttempts: delivery.maxAttempts,
      requestedAt,
    });
  });

  try {
    const sent = await input.client.sendMessage({
      chatId: delivery.chatId,
      text: delivery.messageText,
    });
    const completedAt = input.now();

    await db.transaction(async (transaction) => {
      await completeTelegramDeliveryAttempt(transaction, {
        deliveryId: delivery.id,
        attemptNumber,
        completedAt,
        httpStatus: 200,
        telegramOk: true,
        telegramMessageId: String(sent.messageId),
        durationMs: Math.max(0, completedAt.getTime() - requestedAt.getTime()),
      });
      await transitionTelegramDelivery(transaction, {
        deliveryId: delivery.id,
        from: "processing",
        to: "sent",
        attemptCount: attemptNumber,
        maxAttempts: delivery.maxAttempts,
        sentAt: completedAt,
        telegramMessageId: String(sent.messageId),
      });
    });

    safeEmit(input.logger, {
      event: "telegram_delivery_worker",
      deliveryId: delivery.id,
      destinationId: delivery.destinationId,
      reportType: delivery.reportType,
      outcome: "sent",
      attempt: attemptNumber,
      httpStatus: 200,
      telegramErrorCode: null,
      durationMs: Math.max(0, completedAt.getTime() - requestedAt.getTime()),
      errorCode: null,
    });
    return "sent";
  } catch (error) {
    const completedAt = input.now();

    if (isTelegramClientError(error)) {
      const metadata = errorMetadata(error);
      const canRetry = error.retryable && attemptNumber < delivery.maxAttempts;
      const nextAttemptAt = canRetry
        ? new Date(
            completedAt.getTime() +
              telegramRetryDelayMs(attemptNumber, error.retryAfterSeconds),
          )
        : undefined;

      await db.transaction(async (transaction) => {
        await completeTelegramDeliveryAttempt(transaction, {
          deliveryId: delivery.id,
          attemptNumber,
          completedAt,
          httpStatus: error.httpStatus,
          telegramOk: error.kind === "api" ? false : null,
          telegramErrorCode: error.telegramErrorCode,
          telegramErrorDescription: error.message,
          durationMs: error.durationMs,
        });
        await transitionTelegramDelivery(transaction, {
          deliveryId: delivery.id,
          from: "processing",
          to: canRetry ? "retry" : "failed",
          attemptCount: attemptNumber,
          maxAttempts: delivery.maxAttempts,
          nextAttemptAt,
          lastErrorCode: metadata.errorCode,
          lastErrorMessage: metadata.errorMessage,
        });
      });

      safeEmit(input.logger, {
        event: "telegram_delivery_worker",
        deliveryId: delivery.id,
        destinationId: delivery.destinationId,
        reportType: delivery.reportType,
        outcome: canRetry ? "retry" : "failed",
        attempt: attemptNumber,
        httpStatus: metadata.httpStatus,
        telegramErrorCode: metadata.telegramErrorCode,
        durationMs: metadata.durationMs,
        errorCode: metadata.errorCode,
      });
      return canRetry ? "retry" : "failed";
    }

    const durationMs = Math.max(0, completedAt.getTime() - requestedAt.getTime());
    await db.transaction(async (transaction) => {
      await completeTelegramDeliveryAttempt(transaction, {
        deliveryId: delivery.id,
        attemptNumber,
        completedAt,
        telegramOk: null,
        telegramErrorDescription:
          "Worker mengalami error internal yang tidak diklasifikasikan.",
        durationMs,
      });
      await transitionTelegramDelivery(transaction, {
        deliveryId: delivery.id,
        from: "processing",
        to: "failed",
        attemptCount: attemptNumber,
        maxAttempts: delivery.maxAttempts,
        lastErrorCode: "WORKER_UNEXPECTED_ERROR",
        lastErrorMessage:
          "Worker mengalami error internal yang tidak diklasifikasikan; automatic retry dinonaktifkan.",
      });
    });

    safeEmit(input.logger, {
      event: "telegram_delivery_worker",
      deliveryId: delivery.id,
      destinationId: delivery.destinationId,
      reportType: delivery.reportType,
      outcome: "failed",
      attempt: attemptNumber,
      httpStatus: null,
      telegramErrorCode: null,
      durationMs,
      errorCode: "WORKER_UNEXPECTED_ERROR",
    });
    return "failed";
  }
}

export async function runTelegramDeliveryBatch(
  options: RunTelegramDeliveryBatchOptions,
): Promise<TelegramDeliveryBatchResult> {
  const workerId = normalizeWorkerId(options.workerId);
  const batchSize = options.batchSize ?? TELEGRAM_DELIVERY_BATCH_SIZE;
  const staleProcessingMs =
    options.staleProcessingMs ?? TELEGRAM_STALE_PROCESSING_MS;
  const now = options.now ?? (() => new Date());

  if (!Number.isSafeInteger(batchSize) || batchSize <= 0 || batchSize > 100) {
    throw new Error("TELEGRAM_BATCH_SIZE_INVALID");
  }

  if (
    !Number.isSafeInteger(staleProcessingMs) ||
    staleProcessingMs < 60_000 ||
    staleProcessingMs > 24 * 60 * 60 * 1000
  ) {
    throw new Error("TELEGRAM_STALE_PROCESSING_MS_INVALID");
  }

  const recoveryNow = now();
  const recovery = await recoverStaleTelegramDeliveries({
    workerId,
    staleBefore: new Date(recoveryNow.getTime() - staleProcessingMs),
    now: recoveryNow,
    limit: Math.max(batchSize * 2, 20),
  });

  if (recovery.inspected > 0) {
    safeEmit(options.logger, {
      event: "telegram_delivery_worker",
      deliveryId: null,
      destinationId: null,
      reportType: null,
      outcome: "recovery",
      attempt: null,
      httpStatus: null,
      telegramErrorCode: null,
      durationMs: null,
      errorCode:
        recovery.ambiguousFailed > 0
          ? "AMBIGUOUS_STALE_PROCESSING"
          : "STALE_LOCK_RECOVERED",
    });
  }

  const claimed = await claimTelegramDeliveryBatch({
    workerId,
    batchSize,
    now: now(),
  });

  if (claimed.length === 0) {
    safeEmit(options.logger, {
      event: "telegram_delivery_worker",
      deliveryId: null,
      destinationId: null,
      reportType: null,
      outcome: "idle",
      attempt: null,
      httpStatus: null,
      telegramErrorCode: null,
      durationMs: null,
      errorCode: null,
    });
  }

  const result: TelegramDeliveryBatchResult = {
    claimed: claimed.length,
    sent: 0,
    retry: 0,
    failed: 0,
    released: 0,
    recovered: recovery.requeued,
    ambiguousFailed: recovery.ambiguousFailed,
  };

  for (let index = 0; index < claimed.length; index += 1) {
    const delivery = claimed[index];
    if (!delivery) continue;

    if (options.shouldStop?.()) {
      for (const remaining of claimed.slice(index)) {
        const released = await releaseClaimedTelegramDelivery({
          deliveryId: remaining.id,
          workerId,
          now: now(),
        });
        if (released) {
          result.released += 1;
          safeEmit(options.logger, {
            event: "telegram_delivery_worker",
            deliveryId: remaining.id,
            destinationId: remaining.destinationId,
            reportType: remaining.reportType,
            outcome: "released",
            attempt: null,
            httpStatus: null,
            telegramErrorCode: null,
            durationMs: null,
            errorCode: "WORKER_GRACEFUL_RELEASE",
          });
        }
      }
      break;
    }

    const outcome = await processClaimedDelivery(delivery, {
      client: options.client,
      logger: options.logger,
      now,
    });
    result[outcome] += 1;
  }

  return result;
}
