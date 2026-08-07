import { TelegramClient } from "../src/server/integrations/telegram/telegram-client";
import { redactTelegramSecrets } from "../src/server/integrations/telegram/telegram-redaction";
import { loadTelegramDevelopmentConnectivityConfig } from "./telegram-connectivity-support";

async function main() {
  const config = loadTelegramDevelopmentConnectivityConfig({ requireChatId: true });
  const client = new TelegramClient({
    apiBaseUrl: config.apiBaseUrl,
    botToken: config.botToken,
    timeoutMs: config.timeoutMs,
  });
  const message = await client.sendMessage({
    chatId: config.chatId!,
    text: [
      "ASIHJAYA RMS Telegram Integration",
      "",
      "Test message development berhasil.",
      "Source: typed Telegram client stage 2C.2",
    ].join("\n"),
  });

  console.log(`Telegram test message OK (message_id=${message.messageId}).`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(redactTelegramSecrets(message, process.env.TELEGRAM_BOT_TOKEN));
  process.exitCode = 1;
});
