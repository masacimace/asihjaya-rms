import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";

import { db, pool } from "@/db";
import {
  customerDepositLedger,
  payments,
  sales,
  settlementImportBatches,
} from "@/db/schema";
import { lockCustomerDepositBalance } from "@/features/customers/deposit-balance-lock";
import {
  claimPosCheckoutAttempt,
  getPosCheckoutAttemptByKey,
  markPosCheckoutAttemptCompleted,
} from "@/features/pos/checkout-attempt-service";
import { type PosCheckoutPayload } from "@/features/pos/contracts";
import { getPosCheckoutRecoveryStatus } from "@/features/pos/checkout-recovery";
import {
  claimProductItemsForSale,
  type InventorySaleClaimTransaction,
} from "@/features/pos/inventory-sale-claim";
import { lockManualPaymentReference } from "@/features/pos/manual-payment-reference-lock";
import {
  executeApprovedSaleReversal,
  SaleReversalTransactionError,
} from "@/features/sales/transaction-service";
import { createHardwareJobV2 } from "@/lib/hardware/job-producer-v2";
import { type AuthContext } from "@/lib/auth/session";

type OrganizationFixture = {
  organizationId: string;
  outletId: string;
  registerId: string;
  shiftId: string;
  makerId: string;
  approverId: string;
  executorId: string;
  customerId: string;
  categoryId: string;
  masterId: string;
  itemIds: string[];
  paymentProfileId: string;
  prefix: string;
};

type SuiteFixture = {
  organizationA: OrganizationFixture;
  organizationB: OrganizationFixture;
};

type TestCase = {
  name: string;
  run: (fixture: SuiteFixture) => Promise<void>;
};

const TEST_CASES: TestCase[] = [];
const TEST_NOW = new Date("2026-07-28T02:00:00.000Z");

function test(name: string, run: TestCase["run"]) {
  TEST_CASES.push({ name, run });
}

function id() {
  return randomUUID();
}

function key(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

async function queryOne<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const result = await pool.query<T>(text, values);
  assert.equal(result.rows.length, 1, `Query harus menghasilkan tepat satu row: ${text}`);
  return result.rows[0]!;
}

async function queryCount(tableName: string, whereSql = "", values: unknown[] = []) {
  const result = await queryOne<{ count: string }>(
    `select count(*)::text as count from ${tableName} ${whereSql}`,
    values,
  );
  return Number(result.count);
}

async function assertDisposablePostgres17() {
  const result = await queryOne<{
    version_number: string;
    database_name: string;
  }>(
    `select current_setting('server_version_num') as version_number,
            current_database() as database_name`,
  );

  assert.equal(
    Number(result.version_number) >= 170000 && Number(result.version_number) < 180000,
    true,
    `Financial test wajib memakai PostgreSQL 17, ditemukan ${result.version_number}.`,
  );
  assert.match(
    result.database_name,
    /(?:^|[_-])(test|ci)(?:$|[_-])/i,
    `Database ${result.database_name} tidak terlihat sebagai database disposable.`,
  );
}

async function resetPublicTables() {
  const result = await pool.query<{ tablename: string }>(
    `select tablename
       from pg_tables
      where schemaname = 'public'
      order by tablename`,
  );

  const tables = result.rows.map(({ tablename }: { tablename: string }) =>
    `"public"."${tablename.replaceAll('"', '""')}"`,
  );

  if (tables.length > 0) {
    await pool.query(`truncate table ${tables.join(", ")} restart identity cascade`);
  }
}

