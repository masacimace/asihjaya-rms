import { config as loadDotenv } from "dotenv";

import { getTelegramDeliveryWorkerRuntimeConfig } from "@/server/integrations/telegram/telegram-runtime-config";

loadDotenv({ path: ".env", quiet: true });

let stopRequested = false;

function requestStop(signal: NodeJS.Signals) {
  stopRequested = true;
  console.log(
    JSON.stringify({
      event: "telegram_delivery_worker_signal",
      signal,
      action: "finish_current_and_release_unstarted",
    }),
  );
}

process.once("SIGINT", () => requestStop("SIGINT"));
process.once("SIGTERM", () => requestStop("SIGTERM"));

const config = getTelegramDeliveryWorkerRuntimeConfig();

if (!config.enabled) {
  console.log(
    JSON.stringify({
      event: "telegram_delivery_worker",
      outcome: "disabled",
    }),
  );
  process.exitCode = 0;
} else {
  const [{ TelegramClient }, { pool }, { runTelegramDeliveryBatch }] =
    await Promise.all([
      import("@/server/integrations/telegram/telegram-client"),
      import("@/db"),
      import("@/server/integrations/telegram/telegram-delivery-worker"),
    ]);

  const client = new TelegramClient({
    apiBaseUrl: config.apiBaseUrl,
    botToken: config.botToken,
    timeoutMs: config.requestTimeoutMs,
  });

  try {
    const result = await runTelegramDeliveryBatch({
      client,
      shouldStop: () => stopRequested,
      logger: (entry) => console.log(JSON.stringify(entry)),
    });

    console.log(
      JSON.stringify({
        event: "telegram_delivery_worker_summary",
        ...result,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "telegram_delivery_worker_fatal",
        errorCode: "WORKER_FATAL",
        message:
          error instanceof Error
            ? error.message.replace(/\d{5,20}:[A-Za-z0-9_-]{20,}/g, "[REDACTED_TELEGRAM_TOKEN]")
            : "Unknown worker failure",
      }),
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
