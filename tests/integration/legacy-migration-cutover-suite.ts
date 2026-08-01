import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { pool } from "@/db";
import { getLegacyMigrationCutoverData } from "@/features/legacy-migration/cutover-queries";
import {
  executeLegacyMigrationCutover,
  LegacyMigrationCutoverError,
} from "@/features/legacy-migration/cutover-service";
import { getLegacyMigrationSessionLockKey } from "@/features/legacy-migration/safety";
import type { AuthContext } from "@/lib/auth/session";

type CutoverFixture = {
  organizationId: string;
  outletId: string;
  actorUserId: string;
  categoryId: string;
  masterId: string;
  batchId: string;
  sessionId: string;
  itemIds: string[];
  verificationIds: string[];
  barcodes: string[];
  skus: string[];
};

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

const TEST_CASES: TestCase[] = [];

function test(name: string, run: TestCase["run"]) {
  TEST_CASES.push({ name, run });
}

function id() {
  return randomUUID();
}

function token(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

function errorCauseChainIncludes(error: unknown, pattern: RegExp) {
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (current !== null && current !== undefined && !visited.has(current)) {
    visited.add(current);

    if (current instanceof Error && pattern.test(current.message)) {
      return true;
    }

    if (typeof current !== "object") {
      return false;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

async function queryOne<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const result = await pool.query<T>(text, values);
  assert.equal(result.rows.length, 1, `Query harus menghasilkan satu row: ${text}`);
  return result.rows[0]!;
}

async function queryCount(
  tableName: string,
  whereSql = "",
  values: unknown[] = [],
) {
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
    `Cutover test wajib memakai PostgreSQL 17, ditemukan ${result.version_number}.`,
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
  const tables = result.rows.map(
    ({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`,
  );
  if (tables.length > 0) {
    await pool.query(`truncate table ${tables.join(", ")} restart identity cascade`);
  }
}

async function createFixture(itemCount = 2): Promise<CutoverFixture> {
  const organizationId = id();
  const outletId = id();
  const actorUserId = id();
  const categoryId = id();
  const masterId = id();
  const batchId = id();
  const sessionId = id();
  const itemIds = Array.from({ length: itemCount }, () => id());
  const verificationIds = Array.from({ length: itemCount }, () => id());
  const barcodes = Array.from(
    { length: itemCount },
    (_, index) => `${index + 1}`.padStart(6, "0"),
  );
  const skus = Array.from({ length: itemCount }, (_, index) =>
    token(`SKU${index + 1}`),
  );

  await pool.query(
    `insert into organizations (id, name, slug, timezone, currency)
     values ($1, 'Cutover Test Organization', $2, 'Asia/Jakarta', 'IDR')`,
    [organizationId, token("cutover-org")],
  );
  await pool.query(
    `insert into outlets (id, organization_id, code, name)
     values ($1, $2, $3, 'Cutover Test Outlet')`,
    [outletId, organizationId, token("OUT").slice(0, 24)],
  );
  await pool.query(
    `insert into users (id, organization_id, email, username, full_name, status)
     values ($1, $2, $3, $4, 'Cutover Manager', 'active')`,
    [
      actorUserId,
      organizationId,
      `${token("manager")}@test.local`,
      token("manager").slice(0, 80),
    ],
  );
  await pool.query(
    `insert into product_categories
       (id, organization_id, code, name, is_active)
     values ($1, $2, $3, 'Cincin', true)`,
    [categoryId, organizationId, token("CAT").slice(0, 48)],
  );
  await pool.query(
    `insert into product_masters
       (id, organization_id, category_id, code, name, status)
     values ($1, $2, $3, $4, 'Master Cincin Test', 'active')`,
    [masterId, organizationId, categoryId, token("MASTER").slice(0, 64)],
  );
  await pool.query(
    `insert into legacy_product_import_batches
       (id, organization_id, outlet_id, uploaded_by, file_name, file_hash,
        file_size_bytes, worksheet_name, barcode_length, status, total_rows,
        valid_rows, warning_rows, invalid_rows, unique_master_count)
     values ($1, $2, $3, $4, 'cutover-test.xlsx', $5, 1024, 'Produk', 6,
             'ready', $6, $6, 0, 0, 1)`,
    [batchId, organizationId, outletId, actorUserId, token("hash").padEnd(64, "0").slice(0, 64), itemCount],
  );
  await pool.query(
    `insert into legacy_migration_sessions
       (id, batch_id, organization_id, outlet_id, name, status, created_by,
        started_at, locked_at)
     values ($1, $2, $3, $4, 'Etalase Cutover Test', 'locked', $5, now(), now())`,
    [sessionId, batchId, organizationId, outletId, actorUserId],
  );

  for (let index = 0; index < itemCount; index += 1) {
    const itemId = itemIds[index]!;
    const verificationId = verificationIds[index]!;
    const barcode = barcodes[index]!;
    const sku = skus[index]!;

    await pool.query(
      `insert into product_items
         (id, organization_id, product_master_id, display_name, current_outlet_id,
          sku, barcode, legacy_id, weight_gram, purity_percent, selling_amount,
          price_per_gram, deduction_per_gram, availability, condition,
          location_state, is_active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, '2.100', '75.000',
               '2058000', '980000', '25000', 'migration_hold', 'good',
               'outlet', true)`,
      [
        itemId,
        organizationId,
        masterId,
        `Item ${barcode}`,
        outletId,
        sku,
        token("INTBAR").slice(0, 120),
        barcode,
      ],
    );
    await pool.query(
      `insert into legacy_migration_verifications
         (id, session_id, batch_id, organization_id, outlet_id, barcode_value,
          source, status, target_product_master_id, verified_item_name,
          verified_weight_gram, verified_purity, condition, use_legacy_image,
          image_key, submission_fingerprint, submitted_by, reviewed_by,
          reviewed_at, product_item_id)
       values ($1, $2, $3, $4, $5, $6, 'physical_unmatched', 'approved', $7,
               $8, '2.100', '75.000', 'good', false, $9, $10, $11, $11,
               now(), $12)`,
      [
        verificationId,
        sessionId,
        batchId,
        organizationId,
        outletId,
        barcode,
        masterId,
        `Item ${barcode}`,
        `test/${barcode}.webp`,
        token("fingerprint").padEnd(64, "f").slice(0, 64),
        actorUserId,
        itemId,
      ],
    );
    await pool.query(
      `insert into item_barcodes
         (id, organization_id, item_id, barcode_value, source, is_primary,
          is_active, created_by)
       values ($1, $2, $3, $4, 'legacy_physical_label', true, true, $5)`,
      [id(), organizationId, itemId, barcode, actorUserId],
    );
  }

  return {
    organizationId,
    outletId,
    actorUserId,
    categoryId,
    masterId,
    batchId,
    sessionId,
    itemIds,
    verificationIds,
    barcodes,
    skus,
  };
}

function authContext(fixture: CutoverFixture): AuthContext {
  return {
    session: { id: id(), expiresAt: new Date(Date.now() + 60_000) },
    organization: {
      id: fixture.organizationId,
      name: "Cutover Test Organization",
      slug: "cutover-test",
      timezone: "Asia/Jakarta",
    },
    user: {
      id: fixture.actorUserId,
      email: "manager@test.local",
      username: "manager",
      fullName: "Cutover Manager",
    },
    roles: [],
    permissionCodes: ["migration.cutover.execute"],
    outlets: [
      {
        id: fixture.outletId,
        code: "OUT-TEST",
        name: "Cutover Test Outlet",
        isPrimary: true,
      },
    ],
  };
}

function executeInput(fixture: CutoverFixture) {
  return {
    organizationId: fixture.organizationId,
    actorUserId: fixture.actorUserId,
    batchId: fixture.batchId,
    sessionId: fixture.sessionId,
    requestMetadata: {
      ipAddress: "127.0.0.1",
      userAgent: "cutover-integration-test",
    },
  };
}

async function assertNoPartialActivation(fixture: CutoverFixture) {
  assert.equal(
    await queryCount(
      "legacy_migration_cutover_runs",
      "where session_id = $1",
      [fixture.sessionId],
    ),
    0,
  );
  assert.equal(
    await queryCount(
      "inventory_movements",
      "where reference_type = 'legacy_migration_cutover'",
    ),
    0,
  );
  assert.equal(
    await queryCount(
      "product_items",
      "where id = any($1::uuid[]) and availability = 'migration_hold'",
      [fixture.itemIds],
    ),
    fixture.itemIds.length,
  );
  assert.equal(
    await queryCount(
      "legacy_migration_verifications",
      "where id = any($1::uuid[]) and status = 'approved'",
      [fixture.verificationIds],
    ),
    fixture.verificationIds.length,
  );
  const session = await queryOne<{ status: string }>(
    `select status::text as status
       from legacy_migration_sessions
      where id = $1`,
    [fixture.sessionId],
  );
  assert.equal(session.status, "locked");
}

test("successful cutover activates all eligible rows and persists report metadata", async () => {
  const fixture = await createFixture(2);
  const result = await executeLegacyMigrationCutover(executeInput(fixture));

  assert.equal(result.alreadyExecuted, false);
  assert.equal(result.itemCount, 2);
  assert.equal(
    await queryCount(
      "legacy_migration_cutover_runs",
      "where session_id = $1",
      [fixture.sessionId],
    ),
    1,
  );
  assert.equal(
    await queryCount(
      "inventory_movements",
      "where reference_id = $1 and movement_type = 'migration_opening'",
      [result.runId],
    ),
    2,
  );
  assert.equal(
    await queryCount(
      "product_items",
      "where id = any($1::uuid[]) and availability = 'available'",
      [fixture.itemIds],
    ),
    2,
  );
  assert.equal(
    await queryCount(
      "legacy_migration_verifications",
      "where id = any($1::uuid[]) and status = 'activated'",
      [fixture.verificationIds],
    ),
    2,
  );

  const run = await queryOne<{ metadata: Record<string, unknown> }>(
    `select metadata from legacy_migration_cutover_runs where id = $1`,
    [result.runId],
  );
  assert.equal(typeof run.metadata.operationId, "string");
  assert.equal(typeof run.metadata.startedAt, "string");
  assert.equal(typeof run.metadata.finishedAt, "string");
  assert.match(String(run.metadata.barcodeDigest), /^[0-9a-f]{64}$/);
  assert.equal(run.metadata.preflightBlockerCount, 0);
});

test("two managers cutting over the same session produce one run only", async () => {
  const fixture = await createFixture(3);
  const [left, right] = await Promise.all([
    executeLegacyMigrationCutover(executeInput(fixture)),
    executeLegacyMigrationCutover(executeInput(fixture)),
  ]);

  assert.equal([left, right].filter((row) => row.alreadyExecuted).length, 1);
  assert.equal([left, right].filter((row) => !row.alreadyExecuted).length, 1);
  assert.equal(left.runId, right.runId);
  assert.equal(
    await queryCount(
      "legacy_migration_cutover_runs",
      "where session_id = $1",
      [fixture.sessionId],
    ),
    1,
  );
  assert.equal(
    await queryCount(
      "inventory_movements",
      "where reference_type = 'legacy_migration_cutover'",
    ),
    3,
  );
  assert.equal(
    await queryCount(
      "audit_logs",
      "where action = 'legacy_migration_cutover.idempotent_retry'",
    ),
    1,
  );
});

test("database error after movement insertion rolls back the whole cutover and allows retry", async () => {
  const fixture = await createFixture(2);

  await pool.query(`
    create or replace function cutover_test_fail_item_activation()
    returns trigger language plpgsql as $$
    begin
      if old.availability = 'migration_hold' and new.availability = 'available' then
        raise exception 'forced cutover rollback';
      end if;
      return new;
    end;
    $$;
  `);
  await pool.query(`
    create trigger cutover_test_fail_item_activation_trigger
    before update on product_items
    for each row execute function cutover_test_fail_item_activation();
  `);

  await assert.rejects(
    executeLegacyMigrationCutover(executeInput(fixture)),
    (error: unknown) =>
      errorCauseChainIncludes(error, /forced cutover rollback/),
  );
  await assertNoPartialActivation(fixture);
  assert.equal(
    await queryCount(
      "audit_logs",
      "where action = 'legacy_migration_cutover.failed' and entity_id = $1",
      [fixture.sessionId],
    ),
    1,
  );

  const failure = await queryOne<{ after_data: Record<string, unknown> }>(
    `select after_data from audit_logs
      where action = 'legacy_migration_cutover.failed' and entity_id = $1`,
    [fixture.sessionId],
  );
  assert.equal(failure.after_data.rollbackGuaranteed, true);
  assert.equal(failure.after_data.rollbackConfirmed, true);
  assert.equal(failure.after_data.retryAllowed, true);

  await pool.query(
    `drop trigger cutover_test_fail_item_activation_trigger on product_items`,
  );
  await pool.query(`drop function cutover_test_fail_item_activation()`);

  const retry = await executeLegacyMigrationCutover(executeInput(fixture));
  assert.equal(retry.alreadyExecuted, false);
  assert.equal(retry.itemCount, 2);
});

test("stale preflight data is rejected inside the transaction and succeeds after repair", async () => {
  const fixture = await createFixture(1);
  await pool.query(`update product_categories set is_active = false where id = $1`, [
    fixture.categoryId,
  ]);

  await assert.rejects(
    executeLegacyMigrationCutover(executeInput(fixture)),
    (error: unknown) => {
      if (!(error instanceof LegacyMigrationCutoverError)) return false;
      assert.equal(error.code, "CUTOVER_ITEM_INVALID");
      assert.equal(error.detail, "CATEGORY_NOT_ACTIVE");
      return true;
    },
  );
  await assertNoPartialActivation(fixture);

  await pool.query(`update product_categories set is_active = true where id = $1`, [
    fixture.categoryId,
  ]);
  const retry = await executeLegacyMigrationCutover(executeInput(fixture));
  assert.equal(retry.itemCount, 1);
});

test("sold update holding the session lock completes before cutover and sold item stays excluded", async () => {
  const fixture = await createFixture(2);
  const client = await pool.connect();
  const soldIndex = 0;
  const soldItemId = fixture.itemIds[soldIndex]!;
  const soldVerificationId = fixture.verificationIds[soldIndex]!;
  const soldBarcode = fixture.barcodes[soldIndex]!;

  try {
    await client.query("begin");
    await client.query(
      `select pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [
        getLegacyMigrationSessionLockKey({
          organizationId: fixture.organizationId,
          sessionId: fixture.sessionId,
        }),
      ],
    );

    const cutoverPromise = executeLegacyMigrationCutover(executeInput(fixture));
    await new Promise((resolve) => setTimeout(resolve, 100));

    await client.query(
      `insert into legacy_migration_sold_records
         (id, batch_id, organization_id, outlet_id, session_id, barcode_value,
          verification_id, product_item_id, previous_verification_status,
          previous_item_availability, sold_at, reported_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'approved',
               'migration_hold', now(), $9)`,
      [
        id(),
        fixture.batchId,
        fixture.organizationId,
        fixture.outletId,
        fixture.sessionId,
        soldBarcode,
        soldVerificationId,
        soldItemId,
        fixture.actorUserId,
      ],
    );
    await client.query(
      `update legacy_migration_verifications
          set status = 'sold_during_migration', updated_at = now()
        where id = $1`,
      [soldVerificationId],
    );
    await client.query(
      `update product_items
          set availability = 'sold', is_active = false, updated_at = now()
        where id = $1`,
      [soldItemId],
    );
    await client.query(
      `update item_barcodes set is_active = false, updated_at = now()
        where item_id = $1 and barcode_value = $2`,
      [soldItemId, soldBarcode],
    );
    await client.query("commit");

    const result = await cutoverPromise;
    assert.equal(result.itemCount, 1);
    const soldItem = await queryOne<{ availability: string; is_active: boolean }>(
      `select availability::text as availability, is_active
         from product_items where id = $1`,
      [soldItemId],
    );
    assert.equal(soldItem.availability, "sold");
    assert.equal(soldItem.is_active, false);
    assert.equal(
      await queryCount(
        "inventory_movements",
        "where reference_id = $1 and movement_type = 'migration_opening'",
        [result.runId],
      ),
      1,
    );
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
});

test("existing migration opening blocks cutover without partial activation and allows retry after cleanup", async () => {
  const fixture = await createFixture(1);
  const movementId = id();
  await pool.query(
    `insert into inventory_movements
       (id, organization_id, item_id, movement_type, to_outlet_id,
        reference_type, reference_id, performed_by, approved_by)
     values ($1, $2, $3, 'migration_opening', $4, 'cutover-preflight-test',
             $5, $6, $6)`,
    [
      movementId,
      fixture.organizationId,
      fixture.itemIds[0],
      fixture.outletId,
      id(),
      fixture.actorUserId,
    ],
  );

  const preflight = await getLegacyMigrationCutoverData(
    authContext(fixture),
    fixture.batchId,
  );
  assert.notEqual(preflight, null);
  const sessionPreflight = preflight?.sessions.find(
    (session) => session.id === fixture.sessionId,
  );
  assert.equal(sessionPreflight?.canExecute, false);
  assert.equal(
    sessionPreflight?.issues.some(
      (issue) => issue.code === "OPENING_MOVEMENT_EXISTS",
    ),
    true,
  );

  await assert.rejects(
    executeLegacyMigrationCutover(executeInput(fixture)),
    (error: unknown) => {
      if (!(error instanceof LegacyMigrationCutoverError)) return false;
      assert.equal(error.code, "CUTOVER_OPENING_MOVEMENT_EXISTS");
      return true;
    },
  );
  await assertNoPartialActivation(fixture);

  await pool.query(`delete from inventory_movements where id = $1`, [movementId]);
  const retry = await executeLegacyMigrationCutover(executeInput(fixture));
  assert.equal(retry.alreadyExecuted, false);
  assert.equal(retry.itemCount, 1);
});

test("database unique index rejects a second migration opening for one item", async () => {
  const fixture = await createFixture(1);
  const firstReference = id();
  const secondReference = id();
  await pool.query(
    `insert into inventory_movements
       (id, organization_id, item_id, movement_type, to_outlet_id,
        reference_type, reference_id, performed_by, approved_by)
     values ($1, $2, $3, 'migration_opening', $4, 'test_cutover', $5, $6, $6)`,
    [
      id(),
      fixture.organizationId,
      fixture.itemIds[0],
      fixture.outletId,
      firstReference,
      fixture.actorUserId,
    ],
  );

  await assert.rejects(
    pool.query(
      `insert into inventory_movements
         (id, organization_id, item_id, movement_type, to_outlet_id,
          reference_type, reference_id, performed_by, approved_by)
       values ($1, $2, $3, 'migration_opening', $4, 'test_cutover', $5, $6, $6)`,
      [
        id(),
        fixture.organizationId,
        fixture.itemIds[0],
        fixture.outletId,
        secondReference,
        fixture.actorUserId,
      ],
    ),
    (error: unknown) => {
      assert.equal((error as { code?: string }).code, "23505");
      return true;
    },
  );
});

export async function runLegacyMigrationCutoverSuite() {
  const startedAt = Date.now();
  let passed = 0;

  try {
    await assertDisposablePostgres17();
    console.log(
      `\nLegacy Migration Transactional Cutover Suite (${TEST_CASES.length} cases)`,
    );

    for (const testCase of TEST_CASES) {
      await resetPublicTables();
      const caseStartedAt = Date.now();
      try {
        await testCase.run();
        passed += 1;
        console.log(`  PASS ${testCase.name} (${Date.now() - caseStartedAt} ms)`);
      } catch (error) {
        console.error(`  FAIL ${testCase.name}`);
        throw error;
      }
    }

    console.log(
      `\nLegacy Migration Transactional Cutover Suite passed: ${passed}/${TEST_CASES.length} cases (${Date.now() - startedAt} ms).`,
    );
  } finally {
    await pool.end();
  }
}