async function createOrganizationFixture(prefix: string): Promise<OrganizationFixture> {
  const organizationId = id();
  const outletId = id();
  const registerId = id();
  const makerId = id();
  const approverId = id();
  const executorId = id();
  const shiftId = id();
  const customerId = id();
  const categoryId = id();
  const masterId = id();
  const paymentProfileId = id();
  const itemIds = [id(), id(), id()];

  await pool.query(
    `insert into organizations (id, name, slug, timezone, currency)
     values ($1, $2, $3, 'Asia/Jakarta', 'IDR')`,
    [organizationId, `Organization ${prefix}`, `financial-${prefix.toLowerCase()}`],
  );
  await pool.query(
    `insert into outlets (id, organization_id, code, name)
     values ($1, $2, $3, $4)`,
    [outletId, organizationId, `${prefix}-OUT`, `Outlet ${prefix}`],
  );
  await pool.query(
    `insert into registers (id, outlet_id, code, name)
     values ($1, $2, $3, $4)`,
    [registerId, outletId, `${prefix}-REG`, `Register ${prefix}`],
  );

  for (const [userId, role] of [
    [makerId, "maker"],
    [approverId, "approver"],
    [executorId, "executor"],
  ] as const) {
    await pool.query(
      `insert into users (id, organization_id, email, username, full_name, status)
       values ($1, $2, $3, $4, $5, 'active')`,
      [
        userId,
        organizationId,
        `${prefix.toLowerCase()}-${role}@test.local`,
        `${prefix.toLowerCase()}-${role}`,
        `${prefix} ${role}`,
      ],
    );
    await pool.query(
      `insert into user_outlets (id, user_id, outlet_id, is_primary)
       values ($1, $2, $3, true)`,
      [id(), userId, outletId],
    );
  }

  await pool.query(
    `insert into shifts (id, outlet_id, register_id, opened_by, status, opening_cash, opened_at)
     values ($1, $2, $3, $4, 'open', 0, $5)`,
    [shiftId, outletId, registerId, makerId, TEST_NOW],
  );
  await pool.query(
    `insert into customers (id, organization_id, customer_code, full_name, is_active)
     values ($1, $2, $3, $4, true)`,
    [customerId, organizationId, `${prefix}-CUST`, `Customer ${prefix}`],
  );
  await pool.query(
    `insert into product_categories (id, organization_id, code, name, is_active)
     values ($1, $2, $3, $4, true)`,
    [categoryId, organizationId, `${prefix}-CAT`, `Category ${prefix}`],
  );
  await pool.query(
    `insert into product_masters (id, organization_id, category_id, code, name, status)
     values ($1, $2, $3, $4, $5, 'active')`,
    [masterId, organizationId, categoryId, `${prefix}-MASTER`, `Master ${prefix}`],
  );

  for (const [index, itemId] of itemIds.entries()) {
    await pool.query(
      `insert into product_items (
         id, organization_id, product_master_id, current_outlet_id,
         sku, barcode, selling_amount, availability, condition,
         location_state, is_active
       ) values ($1, $2, $3, $4, $5, $6, 1000000, 'available', 'good', 'outlet', true)`,
      [
        itemId,
        organizationId,
        masterId,
        outletId,
        `${prefix}-SKU-${index + 1}`,
        `${prefix}-BAR-${index + 1}`,
      ],
    );
  }

  await pool.query(
    `insert into manual_payment_profiles (
       id, organization_id, outlet_id, register_id, profile_type, code,
       name, provider, verification_source, terminal_id, is_active
     ) values ($1, $2, $3, $4, 'edc', $5, $6, 'BCA', 'edc_terminal', $7, true)`,
    [
      paymentProfileId,
      organizationId,
      outletId,
      registerId,
      `${prefix}-EDC`,
      `EDC ${prefix}`,
      `${prefix}-TERM`,
    ],
  );

  return {
    organizationId,
    outletId,
    registerId,
    shiftId,
    makerId,
    approverId,
    executorId,
    customerId,
    categoryId,
    masterId,
    itemIds,
    paymentProfileId,
    prefix,
  };
}

async function createFixture(): Promise<SuiteFixture> {
  return {
    organizationA: await createOrganizationFixture("A"),
    organizationB: await createOrganizationFixture("B"),
  };
}

