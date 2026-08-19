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
  markPosCheckoutAttemptFailed,
} from "@/features/pos/checkout-attempt-service";
import { type PosCheckoutPayload } from "@/features/pos/contracts";
import { getPosCheckoutRecoveryStatus } from "@/features/pos/checkout-recovery";
import {
  claimProductItemsForSale,
  type InventorySaleClaimTransaction,
} from "@/features/pos/inventory-sale-claim";
import { lockManualPaymentReference } from "@/features/pos/manual-payment-reference-lock";
import {
  executeSaleReversal,
  SaleReversalTransactionError,
} from "@/features/sales/transaction-service";
import { createHardwareJobV2 } from "@/lib/hardware/job-producer-v2";
import { type AuthContext } from "@/lib/auth/session";
import {
  closeShiftWithReconciliation,
  ShiftClosingError,
} from "@/lib/shifts/shift-closing";

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
  const itemIds = overrides.itemIds ?? [fixture.itemIds[0]!];
  const itemPricing =
    overrides.itemPricing ??
    itemIds.map((itemId) => ({
      itemId,
      pricePerGram: "1000000",
      discountAmount: 0,
      laborAmount: 0,
      adjustmentAmount: 0,
    }));

  return {
    payments: [{ method: "cash", amount: 1_000_000 }],
    idempotencyKey,
    customerId: fixture.customerId,
    ...overrides,
    itemIds,
    itemPricing,
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

test("checkout failed and stale attempts are reclaimed with attempt fencing", async ({
  organizationA,
}) => {
  const idempotencyKey = key("pos_retry_fencing");
  const context = checkoutContext(organizationA);
  const payload = checkoutPayload(organizationA, idempotencyKey);

  const firstClaim = await claimPosCheckoutAttempt({ context, payload });
  assert.equal(firstClaim.status, "claimed");
  if (firstClaim.status !== "claimed") {
    throw new Error("Initial checkout attempt was not claimed.");
  }

  await markPosCheckoutAttemptFailed({
    attemptId: firstClaim.attempt.id,
    attemptCount: firstClaim.attempt.attemptCount,
    errorCode: "TEST_TRANSIENT_FAILURE",
    errorMessage: "Simulated transient checkout failure",
  });

  const failedAttempt = await getPosCheckoutAttemptByKey(idempotencyKey);
  assert.equal(failedAttempt?.status, "failed");
  assert.equal(failedAttempt?.attemptCount, 1);

  const failedReplay = await claimPosCheckoutAttempt({ context, payload });
  assert.equal(failedReplay.status, "claimed");
  if (failedReplay.status !== "claimed") {
    throw new Error("Failed checkout attempt was not reclaimed.");
  }
  assert.equal(failedReplay.replay, true);
  assert.equal(failedReplay.attempt.attemptCount, 2);

  await pool.query(
    `update pos_checkout_attempts
        set updated_at = now() - interval '10 minutes'
      where id = $1`,
    [failedReplay.attempt.id],
  );

  const staleReplay = await claimPosCheckoutAttempt({ context, payload });
  assert.equal(staleReplay.status, "claimed");
  if (staleReplay.status !== "claimed") {
    throw new Error("Stale checkout attempt was not reclaimed.");
  }
  assert.equal(staleReplay.replay, true);
  assert.equal(staleReplay.attempt.attemptCount, 3);

  const staleOwnerSale = await createSale(organizationA);
  await markPosCheckoutAttemptCompleted({
    attemptId: failedReplay.attempt.id,
    attemptCount: failedReplay.attempt.attemptCount,
    saleId: staleOwnerSale.saleId,
  });

  const fencedAttempt = await getPosCheckoutAttemptByKey(idempotencyKey);
  assert.equal(fencedAttempt?.status, "processing");
  assert.equal(fencedAttempt?.attemptCount, 3);
  assert.equal(fencedAttempt?.saleId, null);

  const currentOwnerSale = await createSale(organizationA);
  await markPosCheckoutAttemptCompleted({
    attemptId: staleReplay.attempt.id,
    attemptCount: staleReplay.attempt.attemptCount,
    saleId: currentOwnerSale.saleId,
  });

  const completedAttempt = await getPosCheckoutAttemptByKey(idempotencyKey);
  assert.equal(completedAttempt?.status, "completed");
  assert.equal(completedAttempt?.attemptCount, 3);
  assert.equal(completedAttempt?.saleId, currentOwnerSale.saleId);
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

test("direct refund is concurrency-safe and tenant scoped without approval", async ({
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
       id, sale_id, method, provider, amount, status, verification_status,
       manual_payment_profile_id, settlement_status, verified_by, verified_at,
       paid_at, metadata
     ) values ($1, $2, 'debit_card', 'BCA', 1000000, 'paid', 'self_verified',
       $3, 'not_applicable', $4, $5, $5, '{}'::jsonb)`,
    [
      id(),
      sale.saleId,
      organizationA.paymentProfileId,
      organizationA.makerId,
      TEST_NOW,
    ],
  );

  const execute = () =>
    executeSaleReversal({
      kind: "refund",
      saleId: sale.saleId,
      organizationId: organizationA.organizationId,
      accessibleOutletIds: [organizationA.outletId],
      actor: { id: organizationA.executorId, fullName: "A executor" },
      executionNote: "Concurrent direct financial test refund",
      requestMetadata: { ipAddress: "127.0.0.1", userAgent: "financial-test" },
      now: new Date(TEST_NOW.getTime() + 5_000),
    });

  const concurrent = await Promise.allSettled([execute(), execute()]);
  const fulfilled = concurrent.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof execute>>> =>
      result.status === "fulfilled",
  );
  assert.equal(fulfilled.length, 1);

  for (const result of concurrent) {
    if (result.status === "rejected") {
      assert.equal(result.reason instanceof SaleReversalTransactionError, true);
      assert.equal(
        ["INVALID_STATE", "CONCURRENT_STATE_CHANGE"].includes(result.reason.code),
        true,
      );
    }
  }

  assert.equal(await queryCount("approvals"), 0, "Refund langsung tidak boleh membuat approval.");
  assert.equal(await queryCount("payment_refunds", "where sale_id = $1", [sale.saleId]), 1);
  assert.equal(await queryCount("sale_return_cases", "where sale_id = $1", [sale.saleId]), 1);
  assert.equal(await queryCount("sale_return_items", "where product_item_id = $1", [itemId]), 1);

  const saleState = await queryOne<{ status: string }>(
    `select status from sales where id = $1`,
    [sale.saleId],
  );
  assert.equal(saleState.status, "refunded");

  await assert.rejects(
    execute(),
    (error: unknown) =>
      error instanceof SaleReversalTransactionError && error.code === "INVALID_STATE",
  );

  await assert.rejects(
    executeSaleReversal({
      kind: "refund",
      saleId: sale.saleId,
      organizationId: organizationB.organizationId,
      accessibleOutletIds: [organizationB.outletId],
      actor: { id: organizationB.executorId, fullName: "B executor" },
      requestMetadata: { ipAddress: null, userAgent: null },
      now: new Date(TEST_NOW.getTime() + 6_000),
    }),
    (error: unknown) =>
      error instanceof SaleReversalTransactionError && error.code === "NOT_FOUND",
  );
});

test("shift closing reconciles cash exactly once and requires variance notes", async ({
  organizationA,
  organizationB,
}) => {
  const sale = await createSale(organizationA);

  await pool.query(`update shifts set opening_cash = 100000 where id = $1`, [
    organizationA.shiftId,
  ]);
  await pool.query(
    `insert into cash_movements
       (id, shift_id, type, amount, reference_type, reference_id, reason, created_by, created_at)
     values
       ($1, $2, 'cash_sale', 1000000, 'sale', $3, 'Cash sale', $4, $9),
       ($5, $2, 'cash_in', 200000, null, null, 'Petty cash return', $4, $9),
       ($6, $2, 'cash_out', 50000, null, null, 'Operational expense', $4, $9),
       ($7, $2, 'cash_refund', 100000, 'sale', $3, 'Cash refund', $4, $9),
       ($8, $2, 'closing_adjustment', 25000, null, null, 'Approved adjustment', $4, $9)`,
    [
      id(),
      organizationA.shiftId,
      sale.saleId,
      organizationA.makerId,
      id(),
      id(),
      id(),
      id(),
      TEST_NOW,
    ],
  );

  const expectedCash = 1_175_000;
  const close = () =>
    closeShiftWithReconciliation({
      auth: authContext(organizationA),
      shiftId: organizationA.shiftId,
      actualCash: expectedCash,
      varianceReason: null,
      requestMetadata: {
        ipAddress: "127.0.0.1",
        userAgent: "financial-test",
      },
      source: "pos.close_shift",
    });

  const concurrent = await Promise.allSettled([close(), close()]);
  const successful = concurrent.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof close>>> =>
      result.status === "fulfilled",
  );
  const rejected = concurrent.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  assert.equal(successful.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0]?.reason instanceof ShiftClosingError, true);
  assert.equal(successful[0]?.value.expectedCash, expectedCash);
  assert.equal(successful[0]?.value.variance, 0);

  const closedShift = await queryOne<{
    status: string;
    expected_cash: string;
    actual_cash: string;
    cash_variance: string;
  }>(
    `select status, expected_cash, actual_cash, cash_variance
       from shifts
      where id = $1`,
    [organizationA.shiftId],
  );
  assert.deepEqual(closedShift, {
    status: "closed",
    expected_cash: String(expectedCash),
    actual_cash: String(expectedCash),
    cash_variance: "0",
  });
  assert.equal(
    await queryCount(
      "audit_logs",
      "where entity_type = 'shift' and entity_id = $1 and action = 'shift.close'",
      [organizationA.shiftId],
    ),
    1,
  );

  await pool.query(`update shifts set opening_cash = 100000 where id = $1`, [
    organizationB.shiftId,
  ]);

  await assert.rejects(
    closeShiftWithReconciliation({
      auth: authContext(organizationB),
      shiftId: organizationB.shiftId,
      actualCash: 90_000,
      varianceReason: null,
      requestMetadata: { ipAddress: null, userAgent: null },
      source: "admin.shift_dashboard",
    }),
    (error: unknown) =>
      error instanceof ShiftClosingError &&
      /Catatan selisih wajib diisi/.test(error.message),
  );

  const stillOpen = await queryOne<{ status: string }>(
    `select status from shifts where id = $1`,
    [organizationB.shiftId],
  );
  assert.equal(stillOpen.status, "open");

  const varianceClose = await closeShiftWithReconciliation({
    auth: authContext(organizationB),
    shiftId: organizationB.shiftId,
    actualCash: 90_000,
    varianceReason: "Selisih kas hasil perhitungan ulang",
    requestMetadata: { ipAddress: null, userAgent: null },
    source: "admin.shift_dashboard",
  });
  assert.equal(varianceClose.expectedCash, 100_000);
  assert.equal(varianceClose.variance, -10_000);
  assert.equal(varianceClose.varianceReason, "Selisih kas hasil perhitungan ulang");
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
