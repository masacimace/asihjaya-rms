import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db, pool } from "@/db";
import { claimProductItemsForSale } from "@/features/pos/inventory-sale-claim";
import { lookupPosItemByScanValue } from "@/features/pos/queries";

const TEST_CASES: Array<{ name: string; run: () => Promise<void> }> = [];

function test(name: string, run: () => Promise<void>) {
  TEST_CASES.push({ name, run });
}

function id() {
  return randomUUID();
}

function token(prefix: string, maxLength = 48) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`.slice(0, maxLength);
}

type BaseFixture = {
  organizationId: string;
  outletId: string;
  otherOutletId: string;
  actorUserId: string;
  categoryId: string;
  inactiveCategoryId: string;
  masterId: string;
  inactiveCategoryMasterId: string;
  registerId: string;
  shiftId: string;
};

type ItemOptions = {
  internalBarcode?: string;
  legacyBarcode?: string | null;
  legacyBarcodeActive?: boolean;
  sku?: string;
  qrValue?: string | null;
  serialNumber?: string | null;
  outletId?: string;
  masterId?: string;
  availability?: "draft" | "migration_hold" | "available" | "reserved" | "inspection" | "sold";
  condition?: "good" | "damaged" | "lost" | "returned";
  locationState?: "outlet" | "warehouse" | "in_transit" | "customer" | "repair";
  sellingAmount?: string | null;
  isActive?: boolean;
};

type CreatedItem = {
  id: string;
  sku: string;
  internalBarcode: string;
  legacyBarcode: string | null;
};

async function queryOne<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const result = await pool.query<T>(text, values);
  assert.equal(result.rows.length, 1, `Query harus menghasilkan satu row: ${text}`);
  return result.rows[0]!;
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
    Number(result.version_number) >= 170000 &&
      Number(result.version_number) < 180000,
    true,
    `Legacy barcode POS test wajib memakai PostgreSQL 17, ditemukan ${result.version_number}.`,
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

async function createBaseFixture(): Promise<BaseFixture> {
  const fixture: BaseFixture = {
    organizationId: id(),
    outletId: id(),
    otherOutletId: id(),
    actorUserId: id(),
    categoryId: id(),
    inactiveCategoryId: id(),
    masterId: id(),
    inactiveCategoryMasterId: id(),
    registerId: id(),
    shiftId: id(),
  };

  await pool.query(
    `insert into organizations (id, name, slug, timezone, currency)
     values ($1, 'Legacy Barcode POS Test', $2, 'Asia/Jakarta', 'IDR')`,
    [fixture.organizationId, token("legacy-pos-org", 80)],
  );
  await pool.query(
    `insert into outlets (id, organization_id, code, name)
     values
       ($1, $3, $4, 'Outlet POS Test'),
       ($2, $3, $5, 'Outlet Lain')`,
    [
      fixture.outletId,
      fixture.otherOutletId,
      fixture.organizationId,
      token("OUTA", 24),
      token("OUTB", 24),
    ],
  );
  await pool.query(
    `insert into users (id, organization_id, email, username, full_name, status)
     values ($1, $2, $3, $4, 'Kasir Barcode Test', 'active')`,
    [
      fixture.actorUserId,
      fixture.organizationId,
      `${token("cashier", 40)}@test.local`,
      token("cashier", 80),
    ],
  );
  await pool.query(
    `insert into product_categories (id, organization_id, code, name, is_active)
     values
       ($1, $3, $4, 'Cincin', true),
       ($2, $3, $5, 'Kategori Nonaktif', false)`,
    [
      fixture.categoryId,
      fixture.inactiveCategoryId,
      fixture.organizationId,
      token("CAT", 48),
      token("INACTIVE", 48),
    ],
  );
  await pool.query(
    `insert into product_masters
       (id, organization_id, category_id, code, name, status)
     values
       ($1, $3, $4, $5, 'Master POS Test', 'active'),
       ($2, $3, $6, $7, 'Master Kategori Nonaktif', 'active')`,
    [
      fixture.masterId,
      fixture.inactiveCategoryMasterId,
      fixture.organizationId,
      fixture.categoryId,
      token("MASTER", 64),
      fixture.inactiveCategoryId,
      token("MASTER-INACTIVE", 64),
    ],
  );
  await pool.query(
    `insert into registers (id, outlet_id, code, name, is_active)
     values ($1, $2, $3, 'Register Test', true)`,
    [fixture.registerId, fixture.outletId, token("REG", 32)],
  );
  await pool.query(
    `insert into shifts
       (id, outlet_id, register_id, opened_by, status, opening_cash, opened_at)
     values ($1, $2, $3, $4, 'open', '0', now())`,
    [
      fixture.shiftId,
      fixture.outletId,
      fixture.registerId,
      fixture.actorUserId,
    ],
  );

  return fixture;
}

async function createItem(
  fixture: BaseFixture,
  options: ItemOptions = {},
): Promise<CreatedItem> {
  const itemId = id();
  const sku = options.sku ?? token("SKU", 80);
  const internalBarcode = options.internalBarcode ?? token("AJ", 120);
  const legacyBarcode = options.legacyBarcode ?? null;
  const masterId = options.masterId ?? fixture.masterId;
  const outletId = options.outletId ?? fixture.outletId;
  const availability = options.availability ?? "available";
  const condition = options.condition ?? "good";
  const locationState = options.locationState ?? "outlet";
  const sellingAmount =
    options.sellingAmount === undefined ? "2058000" : options.sellingAmount;
  const isActive = options.isActive ?? true;

  await pool.query(
    `insert into product_items
       (id, organization_id, product_master_id, display_name, current_outlet_id,
        sku, barcode, qr_value, serial_number, legacy_id, weight_gram,
        purity_percent, selling_amount, price_per_gram, deduction_per_gram,
        availability, condition, location_state, is_active)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '2.100', '75.000',
             $11, '980000', '25000', $12, $13, $14, $15)`,
    [
      itemId,
      fixture.organizationId,
      masterId,
      `Item ${sku}`,
      outletId,
      sku,
      internalBarcode,
      options.qrValue ?? null,
      options.serialNumber ?? null,
      legacyBarcode,
      sellingAmount,
      availability,
      condition,
      locationState,
      isActive,
    ],
  );

  const aliases: Array<{
    barcodeValue: string;
    source: "legacy_import" | "system_generated";
    isPrimary: boolean;
    isActive: boolean;
  }> = [];

  if (legacyBarcode) {
    aliases.push({
      barcodeValue: legacyBarcode,
      source: "legacy_import",
      isPrimary: true,
      isActive: options.legacyBarcodeActive ?? true,
    });
  }

  if (internalBarcode !== legacyBarcode) {
    aliases.push({
      barcodeValue: internalBarcode,
      source: "system_generated",
      isPrimary: !legacyBarcode || options.legacyBarcodeActive === false,
      isActive: true,
    });
  }

  for (const alias of aliases) {
    await pool.query(
      `insert into item_barcodes
         (id, organization_id, item_id, barcode_value, source, is_primary,
          is_active, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id(),
        fixture.organizationId,
        itemId,
        alias.barcodeValue,
        alias.source,
        alias.isPrimary,
        alias.isActive,
        fixture.actorUserId,
      ],
    );
  }

  return { id: itemId, sku, internalBarcode, legacyBarcode };
}

