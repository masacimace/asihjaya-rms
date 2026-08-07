import { and, asc, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  outlets,
  telegramDeliveryAttempts,
  telegramDeliveryOutbox,
  telegramDestinations,
  telegramReportSettings,
} from "@/db/schema";

export type TelegramAdminDestination = {
  id: string | null;
  outletId: string;
  outletCode: string;
  outletName: string;
  name: string;
  chatId: string;
  isActive: boolean;
  openingEnabled: boolean;
  closingDailyEnabled: boolean;
  weeklyEnabled: boolean;
  monthlyEnabled: boolean;
  timezone: string;
};

export type TelegramDeliveryHistoryRow = {
  id: string;
  createdAt: Date;
  outletName: string;
  destinationName: string;
  reportType: "opening" | "closing_daily" | "weekly" | "monthly" | "test";
  status: "pending" | "processing" | "retry" | "sent" | "failed" | "cancelled";
  attemptCount: number;
  maxAttempts: number;
  sentAt: Date | null;
  telegramMessageId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export async function getTelegramAdminOverview(organizationId: string) {
  const [outletRows, destinationRows, deliveryRows, statusRows] = await Promise.all([
    db
      .select({
        id: outlets.id,
        code: outlets.code,
        name: outlets.name,
      })
      .from(outlets)
      .where(and(eq(outlets.organizationId, organizationId), eq(outlets.isActive, true)))
      .orderBy(asc(outlets.name)),

    db
      .select({
        id: telegramDestinations.id,
        outletId: telegramDestinations.outletId,
        name: telegramDestinations.name,
        chatId: telegramDestinations.chatId,
        isActive: telegramDestinations.isActive,
        createdAt: telegramDestinations.createdAt,
        openingEnabled: telegramReportSettings.openingEnabled,
        closingDailyEnabled: telegramReportSettings.closingDailyEnabled,
        weeklyEnabled: telegramReportSettings.weeklyEnabled,
        monthlyEnabled: telegramReportSettings.monthlyEnabled,
        timezone: telegramReportSettings.timezone,
        settingsActive: telegramReportSettings.isActive,
      })
      .from(telegramDestinations)
      .leftJoin(
        telegramReportSettings,
        eq(telegramReportSettings.destinationId, telegramDestinations.id),
      )
      .where(eq(telegramDestinations.organizationId, organizationId))
      .orderBy(desc(telegramDestinations.isActive), desc(telegramDestinations.updatedAt)),

    db
      .select({
        id: telegramDeliveryOutbox.id,
        createdAt: telegramDeliveryOutbox.createdAt,
        outletName: outlets.name,
        destinationName: telegramDestinations.name,
        reportType: telegramDeliveryOutbox.reportType,
        status: telegramDeliveryOutbox.status,
        attemptCount: telegramDeliveryOutbox.attemptCount,
        maxAttempts: telegramDeliveryOutbox.maxAttempts,
        sentAt: telegramDeliveryOutbox.sentAt,
        telegramMessageId: telegramDeliveryOutbox.telegramMessageId,
        lastErrorCode: telegramDeliveryOutbox.lastErrorCode,
        lastErrorMessage: telegramDeliveryOutbox.lastErrorMessage,
      })
      .from(telegramDeliveryOutbox)
      .innerJoin(outlets, eq(outlets.id, telegramDeliveryOutbox.outletId))
      .innerJoin(
        telegramDestinations,
        eq(telegramDestinations.id, telegramDeliveryOutbox.destinationId),
      )
      .where(eq(telegramDeliveryOutbox.organizationId, organizationId))
      .orderBy(desc(telegramDeliveryOutbox.createdAt))
      .limit(50),

    db
      .select({
        status: telegramDeliveryOutbox.status,
        total: count(),
      })
      .from(telegramDeliveryOutbox)
      .where(eq(telegramDeliveryOutbox.organizationId, organizationId))
      .groupBy(telegramDeliveryOutbox.status),
  ]);

  const latestDestinationByOutlet = new Map<string, (typeof destinationRows)[number]>();
  for (const row of destinationRows) {
    if (!latestDestinationByOutlet.has(row.outletId)) {
      latestDestinationByOutlet.set(row.outletId, row);
    }
  }

  const destinations: TelegramAdminDestination[] = outletRows.map((outlet) => {
    const destination = latestDestinationByOutlet.get(outlet.id);
    return {
      id: destination?.id ?? null,
      outletId: outlet.id,
      outletCode: outlet.code,
      outletName: outlet.name,
      name: destination?.name ?? `${outlet.name} Telegram`,
      chatId: destination?.chatId ?? "",
      isActive: destination?.isActive ?? true,
      openingEnabled: destination?.openingEnabled ?? false,
      closingDailyEnabled: destination?.closingDailyEnabled ?? false,
      weeklyEnabled: destination?.weeklyEnabled ?? false,
      monthlyEnabled: destination?.monthlyEnabled ?? false,
      timezone: destination?.timezone ?? "Asia/Jakarta",
    };
  });

  const statusCounts = Object.fromEntries(statusRows.map((row) => [row.status, row.total])) as Partial<
    Record<TelegramDeliveryHistoryRow["status"], number>
  >;

  return {
    destinations,
    deliveries: deliveryRows satisfies TelegramDeliveryHistoryRow[],
    statusCounts,
  };
}

export async function getTelegramDeliveryDetail(input: {
  organizationId: string;
  deliveryId: string;
}) {
  const [delivery] = await db
    .select({
      id: telegramDeliveryOutbox.id,
      eventKey: telegramDeliveryOutbox.eventKey,
      reportType: telegramDeliveryOutbox.reportType,
      status: telegramDeliveryOutbox.status,
      businessDate: telegramDeliveryOutbox.businessDate,
      periodStart: telegramDeliveryOutbox.periodStart,
      periodEnd: telegramDeliveryOutbox.periodEnd,
      messageText: telegramDeliveryOutbox.messageText,
      attemptCount: telegramDeliveryOutbox.attemptCount,
      maxAttempts: telegramDeliveryOutbox.maxAttempts,
      nextAttemptAt: telegramDeliveryOutbox.nextAttemptAt,
      sentAt: telegramDeliveryOutbox.sentAt,
      telegramMessageId: telegramDeliveryOutbox.telegramMessageId,
      lastErrorCode: telegramDeliveryOutbox.lastErrorCode,
      lastErrorMessage: telegramDeliveryOutbox.lastErrorMessage,
      createdAt: telegramDeliveryOutbox.createdAt,
      updatedAt: telegramDeliveryOutbox.updatedAt,
      outletName: outlets.name,
      outletCode: outlets.code,
      destinationName: telegramDestinations.name,
      chatId: telegramDestinations.chatId,
    })
    .from(telegramDeliveryOutbox)
    .innerJoin(outlets, eq(outlets.id, telegramDeliveryOutbox.outletId))
    .innerJoin(
      telegramDestinations,
      eq(telegramDestinations.id, telegramDeliveryOutbox.destinationId),
    )
    .where(
      and(
        eq(telegramDeliveryOutbox.id, input.deliveryId),
        eq(telegramDeliveryOutbox.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!delivery) return null;

  const attempts = await db
    .select({
      id: telegramDeliveryAttempts.id,
      attemptNumber: telegramDeliveryAttempts.attemptNumber,
      requestedAt: telegramDeliveryAttempts.requestedAt,
      completedAt: telegramDeliveryAttempts.completedAt,
      httpStatus: telegramDeliveryAttempts.httpStatus,
      telegramOk: telegramDeliveryAttempts.telegramOk,
      telegramErrorCode: telegramDeliveryAttempts.telegramErrorCode,
      telegramErrorDescription: telegramDeliveryAttempts.telegramErrorDescription,
      telegramMessageId: telegramDeliveryAttempts.telegramMessageId,
      durationMs: telegramDeliveryAttempts.durationMs,
    })
    .from(telegramDeliveryAttempts)
    .where(eq(telegramDeliveryAttempts.deliveryId, input.deliveryId))
    .orderBy(asc(telegramDeliveryAttempts.attemptNumber));

  return { delivery, attempts };
}
