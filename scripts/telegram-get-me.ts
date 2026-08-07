import { redactTelegramSecrets } from "../src/server/integrations/telegram/telegram-redaction";
import {
  formatTelegramDevelopmentFailure,
  loadTelegramDevelopmentConnectivityConfig,
  requestTelegramDevelopmentApi,
} from "./telegram-connectivity-support";

type TelegramBotIdentity = {
  id?: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
};

async function main() {
  const config = loadTelegramDevelopmentConnectivityConfig();
  const response = await requestTelegramDevelopmentApi<TelegramBotIdentity>({
    config,
    method: "getMe",
  });

  if (!response.ok || !response.result) {
    throw new Error(formatTelegramDevelopmentFailure("getMe", response));
  }

  const username = response.result.username
    ? `@${response.result.username}`
    : response.result.first_name || "bot tanpa username";
  const id = response.result.id ?? "unknown";

  console.log(`Telegram getMe OK: ${username} (id=${id}).`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    redactTelegramSecrets(message, process.env.TELEGRAM_BOT_TOKEN),
  );
  process.exitCode = 1;
});
