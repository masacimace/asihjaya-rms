import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const schemaSource = read("src/db/schema/index.ts");
const reopenSource = read("src/lib/shifts/shift-reopen.ts");
const closingSource = read("src/lib/shifts/shift-closing.ts");
const controlsSource = read(
  "src/components/pos/workspace/pos-shift-controls.tsx",
);
const pageSource = read("src/app/(pos)/pos/page.tsx");
const dailySource = read(
  "src/server/integrations/telegram/telegram-daily-service.ts",
);
const weeklySource = read(
  "src/server/integrations/telegram/telegram-weekly-service.ts",
);
const monthlySource = read(
  "src/server/integrations/telegram/telegram-monthly-service.ts",
);

function contains(source: string, value: string, label: string) {
  assert.ok(source.includes(value), `${label} belum ditemukan.`);
}

contains(
  schemaSource,
  '"shifts_outlet_business_date_uq"',
  "unique business-date shift tetap dipertahankan",
);
contains(
  schemaSource,
  'revision: integer("revision").default(1).notNull()',
  "finance revision",
);
contains(
  schemaSource,
  'supersededAt: timestamp("superseded_at"',
  "finance superseded marker",
);
contains(
  schemaSource,
  '"finance_closing_snapshots_current_shift_uq"',
  "single current finance snapshot",
);
contains(
  schemaSource,
  '"shift_reopened"',
  "Telegram shift_reopened report type",
);
contains(
  reopenSource,
  'auth.permissionCodes.includes("shifts.manage")',
  "same-day continuation permission guard",
);
contains(
  reopenSource,
  "shift.businessDate !== currentBusinessDate",
  "same business-date guard",
);
contains(
  reopenSource,
  'delivery.status === "processing"',
  "Telegram in-flight ambiguity guard",
);
contains(reopenSource, 'to: "cancelled"', "unsent closing cancellation");
contains(reopenSource, "supersededAt: now", "finance snapshot supersede");
contains(reopenSource, 'status: "open"', "same shift reopen");
contains(reopenSource, 'action: "shift.reopen"', "reopen audit");
contains(
  reopenSource,
  'reportType: "shift_reopened"',
  "reopen correction outbox",
);
contains(controlsSource, "Lanjutkan Shift Hari Ini", "POS same-day continuation UI");
contains(
  pageSource,
  'canContinueShift={auth.permissionCodes.includes("shifts.manage")}',
  "POS continuation permission exposure",
);
contains(
  dailySource,
  "financeClosingSnapshots.revision",
  "daily revisioned finance persistence",
);
contains(
  weeklySource,
  "isNull(financeClosingSnapshots.supersededAt)",
  "weekly current snapshot only",
);
contains(
  monthlySource,
  "isNull(financeClosingSnapshots.supersededAt)",
  "monthly current snapshot only",
);
assert.equal(
  reopenSource.includes("sendMessage("),
  false,
  "Reopen tidak boleh mengirim HTTP Telegram secara langsung.",
);
assert.equal(
  reopenSource.includes("fetch("),
  false,
  "Reopen tidak boleh melakukan HTTP request.",
);
assert.equal(
  closingSource.includes("DELETE FROM finance_closing_snapshots"),
  false,
  "Closing history tidak boleh dihapus.",
);

