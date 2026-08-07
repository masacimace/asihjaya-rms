import {
  getBusinessDateTimeParts,
  normalizeBusinessTimeZone,
} from "@/lib/time/business-time";
import { assertIsoBusinessDate } from "@/server/integrations/telegram/telegram-outbox-contract";

export type TelegramOpeningSnapshot = {
  schemaVersion: 1;
  reportType: "opening";
  shiftId: string;
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  businessDate: string;
  cashier: {
    id: string;
    name: string;
  };
  openedAt: string;
  openingCash: string;
  timezone: string;
};

export type BuildTelegramOpeningSnapshotInput = {
  shiftId: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  businessDate: string;
  cashierId: string;
  cashierName: string;
  openedAt: Date;
  openingCash: string;
  timezone: string;
};

function assertNonBlank(value: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function normalizeOpeningCash(value: string): string {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error("TELEGRAM_OPENING_CASH_INVALID");
  }
  return BigInt(normalized).toString();
}

function formatBusinessDate(value: string): string {
  assertIsoBusinessDate(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("TELEGRAM_BUSINESS_DATE_INVALID");

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );

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

  const zonePart = new Intl.DateTimeFormat("id-ID", {
    timeZone,
    timeZoneName: "short",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  return zonePart?.trim() || timeZone;
}

function formatOpeningTime(openedAt: string, timeZone: string): string {
  const date = new Date(openedAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error("TELEGRAM_OPENING_TIME_INVALID");
  }

  const parts = getBusinessDateTimeParts(date, timeZone);
  const hour = String(parts.hour).padStart(2, "0");
  const minute = String(parts.minute).padStart(2, "0");
  return `${hour}:${minute} ${formatTimezoneLabel(date, timeZone)}`;
}

function formatRupiahInteger(value: string): string {
  return `Rp${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(BigInt(value))}`;
}

export function buildTelegramOpeningEventKey(
  outletId: string,
  businessDate: string,
): string {
  assertIsoBusinessDate(businessDate);
  return `outlet-opened:${assertNonBlank(outletId, "TELEGRAM_OUTLET_ID_REQUIRED")}:${businessDate}`;
}

export function buildTelegramOpeningSnapshot(
  input: BuildTelegramOpeningSnapshotInput,
): TelegramOpeningSnapshot {
  assertIsoBusinessDate(input.businessDate);

  if (Number.isNaN(input.openedAt.getTime())) {
    throw new Error("TELEGRAM_OPENING_TIME_INVALID");
  }

  return {
    schemaVersion: 1,
    reportType: "opening",
    shiftId: assertNonBlank(input.shiftId, "TELEGRAM_SHIFT_ID_REQUIRED"),
    outlet: {
      id: assertNonBlank(input.outletId, "TELEGRAM_OUTLET_ID_REQUIRED"),
      code: assertNonBlank(input.outletCode, "TELEGRAM_OUTLET_CODE_REQUIRED"),
      name: assertNonBlank(input.outletName, "TELEGRAM_OUTLET_NAME_REQUIRED"),
    },
    businessDate: input.businessDate,
    cashier: {
      id: assertNonBlank(input.cashierId, "TELEGRAM_CASHIER_ID_REQUIRED"),
      name: assertNonBlank(input.cashierName, "TELEGRAM_CASHIER_NAME_REQUIRED"),
    },
    openedAt: input.openedAt.toISOString(),
    openingCash: normalizeOpeningCash(input.openingCash),
    timezone: normalizeBusinessTimeZone(input.timezone),
  };
}

export function formatTelegramOpeningMessage(
  snapshot: TelegramOpeningSnapshot,
): string {
  const timeZone = normalizeBusinessTimeZone(snapshot.timezone);

  return [
    "🟢 OUTLET DIBUKA",
    "",
    `Outlet: ${snapshot.outlet.name}`,
    `Tanggal operasional: ${formatBusinessDate(snapshot.businessDate)}`,
    `Kasir utama: ${snapshot.cashier.name}`,
    `Waktu buka: ${formatOpeningTime(snapshot.openedAt, timeZone)}`,
    `Kas awal: ${formatRupiahInteger(snapshot.openingCash)}`,
    "",
    `Shift: ${snapshot.shiftId}`,
    "Status: Operasional dimulai",
  ].join("\n");
}
