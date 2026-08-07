import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  TELEGRAM_DELIVERY_BATCH_SIZE,
  TELEGRAM_STALE_PROCESSING_MS,
  telegramRetryDelayMs,
} from "@/server/integrations/telegram/telegram-delivery-policy";
import { getTelegramDeliveryWorkerRuntimeConfig } from "@/server/integrations/telegram/telegram-runtime-config";

const root = process.cwd();
const workerSource = readFileSync(
  path.join(
    root,
    "src/server/integrations/telegram/telegram-delivery-worker.ts",
  ),
  "utf8",
);
const repositorySource = readFileSync(
  path.join(
    root,
    "src/server/integrations/telegram/telegram-outbox-repository.ts",
  ),
  "utf8",
);
const runnerSource = readFileSync(
  path.join(root, "scripts/run-telegram-delivery.ts"),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
) as { scripts?: Record<string, string> };

assert.equal(TELEGRAM_DELIVERY_BATCH_SIZE, 20);
assert.equal(TELEGRAM_STALE_PROCESSING_MS, 30 * 60 * 1000);
assert.equal(telegramRetryDelayMs(1), 60 * 1000);
assert.equal(telegramRetryDelayMs(2), 5 * 60 * 1000);
assert.equal(telegramRetryDelayMs(3), 15 * 60 * 1000);
assert.equal(telegramRetryDelayMs(4), 60 * 60 * 1000);
assert.equal(telegramRetryDelayMs(5), 60 * 60 * 1000);
assert.equal(telegramRetryDelayMs(1, 2), 60 * 1000);
assert.equal(telegramRetryDelayMs(1, 120), 120 * 1000);
assert.throws(() => telegramRetryDelayMs(0), /TELEGRAM_RETRY_ATTEMPT_INVALID/);

assert.ok(
  repositorySource.includes('.for("update", { skipLocked: true })'),
  "Worker wajib memakai FOR UPDATE SKIP LOCKED.",
);
assert.ok(
  repositorySource.includes("AMBIGUOUS_STALE_PROCESSING"),
  "Stale attempt ambiguous wajib gagal tanpa automatic retry.",
);
assert.ok(
  repositorySource.includes("STALE_LOCK_RECOVERED"),
  "Stale lock sebelum attempt wajib dapat direqueue.",
);
assert.ok(
  workerSource.indexOf("await beginTelegramDeliveryAttempt") <
    workerSource.indexOf("input.client.sendMessage"),
  "Attempt audit harus dimulai sebelum HTTP dispatch.",
);
assert.ok(
  workerSource.includes("attemptNumber < delivery.maxAttempts"),
  "Retry wajib berhenti saat max attempts tercapai.",
);
assert.ok(
  workerSource.includes("error.retryAfterSeconds"),
  "Worker wajib menghormati Telegram retry_after.",
);
assert.ok(
  workerSource.includes('lastErrorCode: "WORKER_UNEXPECTED_ERROR"'),
  "Unexpected worker error wajib menjadi failed non-retryable.",
);
const workerLogType = workerSource.slice(
  workerSource.indexOf("export type TelegramDeliveryWorkerLogEntry"),
  workerSource.indexOf("export type TelegramDeliveryWorkerLogger"),
);
assert.equal(
  workerLogType.includes("messageText"),
  false,
  "Structured worker log tidak boleh mempunyai field messageText.",
);
assert.equal(
  workerLogType.includes("chatId"),
  false,
  "Structured worker log tidak boleh mempunyai field chatId.",
);
assert.ok(
  runnerSource.includes('process.once("SIGTERM"'),
  "Runner wajib menangani SIGTERM.",
);
assert.ok(
  runnerSource.includes("finish_current_and_release_unstarted"),
  "Runner wajib mendokumentasikan graceful release.",
);
assert.equal(
  packageJson.scripts?.["telegram:deliver"],
  "tsx scripts/run-telegram-delivery.ts",
);
assert.equal(
  packageJson.scripts?.["check:telegram-worker"],
  "tsx scripts/check-telegram-worker.ts",
);
assert.equal(
  packageJson.scripts?.["test:telegram-worker:local"],
  "tsx scripts/run-telegram-worker-local.ts",
);

