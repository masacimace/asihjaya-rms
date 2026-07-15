import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [
    eventService,
    approvalNotifications,
    approvalActions,
    saleTransactionService,
    saleAdminActions,
    returnNotifications,
    returnService,
    reconciliationNotifications,
    reconciliationAction,
    settlementImportAction,
    shiftNotifications,
    cashNotifications,
    hardwareNotifications,
  ] = await Promise.all([
    readFile("src/features/notifications/event-service.ts", "utf8"),
    readFile("src/features/notifications/approvals.ts", "utf8"),
    readFile("src/app/actions/approvals.ts", "utf8"),
    readFile("src/features/sales/transaction-service.ts", "utf8"),
    readFile("src/features/sales/admin-actions.ts", "utf8"),
    readFile("src/features/notifications/returns.ts", "utf8"),
    readFile("src/features/returns/transaction-service.ts", "utf8"),
    readFile("src/features/notifications/reconciliation.ts", "utf8"),
    readFile("src/app/actions/payment-reconciliation.ts", "utf8"),
    readFile("src/app/actions/settlement-import.ts", "utf8"),
    readFile("src/features/notifications/shift.ts", "utf8"),
    readFile("src/features/notifications/cash.ts", "utf8"),
    readFile("src/features/notifications/hardware.ts", "utf8"),
  ]);

  assert.match(
    eventService,
    /resolveNotificationEventsByEntityInTransaction/,
  );
  assert.match(approvalNotifications, /approval\.execution_ready/);
  assert.match(approvalNotifications, /approval\.execution_failed/);
  assert.match(approvalNotifications, /approval\.refund_completed/);
  assert.match(approvalNotifications, /approval\.void_completed/);
  assert.match(
    approvalActions,
    /publishApprovalResolutionNotificationInTransaction/,
  );
  assert.match(
    saleTransactionService,
    /publishSaleReversalCompletedNotificationInTransaction/,
  );
  assert.match(
    saleTransactionService,
    /publishReturnAwaitingReceiptNotificationInTransaction/,
  );
  assert.match(
    saleAdminActions,
    /publishApprovalExecutionFailedNotification/,
  );

  assert.match(returnNotifications, /return\.awaiting_receipt/);
  assert.match(returnNotifications, /return\.pending_inspection/);
  assert.match(returnNotifications, /return\.completed/);
  assert.match(returnNotifications, /requiredAnyPermissionCodes: \["returns\.receive"\]/);
  assert.match(returnNotifications, /requiredAnyPermissionCodes: \["returns\.inspect"\]/);
  assert.match(
    returnService,
    /publishReturnPendingInspectionNotificationInTransaction/,
  );
  assert.match(
    returnService,
    /publishReturnCompletedNotificationInTransaction/,
  );

  assert.match(
    reconciliationNotifications,
    /payment\.reconciliation_mismatch/,
  );
  assert.match(
    reconciliationNotifications,
    /payment\.reconciliation_not_found/,
  );
  assert.match(
    reconciliationNotifications,
    /settlement_import\.completed_with_issues/,
  );
  assert.match(
    reconciliationAction,
    /syncPaymentReconciliationNotificationInTransaction/,
  );
  assert.match(
    settlementImportAction,
    /syncSettlementImportCompletedNotificationInTransaction/,
  );

  assert.match(shiftNotifications, /eventType: "shift\.cash_variance"/);
  assert.match(shiftNotifications, /requiresAction: true/);
  assert.match(cashNotifications, /eventType: "cash\.manual_movement"/);
  assert.match(hardwareNotifications, /eventType: "hardware\.agent_offline"/);
  assert.match(hardwareNotifications, /eventType: "hardware\.agent_recovered"/);
  assert.match(hardwareNotifications, /eventType: "hardware\.job_failed"/);

  assert.doesNotMatch(
    approvalNotifications,
    /eventType: "approval\.pending"/,
    "Pending approval harus tetap hanya berada di Approval Drawer.",
  );

  console.log(
    "Notification Center V1-C approval result and operational event checks passed.",
  );
}

main().catch((error) => {
  console.error("Notification Center V1-C check gagal.", error);
  process.exitCode = 1;
});
