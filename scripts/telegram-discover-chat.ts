import { redactTelegramSecrets } from "../src/server/integrations/telegram/telegram-redaction";
import {
  formatTelegramDevelopmentFailure,
  loadTelegramDevelopmentConnectivityConfig,
  requestTelegramDevelopmentApi,
} from "./telegram-connectivity-support";

type TelegramDevelopmentChat = {
  id?: number;
  type?: string;
  title?: string;
  username?: string;
};

type TelegramDevelopmentUpdate = {
  message?: { chat?: TelegramDevelopmentChat };
  edited_message?: { chat?: TelegramDevelopmentChat };
  channel_post?: { chat?: TelegramDevelopmentChat };
  my_chat_member?: { chat?: TelegramDevelopmentChat };
};

function updateChat(update: TelegramDevelopmentUpdate) {
  return (
    update.message?.chat ??
    update.edited_message?.chat ??
    update.channel_post?.chat ??
    update.my_chat_member?.chat ??
    null
  );
}

async function main() {
  const config = loadTelegramDevelopmentConnectivityConfig();
  const response = await requestTelegramDevelopmentApi<
    TelegramDevelopmentUpdate[]
  >({
    config,
    method: "getUpdates",
    payload: {
      limit: 100,
      timeout: 0,
      allowed_updates: [
        "message",
        "edited_message",
        "channel_post",
        "my_chat_member",
      ],
    },
  });

  if (!response.ok || !response.result) {
    throw new Error(formatTelegramDevelopmentFailure("getUpdates", response));
  }

  const chats = new Map<number, TelegramDevelopmentChat>();
  for (const update of response.result) {
    const chat = updateChat(update);
    if (typeof chat?.id === "number") {
      chats.set(chat.id, chat);
    }
  }

  if (chats.size === 0) {
    console.log(
      "Belum ada chat development yang terlihat. Tambahkan bot development ke private group development, kirim satu pesan/trigger update, lalu jalankan command ini lagi.",
    );
    return;
  }

  console.log("Telegram development chats yang terlihat oleh bot:");
  for (const chat of chats.values()) {
    const label = chat.title || (chat.username ? `@${chat.username}` : chat.type) || "chat";
    console.log(`- ${label}: ${chat.id}`);
  }
  console.log("Salin chat ID private group development ke TELEGRAM_DEV_CHAT_ID pada .env lokal.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    redactTelegramSecrets(message, process.env.TELEGRAM_BOT_TOKEN),
  );
  process.exitCode = 1;
});
