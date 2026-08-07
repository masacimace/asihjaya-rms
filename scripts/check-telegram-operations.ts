import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const source = (relativePath: string) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const packageJson = JSON.parse(source("package.json")) as {
  scripts?: Record<string, string>;
};
assert.equal(
  packageJson.scripts?.["telegram:reconcile-reports"],
  "tsx scripts/run-telegram-report-reconciliation.ts",
);
assert.equal(
  packageJson.scripts?.["check:telegram-operations"],
  "tsx scripts/check-telegram-operations.ts",
);

const compose = source("compose.production.yaml");
for (const contract of [
  "  telegram-runtime:",
  "- telegram",
  "ASIHJAYA_OPERATIONS_IMAGE",
  "NODE_ENV: production",
  "- edge",
  "- backend",
]) {
  assert.ok(compose.includes(contract), `Compose Telegram runtime wajib memuat ${contract}.`);
}

const dockerfile = source("Dockerfile");
for (const contract of [
  "COPY src/db ./src/db",
  "COPY src/lib/time ./src/lib/time",
  "COPY src/server/integrations/telegram ./src/server/integrations/telegram",
]) {
  assert.ok(dockerfile.includes(contract), `Operations image wajib memuat ${contract}.`);
}
assert.equal(/COPY\s+.*\.env/i.test(dockerfile), false, "Dockerfile tidak boleh menyalin secret env.");

const wrapper = source("ops/scripts/ajsystem-telegram-reporting");
for (const contract of [
  "delivery|reconcile|status",
  "ASIHJAYA_OPERATIONS_IMAGE",
  "org.opencontainers.image.version",
  "org.opencontainers.image.revision",
  "telegram:deliver",
  "telegram:reconcile-reports",
  "write_success_marker",
  "${job}-success.epoch",
  "telegram_delivery_outbox",
]) {
  assert.ok(wrapper.includes(contract), `Telegram ops wrapper wajib memuat ${contract}.`);
}
assert.equal(wrapper.includes("TELEGRAM_BOT_TOKEN="), false, "Wrapper tidak boleh mencetak/menetapkan bot token.");

const installer = source("ops/scripts/ajsystem-install-telegram-reporting");
for (const contract of [
  "install|verify|uninstall",
  "APP_REVISION",
  "git -C \"$PROJECT_DIR\" rev-parse HEAD",
  "systemd-analyze verify",
  "Timer sengaja BELUM di-enable",
  "ajsystem-telegram-reporting",
  "ajsystem-monitor",
]) {
  assert.ok(installer.includes(contract), `Installer Telegram wajib memuat ${contract}.`);
}
assert.equal(
  installer.includes("systemctl enable --now"),
  false,
  "Installer tidak boleh mengaktifkan timer sebelum production acceptance.",
);

const units = {
  deliveryService: source("ops/systemd/ajsystem-telegram-delivery.service"),
  deliveryTimer: source("ops/systemd/ajsystem-telegram-delivery.timer"),
  reconcileService: source("ops/systemd/ajsystem-telegram-report-reconcile.service"),
  reconcileTimer: source("ops/systemd/ajsystem-telegram-report-reconcile.timer"),
};
for (const service of [units.deliveryService, units.reconcileService]) {
  for (const contract of [
    "Type=oneshot",
    "User=ubuntu",
    "SupplementaryGroups=docker",
    "ProtectSystem=strict",
    "NoNewPrivileges=true",
    "ConditionPathExists=/var/lib/asihjaya-rms/deployments/current.env",
  ]) {
    assert.ok(service.includes(contract), `Telegram systemd service wajib memuat ${contract}.`);
  }
  assert.equal(service.includes("TELEGRAM_BOT_TOKEN"), false, "Systemd unit tidak boleh memuat bot token.");
}
assert.ok(units.deliveryService.includes("ajsystem-telegram-reporting delivery"));
assert.ok(units.reconcileService.includes("ajsystem-telegram-reporting reconcile"));
assert.ok(units.deliveryTimer.includes("OnUnitInactiveSec=2min"));
assert.ok(units.reconcileTimer.includes("OnUnitInactiveSec=1h"));

