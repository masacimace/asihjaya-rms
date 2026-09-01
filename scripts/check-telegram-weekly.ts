import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildTelegramWeeklyFinanceEventKey,
  buildTelegramWeeklyFinanceSnapshot,
  calculateWeeklyNetSalesChangeRate,
  formatTelegramWeeklyFinanceMessage,
  getLatestCompletedWeeklyPeriod,
  getPreviousWeeklyPeriod,
  getWeeklyPeriodForBusinessDate,
} from "@/server/integrations/telegram/telegram-weekly-report";

const projectRoot = process.cwd();
const closingSource = readFileSync(
  path.join(projectRoot, "src", "lib", "shifts", "shift-closing.ts"),
  "utf8",
);
const serviceSource = readFileSync(
  path.join(
    projectRoot,
    "src",
    "server",
    "integrations",
    "telegram",
    "telegram-weekly-service.ts",
  ),
  "utf8",
);

function assertContains(source: string, value: string, label: string) {
  assert.ok(source.includes(value), `${label} belum ditemukan.`);
}

assertContains(
  closingSource,
  "await finalizeTelegramWeeklyAfterClosingInTransaction(transaction, {",
  "weekly generation di closing transaction",
);
assertContains(
  serviceSource,
  "financeClosingSnapshots",
  "weekly aggregation dari finance closing snapshots",
);
assertContains(
  serviceSource,
  'reportType: "weekly"',
  "weekly destination guard",
);
assertContains(
  serviceSource,
  "gte(financeClosingSnapshots.businessDate, input.period.start)",
  "weekly business date period start",
);
assertContains(
  serviceSource,
  "lte(financeClosingSnapshots.businessDate, input.period.end)",
  "weekly business date period end",
);
assert.equal(
  serviceSource.includes("sendMessage("),
  false,
  "Weekly service tidak boleh mengirim HTTP Telegram.",
);
assert.equal(
  serviceSource.includes("fetch("),
  false,
  "Weekly service tidak boleh melakukan HTTP request.",
);

assert.deepEqual(getWeeklyPeriodForBusinessDate("2026-08-03"), {
  start: "2026-08-03",
  end: "2026-08-09",
});
assert.deepEqual(getWeeklyPeriodForBusinessDate("2026-08-09"), {
  start: "2026-08-03",
  end: "2026-08-09",
});
assert.deepEqual(getWeeklyPeriodForBusinessDate("2026-09-06"), {
  start: "2026-08-31",
  end: "2026-09-06",
});
assert.deepEqual(getLatestCompletedWeeklyPeriod("2026-08-09"), {
  start: "2026-08-03",
  end: "2026-08-09",
});
assert.deepEqual(
  getLatestCompletedWeeklyPeriod("2026-08-10"),
  { start: "2026-08-03", end: "2026-08-09" },
  "Closing Senin harus mengejar report minggu yang baru selesai.",
);
assert.deepEqual(
  getLatestCompletedWeeklyPeriod("2026-08-14"),
  { start: "2026-08-03", end: "2026-08-09" },
  "Closing Jumat tidak boleh membuat report minggu berjalan yang belum selesai.",
);
assert.deepEqual(
  getPreviousWeeklyPeriod({ start: "2026-08-03", end: "2026-08-09" }),
  { start: "2026-07-27", end: "2026-08-02" },
);

const outletId = "20000000-0000-0000-0000-000000000001";
assert.equal(
  buildTelegramWeeklyFinanceEventKey(outletId, "2026-08-03"),
  `weekly-finance:${outletId}:2026-08-03`,
);
assert.equal(calculateWeeklyNetSalesChangeRate("30000000", "25000000"), "20.0");
assert.equal(calculateWeeklyNetSalesChangeRate("22500000", "25000000"), "-10.0");
assert.equal(calculateWeeklyNetSalesChangeRate("100000", "0"), null);
assert.equal(calculateWeeklyNetSalesChangeRate("100000", null), null);