async function createSale(
  fixture: OrganizationFixture,
  options: {
    idempotencyKey?: string;
    totalAmount?: number;
    customerId?: string | null;
    status?: "draft" | "completed";
  } = {},
) {
  const saleId = id();
  const totalAmount = options.totalAmount ?? 1_000_000;
  const status = options.status ?? "completed";
  const idempotencyKey = options.idempotencyKey ?? key("pos_sale");
  const invoiceNumber = `${fixture.prefix}-INV-${randomUUID().slice(0, 8)}`;

  await pool.query(
    `insert into sales (
       id, organization_id, outlet_id, register_id, shift_id, customer_id,
       cashier_id, invoice_number, idempotency_key, status,
       subtotal_amount, discount_amount, additional_fee_amount, total_amount,
       completed_at
     ) values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11, 0, 0, $11, $12
     )`,
    [
      saleId,
      fixture.organizationId,
      fixture.outletId,
      fixture.registerId,
      fixture.shiftId,
      options.customerId ?? fixture.customerId,
      fixture.makerId,
      invoiceNumber,
      idempotencyKey,
      status,
      totalAmount,
      status === "completed" ? TEST_NOW : null,
    ],
  );

  return { saleId, invoiceNumber, idempotencyKey, totalAmount };
}

function checkoutContext(fixture: OrganizationFixture) {
  return {
    organizationId: fixture.organizationId,
    outletId: fixture.outletId,
    registerId: fixture.registerId,
    shiftId: fixture.shiftId,
    cashierId: fixture.makerId,
  };
}

function checkoutPayload(
  fixture: OrganizationFixture,
  idempotencyKey: string,
  overrides: Partial<PosCheckoutPayload> = {},
): PosCheckoutPayload {
  return {
    itemIds: [fixture.itemIds[0]!],
    payments: [{ method: "cash", amount: 1_000_000 }],
    idempotencyKey,
    customerId: fixture.customerId,
    ...overrides,
  };
}

function authContext(fixture: OrganizationFixture): AuthContext {
  return {
    session: { id: id(), expiresAt: new Date(TEST_NOW.getTime() + 3_600_000) },
    organization: {
      id: fixture.organizationId,
      name: `Organization ${fixture.prefix}`,
      slug: `financial-${fixture.prefix.toLowerCase()}`,
      timezone: "Asia/Jakarta",
    },
    user: {
      id: fixture.makerId,
      email: `${fixture.prefix.toLowerCase()}-maker@test.local`,
      username: `${fixture.prefix.toLowerCase()}-maker`,
      fullName: `${fixture.prefix} maker`,
    },
    roles: [],
    permissionCodes: [],
    outlets: [
      {
        id: fixture.outletId,
        code: `${fixture.prefix}-OUT`,
        name: `Outlet ${fixture.prefix}`,
        isPrimary: true,
      },
    ],
  };
}

