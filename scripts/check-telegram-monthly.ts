import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildTelegramMonthlyFinanceEventKey,
  buildTelegramMonthlyFinanceSnapshot,
  calculateMonthlyNetSalesChangeRate,
  formatTelegramMonthlyFinanceMessage,
  getLatestCompletedMonthlyPeriod,
  getMonthlyPeriodForBusinessDate,
  getPreviousMonthlyPeriod,
} from "@/server/integrations/telegram/telegram-monthly-report";

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
    "telegram-monthly-service.ts",
  ),
  "utf8",
);

function assertContains(source: string, value: string, label: string) {
  assert.ok(source.includes(value), `${label} belum ditemukan.`);
}

assertContains(
  closingSource,
  "await finalizeTelegramMonthlyAfterClosingInTransaction(transaction, {",
  "monthly generation di closing transaction",
);
assertContains(
  closingSource,
  "closingBusinessDate: businessDate",
  "monthly generation harus memakai business date shift",
);
assertContains(
  serviceSource,
  "financeClosingSnapshots",
  "monthly aggregation dari finance closing snapshots",
);
assertContains(
  serviceSource,
  'reportType: "monthly"',
  "monthly destination guard",
);
assertContains(
  serviceSource,
  "gte(financeClosingSnapshots.businessDate, input.period.start)",
  "monthly business date period start",
);
assertContains(
  serviceSource,
  "lte(financeClosingSnapshots.businessDate, input.period.end)",
  "monthly business date period end",
);
assert.equal(
  serviceSource.includes("sendMessage("),
  false,
  "Monthly service tidak boleh mengirim HTTP Telegram.",
);
assert.equal(
  serviceSource.includes("fetch("),
  false,
  "Monthly service tidak boleh melakukan HTTP request.",
);

// Calendar-month boundaries, including leap year and year crossing.
assert.deepEqual(getMonthlyPeriodForBusinessDate("2026-01-15"), {
  start: "2026-01-01",
  end: "2026-01-31",
});
assert.deepEqual(getMonthlyPeriodForBusinessDate("2026-04-30"), {
  start: "2026-04-01",
  end: "2026-04-30",
});
assert.deepEqual(getMonthlyPeriodForBusinessDate("2025-02-15"), {
  start: "2025-02-01",
  end: "2025-02-28",
});
assert.deepEqual(getMonthlyPeriodForBusinessDate("2024-02-29"), {
  start: "2024-02-01",
  end: "2024-02-29",
});
assert.deepEqual(getLatestCompletedMonthlyPeriod("2026-08-31"), {
  start: "2026-08-01",
  end: "2026-08-31",
});
assert.deepEqual(
  getLatestCompletedMonthlyPeriod("2026-09-01"),
  { start: "2026-08-01", end: "2026-08-31" },
  "Closing pertama bulan baru harus mengejar bulan kalender sebelumnya.",
);
assert.deepEqual(
  getLatestCompletedMonthlyPeriod("2026-09-15"),
  { start: "2026-08-01", end: "2026-08-31" },
  "Closing pertengahan bulan tidak boleh membuat bulan berjalan yang belum selesai.",
);
assert.deepEqual(
  getPreviousMonthlyPeriod({ start: "2026-01-01", end: "2026-01-31" }),
  { start: "2025-12-01", end: "2025-12-31" },
);

const outletId = "20000000-0000-0000-0000-000000000001";
assert.equal(
  buildTelegramMonthlyFinanceEventKey(outletId, "2026-08-01"),
  `monthly-finance:${outletId}:2026-08`,
);
assert.equal(calculateMonthlyNetSalesChangeRate("21000000", "20000000"), "5.0");
assert.equal(calculateMonthlyNetSalesChangeRate("18000000", "20000000"), "-10.0");
assert.equal(calculateMonthlyNetSalesChangeRate("100000", "0"), null);
assert.equal(calculateMonthlyNetSalesChangeRate("100000", null), null);