const snapshot = buildTelegramWeeklyFinanceSnapshot({
  outlet: {
    id: outletId,
    code: "PBG",
    name: "Pasar Bantar Gebang",
  },
  period: { start: "2026-08-03", end: "2026-08-09" },
  timezone: "Asia/Jakarta",
  snapshotDays: 6,
  sales: {
    grossSales: "31300000",
    discountTotal: "1300000",
    netSales: "30000000",
    costSnapshotComplete: true,
    costOfGoods: "20000000",
    grossMargin: "10000000",
    grossMarginRate: "33.3333",
  },
  payments: {
    cashTotal: "12000000",
    bankTransferTotal: "9000000",
    debitCardTotal: "5000000",
    creditCardTotal: "3000000",
  },
  customerDeposit: {
    openingBalance: "1000000",
    depositIn: "700000",
    depositUsed: "300000",
    withdrawal: "100000",
    adjustmentIn: "0",
    adjustmentOut: "0",
    closingBalance: "1300000",
  },
  cash: { varianceTotal: "-75000" },
  operations: { transactionCount: 24, itemsSoldCount: 31 },
  comparison: {
    previousPeriod: { start: "2026-07-27", end: "2026-08-02" },
    previousNetSales: "25000000",
    netSalesChangeRate: "20.0",
  },
});

const message = formatTelegramWeeklyFinanceMessage(snapshot);
for (const expected of [
  "📊 WEEKLY FINANCE REPORT",
  "Periode: 3–9 Agustus 2026",
  "Gross sales: Rp31.300.000",
  "Net sales: Rp30.000.000",
  "Cost of goods: Rp20.000.000",
  "Gross margin: Rp10.000.000",
  "Gross margin rate: 33,33%",
  "DANA TITIP",
  "Saldo awal: Rp1.000.000",
  "Masuk: Rp700.000",
  "Digunakan: Rp300.000",
  "Dicairkan: Rp100.000",
  "Saldo akhir: Rp1.300.000",
  "Total variance kas: -Rp75.000",
  "Transaksi: 24",
  "Produk terjual: 31",
  "Vs minggu sebelumnya (Net sales): +20,0%",
]) {
  assert.ok(message.includes(expected), `Weekly message kurang field: ${expected}`);
}
assert.ok(message.length <= 4096, "Weekly finance message melebihi limit Telegram.");

