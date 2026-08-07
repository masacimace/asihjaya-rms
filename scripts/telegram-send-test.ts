import { redactTelegramSecrets } from "../src/server/integrations/telegram/telegram-redaction";
import {
  formatTelegramDevelopmentFailure,
  loadTelegramDevelopmentConnectivityConfig,
  requestTelegramDevelopmentApi,
} from "./telegram-connectivity-support";

type TelegramSentMessage = {
  message_id?: number;
};

async function main() {
  const config = loadTelegramDevelopmentConnectivityConfig({ requireChatId: true });
  const response = await requestTelegramDevelopmentApi<TelegramSentMessage>({
    config,
    method: "sendMessage",
    payload: {
      chat_id: config.chatId,
      text: [
        "ASIHJAYA RMS Telegram Integration",
        "",
        "Test message development berhasil.",
        "Source: local-first connectivity stage 2C.1",
      ].join("\n"),
    },
  });

  if (!response.ok || !response.result) {
    throw new Error(formatTelegramDevelopmentFailure("sendMessage", response));
  }

  console.log(
    `Telegram test message OK (message_id=${response.result.message_id ?? "unknown"}).`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    redactTelegramSecrets(message, process.env.TELEGRAM_BOT_TOKEN),
  );
  process.exitCode = 1;
});
