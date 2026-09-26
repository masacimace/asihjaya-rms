import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (relativePath: string) =>
  readFileSync(resolve(relativePath), "utf8");

const schema = read("src/db/schema/index.ts");
const settingsAction = read("src/app/actions/telegram-settings.ts");
const settingsPage = read(
  "src/app/(admin)/admin/pengaturan/integrasi/telegram/page.tsx",
);
const adminQueries = read("src/features/telegram/admin-queries.ts");
const outbox = read(
  "src/server/integrations/telegram/telegram-outbox-repository.ts",
);
const dailyService = read(
  "src/server/integrations/telegram/telegram-daily-service.ts",
);
const dailyReport = read(
  "src/server/integrations/telegram/telegram-daily-report.ts",
);
const businessTime = read("src/lib/time/business-time.ts");
const reopen = read("src/lib/shifts/shift-reopen.ts");

assert.match(schema, /dailyReportNotBefore: varchar\("daily_report_not_before"/);
assert.match(schema, /dailyReportGraceMinutes: integer\("daily_report_grace_minutes"\)/);
assert.match(settingsPage, /name="dailyReportNotBefore"/);
assert.match(settingsPage, /name="dailyReportGraceMinutes"/);
assert.match(settingsAction, /REPORT_TIME_PATTERN/);
assert.match(settingsAction, /dailyReportGraceMinutes > 120/);
assert.match(adminQueries, /dailyReportNotBefore/);
assert.match(adminQueries, /dailyReportGraceMinutes/);
assert.match(outbox, /nextAttemptAt: input\.nextAttemptAt \?\? now/);
assert.match(outbox, /dailyReportNotBefore: telegramReportSettings\.dailyReportNotBefore/);
assert.match(dailyService, /getBusinessDateTimeForKey/);
assert.match(dailyService, /Math\.max\(configuredNotBefore\.getTime\(\), graceDeliveryAt\.getTime\(\)\)/);
assert.match(dailyService, /nextAttemptAt,/);
assert.match(businessTime, /export function getBusinessDateTimeForKey/);

assert.doesNotMatch(
  reopen,
  /reportType: "shift_reopened"/,
  "Reopen tidak boleh enqueue pesan shift_reopened ke owner.",
);
assert.match(reopen, /const reopenNoticeStatus:[\s\S]*"not_required"/);

assert.match(dailyReport, /telegramBold\("LAPORAN HARIAN"\)/);
assert.doesNotMatch(
  dailyReport,
  /REVISI \$\{snapshot\.revision\}/,
  "Revision internal tidak boleh tampil di laporan owner.",
);
assert.doesNotMatch(
  dailyReport,
  /Laporan final setelah reopen/,
  "Lifecycle reopen internal tidak perlu ditampilkan ke owner.",
);

console.log(
  "Batch 2 Telegram Final Report contract: settings DB/UI, delayed outbox, silent reopen, dan revision-free owner report OK.",
);
