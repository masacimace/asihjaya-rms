import {
  enqueueTelegramDelivery,
  findEnabledTelegramDestinationForOutlet,
  type TelegramRepositoryTransaction,
} from "@/server/integrations/telegram/telegram-outbox-repository";
import {
  buildTelegramOpeningEventKey,
  buildTelegramOpeningSnapshot,
  formatTelegramOpeningMessage,
} from "@/server/integrations/telegram/telegram-opening-report";

export type EnqueueTelegramOpeningInput = {
  integrationEnabled: boolean;
  maxAttempts: number;
  organizationId: string;
  outletId: string;
  outletCode: string;
  outletName: string;
  shiftId: string;
  businessDate: string;
  cashierId: string;
  cashierName: string;
  openedAt: Date;
  openingCash: string;
};

export type EnqueueTelegramOpeningResult =
  | { status: "integration_disabled" }
  | { status: "destination_unavailable" }
  | { status: "enqueued"; deliveryId: string }
  | { status: "duplicate"; deliveryId: string };

export async function enqueueTelegramOpeningNotification(
  transaction: TelegramRepositoryTransaction,
  input: EnqueueTelegramOpeningInput,
): Promise<EnqueueTelegramOpeningResult> {
  if (!input.integrationEnabled) {
    return { status: "integration_disabled" };
  }

  const destination = await findEnabledTelegramDestinationForOutlet(transaction, {
    organizationId: input.organizationId,
    outletId: input.outletId,
    reportType: "opening",
  });

  if (!destination) {
    return { status: "destination_unavailable" };
  }

  const snapshot = buildTelegramOpeningSnapshot({
    shiftId: input.shiftId,
    outletId: input.outletId,
    outletCode: input.outletCode,
    outletName: input.outletName,
    businessDate: input.businessDate,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    openedAt: input.openedAt,
    openingCash: input.openingCash,
    timezone: destination.timezone,
  });

  const result = await enqueueTelegramDelivery(transaction, {
    organizationId: input.organizationId,
    eventKey: buildTelegramOpeningEventKey(input.outletId, input.businessDate),
    destinationId: destination.destinationId,
    outletId: input.outletId,
    reportType: "opening",
    businessDate: input.businessDate,
    payloadSnapshot: snapshot,
    messageText: formatTelegramOpeningMessage(snapshot),
    maxAttempts: input.maxAttempts,
  });

  return result.created
    ? { status: "enqueued", deliveryId: result.delivery.id }
    : { status: "duplicate", deliveryId: result.delivery.id };
}