const snapshot = buildTelegramMonthlyFinanceSnapshot({
  outlet: {
    id: outletId,
    code: "PBG",
    name: "Pasar Bantar Gebang",
  },
  period: { start: "2026-08-01", end: "2026-08-31" },
  timezone: "Asia/Jakarta",
  snapshotDays: 26,
  sales: {
    grossSales: "22000000",
    discountTotal: "1000000",
    netSales: "21000000",
    costSnapshotComplete: true,
    costOfGoods: "14500000",
    grossMargin: "6500000",
    grossMarginRate: "30.9524",
  },
  payments: {
    cashTotal: "8500000",
    bankTransferTotal: "6500000",
    debitCardTotal: "3500000",
    creditCardTotal: "2000000",
  },
  customerDeposit: {
    openingBalance: "1000000",
    depositIn: "900000",
    depositUsed: "400000",
    withdrawal: "200000",
    adjustmentIn: "100000",
    adjustmentOut: "0",
    closingBalance: "1400000",
  },
  cash: { varianceTotal: "-125000" },
  operations: { transactionCount: 120, itemsSoldCount: 155 },
  comparison: {
    previousPeriod: { start: "2026-07-01", end: "2026-07-31" },
    previousNetSales: "20000000",
    netSalesChangeRate: "5.0",
  },
});

const message = formatTelegramMonthlyFinanceMessage(snapshot);
for (const expected of [
  "📈 MONTHLY FINANCE REPORT",
  "Periode: Agustus 2026",
  "Hari operasional tersnapshot: 26",
  "Gross sales: Rp22.000.000",
  "Net sales: Rp21.000.000",
  "Cost of goods: Rp14.500.000",
  "Gross margin: Rp6.500.000",
  "Gross margin rate: 30,95%",
  "DANA TITIP",
  "Saldo awal: Rp1.000.000",
  "Masuk: Rp900.000",
  "Digunakan: Rp400.000",
  "Dicairkan: Rp200.000",
  "Adjustment masuk: Rp100.000",
  "Saldo akhir: Rp1.400.000",
  "Total variance kas: -Rp125.000",
  "Transaksi: 120",
  "Produk terjual: 155",
  "Vs bulan sebelumnya (Net sales): +5,0%",
]) {
  assert.ok(message.includes(expected), `Monthly message kurang field: ${expected}`);
}
assert.ok(message.length <= 4096, "Monthly finance message melebihi limit Telegram.");

