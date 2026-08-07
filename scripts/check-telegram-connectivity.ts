import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { collectServerEnvironmentIssues } from "../src/lib/env";
import { redactTelegramSecrets } from "../src/server/integrations/telegram/telegram-redaction";
import {
  assertDevelopmentTelegramApiAllowed,
  requestTelegramDevelopmentApi,
  type TelegramDevelopmentConnectivityConfig,
} from "./telegram-connectivity-support";
import { startTelegramMockServer } from "./telegram-mock-server";

const sampleToken = "123456789:abcdefghijklmnopqrstuvwx";
const redacted = redactTelegramSecrets(
  `request=https://api.telegram.org/bot${sampleToken}/getMe token=${sampleToken}`,
  sampleToken,
);
assert(!redacted.includes(sampleToken), "Bot token wajib ter-redact dari log/error.");
assert.match(redacted, /REDACTED_TELEGRAM_BOT_TOKEN/);

assert.throws(
  () => assertDevelopmentTelegramApiAllowed("https://api.telegram.org", false),
  /TELEGRAM_DEV_REAL_API_ALLOWED=true/,
  "API nyata wajib memerlukan opt-in eksplisit development.",
);
assert.doesNotThrow(() => {
  assertDevelopmentTelegramApiAllowed("http://127.0.0.1:8787", false);
});
assert.throws(
  () => assertDevelopmentTelegramApiAllowed("http://telegram.example.com", false),
  /non-loopback hanya boleh memakai API resmi/,
);
assert.throws(
  () => assertDevelopmentTelegramApiAllowed("https://telegram.example.com", true),
  /non-loopback hanya boleh memakai API resmi/,
);

const telegramProductionBase = {
  NODE_ENV: "production",
  TELEGRAM_INTEGRATION_ENABLED: "true",
  TELEGRAM_API_BASE_URL: "https://api.telegram.org",
  TELEGRAM_REQUEST_TIMEOUT_MS: "10000",
  TELEGRAM_MAX_ATTEMPTS: "5",
};
const telegramIssueNames = (source: Record<string, string>) =>
  collectServerEnvironmentIssues(source, {
    mode: "production",
    requireCore: false,
  }).map((issue) => issue.name);

assert(
  telegramIssueNames(telegramProductionBase).includes("TELEGRAM_BOT_TOKEN"),
  "Integrasi aktif tanpa TELEGRAM_BOT_TOKEN wajib ditolak.",
);
assert(
  telegramIssueNames({
    ...telegramProductionBase,
    TELEGRAM_BOT_TOKEN: "CHANGE_ME",
  }).includes("TELEGRAM_BOT_TOKEN"),
  "Placeholder TELEGRAM_BOT_TOKEN wajib ditolak saat integrasi aktif.",
);
assert(
  !telegramIssueNames({
    ...telegramProductionBase,
    TELEGRAM_BOT_TOKEN: sampleToken,
  }).includes("TELEGRAM_BOT_TOKEN"),
  "Token BotFather yang valid harus diterima oleh environment validator.",
);
assert(
  telegramIssueNames({
    ...telegramProductionBase,
    TELEGRAM_BOT_TOKEN: sampleToken,
    TELEGRAM_API_BASE_URL: "https://telegram.example.com",
  }).includes("TELEGRAM_API_BASE_URL"),
  "Production wajib menolak Telegram API origin non-official.",
);

const productionTemplate = readFileSync(".env.production.example", "utf8");
for (const [name, value] of [
  ["TELEGRAM_INTEGRATION_ENABLED", "false"],
  ["TELEGRAM_BOT_TOKEN", "CHANGE_ME"],
  ["TELEGRAM_API_BASE_URL", "https://api.telegram.org"],
  ["TELEGRAM_REQUEST_TIMEOUT_MS", "10000"],
  ["TELEGRAM_MAX_ATTEMPTS", "5"],
] as const) {
  assert.match(
    productionTemplate,
    new RegExp(`^${name}=${value.replaceAll(".", "\\.")}$`, "m"),
    `.env.production.example wajib mendokumentasikan ${name}=${value}.`,
  );
}

for (const filePath of ["Dockerfile", "compose.production.yaml"]) {
  assert(
    !readFileSync(filePath, "utf8").includes("TELEGRAM_BOT_TOKEN"),
    `${filePath} tidak boleh menanam TELEGRAM_BOT_TOKEN.`,
  );
}

const { server, origin } = await startTelegramMockServer({
  port: 0,
  scenario: "success",
  silent: true,
});

try {
  const config: TelegramDevelopmentConnectivityConfig = {
    apiBaseUrl: origin,
    botToken: "local-mock-token",
    timeoutMs: 1_000,
    chatId: "-1001234567890",
  };

  const identity = await requestTelegramDevelopmentApi<{
    id: number;
    username: string;
  }>({
    config,
    method: "getMe",
  });
  assert.equal(identity.ok, true);
  assert.equal(identity.result?.username, "asihjaya_dev_mock_bot");

  const updates = await requestTelegramDevelopmentApi<
    Array<{ message?: { chat?: { id?: number } } }>
  >({
    config,
    method: "getUpdates",
    payload: { limit: 100, timeout: 0 },
  });
  assert.equal(updates.ok, true);
  assert.equal(updates.result?.[0]?.message?.chat?.id, -1001234567890);

  const message = await requestTelegramDevelopmentApi<{
    message_id: number;
  }>({
    config,
    method: "sendMessage",
    payload: {
      chat_id: config.chatId,
      text: "ASIHJAYA 2C.1 connectivity check",
    },
  });
  assert.equal(message.ok, true);
  assert.equal(message.result?.message_id, 1001);
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

console.log(
  "Telegram 2C.1 connectivity checks passed: env contract, secret redaction, real-API guard, mocked getMe/getUpdates, dan mocked sendMessage.",
);