const monitor = source("ops/scripts/ajsystem-monitor");
for (const contract of [
  "check_telegram_reporting",
  "ajsystem-telegram-delivery.timer",
  "ajsystem-telegram-report-reconcile.timer",
  "delivery-success.epoch",
  "reconcile-success.epoch",
  "telegram_pending",
  "telegram_retry",
  "telegram_failed",
  "telegram_oldest_pending_age_seconds",
]) {
  assert.ok(monitor.includes(contract), `AJSystem monitor wajib memuat ${contract}.`);
}
assert.ok(
  monitor.includes("issue warning telegram_"),
  "Telegram degradation harus menjadi warning agar health utama POS tidak gagal karena kanal Telegram.",
);

const reconciliation = source(
  "src/server/integrations/telegram/telegram-report-reconciliation.ts",
);
for (const contract of [
  "financeClosingSnapshots",
  "getWeeklyPeriodForBusinessDate",
  "getMonthlyPeriodForBusinessDate",
  "enqueueTelegramWeeklyPeriodInTransaction",
  "enqueueTelegramMonthlyPeriodInTransaction",
  "settingsUpdatedAt",
  "TELEGRAM_RECONCILIATION_PERIOD_LIMIT",
]) {
  assert.ok(reconciliation.includes(contract), `Reconciliation wajib memuat ${contract}.`);
}
assert.equal(reconciliation.includes("sendMessage("), false, "Reconciliation tidak boleh mengirim Telegram langsung.");

