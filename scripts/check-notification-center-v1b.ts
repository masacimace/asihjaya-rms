import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseSale = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  outletId: "10000000-0000-4000-8000-000000000002",
  outletCode: "UTAMA",
  outletName: "Asih Jaya Utama",
  registerId: "10000000-0000-4000-8000-000000000003",
  registerCode: "REG-01",
  shiftId: "10000000-0000-4000-8000-000000000004",
  cashierId: "10000000-0000-4000-8000-000000000005",
  cashierName: "Sales Test",
  saleId: "10000000-0000-4000-8000-000000000006",
  invoiceNumber: "AJ-UTAMA-20260714-001",
  subtotalAmount: 12_500_000,
  discountAmount: 0,
  totalAmount: 12_500_000,
  itemCount: 2,
  totalWeightGram: 8.45,
  payments: [
    {
      method: "cash",
      methodLabel: "Cash",
      amount: 12_500_000,
      provider: null,
    },
  ],
  occurredAt: new Date("2026-07-14T10:00:00.000Z"),
};

async function main() {
  process.env.DATABASE_URL ??=
    "postgresql://notification-check:notification-check@127.0.0.1:5432/notification-check";

  const {
    buildSaleCompletedNotification,
    buildSaleRecoveryNotification,
    DEFAULT_HIGH_VALUE_SALE_THRESHOLD_IDR,
  } = await import("../src/features/notifications/sales");

  const normal = buildSaleCompletedNotification(baseSale);
  assert.equal(normal.eventType, "sale.completed");
  assert.equal(normal.severity, "info");
  assert.equal(normal.title, "Transaksi berhasil");
  assert.equal(normal.deduplicationKey, `sale.completed:${baseSale.saleId}`);
  assert.deepEqual(normal.recipients?.organizationRoleCodes, [
    "owner",
    "system_admin",
  ]);
  assert.deepEqual(normal.recipients?.outletRoleCodes, ["manager"]);
  assert.deepEqual(normal.recipients?.excludeUserIds, [baseSale.cashierId]);
  assert.equal(normal.payload?.isHighValue, false);
  assert.equal(normal.payload?.isSplitPayment, false);
  assert.equal(normal.payload?.totalWeightGram, 8.45);
  assert.equal("customerName" in (normal.payload ?? {}), false);
  assert.equal("customerPhone" in (normal.payload ?? {}), false);

  const highValueSplit = buildSaleCompletedNotification({
    ...baseSale,
    saleId: "10000000-0000-4000-8000-000000000007",
    totalAmount: DEFAULT_HIGH_VALUE_SALE_THRESHOLD_IDR,
    payments: [
      {
        method: "cash",
        methodLabel: "Cash",
        amount: 5_000_000,
      },
      {
        method: "debit_card",
        methodLabel: "Debit Card EDC",
        amount: 25_000_000,
        provider: "BCA",
      },
    ],
  });
  assert.equal(highValueSplit.severity, "warning");
  assert.equal(highValueSplit.title, "Transaksi bernilai besar berhasil");
  assert.equal(highValueSplit.payload?.isHighValue, true);
  assert.equal(highValueSplit.payload?.isSplitPayment, true);
  assert.equal(
    (highValueSplit.payload?.payments as unknown[] | undefined)?.length,
    2,
  );

  const recovery = buildSaleRecoveryNotification({
    organizationId: baseSale.organizationId,
    outletId: baseSale.outletId,
    cashierId: baseSale.cashierId,
    saleId: baseSale.saleId,
    invoiceNumber: baseSale.invoiceNumber,
    totalAmount: baseSale.totalAmount,
    idempotencyKey: "pos_20260714_test",
    recoveryReason: "attempt_repaired",
  });
  assert.equal(recovery.eventType, "sale.recovery_completed");
  assert.equal(recovery.severity, "warning");
  assert.equal(
    recovery.deduplicationKey,
    `sale.recovery_completed:${baseSale.saleId}`,
  );

  const [service, posAction, recoverySource, adminShell] = await Promise.all([
    readFile("src/features/notifications/event-service.ts", "utf8"),
    readFile("src/app/actions/pos.ts", "utf8"),
    readFile("src/features/pos/checkout-recovery.ts", "utf8"),
    readFile("src/components/layout/admin-shell.tsx", "utf8"),
  ]);

  assert.match(service, /organizationRoleCodes/);
  assert.match(service, /outletRoleCodes/);
  assert.match(posAction, /publishSaleCompletedNotificationInTransaction/);
  assert.match(posAction, /publishSaleRecoveryNotificationInTransaction/);
  assert.match(recoverySource, /publishSaleRecoveryNotification/);
  assert.match(recoverySource, /outletId: sale\.outletId/);
  assert.match(adminShell, /notificationDrawerData\.unreadCount/);

  console.log(
    "Notification Center V1-B transaction notification checks passed.",
  );
}

main().catch((error) => {
  console.error("Notification Center V1-B check gagal.", error);
  process.exitCode = 1;
});