const disabled = getTelegramDeliveryWorkerRuntimeConfig({
  TELEGRAM_INTEGRATION_ENABLED: "false",
  TELEGRAM_API_BASE_URL: "http://127.0.0.1:8787",
});
assert.equal(disabled.enabled, false);
assert.equal(disabled.requestTimeoutMs, 10_000);

const enabled = getTelegramDeliveryWorkerRuntimeConfig({
  TELEGRAM_INTEGRATION_ENABLED: "true",
  TELEGRAM_BOT_TOKEN: ["123456789", "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi"].join(":"),
  TELEGRAM_API_BASE_URL: "http://127.0.0.1:8787",
  TELEGRAM_REQUEST_TIMEOUT_MS: "1500",
});
assert.equal(enabled.enabled, true);
assert.equal(enabled.apiBaseUrl, "http://127.0.0.1:8787");
assert.equal(enabled.requestTimeoutMs, 1500);
assert.throws(
  () =>
    getTelegramDeliveryWorkerRuntimeConfig({
      TELEGRAM_INTEGRATION_ENABLED: "true",
      TELEGRAM_API_BASE_URL: "http://127.0.0.1:8787",
    }),
  /TELEGRAM_BOT_TOKEN_REQUIRED/,
);
assert.throws(
  () =>
    getTelegramDeliveryWorkerRuntimeConfig({
      TELEGRAM_INTEGRATION_ENABLED: "false",
      TELEGRAM_API_BASE_URL: "http://example.com",
    }),
  /TELEGRAM_API_BASE_URL_INSECURE/,
);

console.log(
  "Telegram 2C.6 worker contract checks passed: batch, SKIP LOCKED, retry backoff, retry_after, max attempts, stale ambiguity, graceful stop, runtime guard, dan redacted log contract.",
);


