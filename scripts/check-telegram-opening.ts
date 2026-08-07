import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { getBusinessDateKey } from "@/lib/time/business-time";
import {
  buildTelegramOpeningEventKey,
  buildTelegramOpeningSnapshot,
  formatTelegramOpeningMessage,
} from "@/server/integrations/telegram/telegram-opening-report";
import { getTelegramRuntimeOutboxConfig } from "@/server/integrations/telegram/telegram-runtime-config";

const projectRoot = process.cwd();
const actionSource = readFileSync(
  path.join(projectRoot, "src", "app", "actions", "pos.ts"),
  "utf8",
);
const serviceSource = readFileSync(
  path.join(
    projectRoot,
    "src",
    "server",
    "integrations",
    "telegram",
    "telegram-opening-service.ts",
  ),
  "utf8",
);

function assertContains(source: string, value: string, label: string) {
  assert.ok(source.includes(value), `${label} belum ditemukan.`);
}

const openingActionStart = actionSource.indexOf(
  "export async function openPosShiftAction",
);
assert.ok(openingActionStart >= 0, "openPosShiftAction tidak ditemukan.");
const openingAction = actionSource.slice(openingActionStart);

for (const [value, label] of [
  [
    "const businessDate = getBusinessDateKey(now, auth.organization.timezone);",
    "business date opening dari timezone organisasi",
  ],
  ["businessDate,", "persist shifts.business_date"],
  [
    "await enqueueTelegramOpeningNotification(transaction, {",
    "enqueue opening di transaction yang sama",
  ],
  ["cashierName: auth.user.fullName", "snapshot kasir utama"],
  ["openingCash: openingCashAmount", "snapshot kas awal"],
] as const) {
  assertContains(openingAction, value, label);
}

assert.equal(
  serviceSource.includes("sendMessage("),
  false,
  "Opening service tidak boleh memanggil Telegram sendMessage.",
);
assert.equal(
  serviceSource.includes("fetch("),
  false,
  "Opening service tidak boleh melakukan HTTP request.",
);
assert.equal(
  serviceSource.includes("telegram-client"),
  false,
  "Opening service tidak boleh bergantung pada Telegram client runtime.",
);

const openedAt = new Date("2026-08-07T01:02:00.000Z");
assert.equal(
  getBusinessDateKey(openedAt, "Asia/Jakarta"),
  "2026-08-07",
  "Business date opening Asia/Jakarta salah.",
);
assert.equal(
  getBusinessDateKey(new Date("2026-08-31T17:30:00.000Z"), "Asia/Jakarta"),
  "2026-09-01",
  "Business date opening harus mengikuti calendar timezone organisasi.",
);

const outletId = "20000000-0000-0000-0000-000000000001";
const shiftId = "80000000-0000-0000-0000-000000000001";
const cashierId = "40000000-0000-0000-0000-000000000001";
const businessDate = "2026-08-07";

assert.equal(
  buildTelegramOpeningEventKey(outletId, businessDate),
  `outlet-opened:${outletId}:${businessDate}`,
);

const snapshot = buildTelegramOpeningSnapshot({
  shiftId,
  outletId,
  outletCode: "PBG",
  outletName: "Pasar Bantar Gebang",
  businessDate,
  cashierId,
  cashierName: "Rosalia Manda",
  openedAt,
  openingCash: "2000000",
  timezone: "Asia/Jakarta",
});

assert.deepEqual(snapshot, {
  schemaVersion: 1,
  reportType: "opening",
  shiftId,
  outlet: {
    id: outletId,
    code: "PBG",
    name: "Pasar Bantar Gebang",
  },
  businessDate,
  cashier: {
    id: cashierId,
    name: "Rosalia Manda",
  },
  openedAt: "2026-08-07T01:02:00.000Z",
  openingCash: "2000000",
  timezone: "Asia/Jakarta",
});

const message = formatTelegramOpeningMessage(snapshot);
for (const expected of [
  "🟢 OUTLET DIBUKA",
  "Outlet: Pasar Bantar Gebang",
  "Tanggal operasional: 7 Agustus 2026",
  "Kasir utama: Rosalia Manda",
  "Waktu buka: 08:02 WIB",
  "Kas awal: Rp2.000.000",
  `Shift: ${shiftId}`,
  "Status: Operasional dimulai",
]) {
  assert.ok(message.includes(expected), `Opening message kurang field: ${expected}`);
}
assert.ok(message.length <= 4096, "Opening message melebihi limit Telegram.");