async function lookup(fixture: BaseFixture, scanValue: string) {
  return lookupPosItemByScanValue({
    organizationId: fixture.organizationId,
    outletId: fixture.outletId,
    scanValue,
  });
}

function databaseErrorCode(error: unknown): string | null {
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === "string") return record.code;
    current = record.cause;
  }

  return null;
}

test("leading-zero legacy barcode resolves exactly through item_barcodes", async () => {
  const fixture = await createBaseFixture();
  const item = await createItem(fixture, { legacyBarcode: "003037" });

  const result = await lookup(fixture, " 003037 ");
  assert.equal(result.status, "found");
  if (result.status === "found") assert.equal(result.item.id, item.id);

  const withoutLeadingZero = await lookup(fixture, "3037");
  assert.equal(withoutLeadingZero.status, "not_found");
});

test("system-generated internal barcode remains available through the same namespace", async () => {
  const fixture = await createBaseFixture();
  const item = await createItem(fixture, {
    internalBarcode: "AJ000000000321",
    legacyBarcode: "000321",
  });

  const result = await lookup(fixture, item.internalBarcode);
  assert.equal(result.status, "found");
  if (result.status === "found") assert.equal(result.item.id, item.id);
});

test("inactive legacy alias is ignored", async () => {
  const fixture = await createBaseFixture();
  await createItem(fixture, {
    legacyBarcode: "001111",
    legacyBarcodeActive: false,
  });

  const result = await lookup(fixture, "001111");
  assert.equal(result.status, "not_found");
});

