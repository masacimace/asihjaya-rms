import { and, eq, gte, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  financeClosingSnapshots,
  outlets,
  registers,
  shifts,
  telegramDeliveryOutbox,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";
import { getBusinessDateKey } from "@/lib/time/business-time";
import {
  enqueueTelegramDelivery,
  findEnabledTelegramDestinationForOutlet,
  transitionTelegramDelivery,
} from "@/server/integrations/telegram/telegram-outbox-repository";
import { getTelegramRuntimeOutboxConfig } from "@/server/integrations/telegram/telegram-runtime-config";
import {
  buildTelegramShiftReopenedEventKey,
  buildTelegramShiftReopenedSnapshot,
  formatTelegramShiftReopenedMessage,
  type SupersededTelegramReportType,
} from "@/server/integrations/telegram/telegram-shift-reopen-report";

export class ShiftReopenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShiftReopenError";
  }
}

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type ReopenShiftInput = {
  auth: AuthContext;
  shiftId: string;
  reason: string;
  requestMetadata: RequestMetadata;
  source: "pos.reopen_shift";
  now?: Date;
};

export type ReopenShiftResult = {
  id: string;
  outletId: string;
  registerId: string;
  businessDate: string;
  closingRevision: number;
  cancelledDeliveryCount: number;
  previouslySentReportTypes: SupersededTelegramReportType[];
  reopenNoticeStatus:
    | "not_required"
    | "integration_disabled"
    | "destination_unavailable"
    | "enqueued"
    | "duplicate";
};

function normalizeReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 5) {
    throw new ShiftReopenError("Alasan membuka kembali shift wajib diisi minimal 5 karakter.");
  }
  if (reason.length > 500) {
    throw new ShiftReopenError("Alasan membuka kembali shift maksimal 500 karakter.");
  }
  return reason;
}