async function checkDatabase() {
  assert.ok(process.env.DATABASE_URL?.trim(), "DATABASE_URL wajib untuk --database.");
  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const {
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
  const { reconcileTelegramReports } = await import(
    "@/server/integrations/telegram/telegram-report-reconciliation"
  );

  const organizationId = randomUUID();
  const outletId = randomUUID();
  const registerId = randomUUID();
  const userId = randomUUID();
  const destinationId = randomUUID();

  await db.transaction(async (transaction) => {
    await transaction.insert(organizations).values({
      id: organizationId,
      name: "Telegram Reconciliation Test",
      slug: `telegram-reconcile-${organizationId.slice(0, 8)}`,
      timezone: "Asia/Jakarta",
    });
    await transaction.insert(outlets).values({
      id: outletId,
      organizationId,
      code: "TGR",
      name: "Telegram Reconciliation Outlet",
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
      email: `telegram-reconcile-${userId.slice(0, 8)}@example.test`,
      username: `telegram_reconcile_${userId.slice(0, 8)}`,
      fullName: "Telegram Reconciliation Cashier",
    });
    await transaction.insert(telegramDestinations).values({
      id: destinationId,
      organizationId,
      outletId,
      name: "Reconciliation Development Group",
      chatId: `-${Date.now()}`,
      createdBy: userId,
      updatedBy: userId,
    });
    await transaction.insert(telegramReportSettings).values({
      destinationId,
      weeklyEnabled: true,
      monthlyEnabled: true,
      timezone: "Asia/Jakarta",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    });
  });

  async function insertSnapshot(businessDate: string, netSales: string) {
    const shiftId = randomUUID();
    const openedAt = new Date(`${businessDate}T01:00:00.000Z`);
    const closedAt = new Date(`${businessDate}T10:00:00.000Z`);
    await db.transaction(async (transaction) => {
      await transaction.insert(shifts).values({
        id: shiftId,
        outletId,
        registerId,
        openedBy: userId,
        status: "closed",
        businessDate,
        openingCash: "1000000",
        expectedCash: "1000000",
        actualCash: "1000000",
        cashVariance: "0",
        closedBy: userId,
        openedAt,
        closedAt,
      });
      await transaction.insert(financeClosingSnapshots).values({
        shiftId,
        organizationId,
        outletId,
        businessDate,
        grossSales: netSales,
        discountTotal: "0",
        netSales,
        costSnapshotComplete: true,
        costOfGoods: "500000",
        grossMargin: String(Number(netSales) - 500000),
        grossMarginRate: "50.0000",
        cashTotal: netSales,
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
        expectedCash: "1000000",
        actualCash: "1000000",
        cashVariance: "0",
        transactionCount: 1,
        itemsSoldCount: 1,
        heldTransactionCount: 0,
        pendingApprovalCount: 0,
        openedAt,
        closedAt,
        cashierId: userId,
        createdAt: closedAt,
      });
    });
  }

  await insertSnapshot("2026-07-27", "1000000");
  await insertSnapshot("2026-08-03", "1100000");
  await insertSnapshot("2026-08-17", "1200000");
  await insertSnapshot("2026-08-31", "1300000");

  const first = await reconcileTelegramReports({
    maxAttempts: 5,
    now: new Date("2026-09-02T03:00:00.000Z"),
  });
  assert.ok(first.enqueued >= 4, `Reconciliation harus membuat beberapa weekly/monthly event, ditemukan ${first.enqueued}.`);
  assert.equal(first.capped, false);

  const rows = await db
    .select({
      eventKey: telegramDeliveryOutbox.eventKey,
      reportType: telegramDeliveryOutbox.reportType,
    })
    .from(telegramDeliveryOutbox)
    .where(eq(telegramDeliveryOutbox.destinationId, destinationId));
  assert.ok(rows.some((row) => row.eventKey.startsWith(`weekly-finance:${outletId}:`)));
  assert.ok(rows.some((row) => row.eventKey === `monthly-finance:${outletId}:2026-08`));

  const second = await reconcileTelegramReports({
    maxAttempts: 5,
    now: new Date("2026-09-02T03:00:00.000Z"),
  });
  assert.equal(second.enqueued, 0, "Reconciliation kedua harus idempotent.");
  assert.ok(second.duplicate >= first.enqueued, "Reconciliation kedua harus menemukan duplicate existing events.");

  const afterRows = await db
    .select({ id: telegramDeliveryOutbox.id })
    .from(telegramDeliveryOutbox)
    .where(
      and(
        eq(telegramDeliveryOutbox.destinationId, destinationId),
        eq(telegramDeliveryOutbox.organizationId, organizationId),
      ),
    );
  assert.equal(afterRows.length, rows.length, "Reconciliation kedua tidak boleh menambah duplicate row.");

  await db.delete(telegramDeliveryOutbox).where(eq(telegramDeliveryOutbox.destinationId, destinationId));
  await db
    .update(telegramReportSettings)
    .set({ updatedAt: new Date("2026-08-15T00:00:00.000Z") })
    .where(eq(telegramReportSettings.destinationId, destinationId));

  const cutoff = await reconcileTelegramReports({
    maxAttempts: 5,
    now: new Date("2026-09-02T03:00:00.000Z"),
  });
  assert.ok(cutoff.skippedBeforeSettings >= 3, "Period sebelum settings cutoff harus dilewati.");
  const cutoffRows = await db
    .select({ eventKey: telegramDeliveryOutbox.eventKey })
    .from(telegramDeliveryOutbox)
    .where(eq(telegramDeliveryOutbox.destinationId, destinationId));
  assert.ok(
    cutoffRows.every(
      (row) =>
        !row.eventKey.includes(":2026-07-27") &&
        !row.eventKey.includes(":2026-08-03") &&
        !row.eventKey.endsWith(":2026-07"),
    ),
    "Reconciliation tidak boleh backfill period sebelum settings activation cutoff.",
  );
}

if (process.argv.includes("--database")) {
  await checkDatabase();
}

console.log(
  "Telegram 2C.10 operations checks passed: reconciliation, immutable operations runtime, systemd oneshot/timers, installer, monitor integration, dan idempotency contract.",
);