test("SKU, QR value, and serial lookup continue to resolve one item", async () => {
  const fixture = await createBaseFixture();
  const item = await createItem(fixture, {
    sku: "SKU-LEGACY-COMPAT",
    qrValue: "QR-LEGACY-COMPAT",
    serialNumber: "SERIAL-LEGACY-COMPAT",
    legacyBarcode: "002222",
  });

  for (const identifier of [
    "SKU-LEGACY-COMPAT",
    "QR-LEGACY-COMPAT",
    "SERIAL-LEGACY-COMPAT",
  ]) {
    const result = await lookup(fixture, identifier);
    assert.equal(result.status, "found", identifier);
    if (result.status === "found") assert.equal(result.item.id, item.id);
  }
});

test("lookup returns conflict instead of choosing the first candidate", async () => {
  const fixture = await createBaseFixture();
  await createItem(fixture, { legacyBarcode: "CONFLICT-LOOKUP" });
  await createItem(fixture, {
    legacyBarcode: "004444",
    qrValue: "CONFLICT-LOOKUP",
  });

  const result = await lookup(fixture, "CONFLICT-LOOKUP");
  assert.equal(result.status, "conflict");
  assert.match(result.message, /lebih dari satu item/i);
});

test("non-sellable items are found but never returned as POS-ready", async () => {
  const fixture = await createBaseFixture();
  const cases: Array<{ barcode: string; options: ItemOptions }> = [
    {
      barcode: "005001",
      options: { legacyBarcode: "005001", availability: "migration_hold" },
    },
    {
      barcode: "005002",
      options: {
        legacyBarcode: "005002",
        availability: "sold",
        locationState: "customer",
      },
    },
    {
      barcode: "005003",
      options: { legacyBarcode: "005003", outletId: fixture.otherOutletId },
    },
    {
      barcode: "005004",
      options: { legacyBarcode: "005004", sellingAmount: null },
    },
    {
      barcode: "005005",
      options: { legacyBarcode: "005005", condition: "damaged" },
    },
    {
      barcode: "005006",
      options: { legacyBarcode: "005006", locationState: "warehouse" },
    },
    {
      barcode: "005007",
      options: {
        legacyBarcode: "005007",
        masterId: fixture.inactiveCategoryMasterId,
      },
    },
  ];

  for (const entry of cases) {
    await createItem(fixture, entry.options);
    const result = await lookup(fixture, entry.barcode);
    assert.equal(result.status, "unavailable", entry.barcode);
  }
});

test("active barcode namespace rejects duplicate values across two items", async () => {
  const fixture = await createBaseFixture();
  await createItem(fixture, { legacyBarcode: "006666" });
  const secondItem = await createItem(fixture, { legacyBarcode: "006667" });

  await assert.rejects(
    pool.query(
      `insert into item_barcodes
         (id, organization_id, item_id, barcode_value, source, is_primary,
          is_active, created_by)
       values ($1, $2, $3, '006666', 'manual', false, true, $4)`,
      [id(), fixture.organizationId, secondItem.id, fixture.actorUserId],
    ),
    (error: unknown) => databaseErrorCode(error) === "23505",
  );
});

