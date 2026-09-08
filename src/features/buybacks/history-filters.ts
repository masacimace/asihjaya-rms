import type {
  BuybackHistoryDateRange,
  BuybackHistoryPayoutFilter,
  BuybackHistoryProcessingFilter,
  BuybackHistoryPeriod,
} from "@/features/buybacks/contracts";
import {
  getStartOfBusinessDay,
  getStartOfBusinessMonth,
} from "@/lib/time/business-time";

export const buybackHistoryDateRangeLabels: Record<
  BuybackHistoryDateRange,
  string
> = {
  today: "Hari ini",
  yesterday: "Kemarin",
  last7: "7 hari terakhir",
  last30: "30 hari terakhir",
  thisMonth: "Bulan ini",
  all: "Semua waktu",
};

export function normalizeBuybackHistoryDateRange(
  value: string | null | undefined,
): BuybackHistoryDateRange {
  return value === "today" ||
    value === "yesterday" ||
    value === "last7" ||
    value === "last30" ||
    value === "thisMonth" ||
    value === "all"
    ? value
    : "today";
}

export function normalizeBuybackHistoryProcessingFilter(
  value: string | null | undefined,
): BuybackHistoryProcessingFilter {
  return value === "pending" || value === "clear" ? value : "all";
}

export function normalizeBuybackHistoryPayoutFilter(
  value: string | null | undefined,
): BuybackHistoryPayoutFilter {
  return value === "cash" ||
    value === "bank_transfer" ||
    value === "customer_deposit"
    ? value
    : "all";
}

export function createBuybackHistoryPeriod(
  range: BuybackHistoryDateRange,
  timeZone: string,
  now = new Date(),
): BuybackHistoryPeriod {
  const todayStart = getStartOfBusinessDay(now, timeZone);
  const tomorrowStart = getStartOfBusinessDay(now, timeZone, 1);

  if (range === "yesterday") {
    return {
      range,
      label: buybackHistoryDateRangeLabels[range],
      start: getStartOfBusinessDay(now, timeZone, -1),
      end: todayStart,
    };
  }

  if (range === "last7") {
    return {
      range,
      label: buybackHistoryDateRangeLabels[range],
      start: getStartOfBusinessDay(now, timeZone, -6),
      end: tomorrowStart,
    };
  }

  if (range === "last30") {
    return {
      range,
      label: buybackHistoryDateRangeLabels[range],
      start: getStartOfBusinessDay(now, timeZone, -29),
      end: tomorrowStart,
    };
  }

  if (range === "thisMonth") {
    return {
      range,
      label: buybackHistoryDateRangeLabels[range],
      start: getStartOfBusinessMonth(now, timeZone),
      end: tomorrowStart,
    };
  }

  if (range === "all") {
    return {
      range,
      label: buybackHistoryDateRangeLabels[range],
      start: null,
      end: null,
    };
  }

  return {
    range: "today",
    label: buybackHistoryDateRangeLabels.today,
    start: todayStart,
    end: tomorrowStart,
  };
}