test("checkout idempotency claims once and rejects changed financial intent", async ({ organizationA }) => {
  const idempotencyKey = key("pos_checkout");
  const context = checkoutContext(organizationA);
  const payload = checkoutPayload(organizationA, idempotencyKey, {
    customerDepositUsedAmount: 100_000,
  });

  const concurrent = await Promise.all([
    claimPosCheckoutAttempt({ context, payload }),
    claimPosCheckoutAttempt({ context, payload }),
  ]);

  assert.equal(concurrent.filter((result) => result.status === "claimed").length, 1);
  assert.equal(concurrent.filter((result) => result.status === "processing").length, 1);

  const changedDeposit = await claimPosCheckoutAttempt({
    context,
    payload: checkoutPayload(organizationA, idempotencyKey, {
      customerDepositUsedAmount: 200_000,
    }),
  });
  assert.equal(changedDeposit.status, "conflict");

  const changedDepositIn = await claimPosCheckoutAttempt({
    context,
    payload: checkoutPayload(organizationA, idempotencyKey, {
      customerDepositUsedAmount: 100_000,
      customerDepositInAmount: 50_000,
    }),
  });
  assert.equal(changedDepositIn.status, "conflict");

  const changedApproval = await claimPosCheckoutAttempt({
    context,
    payload: checkoutPayload(organizationA, idempotencyKey, {
      customerDepositUsedAmount: 100_000,
      manualPaymentApprovalId: id(),
    }),
  });
  assert.equal(changedApproval.status, "conflict");

  const claimed = concurrent.find((result) => result.status === "claimed");
  if (!claimed || claimed.status !== "claimed") {
    throw new Error("Concurrent checkout claim tidak memiliki owner.");
  }
  const sale = await createSale(organizationA, { idempotencyKey });
  await markPosCheckoutAttemptCompleted({
    attemptId: claimed.attempt.id,
    attemptCount: claimed.attempt.attemptCount,
    saleId: sale.saleId,
  });

  const replay = await claimPosCheckoutAttempt({ context, payload });
  assert.equal(replay.status, "completed");
  assert.equal(replay.attempt.saleId, sale.saleId);
});

test("inventory claim permits exactly one checkout and rolls back partial claims", async ({
  organizationA,
  organizationB,
}) => {
  const targetItemId = organizationA.itemIds[0]!;

  const tenantMismatch = await db.transaction((transaction: InventorySaleClaimTransaction) =>
    claimProductItemsForSale(transaction, {
      organizationId: organizationB.organizationId,
      outletId: organizationB.outletId,
      itemIds: [targetItemId],
      now: TEST_NOW,
    }),
  );
  assert.equal(tenantMismatch.allClaimed, false);

  async function competingClaim() {
    try {
      await db.transaction(async (transaction: InventorySaleClaimTransaction) => {
        const result = await claimProductItemsForSale(transaction, {
          organizationId: organizationA.organizationId,
          outletId: organizationA.outletId,
          itemIds: [targetItemId],
          now: TEST_NOW,
        });
        if (!result.allClaimed) throw new Error("ITEM_ALREADY_CLAIMED");
        await transaction.execute(sql`select pg_sleep(0.08)`);
      });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === "ITEM_ALREADY_CLAIMED") {
        return false;
      }
      throw error;
    }
  }

  const outcomes = await Promise.all([competingClaim(), competingClaim()]);
  assert.deepEqual(outcomes.sort(), [false, true]);

  const targetState = await queryOne<{ availability: string; location_state: string }>(
    `select availability, location_state from product_items where id = $1`,
    [targetItemId],
  );
  assert.deepEqual(targetState, { availability: "sold", location_state: "customer" });

  const availableItemId = organizationA.itemIds[1]!;
  const alreadySoldItemId = organizationA.itemIds[2]!;
  await pool.query(
    `update product_items
        set availability = 'sold', location_state = 'customer'
      where id = $1`,
    [alreadySoldItemId],
  );

  await assert.rejects(
    db.transaction(async (transaction: InventorySaleClaimTransaction) => {
      const result = await claimProductItemsForSale(transaction, {
        organizationId: organizationA.organizationId,
        outletId: organizationA.outletId,
        itemIds: [availableItemId, alreadySoldItemId],
        now: TEST_NOW,
      });
      if (!result.allClaimed) throw new Error("PARTIAL_CLAIM_ROLLBACK");
    }),
    /PARTIAL_CLAIM_ROLLBACK/,
  );

  const rolledBackState = await queryOne<{ availability: string; location_state: string }>(
    `select availability, location_state from product_items where id = $1`,
    [availableItemId],
  );
  assert.deepEqual(rolledBackState, { availability: "available", location_state: "outlet" });
});

