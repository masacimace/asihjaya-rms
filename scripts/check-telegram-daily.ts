import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildTelegramDailyFinanceEventKey,
  buildTelegramDailyFinanceSnapshot,
  formatTelegramDailyFinanceMessage,
} from "@/server/integrations/telegram/telegram-daily-report";

const projectRoot = process.cwd();
const checkoutSource = readFileSync(
  path.join(projectRoot, "src", "app", "actions", "pos.ts"),
  "utf8",
);
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
    "telegram-daily-service.ts",
  ),
  "utf8",
);

function assertContains(source: string, value: string, label: string) {
  assert.ok(source.includes(value), `${label} belum ditemukan.`);
}

assertContains(
  checkoutSource,
  "costAmountSnapshot: item!.costAmount,",
  "checkout cost snapshot",
);
assertContains(
  closingSource,
  "await finalizeTelegramDailyFinanceInTransaction(transaction, {",
  "finance snapshot + daily outbox dalam closing transaction",
);
assertContains(
  closingSource,
  "shift.businessDate ??",
  "fallback business date untuk shift lama",
);
assertContains(
  serviceSource,
  "financeClosingSnapshots",
  "finance closing snapshot persistence",
);
assertContains(
  serviceSource,
  'reportType: "closing_daily"',
  "closing_daily destination guard",
);
assert.equal(
  serviceSource.includes("sendMessage("),
  false,
  "Daily service tidak boleh mengirim HTTP Telegram.",
);
assert.equal(
  serviceSource.includes("fetch("),
  false,
  "Daily service tidak boleh melakukan HTTP request.",
);
assert.equal(
  serviceSource.includes("telegram-client"),
  false,
  "Daily service tidak boleh bergantung pada Telegram client runtime.",
);
assert.equal(
  serviceSource.includes("qris_manual"),
  false,
  "QRIS manual masih hold dan tidak boleh masuk finance snapshot V1.",
);
assert.equal(
  serviceSource.includes("qris_gateway"),
  false,
  "QRIS gateway masih hold dan tidak boleh masuk finance snapshot V1.",
);

const outletId = "20000000-0000-0000-0000-000000000001";
const shiftId = "80000000-0000-0000-0000-000000000001";
const cashierId = "40000000-0000-0000-0000-000000000001";
const businessDate = "2026-08-07";

assert.equal(
  buildTelegramDailyFinanceEventKey(outletId, businessDate),
  `daily-finance:${outletId}:${businessDate}`,
);

const snapshot = buildTelegramDailyFinanceSnapshot({
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
  openedAt: new Date("2026-08-07T01:02:00.000Z"),
  closedAt: new Date("2026-08-07T11:11:00.000Z"),
  timezone: "Asia/Jakarta",
  sales: {
    grossSales: "25450000",
    discountTotal: "350000",
    netSales: "25100000",
    costSnapshotComplete: true,
    costOfGoods: "18250000",
    grossMargin: "6850000",
    grossMarginRate: "27.2908",
  },
  payments: {
    cashTotal: "10500000",
    bankTransferTotal: "7100000",
    debitCardTotal: "4000000",
    creditCardTotal: "2000000",
  },
  customerDeposit: {
    openingBalance: "15750000",
    depositIn: "500000",
    depositUsed: "1000000",
    withdrawal: "0",
    adjustmentIn: "0",
    adjustmentOut: "0",
    closingBalance: "15250000",
  },
  cash: {
    expectedCash: "12500000",
    actualCash: "12450000",
    variance: "-50000",
  },
  operations: {
    transactionCount: 18,
    itemsSoldCount: 22,
    heldTransactionCount: 0,
    pendingApprovalCount: 0,
  },
});

const message = formatTelegramDailyFinanceMessage(snapshot);
for (const expected of [
  "🔴 OUTLET DITUTUP — DAILY FINANCE REPORT",
  "Tanggal operasional: 7 Agustus 2026",
  "Kasir utama: Rosalia Manda",
  "Buka: 08:02 WIB",
  "Tutup: 18:11 WIB",
  "Gross sales: Rp25.450.000",
  "Diskon: Rp350.000",
  "Net sales: Rp25.100.000",
  "Cost of goods: Rp18.250.000",
  "Gross margin: Rp6.850.000",
  "Gross margin rate: 27,29%",
  "Cash: Rp10.500.000",
  "Bank Transfer: Rp7.100.000",
  "EDC Debit: Rp4.000.000",
  "EDC Credit: Rp2.000.000",
  "Masuk: Rp500.000",
  "Digunakan: Rp1.000.000",
  "Expected cash: Rp12.500.000",
  "Actual cash: Rp12.450.000",
  "Variance: -Rp50.000",
  "Transaksi: 18",
  "Produk terjual: 22",
  "Status: Perlu review variance kas",
]) {
  assert.ok(message.includes(expected), `Daily message kurang field: ${expected}`);
}
assert.ok(message.length <= 4096, "Daily finance message melebihi limit Telegram.");