assert.deepEqual(getTelegramRuntimeOutboxConfig({}), {
  enabled: false,
  maxAttempts: 5,
});
assert.deepEqual(
  getTelegramRuntimeOutboxConfig({
    TELEGRAM_INTEGRATION_ENABLED: "true",
    TELEGRAM_MAX_ATTEMPTS: "7",
  }),
  { enabled: true, maxAttempts: 7 },
);
assert.deepEqual(
  getTelegramRuntimeOutboxConfig({
    TELEGRAM_INTEGRATION_ENABLED: "true",
    TELEGRAM_MAX_ATTEMPTS: "invalid",
  }),
  { enabled: true, maxAttempts: 5 },
);

async function checkDatabase() {
  assert.ok(process.env.DATABASE_URL?.trim(), "DATABASE_URL wajib untuk --database.");

  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const {
    organizations,
    outlets,
    registers,
    shifts,
    telegramDeliveryOutbox,
    telegramDestinations,
    telegramReportSettings,
    users,
  } = await import("@/db/schema");
  const { enqueueTelegramOpeningNotification } = await import(
    "@/server/integrations/telegram/telegram-opening-service"
  );

  const organizationId = randomUUID();
  const outletId = randomUUID();
  const registerId = randomUUID();
  const userId = randomUUID();
  const destinationId = randomUUID();
  const shiftId = randomUUID();
  const eventKey = `outlet-opened:${outletId}:2026-08-07`;

  let firstStatus = "";
  let duplicateStatus = "";

  await db.transaction(async (transaction) => {
    await transaction.insert(organizations).values({
      id: organizationId,
      name: "Telegram Opening Test",
      slug: `telegram-opening-${organizationId.slice(0, 8)}`,
      timezone: "Asia/Jakarta",
    });
    await transaction.insert(outlets).values({
      id: outletId,
      organizationId,
      code: "TGO",
      name: "Telegram Opening Outlet",
    });
    await transaction.insert(registers).values({
      id: registerId,
      outletId,
      code: "POS-1",
      name: "POS 1",
      isHardwareHub: true,
    });
    await transaction.insert(users).values({
      id: userId,
      organizationId,
      email: `telegram-opening-${userId.slice(0, 8)}@example.test`,
      username: `telegram_opening_${userId.slice(0, 8)}`,
      fullName: "Telegram Opening Cashier",
    });
    await transaction.insert(telegramDestinations).values({
      id: destinationId,
      organizationId,
      outletId,
      name: "Opening Development Group",
      chatId: `-${Date.now()}`,
      createdBy: userId,
      updatedBy: userId,
    });
    await transaction.insert(telegramReportSettings).values({
      destinationId,
      openingEnabled: true,
      timezone: "Asia/Jakarta",
    });
    await transaction.insert(shifts).values({
      id: shiftId,
      outletId,
      registerId,
      openedBy: userId,
      status: "open",
      businessDate: "2026-08-07",
      openingCash: "2000000",
      expectedCash: "2000000",
      openedAt,
    });

    const input = {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGO",
      outletName: "Telegram Opening Outlet",
      shiftId,
      businessDate: "2026-08-07",
      cashierId: userId,
      cashierName: "Telegram Opening Cashier",
      openedAt,
      openingCash: "2000000",
    } as const;

    firstStatus = (await enqueueTelegramOpeningNotification(transaction, input)).status;
    duplicateStatus = (
      await enqueueTelegramOpeningNotification(transaction, input)
    ).status;
  });

  assert.equal(firstStatus, "enqueued", "Opening pertama harus membuat outbox.");
  assert.equal(duplicateStatus, "duplicate", "Opening duplicate harus idempotent.");

  const deliveries = await db
    .select()
    .from(telegramDeliveryOutbox)
    .where(eq(telegramDeliveryOutbox.eventKey, eventKey));
  assert.equal(deliveries.length, 1, "Duplicate opening tidak boleh membuat dua delivery.");
  assert.equal(deliveries[0]?.status, "pending");
  assert.equal(deliveries[0]?.reportType, "opening");
  assert.equal(deliveries[0]?.businessDate, "2026-08-07");
  assert.equal(deliveries[0]?.attemptCount, 0);
  assert.equal(deliveries[0]?.maxAttempts, 5);
  assert.equal(deliveries[0]?.telegramMessageId, null);
  assert.equal(deliveries[0]?.lastErrorMessage, null);

  const payload = deliveries[0]?.payloadSnapshotJson as
    | { shiftId?: string; openingCash?: string }
    | undefined;
  assert.equal(payload?.shiftId, shiftId);
  assert.equal(payload?.openingCash, "2000000");
  assert.ok(deliveries[0]?.messageText.includes("🟢 OUTLET DIBUKA"));

  await db.transaction(async (transaction) => {
    await transaction
      .update(telegramReportSettings)
      .set({ openingEnabled: false })
      .where(eq(telegramReportSettings.destinationId, destinationId));

    const result = await enqueueTelegramOpeningNotification(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGO",
      outletName: "Telegram Opening Outlet",
      shiftId,
      businessDate: "2026-08-08",
      cashierId: userId,
      cashierName: "Telegram Opening Cashier",
      openedAt: new Date("2026-08-08T01:00:00.000Z"),
      openingCash: "1000000",
    });
    assert.equal(result.status, "destination_unavailable");
  });

  const disabledRows = await db
    .select({ id: telegramDeliveryOutbox.id })
    .from(telegramDeliveryOutbox)
    .where(eq(telegramDeliveryOutbox.businessDate, "2026-08-08"));
  assert.equal(disabledRows.length, 0, "opening_enabled=false tidak boleh enqueue.");

  await db.transaction(async (transaction) => {
    await transaction
      .update(telegramReportSettings)
      .set({ openingEnabled: true })
      .where(eq(telegramReportSettings.destinationId, destinationId));
    await transaction
      .update(telegramDestinations)
      .set({ isActive: false })
      .where(eq(telegramDestinations.id, destinationId));

    const result = await enqueueTelegramOpeningNotification(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGO",
      outletName: "Telegram Opening Outlet",
      shiftId,
      businessDate: "2026-08-09",
      cashierId: userId,
      cashierName: "Telegram Opening Cashier",
      openedAt: new Date("2026-08-09T01:00:00.000Z"),
      openingCash: "1000000",
    });
    assert.equal(result.status, "destination_unavailable");
  });

  const inactiveDestinationRows = await db
    .select({ id: telegramDeliveryOutbox.id })
    .from(telegramDeliveryOutbox)
    .where(eq(telegramDeliveryOutbox.businessDate, "2026-08-09"));
  assert.equal(
    inactiveDestinationRows.length,
    0,
    "Destination inactive tidak boleh enqueue opening.",
  );

  await db.transaction(async (transaction) => {
    const result = await enqueueTelegramOpeningNotification(transaction, {
      integrationEnabled: false,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGO",
      outletName: "Telegram Opening Outlet",
      shiftId,
      businessDate: "2026-08-11",
      cashierId: userId,
      cashierName: "Telegram Opening Cashier",
      openedAt: new Date("2026-08-11T01:00:00.000Z"),
      openingCash: "1000000",
    });
    assert.equal(result.status, "integration_disabled");

    await transaction
      .update(telegramDestinations)
      .set({ isActive: true })
      .where(eq(telegramDestinations.id, destinationId));
  });

  const rollbackShiftId = randomUUID();
  const rollbackEventKey = `outlet-opened:${outletId}:2026-08-10`;
  await assert.rejects(
    db.transaction(async (transaction) => {
      await transaction.insert(shifts).values({
        id: rollbackShiftId,
        outletId,
        registerId,
        openedBy: userId,
        status: "closed",
        businessDate: "2026-08-10",
        openingCash: "500000",
        expectedCash: "500000",
        actualCash: "500000",
        cashVariance: "0",
        closedBy: userId,
        openedAt: new Date("2026-08-10T01:00:00.000Z"),
        closedAt: new Date("2026-08-10T02:00:00.000Z"),
      });

      const result = await enqueueTelegramOpeningNotification(transaction, {
        integrationEnabled: true,
        maxAttempts: 5,
        organizationId,
        outletId,
        outletCode: "TGO",
        outletName: "Telegram Opening Outlet",
        shiftId: rollbackShiftId,
        businessDate: "2026-08-10",
        cashierId: userId,
        cashierName: "Telegram Opening Cashier",
        openedAt: new Date("2026-08-10T01:00:00.000Z"),
        openingCash: "500000",
      });
      assert.equal(result.status, "enqueued");
      throw new Error("ROLLBACK_OPENING_TEST");
    }),
    /ROLLBACK_OPENING_TEST/,
  );

  const [rolledBackShift] = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(eq(shifts.id, rollbackShiftId));
  const [rolledBackDelivery] = await db
    .select({ id: telegramDeliveryOutbox.id })
    .from(telegramDeliveryOutbox)
    .where(
      and(
        eq(telegramDeliveryOutbox.eventKey, rollbackEventKey),
        eq(telegramDeliveryOutbox.destinationId, destinationId),
      ),
    );
  assert.equal(rolledBackShift, undefined, "Rollback transaction harus menghapus shift test.");
  assert.equal(
    rolledBackDelivery,
    undefined,
    "Rollback transaction harus menghapus opening outbox test.",
  );
}

if (process.argv.includes("--database")) {
  await checkDatabase();
}

console.log(
  "Telegram 2C.4 opening checks passed: business date, immutable snapshot, formatter, feature/settings guards, idempotency, transaction rollback, dan no HTTP in opening path.",
);