test("Dana Titip advisory lock prevents concurrent double spend", async ({ organizationA }) => {
  await pool.query(
    `insert into customer_deposit_ledger (
       id, organization_id, outlet_id, customer_id, entry_type, direction,
       amount, balance_after, idempotency_key, description, metadata,
       created_by, occurred_at, created_at
     ) values ($1, $2, $3, $4, 'deposit_in', 'credit', 1000000, 1000000,
       $5, 'Initial financial test balance', '{}'::jsonb, $6, $7, $7)`,
    [
      id(),
      organizationA.organizationId,
      organizationA.outletId,
      organizationA.customerId,
      key("deposit_initial"),
      organizationA.makerId,
      TEST_NOW,
    ],
  );

  async function spend(amount: number, suffix: string) {
    return db.transaction(async (transaction: InventorySaleClaimTransaction) => {
      const balance = await lockCustomerDepositBalance(transaction, {
        organizationId: organizationA.organizationId,
        outletId: organizationA.outletId,
        customerId: organizationA.customerId,
      });
      if (balance < amount) return false;

      await transaction.insert(customerDepositLedger).values({
        organizationId: organizationA.organizationId,
        outletId: organizationA.outletId,
        customerId: organizationA.customerId,
        entryType: "deposit_used",
        direction: "debit",
        amount: String(amount),
        balanceAfter: String(balance - amount),
        idempotencyKey: key(`deposit_spend_${suffix}`),
        description: "Concurrent financial test spend",
        metadata: { source: "financial-concurrency-test" },
        createdBy: organizationA.makerId,
        occurredAt: new Date(TEST_NOW.getTime() + 1_000),
        createdAt: new Date(TEST_NOW.getTime() + 1_000),
      });
      await transaction.execute(sql`select pg_sleep(0.08)`);
      return true;
    });
  }

  const outcomes = await Promise.all([spend(800_000, "a"), spend(800_000, "b")]);
  assert.deepEqual(outcomes.sort(), [false, true]);

  const latest = await db
    .select({ balanceAfter: customerDepositLedger.balanceAfter })
    .from(customerDepositLedger)
    .where(
      and(
        eq(customerDepositLedger.organizationId, organizationA.organizationId),
        eq(customerDepositLedger.outletId, organizationA.outletId),
        eq(customerDepositLedger.customerId, organizationA.customerId),
      ),
    )
    .orderBy(desc(customerDepositLedger.occurredAt), desc(customerDepositLedger.createdAt))
    .limit(1);

  assert.equal(Number(latest[0]?.balanceAfter), 200_000);
  assert.equal(
    await queryCount(
      "customer_deposit_ledger",
      "where organization_id = $1 and customer_id = $2",
      [organizationA.organizationId, organizationA.customerId],
    ),
    2,
  );
});

test("manual payment reference lock serializes duplicate detection", async ({ organizationA }) => {
  const saleA = await createSale(organizationA);
  const saleB = await createSale(organizationA);
  const normalizedProvider = "BCA";
  const normalizedReference = "FINANCIAL-REF-001";

  async function insertPayment(saleId: string) {
    return db.transaction(async (transaction: InventorySaleClaimTransaction) => {
      await lockManualPaymentReference(transaction, {
        organizationId: organizationA.organizationId,
        outletId: organizationA.outletId,
        method: "debit_card",
        normalizedProvider,
        normalizedReference,
      });

      const duplicate = await transaction
        .select({ id: payments.id })
        .from(payments)
        .innerJoin(sales, eq(payments.saleId, sales.id))
        .where(
          and(
            eq(sales.organizationId, organizationA.organizationId),
            eq(sales.outletId, organizationA.outletId),
            eq(payments.method, "debit_card"),
            eq(payments.provider, normalizedProvider),
            eq(payments.normalizedReference, normalizedReference),
          ),
        )
        .limit(1);

      if (duplicate.length > 0) return false;

      await transaction.insert(payments).values({
        saleId,
        method: "debit_card",
        provider: normalizedProvider,
        amount: "1000000",
        status: "paid",
        providerReference: normalizedReference,
        normalizedReference,
        verificationStatus: "self_verified",
        verificationSource: "edc_terminal",
        providerPaidAt: TEST_NOW,
        manualPaymentProfileId: organizationA.paymentProfileId,
        settlementStatus: "unreconciled",
        verifiedBy: organizationA.makerId,
        verifiedAt: TEST_NOW,
        paidAt: TEST_NOW,
        metadata: { source: "financial-concurrency-test" },
      });
      await transaction.execute(sql`select pg_sleep(0.08)`);
      return true;
    });
  }

  const outcomes = await Promise.all([insertPayment(saleA.saleId), insertPayment(saleB.saleId)]);
  assert.deepEqual(outcomes.sort(), [false, true]);
  assert.equal(
    await queryCount(
      "payments p join sales s on s.id = p.sale_id",
      "where s.organization_id = $1 and p.normalized_reference = $2",
      [organizationA.organizationId, normalizedReference],
    ),
    1,
  );
});