async function checkDatabaseWorker() {
  assert.ok(process.env.DATABASE_URL?.trim(), "DATABASE_URL wajib untuk --database.");

  const [
    { Client },
    { TelegramClient },
    { TelegramClientError },
    { runTelegramDeliveryBatch },
    { startTelegramMockServer },
  ] = await Promise.all([
    import("pg"),
    import("@/server/integrations/telegram/telegram-client"),
    import("@/server/integrations/telegram/telegram-errors"),
    import("@/server/integrations/telegram/telegram-delivery-worker"),
    import("./telegram-mock-server"),
  ]);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const organizationId = randomUUID();
  const outletId = randomUUID();
  const userId = randomUUID();
  const destinationId = randomUUID();
  const token = ["123456789", "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi"].join(":");

  async function insertDelivery(input: {
    eventKey: string;
    status?: "pending" | "processing" | "retry";
    attemptCount?: number;
    maxAttempts?: number;
    lockedAt?: Date | null;
    lockedBy?: string | null;
  }) {
    const result = await client.query<{ id: string }>(
      `insert into telegram_delivery_outbox
        (organization_id, event_key, destination_id, outlet_id, report_type,
         business_date, payload_snapshot_json, message_text, status, attempt_count,
         max_attempts, next_attempt_at, locked_at, locked_by)
       values ($1, $2, $3, $4, 'opening', '2026-08-07', '{}'::jsonb,
         'Worker integration test', $5, $6, $7, now() - interval '1 second', $8, $9)
       returning id`,
      [
        organizationId,
        input.eventKey,
        destinationId,
        outletId,
        input.status ?? "pending",
        input.attemptCount ?? 0,
        input.maxAttempts ?? 5,
        input.lockedAt ?? null,
        input.lockedBy ?? null,
      ],
    );
    assert.ok(result.rows[0]?.id);
    return result.rows[0].id;
  }

  async function deliveryRow(id: string) {
    const result = await client.query<{
      status: string;
      attempt_count: number;
      next_attempt_at: Date;
      telegram_message_id: string | null;
      last_error_code: string | null;
      locked_at: Date | null;
      locked_by: string | null;
    }>(
      `select status, attempt_count, next_attempt_at, telegram_message_id,
              last_error_code, locked_at, locked_by
       from telegram_delivery_outbox where id = $1`,
      [id],
    );
    assert.ok(result.rows[0]);
    return result.rows[0];
  }

  async function attemptRows(id: string) {
    const result = await client.query<{
      attempt_number: number;
      completed_at: Date | null;
      http_status: number | null;
      telegram_ok: boolean | null;
      telegram_error_code: number | null;
      telegram_error_description: string | null;
    }>(
      `select attempt_number, completed_at, http_status, telegram_ok,
              telegram_error_code, telegram_error_description
       from telegram_delivery_attempts
       where delivery_id = $1 order by attempt_number`,
      [id],
    );
    return result.rows;
  }

  async function withMock<T>(
    scenario: "success" | "forbidden" | "rate_limited" | "server_error",
    callback: (telegramClient: InstanceType<typeof TelegramClient>) => Promise<T>,
  ) {
    const mock = await startTelegramMockServer({
      port: 0,
      scenario,
      silent: true,
    });
    try {
      const telegramClient = new TelegramClient({
        apiBaseUrl: mock.origin,
        botToken: token,
        timeoutMs: 500,
      });
      return await callback(telegramClient);
    } finally {
      await new Promise<void>((resolve, reject) => {
        mock.server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }

  try {
    await client.query(
      `insert into organizations (id, name, slug)
       values ($1, 'Telegram Worker Org', $2)`,
      [organizationId, `telegram-worker-${organizationId.slice(0, 8)}`],
    );
    await client.query(
      `insert into outlets (id, organization_id, code, name)
       values ($1, $2, 'TGW', 'Telegram Worker Outlet')`,
      [outletId, organizationId],
    );
    await client.query(
      `insert into users (id, organization_id, email, username, full_name)
       values ($1, $2, $3, $4, 'Telegram Worker Tester')`,
      [
        userId,
        organizationId,
        `telegram-worker-${userId.slice(0, 8)}@example.test`,
        `telegram_worker_${userId.slice(0, 8)}`,
      ],
    );
    await client.query(
      `insert into telegram_destinations
        (id, organization_id, outlet_id, name, chat_id, created_by, updated_by)
       values ($1, $2, $3, 'Worker Development Group', '-1001234567890', $4, $4)`,
      [destinationId, organizationId, outletId, userId],
    );
    await client.query(
      `insert into telegram_report_settings
        (destination_id, opening_enabled, closing_daily_enabled)
       values ($1, true, true)`,
      [destinationId],
    );

    const successId = await insertDelivery({ eventKey: "worker:success" });
    await withMock("success", async (telegramClient) => {
      const result = await runTelegramDeliveryBatch({
        client: telegramClient,
        workerId: "worker-success",
      });
      assert.equal(result.sent, 1);
    });
    const success = await deliveryRow(successId);
    assert.equal(success.status, "sent");
    assert.equal(success.attempt_count, 1);
    assert.equal(success.telegram_message_id, "1001");
    const successAttempts = await attemptRows(successId);
    assert.equal(successAttempts.length, 1);
    assert.equal(successAttempts[0]?.http_status, 200);
    assert.equal(successAttempts[0]?.telegram_ok, true);
    assert.ok(successAttempts[0]?.completed_at);

    const rateLimitId = await insertDelivery({ eventKey: "worker:rate-limit" });
    const rateStartedAt = Date.now();
    await withMock("rate_limited", async (telegramClient) => {
      const result = await runTelegramDeliveryBatch({
        client: telegramClient,
        workerId: "worker-rate-limit",
      });
      assert.equal(result.retry, 1);
    });
    const rateLimited = await deliveryRow(rateLimitId);
    assert.equal(rateLimited.status, "retry");
    assert.equal(rateLimited.attempt_count, 1);
    assert.ok(
      rateLimited.next_attempt_at.getTime() >= rateStartedAt + 55_000,
      "429 wajib dijadwalkan dengan backoff minimal sekitar 1 menit.",
    );
    const rateAttempts = await attemptRows(rateLimitId);
    assert.equal(rateAttempts[0]?.http_status, 429);
    assert.equal(rateAttempts[0]?.telegram_error_code, 429);

    const timeoutId = await insertDelivery({ eventKey: "worker:timeout" });
    const timeoutResult = await runTelegramDeliveryBatch({
      client: {
        async sendMessage() {
          throw new TelegramClientError({
            kind: "timeout",
            method: "sendMessage",
            message: "Telegram sendMessage timeout setelah 500 ms.",
            httpStatus: null,
            telegramErrorCode: null,
            retryAfterSeconds: null,
            retryable: true,
            durationMs: 500,
          });
        },
      },
      workerId: "worker-timeout",
    });
    assert.equal(timeoutResult.retry, 1);
    const timeoutRow = await deliveryRow(timeoutId);
    assert.equal(timeoutRow.status, "retry");
    assert.equal(timeoutRow.attempt_count, 1);
    const timeoutAttempts = await attemptRows(timeoutId);
    assert.equal(timeoutAttempts[0]?.http_status, null);
    assert.equal(timeoutAttempts[0]?.telegram_ok, null);

    const serverErrorId = await insertDelivery({ eventKey: "worker:500" });
    await withMock("server_error", async (telegramClient) => {
      const result = await runTelegramDeliveryBatch({
        client: telegramClient,
        workerId: "worker-500",
      });
      assert.equal(result.retry, 1);
    });
    assert.equal((await deliveryRow(serverErrorId)).status, "retry");

    const forbiddenId = await insertDelivery({ eventKey: "worker:403" });
    await withMock("forbidden", async (telegramClient) => {
      const result = await runTelegramDeliveryBatch({
        client: telegramClient,
        workerId: "worker-403",
      });
      assert.equal(result.failed, 1);
    });
    const forbidden = await deliveryRow(forbiddenId);
    assert.equal(forbidden.status, "failed");
    assert.equal(forbidden.last_error_code, "TELEGRAM_403");

    const maxId = await insertDelivery({
      eventKey: "worker:max-attempt",
      status: "retry",
      attemptCount: 4,
      maxAttempts: 5,
    });
    await withMock("server_error", async (telegramClient) => {
      const result = await runTelegramDeliveryBatch({
        client: telegramClient,
        workerId: "worker-max",
      });
      assert.equal(result.failed, 1);
    });
    const maxRow = await deliveryRow(maxId);
    assert.equal(maxRow.status, "failed");
    assert.equal(maxRow.attempt_count, 5);

    const staleSafeId = await insertDelivery({
      eventKey: "worker:stale-safe",
      status: "processing",
      lockedAt: new Date(Date.now() - 60 * 60 * 1000),
      lockedBy: "dead-worker",
    });
    await withMock("success", async (telegramClient) => {
      const result = await runTelegramDeliveryBatch({
        client: telegramClient,
        workerId: "worker-recovery-safe",
      });
      assert.equal(result.recovered, 1);
      assert.equal(result.sent, 1);
    });
    assert.equal((await deliveryRow(staleSafeId)).status, "sent");

    const staleAmbiguousId = await insertDelivery({
      eventKey: "worker:stale-ambiguous",
      status: "processing",
      lockedAt: new Date(Date.now() - 60 * 60 * 1000),
      lockedBy: "dead-worker",
    });
    await client.query(
      `insert into telegram_delivery_attempts
        (delivery_id, attempt_number, requested_at)
       values ($1, 1, now() - interval '30 minutes')`,
      [staleAmbiguousId],
    );
    await withMock("success", async (telegramClient) => {
      const result = await runTelegramDeliveryBatch({
        client: telegramClient,
        workerId: "worker-recovery-ambiguous",
      });
      assert.equal(result.ambiguousFailed, 1);
      assert.equal(result.sent, 0);
    });
    const ambiguous = await deliveryRow(staleAmbiguousId);
    assert.equal(ambiguous.status, "failed");
    assert.equal(ambiguous.last_error_code, "AMBIGUOUS_STALE_PROCESSING");
    assert.equal(ambiguous.attempt_count, 1);
    assert.ok((await attemptRows(staleAmbiguousId))[0]?.completed_at);

    const gracefulIds = await Promise.all([
      insertDelivery({ eventKey: "worker:graceful:1" }),
      insertDelivery({ eventKey: "worker:graceful:2" }),
    ]);
    await withMock("success", async (telegramClient) => {
      const result = await runTelegramDeliveryBatch({
        client: telegramClient,
        workerId: "worker-graceful",
        shouldStop: () => true,
      });
      assert.equal(result.claimed, 2);
      assert.equal(result.released, 2);
      assert.equal(result.sent, 0);
    });
    for (const id of gracefulIds) {
      const row = await deliveryRow(id);
      assert.equal(row.status, "retry");
      assert.equal(row.locked_at, null);
      assert.equal(row.locked_by, null);
      assert.equal((await attemptRows(id)).length, 0);
    }
    await client.query(
      `update telegram_delivery_outbox
       set next_attempt_at = now() + interval '1 day'
       where id = any($1::uuid[])`,
      [gracefulIds],
    );

    const concurrencyIds = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        insertDelivery({ eventKey: `worker:concurrency:${index + 1}` }),
      ),
    );
    await withMock("success", async (telegramClient) => {
      const [left, right] = await Promise.all([
        runTelegramDeliveryBatch({
          client: telegramClient,
          workerId: "worker-concurrent-a",
          batchSize: 3,
        }),
        runTelegramDeliveryBatch({
          client: telegramClient,
          workerId: "worker-concurrent-b",
          batchSize: 3,
        }),
      ]);
      assert.equal(left.sent + right.sent, 6);
    });
    const concurrency = await client.query<{ status: string; count: string }>(
      `select status, count(*)::text as count
       from telegram_delivery_outbox
       where id = any($1::uuid[])
       group by status`,
      [concurrencyIds],
    );
    assert.deepEqual(concurrency.rows, [{ status: "sent", count: "6" }]);
    const concurrencyAttempts = await client.query<{ count: string }>(
      `select count(*)::text as count
       from telegram_delivery_attempts
       where delivery_id = any($1::uuid[])`,
      [concurrencyIds],
    );
    assert.equal(concurrencyAttempts.rows[0]?.count, "6");

    const unexpectedId = await insertDelivery({ eventKey: "worker:unexpected" });
    const result = await runTelegramDeliveryBatch({
      client: {
        async sendMessage() {
          throw new Error("simulated internal client bug");
        },
      },
      workerId: "worker-unexpected",
    });
    assert.equal(result.failed, 1);
    const unexpected = await deliveryRow(unexpectedId);
    assert.equal(unexpected.status, "failed");
    assert.equal(unexpected.last_error_code, "WORKER_UNEXPECTED_ERROR");
  } finally {
    await client.end();
    const { pool } = await import("@/db");
    await pool.end();
  }
}

if (process.argv.includes("--database")) {
  await checkDatabaseWorker();
  console.log(
    "Telegram 2C.6 worker database checks passed: success, timeout/429/5xx retry, 403 failed, max attempts, stale recovery, ambiguous dispatch safety, graceful release, attempt audit, dan concurrent SKIP LOCKED.",
  );
}
