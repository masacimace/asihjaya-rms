ALTER TABLE "telegram_report_settings"
ADD COLUMN "daily_report_not_before" varchar(5) DEFAULT '16:30' NOT NULL;

ALTER TABLE "telegram_report_settings"
ADD COLUMN "daily_report_grace_minutes" integer DEFAULT 10 NOT NULL;

ALTER TABLE "telegram_report_settings"
ADD CONSTRAINT "telegram_report_settings_daily_not_before_ck"
CHECK ("daily_report_not_before" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "telegram_report_settings"
ADD CONSTRAINT "telegram_report_settings_daily_grace_minutes_ck"
CHECK ("daily_report_grace_minutes" BETWEEN 0 AND 120);