test("approved refund is idempotent, maker-checker protected, and tenant scoped", async ({
  organizationA,
  organizationB,
}) => {
  const itemId = organizationA.itemIds[0]!;
  await pool.query(
    `update product_items
        set availability = 'sold', location_state = 'customer'
      where id = $1`,
    [itemId],
  );
  const sale = await createSale(organizationA);
  await pool.query(
    `insert into sale_items (
       id, sale_id, product_item_id, line_number, list_price_amount,
       discount_amount, final_price_amount, snapshot
     ) values ($1, $2, $3, 1, 1000000, 0, 1000000, '{}'::jsonb)`,
    [id(), sale.saleId, itemId],
  );
  await pool.query(
    `insert into payments (
       id, sale_id, method, provider, amount, status, provider_reference,
       normalized_reference, verification_status, verification_source,
       provider_paid_at, manual_payment_profile_id, settlement_status,
       verified_by, verified_at, paid_at, metadata
     ) values ($1, $2, 'debit_card', 'BCA', 1000000, 'paid', $3, $3,
       'self_verified', 'edc_terminal', $4, $5, 'unreconciled', $6, $4, $4,
       '{}'::jsonb)`,
    [
      id(),
      sale.saleId,
      `REF-${randomUUID().slice(0, 10)}`,
      TEST_NOW,
      organizationA.paymentProfileId,
      organizationA.makerId,
    ],
  );

  const approvalId = id();
  await pool.query(
    `insert into approvals (
       id, organization_id, outlet_id, type, status, requested_by, approved_by,
       reference_type, reference_id, request_data, notes, response_notes,
       execution_status, created_at, resolved_at
     ) values ($1, $2, $3, 'refund_transaction', 'approved', $4, $5,
       'sale', $6, '{}'::jsonb, 'Financial test refund', 'Approved',
       'not_started', $7, $7)`,
    [
      approvalId,
      organizationA.organizationId,
      organizationA.outletId,
      organizationA.makerId,
      organizationA.approverId,
      sale.saleId,
      TEST_NOW,
    ],
  );

  const execute = () =>
    executeApprovedSaleReversal({
      kind: "refund",
      saleId: sale.saleId,
      approvalId,
      organizationId: organizationA.organizationId,
      accessibleOutletIds: [organizationA.outletId],
      actor: { id: organizationA.executorId, fullName: "A executor" },
      executionNote: "Concurrent financial test refund",
      requestMetadata: { ipAddress: "127.0.0.1", userAgent: "financial-test" },
      now: new Date(TEST_NOW.getTime() + 5_000),
    });

  const concurrent = await Promise.allSettled([execute(), execute()]);
  const fulfilled = concurrent.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof execute>>> =>
      result.status === "fulfilled",
  );
  assert.equal(fulfilled.length >= 1, true);
  assert.equal(fulfilled.filter((result) => !result.value.idempotentReplay).length, 1);

  for (const result of concurrent) {
    if (result.status === "rejected") {
      assert.equal(result.reason instanceof SaleReversalTransactionError, true);
      assert.equal(
        ["EXECUTION_IN_PROGRESS", "CONCURRENT_STATE_CHANGE"].includes(result.reason.code),
        true,
      );
    }
  }

  const replay = await execute();
  assert.equal(replay.idempotentReplay, true);
  assert.equal(await queryCount("payment_refunds", "where sale_id = $1", [sale.saleId]), 1);
  assert.equal(await queryCount("sale_return_cases", "where sale_id = $1", [sale.saleId]), 1);
  assert.equal(await queryCount("sale_return_items", "where product_item_id = $1", [itemId]), 1);

  const saleState = await queryOne<{ status: string }>(
    `select status from sales where id = $1`,
    [sale.saleId],
  );
  assert.equal(saleState.status, "refunded");

  await assert.rejects(
    executeApprovedSaleReversal({
      kind: "refund",
      saleId: sale.saleId,
      approvalId,
      organizationId: organizationB.organizationId,
      accessibleOutletIds: [organizationB.outletId],
      actor: { id: organizationB.executorId, fullName: "B executor" },
      requestMetadata: { ipAddress: null, userAgent: null },
      now: new Date(TEST_NOW.getTime() + 6_000),
    }),
    (error: unknown) =>
      error instanceof SaleReversalTransactionError && error.code === "NOT_FOUND",
  );

  const makerCheckerSale = await createSale(organizationA);
  const makerCheckerApprovalId = id();
  await pool.query(
    `insert into approvals (
       id, organization_id, outlet_id, type, status, requested_by, approved_by,
       reference_type, reference_id, request_data, execution_status,
       created_at, resolved_at
     ) values ($1, $2, $3, 'refund_transaction', 'approved', $4, $4,
       'sale', $5, '{}'::jsonb, 'not_started', $6, $6)`,
    [
      makerCheckerApprovalId,
      organizationA.organizationId,
      organizationA.outletId,
      organizationA.makerId,
      makerCheckerSale.saleId,
      TEST_NOW,
    ],
  );

  await assert.rejects(
    executeApprovedSaleReversal({
      kind: "refund",
      saleId: makerCheckerSale.saleId,
      approvalId: makerCheckerApprovalId,
      organizationId: organizationA.organizationId,
      accessibleOutletIds: [organizationA.outletId],
      actor: { id: organizationA.executorId, fullName: "A executor" },
      requestMetadata: { ipAddress: null, userAgent: null },
      now: new Date(TEST_NOW.getTime() + 7_000),
    }),
    (error: unknown) =>
      error instanceof SaleReversalTransactionError && error.code === "APPROVAL_NOT_READY",
  );
});