const incompleteCost = buildTelegramDailyFinanceSnapshot({
  ...snapshot,
  openedAt: new Date(snapshot.openedAt),
  closedAt: new Date(snapshot.closedAt),
  sales: {
    ...snapshot.sales,
    costSnapshotComplete: false,
    costOfGoods: null,
    grossMargin: null,
    grossMarginRate: null,
  },
});
const incompleteMessage = formatTelegramDailyFinanceMessage(incompleteCost);
assert.ok(incompleteMessage.includes("Cost snapshot: Tidak lengkap"));
assert.equal(
  incompleteMessage.includes("Cost of goods: Rp0"),
  false,
  "Missing COGS tidak boleh dipalsukan menjadi Rp0.",
);

async function checkDatabase() {
  assert.ok(process.env.DATABASE_URL?.trim(), "DATABASE_URL wajib untuk --database.");

  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const {
    approvals,
    customerDepositLedger,
    customers,
    financeClosingSnapshots,
    organizations,
    outlets,
    payments,
    posHeldCarts,
    productCategories,
    productItems,
    productMasters,
    registers,
    saleItems,
    sales,
    shifts,
    telegramDeliveryOutbox,
    telegramDestinations,
    telegramReportSettings,
    users,
  } = await import("@/db/schema");
  const { finalizeTelegramDailyFinanceInTransaction } = await import(
    "@/server/integrations/telegram/telegram-daily-service"
  );

  const organizationId = randomUUID();
  const outletId = randomUUID();
  const registerId = randomUUID();
  const userId = randomUUID();
  const customerId = randomUUID();
  const categoryId = randomUUID();
  const masterId = randomUUID();
  const itemOneId = randomUUID();
  const itemTwoId = randomUUID();
  const shiftId = randomUUID();
  const saleId = randomUUID();
  const destinationId = randomUUID();
  const openedAt = new Date("2026-08-07T01:00:00.000Z");
  const closedAt = new Date("2026-08-07T10:00:00.000Z");

  await db.transaction(async (transaction) => {
    await transaction.insert(organizations).values({
      id: organizationId,
      name: "Telegram Daily Test",
      slug: `telegram-daily-${organizationId.slice(0, 8)}`,
      timezone: "Asia/Jakarta",
    });
    await transaction.insert(outlets).values({
      id: outletId,
      organizationId,
      code: "TGD",
      name: "Telegram Daily Outlet",
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
      email: `telegram-daily-${userId.slice(0, 8)}@example.test`,
      username: `telegram_daily_${userId.slice(0, 8)}`,
      fullName: "Telegram Daily Cashier",
    });
    await transaction.insert(customers).values({
      id: customerId,
      organizationId,
      customerCode: `TGD-${customerId.slice(0, 6)}`,
      fullName: "Customer Dana Titip",
    });
    await transaction.insert(productCategories).values({
      id: categoryId,
      organizationId,
      code: "TGD-CAT",
      name: "Telegram Daily Category",
    });
    await transaction.insert(productMasters).values({
      id: masterId,
      organizationId,
      categoryId,
      code: "TGD-MASTER",
      name: "Telegram Daily Product",
      status: "active",
    });
    await transaction.insert(productItems).values([
      {
        id: itemOneId,
        organizationId,
        productMasterId: masterId,
        currentOutletId: outletId,
        sku: "TGD-ITEM-1",
        barcode: "TGD-BARCODE-1",
        costAmount: "2000000",
        sellingAmount: "3000000",
        availability: "sold",
        condition: "good",
        locationState: "customer",
      },
      {
        id: itemTwoId,
        organizationId,
        productMasterId: masterId,
        currentOutletId: outletId,
        sku: "TGD-ITEM-2",
        barcode: "TGD-BARCODE-2",
        costAmount: "1000000",
        sellingAmount: "2000000",
        availability: "sold",
        condition: "good",
        locationState: "customer",
      },
    ]);
    await transaction.insert(shifts).values({
      id: shiftId,
      outletId,
      registerId,
      openedBy: userId,
      status: "closed",
      businessDate: "2026-08-07",
      openingCash: "1000000",
      expectedCash: "3300000",
      actualCash: "3250000",
      cashVariance: "-50000",
      closedBy: userId,
      openedAt,
      closedAt,
    });
    await transaction.insert(sales).values({
      id: saleId,
      organizationId,
      outletId,
      registerId,
      shiftId,
      customerId,
      cashierId: userId,
      invoiceNumber: `TGD-${saleId.slice(0, 8)}`,
      idempotencyKey: `telegram-daily-${saleId}`,
      status: "completed",
      subtotalAmount: "5000000",
      discountAmount: "500000",
      additionalFeeAmount: "0",
      totalAmount: "4500000",
      completedAt: new Date("2026-08-07T04:00:00.000Z"),
    });
    await transaction.insert(saleItems).values([
      {
        saleId,
        productItemId: itemOneId,
        lineNumber: 1,
        listPriceAmount: "3000000",
        discountAmount: "300000",
        finalPriceAmount: "2700000",
        costAmountSnapshot: "2000000",
        snapshot: { sku: "TGD-ITEM-1" },
      },
      {
        saleId,
        productItemId: itemTwoId,
        lineNumber: 2,
        listPriceAmount: "2000000",
        discountAmount: "200000",
        finalPriceAmount: "1800000",
        costAmountSnapshot: "1000000",
        snapshot: { sku: "TGD-ITEM-2" },
      },
    ]);
    await transaction.insert(payments).values([
      {
        saleId,
        method: "cash",
        amount: "2500000",
        status: "paid",
        verifiedBy: userId,
        verifiedAt: new Date("2026-08-07T04:00:00.000Z"),
        paidAt: new Date("2026-08-07T04:00:00.000Z"),
      },
      {
        saleId,
        method: "bank_transfer",
        provider: "TEST BANK",
        amount: "1500000",
        status: "paid",
        providerReference: "TRX-TGD-001",
        normalizedReference: "TRX-TGD-001",
        verificationSource: "bank_app",
        providerPaidAt: new Date("2026-08-07T04:00:00.000Z"),
        settlementStatus: "unreconciled",
        verifiedBy: userId,
        verifiedAt: new Date("2026-08-07T04:00:00.000Z"),
        paidAt: new Date("2026-08-07T04:00:00.000Z"),
      },
    ]);
    await transaction.insert(customerDepositLedger).values([
      {
        organizationId,
        outletId,
        customerId,
        entryType: "deposit_in",
        direction: "credit",
        amount: "2000000",
        balanceAfter: "2000000",
        createdBy: userId,
        occurredAt: new Date("2026-08-06T10:00:00.000Z"),
      },
      {
        organizationId,
        outletId,
        customerId,
        saleId,
        entryType: "deposit_used",
        direction: "debit",
        amount: "1000000",
        balanceAfter: "1000000",
        createdBy: userId,
        occurredAt: new Date("2026-08-07T04:00:00.000Z"),
      },
      {
        organizationId,
        outletId,
        customerId,
        saleId,
        entryType: "deposit_in",
        direction: "credit",
        amount: "500000",
        balanceAfter: "1500000",
        createdBy: userId,
        occurredAt: new Date("2026-08-07T04:00:01.000Z"),
      },
      {
        organizationId,
        outletId,
        customerId,
        entryType: "deposit_withdrawal",
        direction: "debit",
        amount: "200000",
        balanceAfter: "1300000",
        createdBy: userId,
        occurredAt: new Date("2026-08-07T06:00:00.000Z"),
      },
      {
        organizationId,
        outletId,
        customerId,
        entryType: "adjustment",
        direction: "credit",
        amount: "100000",
        balanceAfter: "1400000",
        createdBy: userId,
        occurredAt: new Date("2026-08-07T07:00:00.000Z"),
      },
    ]);
    await transaction.insert(posHeldCarts).values({
      organizationId,
      outletId,
      registerId,
      shiftId,
      heldByUserId: userId,
      holdNumber: "HOLD-TGD-1",
      status: "active",
      itemCount: 1,
      subtotalAmount: "100000",
      discountAmount: "0",
      totalAmount: "100000",
    });
    await transaction.insert(approvals).values({
      organizationId,
      outletId,
      type: "other",
      status: "pending",
      requestedBy: userId,
      requestData: { source: "telegram-daily-test" },
    });
    await transaction.insert(telegramDestinations).values({
      id: destinationId,
      organizationId,
      outletId,
      name: "Daily Development Group",
      chatId: `-${Date.now()}`,
      createdBy: userId,
      updatedBy: userId,
    });
    await transaction.insert(telegramReportSettings).values({
      destinationId,
      closingDailyEnabled: true,
      timezone: "Asia/Jakarta",
    });

    const input = {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGD",
      outletName: "Telegram Daily Outlet",
      shiftId,
      businessDate: "2026-08-07",
      cashierId: userId,
      cashierName: "Telegram Daily Cashier",
      openedAt,
      closedAt,
      expectedCash: 3300000,
      actualCash: 3250000,
      cashVariance: -50000,
    } as const;

    const first = await finalizeTelegramDailyFinanceInTransaction(transaction, input);
    const duplicate = await finalizeTelegramDailyFinanceInTransaction(
      transaction,
      input,
    );
    assert.equal(first.financeSnapshotCreated, true);
    assert.equal(first.delivery.status, "enqueued");
    assert.equal(duplicate.financeSnapshotCreated, false);
    assert.equal(duplicate.delivery.status, "duplicate");
  });

  const snapshots = await db
    .select()
    .from(financeClosingSnapshots)
    .where(eq(financeClosingSnapshots.shiftId, shiftId));
  assert.equal(snapshots.length, 1, "Finance snapshot harus satu per shift.");
  const finance = snapshots[0]!;
  assert.equal(finance.grossSales, "5000000");
  assert.equal(finance.discountTotal, "500000");
  assert.equal(finance.netSales, "4500000");
  assert.equal(finance.costSnapshotComplete, true);
  assert.equal(finance.costOfGoods, "3000000");
  assert.equal(finance.grossMargin, "1500000");
  assert.equal(finance.grossMarginRate, "33.3333");
  assert.equal(finance.cashTotal, "2500000");
  assert.equal(finance.bankTransferTotal, "1500000");
  assert.equal(finance.debitCardTotal, "0");
  assert.equal(finance.creditCardTotal, "0");
  assert.equal(finance.customerDepositOpeningBalance, "2000000");
  assert.equal(finance.customerDepositIn, "500000");
  assert.equal(finance.customerDepositUsed, "1000000");
  assert.equal(finance.customerDepositWithdrawal, "200000");
  assert.equal(finance.customerDepositAdjustmentIn, "100000");
  assert.equal(finance.customerDepositAdjustmentOut, "0");
  assert.equal(finance.customerDepositClosingBalance, "1400000");
  assert.equal(finance.transactionCount, 1);
  assert.equal(finance.itemsSoldCount, 2);
  assert.equal(finance.heldTransactionCount, 1);
  assert.equal(finance.pendingApprovalCount, 1);
  assert.equal(finance.expectedCash, "3300000");
  assert.equal(finance.actualCash, "3250000");
  assert.equal(finance.cashVariance, "-50000");

  const deliveries = await db
    .select()
    .from(telegramDeliveryOutbox)
    .where(
      eq(
        telegramDeliveryOutbox.eventKey,
        `daily-finance:${outletId}:2026-08-07`,
      ),
    );
  assert.equal(deliveries.length, 1, "Daily event duplicate tidak boleh terjadi.");
  assert.equal(deliveries[0]?.reportType, "closing_daily");
  assert.equal(deliveries[0]?.status, "pending");
  assert.ok(deliveries[0]?.messageText.includes("DANA TITIP"));
  assert.ok(deliveries[0]?.messageText.includes("Gross margin: Rp1.500.000"));

  const disabledSettingShiftId = randomUUID();
  const disabledSettingOpenedAt = new Date("2026-08-08T01:00:00.000Z");
  const disabledSettingClosedAt = new Date("2026-08-08T10:00:00.000Z");
  await db.transaction(async (transaction) => {
    await transaction.insert(shifts).values({
      id: disabledSettingShiftId,
      outletId,
      registerId,
      openedBy: userId,
      status: "closed",
      businessDate: "2026-08-08",
      openingCash: "1000000",
      expectedCash: "1000000",
      actualCash: "1000000",
      cashVariance: "0",
      closedBy: userId,
      openedAt: disabledSettingOpenedAt,
      closedAt: disabledSettingClosedAt,
    });
    await transaction
      .update(telegramReportSettings)
      .set({ closingDailyEnabled: false })
      .where(eq(telegramReportSettings.destinationId, destinationId));

    const result = await finalizeTelegramDailyFinanceInTransaction(transaction, {
      integrationEnabled: true,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGD",
      outletName: "Telegram Daily Outlet",
      shiftId: disabledSettingShiftId,
      businessDate: "2026-08-08",
      cashierId: userId,
      cashierName: "Telegram Daily Cashier",
      openedAt: disabledSettingOpenedAt,
      closedAt: disabledSettingClosedAt,
      expectedCash: 1000000,
      actualCash: 1000000,
      cashVariance: 0,
    });
    assert.equal(result.financeSnapshotCreated, true);
    assert.equal(result.delivery.status, "destination_unavailable");
  });

  const [disabledSettingSnapshot] = await db
    .select({ id: financeClosingSnapshots.id })
    .from(financeClosingSnapshots)
    .where(eq(financeClosingSnapshots.shiftId, disabledSettingShiftId));
  assert.ok(
    disabledSettingSnapshot,
    "Finance snapshot harus tetap dibuat saat closing_daily disabled.",
  );
  const disabledSettingDelivery = await db
    .select({ id: telegramDeliveryOutbox.id })
    .from(telegramDeliveryOutbox)
    .where(eq(telegramDeliveryOutbox.businessDate, "2026-08-08"));
  assert.equal(
    disabledSettingDelivery.length,
    0,
    "closing_daily=false tidak boleh membuat outbox.",
  );

  const integrationOffShiftId = randomUUID();
  const integrationOffOpenedAt = new Date("2026-08-09T01:00:00.000Z");
  const integrationOffClosedAt = new Date("2026-08-09T10:00:00.000Z");
  await db.transaction(async (transaction) => {
    await transaction.insert(shifts).values({
      id: integrationOffShiftId,
      outletId,
      registerId,
      openedBy: userId,
      status: "closed",
      businessDate: "2026-08-09",
      openingCash: "1000000",
      expectedCash: "1000000",
      actualCash: "1000000",
      cashVariance: "0",
      closedBy: userId,
      openedAt: integrationOffOpenedAt,
      closedAt: integrationOffClosedAt,
    });
    await transaction
      .update(telegramReportSettings)
      .set({ closingDailyEnabled: true })
      .where(eq(telegramReportSettings.destinationId, destinationId));

    const result = await finalizeTelegramDailyFinanceInTransaction(transaction, {
      integrationEnabled: false,
      maxAttempts: 5,
      organizationId,
      outletId,
      outletCode: "TGD",
      outletName: "Telegram Daily Outlet",
      shiftId: integrationOffShiftId,
      businessDate: "2026-08-09",
      cashierId: userId,
      cashierName: "Telegram Daily Cashier",
      openedAt: integrationOffOpenedAt,
      closedAt: integrationOffClosedAt,
      expectedCash: 1000000,
      actualCash: 1000000,
      cashVariance: 0,
    });
    assert.equal(result.financeSnapshotCreated, true);
    assert.equal(result.delivery.status, "integration_disabled");
  });

  const [integrationOffSnapshot] = await db
    .select({ id: financeClosingSnapshots.id })
    .from(financeClosingSnapshots)
    .where(eq(financeClosingSnapshots.shiftId, integrationOffShiftId));
  assert.ok(
    integrationOffSnapshot,
    "Finance snapshot harus tetap dibuat saat Telegram integration OFF.",
  );
  const integrationOffDelivery = await db
    .select({ id: telegramDeliveryOutbox.id })
    .from(telegramDeliveryOutbox)
    .where(eq(telegramDeliveryOutbox.businessDate, "2026-08-09"));
  assert.equal(
    integrationOffDelivery.length,
    0,
    "Integration OFF tidak boleh membuat daily outbox.",
  );
}

if (process.argv.includes("--database")) {
  await checkDatabase();
}

console.log(
  process.argv.includes("--database")
    ? "Telegram 2C.5 daily finance checks passed: cost snapshot, immutable finance snapshot, Dana Titip, payment breakdown, idempotency, dan daily outbox."
    : "Telegram 2C.5 daily finance contract checks passed: formatter, cost safety, checkout snapshot, closing transaction integration, dan no HTTP path.",
);