async function checkDatabase() {
  assert.ok(
    process.env.DATABASE_URL?.trim(),
    "DATABASE_URL wajib untuk --database.",
  );

  const { and, eq, isNull } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const {
    cashMovements,
    financeClosingSnapshots,
    organizations,
    outlets,
    registers,
    shifts,
    telegramDeliveryOutbox,
    telegramDestinations,
    telegramReportSettings,
    users,
  } = await import("@/db/schema");
  const { getBusinessDateKey } = await import("@/lib/time/business-time");
  const { transitionTelegramDelivery } =
    await import("@/server/integrations/telegram/telegram-outbox-repository");
  const { reopenClosedShift, ShiftReopenError } =
    await import("@/lib/shifts/shift-reopen");
  const { closeShiftWithReconciliation } =
    await import("@/lib/shifts/shift-closing");

  const organizationId = randomUUID();
  const outletId = randomUUID();
  const registerId = randomUUID();
  const managerId = randomUUID();
  const cashierId = randomUUID();
  const shiftId = randomUUID();
  const destinationId = randomUUID();
  const businessDate = getBusinessDateKey(new Date(), "Asia/Jakarta");
  const openedAt = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const closedAt = new Date(Date.now() - 5 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({
      id: organizationId,
      name: "Controlled Reopen Test",
      slug: `controlled-reopen-${organizationId.slice(0, 8)}`,
      timezone: "Asia/Jakarta",
    });
    await tx
      .insert(outlets)
      .values({
        id: outletId,
        organizationId,
        code: "CRT",
        name: "Controlled Reopen Outlet",
      });
    await tx
      .insert(registers)
      .values({
        id: registerId,
        outletId,
        code: "POS-1",
        name: "POS 1",
        isHardwareHub: true,
      });
    await tx.insert(users).values([
      {
        id: managerId,
        organizationId,
        email: `manager-${managerId.slice(0, 8)}@example.test`,
        username: `manager_${managerId.slice(0, 8)}`,
        fullName: "Manager Reopen",
      },
      {
        id: cashierId,
        organizationId,
        email: `cashier-${cashierId.slice(0, 8)}@example.test`,
        username: `cashier_${cashierId.slice(0, 8)}`,
        fullName: "Cashier Reopen",
      },
    ]);
    await tx.insert(shifts).values({
      id: shiftId,
      outletId,
      registerId,
      openedBy: cashierId,
      closedBy: managerId,
      status: "closed",
      businessDate,
      openingCash: "500000",
      expectedCash: "500000",
      actualCash: "500000",
      cashVariance: "0",
      openedAt,
      closedAt,
    });
    await tx.insert(cashMovements).values({
      shiftId,
      type: "opening_balance",
      amount: "500000",
      referenceType: "shift",
      referenceId: shiftId,
      reason: "Opening balance test",
      createdBy: cashierId,
      createdAt: openedAt,
    });
    await tx.insert(financeClosingSnapshots).values({
      shiftId,
      organizationId,
      outletId,
      businessDate,
      revision: 1,
      grossSales: "0",
      discountTotal: "0",
      netSales: "0",
      costSnapshotComplete: true,
      costOfGoods: "0",
      grossMargin: "0",
      grossMarginRate: "0.0000",
      cashTotal: "0",
      bankTransferTotal: "0",
      debitCardTotal: "0",
      creditCardTotal: "0",
      customerDepositOpeningBalance: "0",
      customerDepositIn: "0",
      customerDepositUsed: "0",
      customerDepositWithdrawal: "0",
      customerDepositAdjustmentIn: "0",
      customerDepositAdjustmentOut: "0",
      customerDepositClosingBalance: "0",
      expectedCash: "500000",
      actualCash: "500000",
      cashVariance: "0",
      transactionCount: 0,
      itemsSoldCount: 0,
      heldTransactionCount: 0,
      openedAt,
      closedAt,
      cashierId,
    });
    await tx.insert(telegramDestinations).values({
      id: destinationId,
      organizationId,
      outletId,
      name: "Controlled Reopen Group",
      chatId: `-100${String(Date.now()).slice(-10)}`,
      isActive: true,
      createdBy: managerId,
      updatedBy: managerId,
    });
    await tx.insert(telegramReportSettings).values({
      destinationId,
      openingEnabled: true,
      closingDailyEnabled: true,
      weeklyEnabled: false,
      monthlyEnabled: false,
      timezone: "Asia/Jakarta",
      isActive: true,
    });
    await tx.insert(telegramDeliveryOutbox).values({
      organizationId,
      eventKey: `daily-finance:${outletId}:${businessDate}`,
      destinationId,
      outletId,
      reportType: "closing_daily",
      businessDate,
      payloadSnapshotJson: { revision: 1 },
      messageText: "closing revision 1",
      status: "pending",
      attemptCount: 0,
      maxAttempts: 5,
    });
  });

  const makeAuth = (permissionCodes: string[]) => ({
    session: { id: randomUUID(), expiresAt: new Date(Date.now() + 60_000) },
    organization: {
      id: organizationId,
      name: "Controlled Reopen Test",
      slug: "controlled-reopen-test",
      timezone: "Asia/Jakarta",
    },
    user: {
      id: managerId,
      email: "manager@example.test",
      username: "manager",
      fullName: "Manager Reopen",
    },
    roles: [],
    permissionCodes,
    outlets: [
      {
        id: outletId,
        code: "CRT",
        name: "Controlled Reopen Outlet",
        isPrimary: true,
      },
    ],
  });

  await assert.rejects(
    () =>
      reopenClosedShift({
        auth: makeAuth(["pos.access"]),
        shiftId,
        reason: "Tidak memiliki akses pengelolaan shift",
        source: "pos.reopen_shift",
        requestMetadata: { ipAddress: null, userAgent: null },
      }),
    (error: unknown) =>
      error instanceof ShiftReopenError &&
      error.message.includes("shifts.manage"),
  );

  const auth = makeAuth(["shifts.manage"]);
  const firstReopen = await reopenClosedShift({
    auth,
    shiftId,
    reason: "Shift ditutup terlalu cepat saat toko masih beroperasi.",
    source: "pos.reopen_shift",
    requestMetadata: { ipAddress: "127.0.0.1", userAgent: "reopen-test" },
  });
  assert.equal(firstReopen.cancelledDeliveryCount, 1);
  assert.equal(firstReopen.previouslySentReportTypes.length, 0);

  const [reopenedShift] = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);
  assert.equal(reopenedShift?.status, "open");
  assert.equal(reopenedShift?.closedAt, null);
  assert.equal(reopenedShift?.actualCash, null);
  const [rev1] = await db
    .select()
    .from(financeClosingSnapshots)
    .where(
      and(
        eq(financeClosingSnapshots.shiftId, shiftId),
        eq(financeClosingSnapshots.revision, 1),
      ),
    )
    .limit(1);
  assert.ok(rev1?.supersededAt, "Revision 1 harus superseded setelah reopen.");

  await closeShiftWithReconciliation({
    auth,
    shiftId,
    actualCash: 500000,
    varianceReason: null,
    source: "pos.close_shift",
    requestMetadata: { ipAddress: null, userAgent: "reopen-test" },
  });

  const currentSnapshots = await db
    .select({ revision: financeClosingSnapshots.revision })
    .from(financeClosingSnapshots)
    .where(
      and(
        eq(financeClosingSnapshots.shiftId, shiftId),
        isNull(financeClosingSnapshots.supersededAt),
      ),
    );
  assert.deepEqual(
    currentSnapshots.map((row) => row.revision),
    [2],
  );

  const [revisionTwoDelivery] = await db
    .select()
    .from(telegramDeliveryOutbox)
    .where(
      eq(
        telegramDeliveryOutbox.eventKey,
        `daily-finance:${outletId}:${businessDate}:r2`,
      ),
    )
    .limit(1);
  assert.equal(revisionTwoDelivery?.reportType, "closing_daily");
  assert.equal(revisionTwoDelivery?.status, "pending");

  await db.transaction(async (tx) => {
    const processingAt = new Date();
    await transitionTelegramDelivery(tx, {
      deliveryId: revisionTwoDelivery!.id,
      from: "pending",
      to: "processing",
      attemptCount: 0,
      maxAttempts: revisionTwoDelivery!.maxAttempts,
      lockedAt: processingAt,
      lockedBy: "controlled-reopen-test",
    });
    await transitionTelegramDelivery(tx, {
      deliveryId: revisionTwoDelivery!.id,
      from: "processing",
      to: "sent",
      attemptCount: 1,
      maxAttempts: revisionTwoDelivery!.maxAttempts,
      sentAt: new Date(),
      telegramMessageId: "controlled-reopen-message-2",
    });
  });

  const secondReopen = await reopenClosedShift({
    auth,
    shiftId,
    reason: "Toko kembali menerima customer setelah closing kedua.",
    source: "pos.reopen_shift",
    requestMetadata: { ipAddress: null, userAgent: "reopen-test" },
  });
  assert.deepEqual(secondReopen.previouslySentReportTypes, ["closing_daily"]);
  assert.ok(
    secondReopen.reopenNoticeStatus === "enqueued" ||
      secondReopen.reopenNoticeStatus === "integration_disabled",
    `Unexpected reopen notice status ${secondReopen.reopenNoticeStatus}`,
  );

  if (secondReopen.reopenNoticeStatus === "enqueued") {
    const [notice] = await db
      .select()
      .from(telegramDeliveryOutbox)
      .where(
        eq(telegramDeliveryOutbox.eventKey, `shift-reopened:${shiftId}:r2`),
      )
      .limit(1);
    assert.equal(notice?.reportType, "shift_reopened");
    assert.equal(notice?.status, "pending");
  }

  const movementRows = await db
    .select({ type: cashMovements.type })
    .from(cashMovements)
    .where(eq(cashMovements.shiftId, shiftId));
  assert.equal(
    movementRows.filter((row) => row.type === "opening_balance").length,
    1,
    "Reopen tidak boleh membuat modal/opening_balance baru.",
  );

  console.log(
    "Controlled shift reopen database contract passed: same shift, permission guard, cancellation, superseded snapshot, revision 2 closing, correction notice, dan cash continuity.",
  );
}

if (process.argv.includes("--database")) {
  await checkDatabase();
}

console.log("Controlled shift reopen static contract passed.");