test("blank barcode values are rejected at database level", async () => {
  const fixture = await createBaseFixture();
  const item = await createItem(fixture, { legacyBarcode: "007777" });

  await assert.rejects(
    pool.query(
      `insert into item_barcodes
         (id, organization_id, item_id, barcode_value, source, is_primary,
          is_active, created_by)
       values ($1, $2, $3, '   ', 'manual', false, true, $4)`,
      [id(), fixture.organizationId, item.id, fixture.actorUserId],
    ),
    (error: unknown) => databaseErrorCode(error) === "23514",
  );
});

test("legacy barcode lookup feeds a completed sale claim and movement smoke flow", async () => {
  const fixture = await createBaseFixture();
  const item = await createItem(fixture, {
    internalBarcode: "AJ000000008888",
    legacyBarcode: "008888",
  });

  const scanResult = await lookup(fixture, "008888");
  assert.equal(scanResult.status, "found");
  if (scanResult.status !== "found") return;

  const saleId = id();
  const invoiceNumber = token("INV", 80);
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`
      insert into sales
        (id, organization_id, outlet_id, register_id, shift_id, cashier_id,
         invoice_number, idempotency_key, status, subtotal_amount,
         discount_amount, additional_fee_amount, total_amount, completed_at)
      values (${saleId}, ${fixture.organizationId}, ${fixture.outletId},
              ${fixture.registerId}, ${fixture.shiftId}, ${fixture.actorUserId},
              ${invoiceNumber}, ${token("checkout", 120)}, 'completed',
              '2058000', '0', '0', '2058000', now())
    `);
    await transaction.execute(sql`
      insert into sale_items
        (sale_id, product_item_id, line_number, list_price_amount,
         discount_amount, final_price_amount, snapshot)
      values (${saleId}, ${scanResult.item.id}, 1, '2058000', '0',
              '2058000', ${JSON.stringify({ source: "legacy_barcode_pos_smoke" })}::jsonb)
    `);

    const claim = await claimProductItemsForSale(transaction, {
      organizationId: fixture.organizationId,
      outletId: fixture.outletId,
      itemIds: [scanResult.item.id],
    });
    assert.equal(claim.allClaimed, true);

    await transaction.execute(sql`
      insert into inventory_movements
        (organization_id, item_id, movement_type, from_outlet_id,
         reference_type, reference_id, reason, metadata, performed_by)
      values (${fixture.organizationId}, ${scanResult.item.id}, 'sale',
              ${fixture.outletId}, 'sale', ${saleId},
              'Legacy barcode POS integration smoke test.',
              ${JSON.stringify({ scanValue: "008888" })}::jsonb,
              ${fixture.actorUserId})
    `);
  });

  const state = await queryOne<{
    availability: string;
    location_state: string;
    sale_count: string;
    movement_count: string;
  }>(
    `select item.availability,
            item.location_state,
            (select count(*)::text from sale_items where sale_id = $2) as sale_count,
            (select count(*)::text
               from inventory_movements
              where item_id = item.id
                and movement_type = 'sale'
                and reference_id = $2) as movement_count
       from product_items as item
      where item.id = $1`,
    [item.id, saleId],
  );
  assert.equal(state.availability, "sold");
  assert.equal(state.location_state, "customer");
  assert.equal(state.sale_count, "1");
  assert.equal(state.movement_count, "1");

  const secondLookup = await lookup(fixture, "008888");
  assert.equal(secondLookup.status, "unavailable");
});

export async function runLegacyBarcodePosSuite() {
  await assertDisposablePostgres17();

  console.log(`\nLegacy Barcode POS Integration Suite (${TEST_CASES.length} cases)`);
  let passed = 0;

  for (const testCase of TEST_CASES) {
    await resetPublicTables();
    const startedAt = Date.now();

    try {
      await testCase.run();
      passed += 1;
      console.log(`  PASS ${testCase.name} (${Date.now() - startedAt} ms)`);
    } catch (error) {
      console.error(`  FAIL ${testCase.name}`);
      throw error;
    }
  }

  console.log(
    `\nLegacy Barcode POS Integration Suite passed: ${passed}/${TEST_CASES.length} cases`,
  );
  await pool.end();
}
