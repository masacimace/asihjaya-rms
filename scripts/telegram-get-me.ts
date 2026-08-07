import { TelegramClient } from "../src/server/integrations/telegram/telegram-client";
import { redactTelegramSecrets } from "../src/server/integrations/telegram/telegram-redaction";
import { loadTelegramDevelopmentConnectivityConfig } from "./telegram-connectivity-support";

async function main() {
  const config = loadTelegramDevelopmentConnectivityConfig();
  const client = new TelegramClient({
    apiBaseUrl: config.apiBaseUrl,
    botToken: config.botToken,
    timeoutMs: config.timeoutMs,
  });
  const identity = await client.getMe();

  const username = identity.username
    ? `@${identity.username}`
    : identity.firstName || "bot tanpa username";

  console.log(`Telegram getMe OK: ${username} (id=${identity.id}).`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redactTelegramSecrets(message, process.env.TELEGRAM_BOT_TOKEN));
  process.exitCode = 1;
});