const incomplete = buildTelegramMonthlyFinanceSnapshot({
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
  formatTelegramMonthlyFinanceMessage(incomplete).includes(
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
  const { finalizeTelegramMonthlyAfterClosingInTransaction } = await import(
    "@/server/integrations/telegram/telegram-monthly-service"
  );

  const organizationId = randomUUID();
  const outletId = randomUUID();
  const registerId = randomUUID();
  const userId = randomUUID();
  const destinationId = randomUUID();

  await db.transaction(async (transaction) => {
    await transaction.insert(organizations).values({
      id: organizationId,
      name: "Telegram Monthly Test",
      slug: `telegram-monthly-${organizationId.slice(0, 8)}`,
      timezone: "Asia/Jakarta",
    });
    await transaction.insert(outlets).values({
      id: outletId,
      organizationId,
      code: "TGM",
      name: "Telegram Monthly Outlet",
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
      email: `telegram-monthly-${userId.slice(0, 8)}@example.test`,
      username: `telegram_monthly_${userId.slice(0, 8)}`,
      fullName: "Telegram Monthly Cashier",
    });
    await transaction.insert(telegramDestinations).values({
      id: destinationId,
      organizationId,
      outletId,
      name: "Monthly Development Group",
      chatId: `-${Date.now()}`,
      createdBy: userId,
      updatedBy: userId,
    });
    await transaction.insert(telegramReportSettings).values({
      destinationId,
      monthlyEnabled: true,
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
        pendingApprovalCount: 0,
        openedAt,
        closedAt,
        cashierId: userId,
        createdAt: closedAt,
      });
    });
  }

  // Previous month (July) total Net Sales = 20M.
  await insertSnapshot({
    businessDate: "2026-07-01",
    grossSales: "8500000",
    discountTotal: "500000",
    netSales: "8000000",
    costSnapshotComplete: true,
    costOfGoods: "5200000",
    grossMargin: "2800000",
    grossMarginRate: "35.0000",
    depositOpening: "700000",
    depositClosing: "800000",
  });
  await insertSnapshot({
    businessDate: "2026-07-31",
    grossSales: "12500000",
    discountTotal: "500000",
    netSales: "12000000",
    costSnapshotComplete: true,
    costOfGoods: "8000000",
    grossMargin: "4000000",
    grossMarginRate: "33.3333",
    depositOpening: "800000",
    depositClosing: "1000000",
  });

  // August total Net Sales = 21M, therefore +5.0% vs July.
  await insertSnapshot({
    businessDate: "2026-08-01",
    grossSales: "7500000",
    discountTotal: "500000",
    netSales: "7000000",
    costSnapshotComplete: true,
    costOfGoods: "4500000",
    grossMargin: "2500000",
    grossMarginRate: "35.7143",
    cashTotal: "3000000",
    bankTransferTotal: "2000000",
    debitCardTotal: "1000000",
    depositOpening: "1000000",
    depositIn: "200000",
    depositClosing: "1200000",
    variance: "-25000",
    transactionCount: 8,
    itemsSoldCount: 10,
  });
  await insertSnapshot({
    businessDate: "2026-08-15",
    grossSales: "7500000",
    discountTotal: "500000",
    netSales: "7000000",
    costSnapshotComplete: true,
    costOfGoods: "4800000",
    grossMargin: "2200000",
    grossMarginRate: "31.4286",
    cashTotal: "2500000",
    bankTransferTotal: "2500000",
    debitCardTotal: "1000000",
    creditCardTotal: "500000",
    depositOpening: "1200000",
    depositIn: "400000",
    depositUsed: "200000",
    withdrawal: "100000",
    adjustmentIn: "100000",
    depositClosing: "1400000",
    variance: "-50000",
    transactionCount: 9,
    itemsSoldCount: 12,
  });
  await insertSnapshot({
    businessDate: "2026-08-31",
    grossSales: "7500000",
    discountTotal: "500000",
    netSales: "7000000",
    costSnapshotComplete: true,
    costOfGoods: "4700000",
    grossMargin: "2300000",
    grossMarginRate: "32.8571",
    cashTotal: "3000000",
    bankTransferTotal: "2000000",
    debitCardTotal: "500000",
    creditCardTotal: "1000000",
    depositOpening: "1400000",
    depositUsed: "200000",
    depositClosing: "1200000",
    variance: "-50000",
    transactionCount: 10,
    itemsSoldCount: 13,
  });

  const first = await db.transaction((transaction) =>
    finalizeTelegramMonthlyAfterClosingInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGM",
      outletName: "Telegram Monthly Outlet",
      closingBusinessDate: "2026-08-31",
    }),
  );
  assert.equal(first.status, "enqueued");
  assert.deepEqual(first.period, { start: "2026-08-01", end: "2026-08-31" });

  const duplicate = await db.transaction((transaction) =>
    finalizeTelegramMonthlyAfterClosingInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGM",
      outletName: "Telegram Monthly Outlet",
      closingBusinessDate: "2026-09-01",
    }),
  );
  assert.equal(duplicate.status, "duplicate");

  const monthlyRows = await db
    .select()
    .from(telegramDeliveryOutbox)
    .where(
      eq(
        telegramDeliveryOutbox.eventKey,
        `monthly-finance:${outletId}:2026-08`,
      ),
    );
  assert.equal(monthlyRows.length, 1, "Monthly event harus idempotent.");
  assert.equal(monthlyRows[0]?.reportType, "monthly");
  assert.equal(monthlyRows[0]?.businessDate, null);
  assert.equal(monthlyRows[0]?.periodStart, "2026-08-01");
  assert.equal(monthlyRows[0]?.periodEnd, "2026-08-31");
  assert.ok(monthlyRows[0]?.messageText.includes("Net sales: Rp21.000.000"));
  assert.ok(
    monthlyRows[0]?.messageText.includes(
      "Vs bulan sebelumnya (Net sales): +5,0%",
    ),
  );
  assert.ok(monthlyRows[0]?.messageText.includes("Saldo akhir: Rp1.200.000"));

  // Delayed September: outlet tidak buka 30 September. Closing 1 Oktober harus
  // tetap mengunci 1–30 September, dan satu incomplete day membuat margin unavailable.
  await insertSnapshot({
    businessDate: "2026-09-03",
    grossSales: "9000000",
    discountTotal: "0",
    netSales: "9000000",
    costSnapshotComplete: true,
    costOfGoods: "6000000",
    grossMargin: "3000000",
    grossMarginRate: "33.3333",
    depositOpening: "1200000",
    depositClosing: "1200000",
    transactionCount: 6,
    itemsSoldCount: 7,
  });
  await insertSnapshot({
    businessDate: "2026-09-20",
    grossSales: "6000000",
    discountTotal: "0",
    netSales: "6000000",
    costSnapshotComplete: false,
    costOfGoods: null,
    grossMargin: null,
    grossMarginRate: null,
    depositOpening: "1200000",
    depositIn: "100000",
    depositClosing: "1300000",
    transactionCount: 4,
    itemsSoldCount: 5,
  });

  const delayed = await db.transaction((transaction) =>
    finalizeTelegramMonthlyAfterClosingInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGM",
      outletName: "Telegram Monthly Outlet",
      closingBusinessDate: "2026-10-01",
    }),
  );
  assert.equal(delayed.status, "enqueued");
  assert.deepEqual(delayed.period, { start: "2026-09-01", end: "2026-09-30" });

  const [delayedRow] = await db
    .select()
    .from(telegramDeliveryOutbox)
    .where(
      eq(
        telegramDeliveryOutbox.eventKey,
        `monthly-finance:${outletId}:2026-09`,
      ),
    );
  assert.ok(delayedRow, "Delayed monthly event harus dibuat.");
  assert.ok(
    delayedRow.messageText.includes("Cost snapshot: Tidak lengkap"),
    "Satu daily snapshot incomplete harus membuat margin monthly unavailable.",
  );

  // October has no snapshot. Closing 1 November may not fabricate a report.
  const noData = await db.transaction((transaction) =>
    finalizeTelegramMonthlyAfterClosingInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGM",
      outletName: "Telegram Monthly Outlet",
      closingBusinessDate: "2026-11-01",
    }),
  );
  assert.equal(noData.status, "no_data");

  await db
    .update(telegramReportSettings)
    .set({ monthlyEnabled: false })
    .where(eq(telegramReportSettings.destinationId, destinationId));
  const disabled = await db.transaction((transaction) =>
    finalizeTelegramMonthlyAfterClosingInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGM",
      outletName: "Telegram Monthly Outlet",
      closingBusinessDate: "2026-08-31",
    }),
  );
  assert.equal(disabled.status, "destination_unavailable");

  const integrationOff = await db.transaction((transaction) =>
    finalizeTelegramMonthlyAfterClosingInTransaction(transaction, {
      integrationEnabled: false,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGM",
      outletName: "Telegram Monthly Outlet",
      closingBusinessDate: "2026-08-31",
    }),
  );
  assert.equal(integrationOff.status, "integration_disabled");

  const allMonthly = await db
    .select({ id: telegramDeliveryOutbox.id })
    .from(telegramDeliveryOutbox)
    .where(
      and(
        eq(telegramDeliveryOutbox.outletId, outletId),
        eq(telegramDeliveryOutbox.reportType, "monthly"),
      ),
    );
  assert.equal(
    allMonthly.length,
    2,
    "Hanya dua period monthly yang mempunyai data valid harus dibuat.",
  );
}

if (process.argv.includes("--database")) {
  await checkDatabase();
}

console.log(
  process.argv.includes("--database")
    ? "Telegram 2C.8 monthly checks passed: calendar month, snapshot aggregation, delayed generation, cost completeness, previous-month comparison, Dana Titip, dan idempotency."
    : "Telegram 2C.8 monthly contract checks passed: month boundaries, leap year, formatter, comparison, closing hook, dan no HTTP path.",
);