export async function reopenClosedShift({
  auth,
  shiftId,
  reason,
  requestMetadata,
  source,
  now = new Date(),
}: ReopenShiftInput): Promise<ReopenShiftResult> {
  if (!auth.permissionCodes.includes("shifts.reopen")) {
    throw new ShiftReopenError(
      "Buka kembali shift hanya dapat dilakukan oleh manager/owner yang memiliki permission shifts.reopen.",
    );
  }

  const normalizedReason = normalizeReason(reason);
  const accessibleOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));
  const currentBusinessDate = getBusinessDateKey(now, auth.organization.timezone);
  const telegramConfig = getTelegramRuntimeOutboxConfig();

  return db.transaction(async (transaction) => {
    const [shift] = await transaction
      .select({
        id: shifts.id,
        outletId: shifts.outletId,
        registerId: shifts.registerId,
        status: shifts.status,
        businessDate: shifts.businessDate,
        openedAt: shifts.openedAt,
        openingCash: shifts.openingCash,
        expectedCash: shifts.expectedCash,
        actualCash: shifts.actualCash,
        cashVariance: shifts.cashVariance,
        varianceReason: shifts.varianceReason,
        closedBy: shifts.closedBy,
        closedAt: shifts.closedAt,
        outletCode: outlets.code,
        outletName: outlets.name,
        registerCode: registers.code,
        registerName: registers.name,
      })
      .from(shifts)
      .innerJoin(outlets, eq(shifts.outletId, outlets.id))
      .innerJoin(registers, eq(shifts.registerId, registers.id))
      .where(
        and(
          eq(shifts.id, shiftId),
          eq(outlets.organizationId, auth.organization.id),
        ),
      )
      .limit(1)
      .for("update");

    if (!shift || !accessibleOutletIds.has(shift.outletId)) {
      throw new ShiftReopenError("Shift tidak ditemukan atau bukan akses outlet kamu.");
    }
    if (shift.status !== "closed") {
      throw new ShiftReopenError("Hanya shift berstatus closed yang dapat dibuka kembali.");
    }
    if (!shift.businessDate || !shift.closedAt || !shift.closedBy) {
      throw new ShiftReopenError("Data penutupan shift belum lengkap dan tidak aman untuk dibuka kembali.");
    }
    if (shift.businessDate !== currentBusinessDate) {
      throw new ShiftReopenError(
        `Shift hanya dapat dibuka kembali pada tanggal operasional yang sama (${shift.businessDate}).`,
      );
    }

    const [financeSnapshot] = await transaction
      .select({
        id: financeClosingSnapshots.id,
        revision: financeClosingSnapshots.revision,
      })
      .from(financeClosingSnapshots)
      .where(
        and(
          eq(financeClosingSnapshots.shiftId, shift.id),
          isNull(financeClosingSnapshots.supersededAt),
        ),
      )
      .limit(1)
      .for("update");

    if (!financeSnapshot) {
      throw new ShiftReopenError(
        "Snapshot finance penutupan aktif tidak ditemukan. Reopen diblokir agar audit keuangan tetap konsisten.",
      );
    }

    const affectedDeliveries = await transaction
      .select({
        id: telegramDeliveryOutbox.id,
        reportType: telegramDeliveryOutbox.reportType,
        status: telegramDeliveryOutbox.status,
        attemptCount: telegramDeliveryOutbox.attemptCount,
        maxAttempts: telegramDeliveryOutbox.maxAttempts,
      })
      .from(telegramDeliveryOutbox)
      .where(
        and(
          eq(telegramDeliveryOutbox.organizationId, auth.organization.id),
          eq(telegramDeliveryOutbox.outletId, shift.outletId),
          or(
            and(
              eq(telegramDeliveryOutbox.reportType, "closing_daily"),
              eq(telegramDeliveryOutbox.businessDate, shift.businessDate),
            ),
            and(
              eq(telegramDeliveryOutbox.reportType, "weekly"),
              lte(telegramDeliveryOutbox.periodStart, shift.businessDate),
              gte(telegramDeliveryOutbox.periodEnd, shift.businessDate),
            ),
            and(
              eq(telegramDeliveryOutbox.reportType, "monthly"),
              lte(telegramDeliveryOutbox.periodStart, shift.businessDate),
              gte(telegramDeliveryOutbox.periodEnd, shift.businessDate),
            ),
          ),
        ),
      )
      .for("update");

    if (affectedDeliveries.some((delivery) => delivery.status === "processing")) {
      throw new ShiftReopenError(
        "Laporan Telegram penutupan sedang diproses. Tunggu sebentar lalu coba buka kembali shift agar status laporan tidak ambigu.",
      );
    }

    let cancelledDeliveryCount = 0;
    for (const delivery of affectedDeliveries) {
      if (
        delivery.status !== "pending" &&
        delivery.status !== "retry" &&
        delivery.status !== "failed"
      ) {
        continue;
      }

      await transitionTelegramDelivery(transaction, {
        deliveryId: delivery.id,
        from: delivery.status,
        to: "cancelled",
        attemptCount: delivery.attemptCount,
        maxAttempts: delivery.maxAttempts,
        lastErrorCode: "SHIFT_REOPENED",
        lastErrorMessage: "Delivery dibatalkan karena shift dibuka kembali sebelum final closing.",
      });
      cancelledDeliveryCount += 1;
    }

    const previouslySentReportTypes = [
      ...new Set(
        affectedDeliveries
          .filter((delivery) => delivery.status === "sent")
          .map((delivery) => delivery.reportType)
          .filter(
            (reportType): reportType is SupersededTelegramReportType =>
              reportType === "closing_daily" ||
              reportType === "weekly" ||
              reportType === "monthly",
          ),
      ),
    ];

    await transaction
      .update(financeClosingSnapshots)
      .set({
        supersededAt: now,
        supersededByUserId: auth.user.id,
        supersededReason: normalizedReason,
      })
      .where(
        and(
          eq(financeClosingSnapshots.id, financeSnapshot.id),
          isNull(financeClosingSnapshots.supersededAt),
        ),
      );

    const [reopenedShift] = await transaction
      .update(shifts)
      .set({
        status: "open",
        closedBy: null,
        actualCash: null,
        cashVariance: null,
        varianceReason: null,
        closedAt: null,
        updatedAt: now,
      })
      .where(and(eq(shifts.id, shift.id), eq(shifts.status, "closed")))
      .returning({ id: shifts.id });

    if (!reopenedShift) {
      throw new ShiftReopenError(
        "Shift sudah berubah status. Refresh halaman lalu cek ulang sebelum reopen.",
      );
    }

    let reopenNoticeStatus: ReopenShiftResult["reopenNoticeStatus"] = "not_required";

    if (previouslySentReportTypes.length > 0) {
      if (!telegramConfig.enabled) {
        reopenNoticeStatus = "integration_disabled";
      } else {
        const destination = await findEnabledTelegramDestinationForOutlet(transaction, {
          organizationId: auth.organization.id,
          outletId: shift.outletId,
          reportType: "shift_reopened",
        });

        if (!destination) {
          reopenNoticeStatus = "destination_unavailable";
        } else {
          const payload = buildTelegramShiftReopenedSnapshot({
            shiftId: shift.id,
            closingRevision: financeSnapshot.revision,
            outlet: {
              id: shift.outletId,
              code: shift.outletCode,
              name: shift.outletName,
            },
            businessDate: shift.businessDate,
            previousClosedAt: shift.closedAt,
            reopenedAt: now,
            reopenedBy: {
              id: auth.user.id,
              name: auth.user.fullName,
            },
            reason: normalizedReason,
            timezone: destination.timezone,
            supersededReportTypes: previouslySentReportTypes,
          });

          const delivery = await enqueueTelegramDelivery(transaction, {
            organizationId: auth.organization.id,
            eventKey: buildTelegramShiftReopenedEventKey(
              shift.id,
              financeSnapshot.revision,
            ),
            destinationId: destination.destinationId,
            outletId: shift.outletId,
            reportType: "shift_reopened",
            businessDate: shift.businessDate,
            payloadSnapshot: payload,
            messageText: formatTelegramShiftReopenedMessage(payload),
            maxAttempts: telegramConfig.maxAttempts,
          });

          reopenNoticeStatus = delivery.created ? "enqueued" : "duplicate";
        }
      }
    }

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: shift.outletId,
      actorUserId: auth.user.id,
      action: "shift.reopen",
      entityType: "shift",
      entityId: shift.id,
      beforeData: {
        status: "closed",
        businessDate: shift.businessDate,
        closedBy: shift.closedBy,
        closedAt: shift.closedAt.toISOString(),
        actualCash: shift.actualCash,
        cashVariance: shift.cashVariance,
        varianceReason: shift.varianceReason,
        financeSnapshotId: financeSnapshot.id,
        closingRevision: financeSnapshot.revision,
      },
      afterData: {
        status: "open",
        businessDate: shift.businessDate,
        shiftId: shift.id,
        outletCode: shift.outletCode,
        registerCode: shift.registerCode,
        expectedCash: shift.expectedCash,
        cancelledDeliveryCount,
        previouslySentReportTypes,
        reopenNoticeStatus,
      },
      reason: normalizedReason,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        source,
        reopenedAt: now.toISOString(),
      },
      createdAt: now,
    });

    return {
      id: shift.id,
      outletId: shift.outletId,
      registerId: shift.registerId,
      businessDate: shift.businessDate,
      closingRevision: financeSnapshot.revision,
      cancelledDeliveryCount,
      previouslySentReportTypes,
      reopenNoticeStatus,
    };
  });
}
