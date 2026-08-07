import assert from "node:assert/strict";

import { TelegramClient } from "../src/server/integrations/telegram/telegram-client";
import {
  isTelegramClientError,
  isTelegramRetryableStatus,
  type TelegramClientError,
} from "../src/server/integrations/telegram/telegram-errors";
import type { TelegramClientLogEntry } from "../src/server/integrations/telegram/telegram-types";
import {
  startTelegramMockServer,
  type TelegramMockScenario,
} from "./telegram-mock-server";

const SAMPLE_TOKEN = "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
const CHAT_ID = "-1001234567890";

async function closeServer(server: Awaited<ReturnType<typeof startTelegramMockServer>>["server"]) {
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function withMock<T>(
  scenario: TelegramMockScenario,
  run: (client: TelegramClient, logs: TelegramClientLogEntry[]) => Promise<T>,
  timeoutMs = 250,
): Promise<T> {
  const { server, origin } = await startTelegramMockServer({
    port: 0,
    scenario,
    silent: true,
  });
  const logs: TelegramClientLogEntry[] = [];
  const client = new TelegramClient({
    apiBaseUrl: origin,
    botToken: SAMPLE_TOKEN,
    timeoutMs,
    logger: (entry) => logs.push(entry),
  });

  try {
    return await run(client, logs);
  } finally {
    await closeServer(server);
  }
}

async function expectTelegramError(
  action: () => Promise<unknown>,
): Promise<TelegramClientError> {
  try {
    await action();
  } catch (error) {
    assert.equal(
      isTelegramClientError(error),
      true,
      "Failure Telegram wajib menghasilkan TelegramClientError typed.",
    );
    return error as TelegramClientError;
  }
  assert.fail("Expected TelegramClientError, tetapi request berhasil.");
}

await withMock("success", async (client, logs) => {
  const identity = await client.getMe();
  assert.deepEqual(identity, {
    id: 999000111,
    isBot: true,
    firstName: "ASIHJAYA Development Mock",
    username: "asihjaya_dev_mock_bot",
  });

  const message = await client.sendMessage({
    chatId: CHAT_ID,
    text: "ASIHJAYA Telegram client 2C.2",
  });
  assert.equal(message.messageId, 1001);
  assert.equal(message.chatId, CHAT_ID);
  assert.equal(logs.length, 2);
  assert(logs.every((entry) => entry.outcome === "success"));
  assert.equal(JSON.stringify(logs).includes("ASIHJAYA Telegram client 2C.2"), false);
  assert.equal(JSON.stringify(logs).includes(CHAT_ID), false);
});

await withMock("unauthorized", async (client, logs) => {
  const error = await expectTelegramError(() => client.getMe());
  assert.equal(error.kind, "api");
  assert.equal(error.httpStatus, 401);
  assert.equal(error.telegramErrorCode, 401);
  assert.equal(error.retryable, false);
  assert.equal(logs.at(-1)?.retryable, false);
});

await withMock("forbidden", async (client) => {
  const error = await expectTelegramError(() =>
    client.sendMessage({ chatId: CHAT_ID, text: "forbidden" }),
  );
  assert.equal(error.httpStatus, 403);
  assert.equal(error.telegramErrorCode, 403);
  assert.equal(error.retryable, false);
});

await withMock("invalid_chat", async (client) => {
  const error = await expectTelegramError(() =>
    client.sendMessage({ chatId: CHAT_ID, text: "invalid chat" }),
  );
  assert.equal(error.httpStatus, 400);
  assert.equal(error.telegramErrorCode, 400);
  assert.equal(error.retryable, false);
});

await withMock("rate_limited", async (client, logs) => {
  const error = await expectTelegramError(() =>
    client.sendMessage({ chatId: CHAT_ID, text: "rate limited" }),
  );
  assert.equal(error.httpStatus, 429);
  assert.equal(error.telegramErrorCode, 429);
  assert.equal(error.retryable, true);
  assert.equal(error.retryAfterSeconds, 2);
  assert.equal(logs.at(-1)?.retryAfterSeconds, 2);
});

await withMock("server_error", async (client) => {
  const error = await expectTelegramError(() => client.getMe());
  assert.equal(error.httpStatus, 500);
  assert.equal(error.telegramErrorCode, 500);
  assert.equal(error.retryable, true);
});

await withMock("malformed", async (client) => {
  const error = await expectTelegramError(() => client.getMe());
  assert.equal(error.kind, "invalid_response");
  assert.equal(error.httpStatus, 200);
  assert.equal(error.retryable, true);
});

await withMock(
  "timeout",
  async (client, logs) => {
    const error = await expectTelegramError(() => client.getMe());
    assert.equal(error.kind, "timeout");
    assert.equal(error.retryable, true);
    assert.match(error.message, /timeout/i);
    assert.equal(logs.at(-1)?.errorKind, "timeout");
  },
  50,
);

const networkLogs: TelegramClientLogEntry[] = [];
const networkClient = new TelegramClient({
  apiBaseUrl: "http://127.0.0.1:1",
  botToken: SAMPLE_TOKEN,
  timeoutMs: 100,
  logger: (entry) => networkLogs.push(entry),
});
const networkError = await expectTelegramError(() => networkClient.getMe());
assert.equal(networkError.kind, "network");
assert.equal(networkError.retryable, true);
assert.equal(networkError.message.includes(SAMPLE_TOKEN), false);
assert.equal(JSON.stringify(networkLogs).includes(SAMPLE_TOKEN), false);

assert.equal(isTelegramRetryableStatus(429, 429), true);
assert.equal(isTelegramRetryableStatus(500, 500), true);
assert.equal(isTelegramRetryableStatus(503, null), true);
assert.equal(isTelegramRetryableStatus(408, null), true);
assert.equal(isTelegramRetryableStatus(400, 400), false);
assert.equal(isTelegramRetryableStatus(401, 401), false);
assert.equal(isTelegramRetryableStatus(403, 403), false);

assert.throws(
  () =>
    new TelegramClient({
      apiBaseUrl: "https://api.telegram.org/path",
      botToken: SAMPLE_TOKEN,
      timeoutMs: 1000,
    }),
  /origin HTTP\(S\)/,
);
assert.throws(
  () =>
    new TelegramClient({
      apiBaseUrl: "https://api.telegram.org",
      botToken: "",
      timeoutMs: 1000,
    }),
  /botToken wajib/,
);

const validationClient = new TelegramClient({
  apiBaseUrl: "https://api.telegram.org",
  botToken: SAMPLE_TOKEN,
  timeoutMs: 1000,
});
await assert.rejects(
  () => validationClient.sendMessage({ chatId: "", text: "test" }),
  /chatId wajib/,
);
await assert.rejects(
  () => validationClient.sendMessage({ chatId: CHAT_ID, text: "   " }),
  /text tidak boleh kosong/,
);
await assert.rejects(
  () =>
    validationClient.sendMessage({
      chatId: CHAT_ID,
      text: "x".repeat(4097),
    }),
  /maksimal 4096/,
);

console.log(
  "Telegram 2C.2 client checks passed: typed getMe/sendMessage, timeout, network failure, 400/401/403, 429 retry_after, 5xx retry, malformed response, retry classification, validation, dan redacted structured logs.",
);
