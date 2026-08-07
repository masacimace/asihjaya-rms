import { config as loadDotenv } from "dotenv";

import { getTelegramRuntimeOutboxConfig } from "@/server/integrations/telegram/telegram-runtime-config";

loadDotenv({ path: ".env", quiet: true });

const config = getTelegramRuntimeOutboxConfig();

if (!config.enabled) {
  console.log(
    JSON.stringify({
      event: "telegram_report_reconciliation",
      outcome: "disabled",
    }),
  );
  process.exitCode = 0;
} else {
  const [{ pool }, { reconcileTelegramReports }] = await Promise.all([
    import("@/db"),
    import("@/server/integrations/telegram/telegram-report-reconciliation"),
  ]);

  try {
    const result = await reconcileTelegramReports({
      maxAttempts: config.maxAttempts,
    });
    console.log(
      JSON.stringify({
        event: "telegram_report_reconciliation",
        outcome: "success",
        ...result,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "telegram_report_reconciliation",
        outcome: "failed",
        errorCode: "RECONCILIATION_FATAL",
        message:
          error instanceof Error
            ? error.message.replace(
                /\d{5,20}:[A-Za-z0-9_-]{20,}/g,
                "[REDACTED_TELEGRAM_TOKEN]",
              )
            : "Unknown reconciliation failure",
      }),
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