const incomplete = buildTelegramWeeklyFinanceSnapshot({
  ...snapshot,
  sales: {
    ...snapshot.sales,
    costSnapshotComplete: false,
    costOfGoods: null,
    grossMargin: null,
    grossMarginRate: null,
  },
});
assert.ok(
  formatTelegramWeeklyFinanceMessage(incomplete).includes(
    "Cost snapshot: Tidak lengkap",
  ),
);

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
  const { finalizeTelegramWeeklyAfterClosingInTransaction } = await import(
    "@/server/integrations/telegram/telegram-weekly-service"
  );

  const organizationId = randomUUID();
  const outletId = randomUUID();
  const registerId = randomUUID();
  const userId = randomUUID();
  const destinationId = randomUUID();

  await db.transaction(async (transaction) => {
    await transaction.insert(organizations).values({
      id: organizationId,
      name: "Telegram Weekly Test",
      slug: `telegram-weekly-${organizationId.slice(0, 8)}`,
      timezone: "Asia/Jakarta",
    });
    await transaction.insert(outlets).values({
      id: outletId,
      organizationId,
      code: "TGW",
      name: "Telegram Weekly Outlet",
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
      email: `telegram-weekly-${userId.slice(0, 8)}@example.test`,
      username: `telegram_weekly_${userId.slice(0, 8)}`,
      fullName: "Telegram Weekly Cashier",
    });
    await transaction.insert(telegramDestinations).values({
      id: destinationId,
      organizationId,
      outletId,
      name: "Weekly Development Group",
      chatId: `-${Date.now()}`,
      createdBy: userId,
      updatedBy: userId,
    });
    await transaction.insert(telegramReportSettings).values({
      destinationId,
      weeklyEnabled: true,
      timezone: "Asia/Jakarta",
    });
  });

  async function insertSnapshot(input: {
    businessDate: string;
    netSales: string;
    grossSales: string;
    discountTotal: string;
    costOfGoods: string | null;
    grossMargin: string | null;
    grossMarginRate: string | null;
    costSnapshotComplete: boolean;
    cashTotal?: string;
    bankTransferTotal?: string;
    debitCardTotal?: string;
    creditCardTotal?: string;
    depositOpening?: string;
    depositIn?: string;
    depositUsed?: string;
    withdrawal?: string;
    adjustmentIn?: string;
    adjustmentOut?: string;
    depositClosing?: string;
    variance?: string;
    transactionCount?: number;
    itemsSoldCount?: number;
  }) {
    const shiftId = randomUUID();
    const openedAt = new Date(`${input.businessDate}T01:00:00.000Z`);
    const closedAt = new Date(`${input.businessDate}T10:00:00.000Z`);
    const variance = Number(input.variance ?? "0");
    const actualCash = 1000000 + variance;
    assert.ok(Number.isSafeInteger(actualCash) && actualCash >= 0);
    await db.transaction(async (transaction) => {
      await transaction.insert(shifts).values({
        id: shiftId,
        outletId,
        registerId,
        openedBy: userId,
        status: "closed",
        businessDate: input.businessDate,
        openingCash: "1000000",
        expectedCash: "1000000",
        actualCash: String(actualCash),
        cashVariance: String(variance),
        closedBy: userId,
        openedAt,
        closedAt,
      });
      await transaction.insert(financeClosingSnapshots).values({
        shiftId,
        organizationId,
        outletId,
        businessDate: input.businessDate,
        grossSales: input.grossSales,
        discountTotal: input.discountTotal,
        netSales: input.netSales,
        costSnapshotComplete: input.costSnapshotComplete,
        costOfGoods: input.costOfGoods,
        grossMargin: input.grossMargin,
        grossMarginRate: input.grossMarginRate,
        cashTotal: input.cashTotal ?? "0",
        bankTransferTotal: input.bankTransferTotal ?? "0",
        debitCardTotal: input.debitCardTotal ?? "0",
        creditCardTotal: input.creditCardTotal ?? "0",
        customerDepositOpeningBalance: input.depositOpening ?? "0",
        customerDepositIn: input.depositIn ?? "0",
        customerDepositUsed: input.depositUsed ?? "0",
        customerDepositWithdrawal: input.withdrawal ?? "0",
        customerDepositAdjustmentIn: input.adjustmentIn ?? "0",
        customerDepositAdjustmentOut: input.adjustmentOut ?? "0",
        customerDepositClosingBalance: input.depositClosing ?? "0",
        expectedCash: "1000000",
        actualCash: String(actualCash),
        cashVariance: String(variance),
        transactionCount: input.transactionCount ?? 0,
        itemsSoldCount: input.itemsSoldCount ?? 0,
        heldTransactionCount: 0,
        openedAt,
        closedAt,
        cashierId: userId,
        createdAt: closedAt,
      });
    });
  }

  // Previous week total net sales = 25M.
  await insertSnapshot({
    businessDate: "2026-07-27",
    grossSales: "12000000",
    discountTotal: "500000",
    netSales: "11500000",
    costSnapshotComplete: true,
    costOfGoods: "7500000",
    grossMargin: "4000000",
    grossMarginRate: "34.7826",
    depositOpening: "800000",
    depositClosing: "900000",
  });
  await insertSnapshot({
    businessDate: "2026-08-02",
    grossSales: "14000000",
    discountTotal: "500000",
    netSales: "13500000",
    costSnapshotComplete: true,
    costOfGoods: "9000000",
    grossMargin: "4500000",
    grossMarginRate: "33.3333",
    depositOpening: "900000",
    depositClosing: "1000000",
  });

  // Current week total net sales = 30M, therefore +20.0%.
  await insertSnapshot({
    businessDate: "2026-08-03",
    grossSales: "10500000",
    discountTotal: "500000",
    netSales: "10000000",
    costSnapshotComplete: true,
    costOfGoods: "6500000",
    grossMargin: "3500000",
    grossMarginRate: "35.0000",
    cashTotal: "4000000",
    bankTransferTotal: "3000000",
    debitCardTotal: "2000000",
    depositOpening: "1000000",
    depositIn: "200000",
    depositUsed: "100000",
    depositClosing: "1100000",
    variance: "-25000",
    transactionCount: 8,
    itemsSoldCount: 10,
  });
  await insertSnapshot({
    businessDate: "2026-08-07",
    grossSales: "12500000",
    discountTotal: "500000",
    netSales: "12000000",
    costSnapshotComplete: true,
    costOfGoods: "8000000",
    grossMargin: "4000000",
    grossMarginRate: "33.3333",
    cashTotal: "5000000",
    bankTransferTotal: "3000000",
    debitCardTotal: "1000000",
    creditCardTotal: "2000000",
    depositOpening: "1100000",
    depositIn: "500000",
    depositUsed: "200000",
    withdrawal: "100000",
    depositClosing: "1300000",
    variance: "-50000",
    transactionCount: 10,
    itemsSoldCount: 13,
  });
  await insertSnapshot({
    businessDate: "2026-08-09",
    grossSales: "8300000",
    discountTotal: "300000",
    netSales: "8000000",
    costSnapshotComplete: true,
    costOfGoods: "5500000",
    grossMargin: "2500000",
    grossMarginRate: "31.2500",
    cashTotal: "3000000",
    bankTransferTotal: "3000000",
    debitCardTotal: "1000000",
    creditCardTotal: "1000000",
    depositOpening: "1300000",
    depositClosing: "1300000",
    variance: "0",
    transactionCount: 6,
    itemsSoldCount: 8,
  });

  const first = await db.transaction((transaction) =>
    finalizeTelegramWeeklyAfterClosingInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGW",
      outletName: "Telegram Weekly Outlet",
      closingBusinessDate: "2026-08-09",
    }),
  );
  assert.equal(first.status, "enqueued");
  assert.deepEqual(first.period, { start: "2026-08-03", end: "2026-08-09" });

  const duplicate = await db.transaction((transaction) =>
    finalizeTelegramWeeklyAfterClosingInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGW",
      outletName: "Telegram Weekly Outlet",
      closingBusinessDate: "2026-08-09",
    }),
  );
  assert.equal(duplicate.status, "duplicate");

  const weeklyRows = await db
    .select()
    .from(telegramDeliveryOutbox)
    .where(
      eq(
        telegramDeliveryOutbox.eventKey,
        `weekly-finance:${outletId}:2026-08-03`,
      ),
    );
  assert.equal(weeklyRows.length, 1, "Weekly event harus idempotent.");
  assert.equal(weeklyRows[0]?.reportType, "weekly");
  assert.equal(weeklyRows[0]?.businessDate, null);
  assert.equal(weeklyRows[0]?.periodStart, "2026-08-03");
  assert.equal(weeklyRows[0]?.periodEnd, "2026-08-09");
  assert.ok(weeklyRows[0]?.messageText.includes("Net sales: Rp30.000.000"));
  assert.ok(
    weeklyRows[0]?.messageText.includes(
      "Vs minggu sebelumnya (Net sales): +20,0%",
    ),
  );
  assert.ok(weeklyRows[0]?.messageText.includes("Saldo akhir: Rp1.300.000"));

  // Delayed report: outlet tidak buka Minggu 16 Agustus; report dibuat setelah
  // closing berikutnya pada Senin 17 Agustus dan tetap mengunci period 10–16.
  await insertSnapshot({
    businessDate: "2026-08-10",
    grossSales: "7000000",
    discountTotal: "0",
    netSales: "7000000",
    costSnapshotComplete: true,
    costOfGoods: "4500000",
    grossMargin: "2500000",
    grossMarginRate: "35.7143",
    depositOpening: "1300000",
    depositClosing: "1300000",
    transactionCount: 4,
    itemsSoldCount: 5,
  });
  await insertSnapshot({
    businessDate: "2026-08-14",
    grossSales: "5000000",
    discountTotal: "0",
    netSales: "5000000",
    costSnapshotComplete: false,
    costOfGoods: null,
    grossMargin: null,
    grossMarginRate: null,
    depositOpening: "1300000",
    depositIn: "100000",
    depositClosing: "1400000",
    transactionCount: 3,
    itemsSoldCount: 4,
  });

  const delayed = await db.transaction((transaction) =>
    finalizeTelegramWeeklyAfterClosingInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGW",
      outletName: "Telegram Weekly Outlet",
      closingBusinessDate: "2026-08-17",
    }),
  );
  assert.equal(delayed.status, "enqueued");
  assert.deepEqual(delayed.period, { start: "2026-08-10", end: "2026-08-16" });

  const [delayedRow] = await db
    .select()
    .from(telegramDeliveryOutbox)
    .where(
      eq(
        telegramDeliveryOutbox.eventKey,
        `weekly-finance:${outletId}:2026-08-10`,
      ),
    );
  assert.ok(delayedRow, "Delayed weekly event harus dibuat.");
  assert.ok(
    delayedRow.messageText.includes("Cost snapshot: Tidak lengkap"),
    "Satu daily snapshot incomplete harus membuat margin weekly unavailable.",
  );

  // No snapshots in 17–23 August means no weekly delivery.
  const noData = await db.transaction((transaction) =>
    finalizeTelegramWeeklyAfterClosingInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGW",
      outletName: "Telegram Weekly Outlet",
      closingBusinessDate: "2026-08-24",
    }),
  );
  assert.equal(noData.status, "no_data");

  await db
    .update(telegramReportSettings)
    .set({ weeklyEnabled: false })
    .where(eq(telegramReportSettings.destinationId, destinationId));
  const disabled = await db.transaction((transaction) =>
    finalizeTelegramWeeklyAfterClosingInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGW",
      outletName: "Telegram Weekly Outlet",
      closingBusinessDate: "2026-08-09",
    }),
  );
  assert.equal(disabled.status, "destination_unavailable");

  const integrationOff = await db.transaction((transaction) =>
    finalizeTelegramWeeklyAfterClosingInTransaction(transaction, {
      integrationEnabled: false,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGW",
      outletName: "Telegram Weekly Outlet",
      closingBusinessDate: "2026-08-09",
    }),
  );
  assert.equal(integrationOff.status, "integration_disabled");

  const allWeekly = await db
    .select({ id: telegramDeliveryOutbox.id })
    .from(telegramDeliveryOutbox)
    .where(
      and(
        eq(telegramDeliveryOutbox.outletId, outletId),
        eq(telegramDeliveryOutbox.reportType, "weekly"),
      ),
    );
  assert.equal(allWeekly.length, 2, "Hanya dua period weekly yang valid harus dibuat.");
}

if (process.argv.includes("--database")) {
  await checkDatabase();
}

console.log(
  process.argv.includes("--database")
    ? "Telegram 2C.7 weekly checks passed: Monday–Sunday, snapshot aggregation, delayed generation, cost completeness, previous-week comparison, Dana Titip, dan idempotency."
    : "Telegram 2C.7 weekly contract checks passed: Monday–Sunday boundaries, formatter, comparison, closing hook, dan no HTTP path.",
);
