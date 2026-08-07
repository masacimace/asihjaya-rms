import {
  getBusinessDateTimeParts,
  normalizeBusinessTimeZone,
} from "@/lib/time/business-time";
import { assertIsoBusinessDate } from "@/server/integrations/telegram/telegram-outbox-contract";

export type SupersededTelegramReportType =
  | "closing_daily"
  | "weekly"
  | "monthly";

export type TelegramShiftReopenedSnapshot = {
  schemaVersion: 1;
  reportType: "shift_reopened";
  shiftId: string;
  closingRevision: number;
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  businessDate: string;
  previousClosedAt: string;
  reopenedAt: string;
  reopenedBy: {
    id: string;
    name: string;
  };
  reason: string;
  timezone: string;
  supersededReportTypes: SupersededTelegramReportType[];
};

function assertNonBlank(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function assertPositiveInteger(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(code);
  return value;
}

function formatBusinessDate(value: string): string {
  assertIsoBusinessDate(value);
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTimezoneLabel(date: Date, timeZone: string): string {
  if (timeZone === "Asia/Jakarta") return "WIB";
  if (timeZone === "Asia/Makassar") return "WITA";
  if (timeZone === "Asia/Jayapura") return "WIT";

  return (
    new Intl.DateTimeFormat("id-ID", {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone
  );
}

function formatTime(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("TELEGRAM_SHIFT_REOPEN_TIME_INVALID");
  const parts = getBusinessDateTimeParts(date, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")} ${formatTimezoneLabel(date, timeZone)}`;
}

const reportLabels: Record<SupersededTelegramReportType, string> = {
  closing_daily: "Closing / Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export function buildTelegramShiftReopenedEventKey(
  shiftId: string,
  closingRevision: number,
): string {
  return `shift-reopened:${assertNonBlank(shiftId, "TELEGRAM_SHIFT_ID_REQUIRED")}:r${assertPositiveInteger(
    closingRevision,
    "TELEGRAM_SHIFT_REOPEN_REVISION_INVALID",
  )}`;
}

export function buildTelegramShiftReopenedSnapshot(input: {
  shiftId: string;
  closingRevision: number;
  outlet: { id: string; code: string; name: string };
  businessDate: string;
  previousClosedAt: Date;
  reopenedAt: Date;
  reopenedBy: { id: string; name: string };
  reason: string;
  timezone: string;
  supersededReportTypes: SupersededTelegramReportType[];
}): TelegramShiftReopenedSnapshot {
  assertIsoBusinessDate(input.businessDate);
  if (
    Number.isNaN(input.previousClosedAt.getTime()) ||
    Number.isNaN(input.reopenedAt.getTime()) ||
    input.reopenedAt < input.previousClosedAt
  ) {
    throw new Error("TELEGRAM_SHIFT_REOPEN_TIME_INVALID");
  }

  const reason = assertNonBlank(input.reason, "TELEGRAM_SHIFT_REOPEN_REASON_REQUIRED");
  const supersededReportTypes = [...new Set(input.supersededReportTypes)];

  return {
    schemaVersion: 1,
    reportType: "shift_reopened",
    shiftId: assertNonBlank(input.shiftId, "TELEGRAM_SHIFT_ID_REQUIRED"),
    closingRevision: assertPositiveInteger(
      input.closingRevision,
      "TELEGRAM_SHIFT_REOPEN_REVISION_INVALID",
    ),
    outlet: {
      id: assertNonBlank(input.outlet.id, "TELEGRAM_OUTLET_ID_REQUIRED"),
      code: assertNonBlank(input.outlet.code, "TELEGRAM_OUTLET_CODE_REQUIRED"),
      name: assertNonBlank(input.outlet.name, "TELEGRAM_OUTLET_NAME_REQUIRED"),
    },
    businessDate: input.businessDate,
    previousClosedAt: input.previousClosedAt.toISOString(),
    reopenedAt: input.reopenedAt.toISOString(),
    reopenedBy: {
      id: assertNonBlank(input.reopenedBy.id, "TELEGRAM_REOPENED_BY_ID_REQUIRED"),
      name: assertNonBlank(input.reopenedBy.name, "TELEGRAM_REOPENED_BY_NAME_REQUIRED"),
    },
    reason,
    timezone: normalizeBusinessTimeZone(input.timezone),
    supersededReportTypes,
  };
}

export function formatTelegramShiftReopenedMessage(
  snapshot: TelegramShiftReopenedSnapshot,
): string {
  const affectedReports = snapshot.supersededReportTypes.length
    ? snapshot.supersededReportTypes.map((type) => reportLabels[type]).join(", ")
    : "Laporan penutupan sebelumnya";

  return [
    "🟠 SHIFT DIBUKA KEMBALI",
    "",
    `Outlet: ${snapshot.outlet.name}`,
    `Tanggal operasional: ${formatBusinessDate(snapshot.businessDate)}`,
    `Penutupan sebelumnya: ${formatTime(snapshot.previousClosedAt, snapshot.timezone)}`,
    `Dibuka kembali: ${formatTime(snapshot.reopenedAt, snapshot.timezone)}`,
    `Oleh: ${snapshot.reopenedBy.name}`,
    `Alasan: ${snapshot.reason}`,
    "",
    `Laporan terdampak: ${affectedReports}`,
    "Laporan yang sudah terkirim sebelumnya tidak lagi dianggap sebagai laporan akhir.",
    "Laporan final terbaru akan dikirim setelah shift ini ditutup kembali.",
    "",
    "Status: Outlet kembali beroperasi pada shift yang sama.",
  ].join("\n");
}