test("settlement file fingerprint is unique per organization", async ({
  organizationA,
  organizationB,
}) => {
  const fileHash = "a".repeat(64);

  async function insertBatch(fixture: OrganizationFixture) {
    const rows = await db
      .insert(settlementImportBatches)
      .values({
        organizationId: fixture.organizationId,
        outletId: fixture.outletId,
        profileId: fixture.paymentProfileId,
        uploadedBy: fixture.makerId,
        fileName: "financial-test.csv",
        fileKey: `financial-test/${fixture.prefix}.csv`,
        fileHash,
        fileSizeBytes: 128,
        status: "uploaded",
      })
      .onConflictDoNothing()
      .returning({ id: settlementImportBatches.id });
    return rows[0]?.id ?? null;
  }

  const concurrent = await Promise.all([insertBatch(organizationA), insertBatch(organizationA)]);
  assert.equal(concurrent.filter(Boolean).length, 1);
  assert.equal(
    await queryCount(
      "settlement_import_batches",
      "where organization_id = $1 and file_hash = $2",
      [organizationA.organizationId, fileHash],
    ),
    1,
  );

  assert.notEqual(await insertBatch(organizationB), null);
  assert.equal(
    await queryCount("settlement_import_batches", "where file_hash = $1", [fileHash]),
    2,
  );
});

