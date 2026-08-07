import { and, asc, eq, or } from "drizzle-orm";

import { db } from "@/db";
import {
  financeClosingSnapshots,
  outlets,
  telegramDestinations,
  telegramReportSettings,
} from "@/db/schema";
import { getBusinessDateKey } from "@/lib/time/business-time";
import {
  getMonthlyPeriodForBusinessDate,
  type TelegramMonthlyPeriod,
} from "@/server/integrations/telegram/telegram-monthly-report";
import { enqueueTelegramMonthlyPeriodInTransaction } from "@/server/integrations/telegram/telegram-monthly-service";
import {
  getWeeklyPeriodForBusinessDate,
  type TelegramWeeklyPeriod,
} from "@/server/integrations/telegram/telegram-weekly-report";
import { enqueueTelegramWeeklyPeriodInTransaction } from "@/server/integrations/telegram/telegram-weekly-service";

export const TELEGRAM_RECONCILIATION_PERIOD_LIMIT = 200;

type ReconciliationTarget = {
  organizationId: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  timezone: string;
  weeklyEnabled: boolean;
  monthlyEnabled: boolean;
  settingsUpdatedAt: Date;
};

export type TelegramReportReconciliationResult = {
  targets: number;
  periodsInspected: number;
  enqueued: number;
  duplicate: number;
  noData: number;
  skippedBeforeSettings: number;
  capped: boolean;
};

function periodKey(kind: "weekly" | "monthly", period: { start: string; end: string }) {
  return `${kind}:${period.start}:${period.end}`;
}

function hasClosingBoundaryAfterPeriod(
  period: { start: string; end: string },
  currentBusinessDate: string,
  businessDates: string[],
): boolean {
  if (period.end > currentBusinessDate) return false;
  return businessDates.some(
    (businessDate) =>
      businessDate >= period.end && businessDate <= currentBusinessDate,
  );
}

function sortPeriods<T extends { start: string; end: string }>(periods: T[]): T[] {
  return periods.sort((left, right) => left.start.localeCompare(right.start));
}

async function loadTargets(): Promise<ReconciliationTarget[]> {
  return db
    .select({
      organizationId: telegramDestinations.organizationId,
      outletId: telegramDestinations.outletId,
      outletCode: outlets.code,
      outletName: outlets.name,
      timezone: telegramReportSettings.timezone,
      weeklyEnabled: telegramReportSettings.weeklyEnabled,
      monthlyEnabled: telegramReportSettings.monthlyEnabled,
      settingsUpdatedAt: telegramReportSettings.updatedAt,
    })
    .from(telegramDestinations)
    .innerJoin(
      telegramReportSettings,
      eq(telegramReportSettings.destinationId, telegramDestinations.id),
    )
    .innerJoin(outlets, eq(outlets.id, telegramDestinations.outletId))
    .where(
      and(
        eq(telegramDestinations.isActive, true),
        eq(telegramReportSettings.isActive, true),
        or(
          eq(telegramReportSettings.weeklyEnabled, true),
          eq(telegramReportSettings.monthlyEnabled, true),
        ),
      ),
    );
}

async function loadSnapshotBusinessDates(target: ReconciliationTarget): Promise<string[]> {
  const rows = await db
    .select({ businessDate: financeClosingSnapshots.businessDate })
    .from(financeClosingSnapshots)
    .where(
      and(
        eq(financeClosingSnapshots.organizationId, target.organizationId),
        eq(financeClosingSnapshots.outletId, target.outletId),
      ),
    )
    .orderBy(asc(financeClosingSnapshots.businessDate));

  return [...new Set(rows.map((row) => row.businessDate))];
}

function collectWeeklyPeriods(
  businessDates: string[],
  currentBusinessDate: string,
): TelegramWeeklyPeriod[] {
  const periods = new Map<string, TelegramWeeklyPeriod>();

  for (const businessDate of businessDates) {
    const period = getWeeklyPeriodForBusinessDate(businessDate);
    if (!hasClosingBoundaryAfterPeriod(period, currentBusinessDate, businessDates)) continue;
    periods.set(periodKey("weekly", period), period);
  }

  return sortPeriods([...periods.values()]);
}

function collectMonthlyPeriods(
  businessDates: string[],
  currentBusinessDate: string,
): TelegramMonthlyPeriod[] {
  const periods = new Map<string, TelegramMonthlyPeriod>();

  for (const businessDate of businessDates) {
    const period = getMonthlyPeriodForBusinessDate(businessDate);
    if (!hasClosingBoundaryAfterPeriod(period, currentBusinessDate, businessDates)) continue;
    periods.set(periodKey("monthly", period), period);
  }

  return sortPeriods([...periods.values()]);
}

export async function reconcileTelegramReports(options: {
  maxAttempts: number;
  now?: Date;
  periodLimit?: number;
}): Promise<TelegramReportReconciliationResult> {
  const now = options.now ?? new Date();
  const periodLimit = options.periodLimit ?? TELEGRAM_RECONCILIATION_PERIOD_LIMIT;
  if (!Number.isSafeInteger(periodLimit) || periodLimit < 1 || periodLimit > 1000) {
    throw new Error("TELEGRAM_RECONCILIATION_PERIOD_LIMIT_INVALID");
  }

  const result: TelegramReportReconciliationResult = {
    targets: 0,
    periodsInspected: 0,
    enqueued: 0,
    duplicate: 0,
    noData: 0,
    skippedBeforeSettings: 0,
    capped: false,
  };

  const targets = await loadTargets();
  result.targets = targets.length;

  for (const target of targets) {
    const currentBusinessDate = getBusinessDateKey(now, target.timezone);
    const settingsBusinessDate = getBusinessDateKey(
      target.settingsUpdatedAt,
      target.timezone,
    );
    const businessDates = await loadSnapshotBusinessDates(target);

    const candidates: Array<
      | { kind: "weekly"; period: TelegramWeeklyPeriod }
      | { kind: "monthly"; period: TelegramMonthlyPeriod }
    > = [];

    if (target.weeklyEnabled) {
      candidates.push(
        ...collectWeeklyPeriods(businessDates, currentBusinessDate).map((period) => ({
          kind: "weekly" as const,
          period,
        })),
      );
    }
    if (target.monthlyEnabled) {
      candidates.push(
        ...collectMonthlyPeriods(businessDates, currentBusinessDate).map((period) => ({
          kind: "monthly" as const,
          period,
        })),
      );
    }

    candidates.sort((left, right) => left.period.end.localeCompare(right.period.end));

    for (const candidate of candidates) {
      if (candidate.period.end < settingsBusinessDate) {
        result.skippedBeforeSettings += 1;
        continue;
      }
      if (result.periodsInspected >= periodLimit) {
        result.capped = true;
        return result;
      }

      result.periodsInspected += 1;
      const outcome = await db.transaction(async (transaction) => {
        const common = {
          maxAttempts: options.maxAttempts,
          organizationId: target.organizationId,
          outletId: target.outletId,
          outletCode: target.outletCode,
          outletName: target.outletName,
        };
        if (candidate.kind === "weekly") {
          return enqueueTelegramWeeklyPeriodInTransaction(transaction, {
            ...common,
            period: candidate.period,
          });
        }
        return enqueueTelegramMonthlyPeriodInTransaction(transaction, {
          ...common,
          period: candidate.period,
        });
      });

      if (outcome.status === "enqueued") result.enqueued += 1;
      else if (outcome.status === "duplicate") result.duplicate += 1;
      else if (outcome.status === "no_data") result.noData += 1;
    }
  }

  return result;
}