test("hardware job creation is exactly-once per organization and business intent", async ({
  organizationA,
  organizationB,
}) => {
  const idempotencyKey = key("hardware_financial");
  const sourceId = id();
  const payload = {
    schemaVersion: 1,
    drawerProfileId: "drawer_default_v1",
    paymentId: null,
    metadata: {
      requestSource: "financial-concurrency-test",
      requestedAt: TEST_NOW.toISOString(),
      test: true,
    },
  };

  const input = {
    organizationId: organizationA.organizationId,
    outletId: organizationA.outletId,
    registerId: organizationA.registerId,
    createdByUserId: organizationA.makerId,
    jobType: "test_cash_drawer" as const,
    mode: "test" as const,
    payload,
    idempotencyKey,
    sourceType: "financial_test",
    sourceId,
    now: TEST_NOW,
  };

  const concurrent = await Promise.all([createHardwareJobV2(input), createHardwareJobV2(input)]);
  assert.equal(new Set(concurrent.map((result) => result.job.id)).size, 1);
  assert.deepEqual(concurrent.map((result) => result.duplicate).sort(), [false, true]);
  assert.equal(
    await queryCount(
      "hardware_jobs",
      "where organization_id = $1 and idempotency_key = $2",
      [organizationA.organizationId, idempotencyKey],
    ),
    1,
  );

  await assert.rejects(
    createHardwareJobV2({ ...input, sourceId: id() }),
    /intent bisnis yang berbeda/,
  );

  const tenantB = await createHardwareJobV2({
    ...input,
    organizationId: organizationB.organizationId,
    outletId: organizationB.outletId,
    registerId: organizationB.registerId,
    createdByUserId: organizationB.makerId,
    sourceId: organizationB.customerId,
  });
  assert.equal(tenantB.duplicate, false);
});

test("checkout recovery repairs committed sale and hides it from another tenant", async ({
  organizationA,
  organizationB,
}) => {
  const idempotencyKey = key("pos_recovery");
  const context = checkoutContext(organizationA);
  const payload = checkoutPayload(organizationA, idempotencyKey);
  const claim = await claimPosCheckoutAttempt({ context, payload });
  assert.equal(claim.status, "claimed");

  const sale = await createSale(organizationA, { idempotencyKey });

  const hidden = await getPosCheckoutRecoveryStatus({
    auth: authContext(organizationB),
    idempotencyKey,
  });
  assert.equal(hidden.status, "not_found");

  const recovered = await getPosCheckoutRecoveryStatus({
    auth: authContext(organizationA),
    idempotencyKey,
  });
  assert.equal(recovered.status, "completed");
  if (recovered.status === "completed") {
    assert.equal(recovered.sale.id, sale.saleId);
  }

  const attempt = await getPosCheckoutAttemptByKey(idempotencyKey);
  assert.equal(attempt?.status, "completed");
  assert.equal(attempt?.saleId, sale.saleId);
});

export async function runFinancialConcurrencySuite() {
  const startedAt = Date.now();
  let passed = 0;

  try {
    await assertDisposablePostgres17();

    console.log(`\nFinancial & Concurrency Integration Suite (${TEST_CASES.length} cases)`);

    for (const testCase of TEST_CASES) {
      await resetPublicTables();
      const fixture = await createFixture();
      const caseStartedAt = Date.now();

      try {
        await testCase.run(fixture);
        passed += 1;
        console.log(`  PASS ${testCase.name} (${Date.now() - caseStartedAt} ms)`);
      } catch (error) {
        console.error(`  FAIL ${testCase.name}`);
        throw error;
      }
    }

    console.log(
      `\nFinancial & Concurrency Integration Suite passed: ${passed}/${TEST_CASES.length} cases (${Date.now() - startedAt} ms).`,
    );
  } finally {
    await pool.end();
  }
}
