import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";

import { eq, inArray } from "drizzle-orm";

import { db, pool } from "@/db";
import {
  hardwareAgents,
  hardwareJobs,
  inventoryMovements,
  itemBarcodes,
  organizations,
  outlets,
  productBatchImportItemRows,
  productBatchImportMedia,
  productBatchImportSessions,
  productCategories,
  productMasters,
  registers,
  userOutlets,
  users,
} from "@/db/schema";
import {
  commitProductBatchImportSession,
  ProductBatchImportCommitError,
} from "@/features/product-batch-import/commit-service";
import {
  PRODUCT_BATCH_IMPORT_INSTRUCTION_HEADERS,
  PRODUCT_BATCH_IMPORT_ITEM_HEADERS,
  PRODUCT_BATCH_IMPORT_MASTER_HEADERS,
  PRODUCT_BATCH_IMPORT_METADATA_HEADERS,
  PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
  PRODUCT_BATCH_IMPORT_TYPE,
} from "@/features/product-batch-import/contracts";
import { printProductBatchImportLabels } from "@/features/product-batch-import/label-service";
import { getProductBatchImportPreview } from "@/features/product-batch-import/preview-queries";
import { getProductBatchImportResult } from "@/features/product-batch-import/result-queries";
import {
  createProductBatchImportSession,
  ProductBatchImportDuplicateError,
} from "@/features/product-batch-import/session-service";
import { lookupPosItemByScanValue } from "@/features/pos/queries";
import { buildXlsxBuffer, type ExportCell } from "@/lib/export-files";
import type { AuthContext } from "@/lib/auth/session";

import { buildInCellImageWorkbookFixture } from "../../scripts/lib/product-batch-import-embedded-xlsx";
import { buildTestZip } from "../../scripts/lib/product-batch-import-test-zip";

type MasterInput = {
  masterKey: string;
  name?: string;
  categoryCode?: string;
  brand?: string;
  material?: string;
  collection?: string;
  description?: string;
  primaryImage?: string;
  status?: "draft" | "active" | "";
};

type ItemInput = {
  rowKey: string;
  masterKey: string;
  displayName?: string;
  outletCode?: string;
  weightGram?: string | number;
  purityPercent?: string | number;
  exchangePurityPercent?: string | number;
  size?: string;
  color?: string;
  gemstone?: string;
  costAmount?: string | number;
  sellingAmount?: string | number;
  pricePerGram?: string | number;
  deductionPerGram?: string | number;
  condition?: "good" | "damaged" | string;
  locationCode?: string;
  physicalImage?: string;
  internalNotes?: string;
  availability?: "draft" | "available" | string;
};

type OrganizationFixture = {
  organizationId: string;
  userId: string;
  outletId: string;
  outletCode: string;
  restrictedOutletId: string;
  restrictedOutletCode: string;
  categoryId: string;
  categoryCode: string;
  inactiveCategoryId: string;
  inactiveCategoryCode: string;
  registerId: string;
  hardwareAgentId: string;
  auth: AuthContext;
};

type TestCase = {
  name: string;
  run: () => Promise<void>;
};

const TEST_CASES: TestCase[] = [];
const VALID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mNk+M/wHwAF/gL+4x6XWQAAAABJRU5ErkJggg==",
  "base64",
);
const CORRUPT_PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("not-a-real-png"),
]);
const TEST_STORAGE_ROOT = path.resolve(
  process.env.IMAGE_STORAGE_ROOT ?? ".data/product-batch-integration-test",
);

function test(name: string, run: TestCase["run"]) {
  TEST_CASES.push({ name, run });
}

function id() {
  return randomUUID();
}

function token(prefix: string, maxLength = 64) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`.slice(0, maxLength);
}

function masterRow(input: MasterInput): ExportCell[] {
  return [
    input.masterKey,
    input.name ?? `Master ${input.masterKey}`,
    input.categoryCode ?? "CAT-01",
    input.brand ?? "",
    input.material ?? "Emas",
    input.collection ?? "Integration",
    input.description ?? "Product Batch Import integration test.",
    input.primaryImage ?? `${input.masterKey}.png`,
    input.status ?? "active",
  ];
}

function itemRow(input: ItemInput): ExportCell[] {
  return [
    input.rowKey,
    input.masterKey,
    input.displayName ?? "",
    input.outletCode ?? "",
    input.weightGram ?? "",
    input.purityPercent ?? "",
    input.exchangePurityPercent ?? "",
    input.size ?? "",
    input.color ?? "",
    input.gemstone ?? "",
    input.costAmount ?? "",
    input.sellingAmount ?? "",
    input.pricePerGram ?? "",
    input.deductionPerGram ?? "",
    input.condition ?? "good",
    input.locationCode ?? "",
    input.physicalImage ?? "",
    input.internalNotes ?? "",
    input.availability ?? "draft",
  ];
}

function buildWorkbook(masters: MasterInput[], items: ItemInput[]) {
  return buildXlsxBuffer([
    {
      name: "METADATA",
      columns: [...PRODUCT_BATCH_IMPORT_METADATA_HEADERS],
      rows: [
        ["template_version", PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION],
        ["import_type", PRODUCT_BATCH_IMPORT_TYPE],
        ["generated_at", "2026-08-12"],
      ],
    },
    {
      name: "PRODUCT_MASTERS",
      columns: [...PRODUCT_BATCH_IMPORT_MASTER_HEADERS],
      rows: masters.map(masterRow),
    },
    {
      name: "PHYSICAL_PRODUCTS",
      columns: [...PRODUCT_BATCH_IMPORT_ITEM_HEADERS],
      rows: items.map(itemRow),
    },
    {
      name: "INSTRUCTIONS",
      columns: [...PRODUCT_BATCH_IMPORT_INSTRUCTION_HEADERS],
      rows: [["integration-test", "Generated automatically for disposable integration testing."]],
    },
  ]);
}

function buildPackage({
  masters,
  items,
  omitImagePaths = [],
  imageOverrides = {},
}: {
  masters: MasterInput[];
  items: ItemInput[];
  omitImagePaths?: string[];
  imageOverrides?: Record<string, Buffer>;
}) {
  const omitted = new Set(omitImagePaths.map((value) => value.toLocaleLowerCase("en-US")));
  const entries: Array<{ path: string; data: Buffer }> = [
    { path: "products.xlsx", data: buildWorkbook(masters, items) },
  ];

  for (const master of masters) {
    const imageName = master.primaryImage ?? `${master.masterKey}.png`;
    if (!imageName) continue;
    const archivePath = `masters/${imageName}`;
    if (omitted.has(archivePath.toLocaleLowerCase("en-US"))) continue;
    entries.push({
      path: archivePath,
      data: imageOverrides[archivePath] ?? VALID_PNG,
    });
  }

  for (const item of items) {
    if (!item.physicalImage) continue;
    const archivePath = `physical/${item.physicalImage}`;
    if (omitted.has(archivePath.toLocaleLowerCase("en-US"))) continue;
    entries.push({
      path: archivePath,
      data: imageOverrides[archivePath] ?? VALID_PNG,
    });
  }

  return buildTestZip(entries);
}

async function queryCount(
  tableName: string,
  whereSql = "",
  values: unknown[] = [],
) {
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count from ${tableName} ${whereSql}`,
    values,
  );
  assert.equal(result.rows.length, 1);
  return Number(result.rows[0]!.count);
}

async function assertDisposablePostgres17() {
  const result = await pool.query<{
    version_number: string;
    database_name: string;
  }>(
    `select current_setting('server_version_num') as version_number,
            current_database() as database_name`,
  );
  assert.equal(result.rows.length, 1);
  const row = result.rows[0]!;

  assert.equal(
    Number(row.version_number) >= 170000 && Number(row.version_number) < 180000,
    true,
    `Product Batch Import integration test wajib PostgreSQL 17, ditemukan ${row.version_number}.`,
  );
  assert.match(
    row.database_name,
    /(?:^|[_-])(test|ci)(?:$|[_-])/i,
    `Database ${row.database_name} tidak terlihat sebagai database disposable.`,
  );

  assert.match(
    TEST_STORAGE_ROOT.replaceAll("\\", "/"),
    /product-batch.*test|test.*product-batch/i,
    `IMAGE_STORAGE_ROOT integration test tidak terlihat disposable: ${TEST_STORAGE_ROOT}`,
  );
}

async function resetPublicTablesAndStorage() {
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

  await pool.query(`alter sequence if exists product_master_number_seq restart with 1`);
  await pool.query(`alter sequence if exists product_item_number_seq restart with 1`);
  await rm(TEST_STORAGE_ROOT, { recursive: true, force: true });
}

async function createOrganizationFixture(prefix: string): Promise<OrganizationFixture> {
  const organizationId = id();
  const userId = id();
  const outletId = id();
  const restrictedOutletId = id();
  const categoryId = id();
  const inactiveCategoryId = id();
  const registerId = id();
  const hardwareAgentId = id();
  const outletCode = "OUTLET-01";
  const restrictedOutletCode = "OUTLET-LOCKED";
  const categoryCode = "CAT-01";
  const inactiveCategoryCode = "CAT-INACTIVE";
  const slug = token(`batch-${prefix.toLowerCase()}`, 70);
  const username = token(`batch-${prefix.toLowerCase()}-user`, 70);

  await db.insert(organizations).values({
    id: organizationId,
    name: `Batch Test Organization ${prefix}`,
    slug,
    timezone: "Asia/Jakarta",
    currency: "IDR",
  });
  await db.insert(outlets).values([
    {
      id: outletId,
      organizationId,
      code: outletCode,
      name: `Outlet ${prefix}`,
    },
    {
      id: restrictedOutletId,
      organizationId,
      code: restrictedOutletCode,
      name: `Restricted Outlet ${prefix}`,
    },
  ]);
  await db.insert(users).values({
    id: userId,
    organizationId,
    email: `${username}@test.local`,
    username,
    fullName: `Batch Integration ${prefix}`,
    status: "active",
  });
  await db.insert(userOutlets).values({
    id: id(),
    userId,
    outletId,
    isPrimary: true,
  });
  await db.insert(productCategories).values([
    {
      id: categoryId,
      organizationId,
      code: categoryCode,
      name: `Category ${prefix}`,
      isActive: true,
    },
    {
      id: inactiveCategoryId,
      organizationId,
      code: inactiveCategoryCode,
      name: `Inactive Category ${prefix}`,
      isActive: false,
    },
  ]);
  await db.insert(registers).values({
    id: registerId,
    outletId,
    code: "HW-HUB",
    name: `Hardware Hub ${prefix}`,
    isHardwareHub: true,
    isActive: true,
  });
  await db.insert(hardwareAgents).values({
    id: hardwareAgentId,
    organizationId,
    outletId,
    registerId,
    code: token(`agent-${prefix.toLowerCase()}`, 70),
    name: `Label Agent ${prefix}`,
    secretHash: "integration-test-secret-hash",
    status: "online",
    isActive: true,
    capabilities: { print_label_sato: true },
    lastSeenAt: new Date(),
  });

  const auth: AuthContext = {
    session: {
      id: id(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    organization: {
      id: organizationId,
      name: `Batch Test Organization ${prefix}`,
      slug,
      timezone: "Asia/Jakarta",
    },
    user: {
      id: userId,
      email: `${username}@test.local`,
      username,
      fullName: `Batch Integration ${prefix}`,
    },
    roles: [],
    permissionCodes: [
      "products.batch_import",
      "products.manage",
      "inventory.receive",
      "inventory.manage",
      "pricing.manage",
      "inventory.print_label",
    ],
    outlets: [
      {
        id: outletId,
        code: outletCode,
        name: `Outlet ${prefix}`,
        isPrimary: true,
      },
    ],
  };

  return {
    organizationId,
    userId,
    outletId,
    outletCode,
    restrictedOutletId,
    restrictedOutletCode,
    categoryId,
    categoryCode,
    inactiveCategoryId,
    inactiveCategoryCode,
    registerId,
    hardwareAgentId,
    auth,
  };
}

async function createSession(
  fixture: OrganizationFixture,
  archiveBuffer: Buffer,
  fileName = "product-batch-integration.zip",
) {
  return createProductBatchImportSession({
    auth: fixture.auth,
    fileName,
    archiveBuffer,
    requestMetadata: { userAgent: "product-batch-integration-suite" },
  });
}

function collectIssueCodes(
  preview: NonNullable<Awaited<ReturnType<typeof getProductBatchImportPreview>>>,
) {
  return new Set([
    ...preview.masters.flatMap((row) => [
      ...row.validationErrors.map((issue) => issue.code),
      ...row.validationWarnings.map((issue) => issue.code),
    ]),
    ...preview.items.flatMap((row) => [
      ...row.validationErrors.map((issue) => issue.code),
      ...row.validationWarnings.map((issue) => issue.code),
    ]),
  ]);
}

async function expectErrorCode(
  action: () => Promise<unknown>,
  expectedCode: string,
) {
  await assert.rejects(action, (error: unknown) => {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === expectedCode
    );
  });
}

test("1 master + 1 draft item commits generated identities without opening movement", async () => {
  const fixture = await createOrganizationFixture("BASIC");
  const archive = buildPackage({
    masters: [{ masterKey: "MASTER-001", categoryCode: fixture.categoryCode }],
    items: [{ rowKey: "ITEM-001", masterKey: "MASTER-001", availability: "draft" }],
  });

  const session = await createSession(fixture, archive);
  assert.equal(session.status, "ready");
  assert.equal(session.totalMasterRows, 1);
  assert.equal(session.totalItemRows, 1);

  const preview = await getProductBatchImportPreview(fixture.auth, session.id);
  assert.ok(preview);
  assert.equal(preview.items[0]?.effectiveImageSource, "master");

  const committed = await commitProductBatchImportSession({
    auth: fixture.auth,
    sessionId: session.id,
  });
  assert.equal(committed.committedMasterCount, 1);
  assert.equal(committed.committedItemCount, 1);
  assert.equal(committed.availableItemCount, 0);
  assert.equal(committed.draftItemCount, 1);

  const result = await getProductBatchImportResult(fixture.auth, session.id);
  assert.ok(result);
  assert.equal(result.session.status, "completed");
  assert.equal(result.masters.length, 1);
  assert.equal(result.items.length, 1);
  assert.match(result.masters[0]!.code, /^PM-\d{6}$/);
  assert.match(result.items[0]!.sku, /^AJ-ITEM-\d{8}$/);
  assert.match(result.items[0]!.barcode, /^AJ\d{8}$/);
  assert.equal(result.items[0]!.qrValue, result.items[0]!.barcode);
  assert.equal(result.items[0]!.imageSource, "master-fallback");

  const barcodeRows = await db
    .select({ source: itemBarcodes.source, isPrimary: itemBarcodes.isPrimary, isActive: itemBarcodes.isActive })
    .from(itemBarcodes)
    .where(eq(itemBarcodes.itemId, result.items[0]!.productItemId));
  assert.equal(barcodeRows.length, 1);
  assert.deepEqual(barcodeRows[0], {
    source: "system_generated",
    isPrimary: true,
    isActive: true,
  });
  assert.equal(
    await queryCount("inventory_movements", "where item_id = $1", [result.items[0]!.productItemId]),
    0,
  );
});

test("single XLSX Picture in Cell uses the same staging and atomic commit pipeline", async () => {
  const fixture = await createOrganizationFixture("EMBEDDED");
  const workbook = buildWorkbook(
    [
      {
        masterKey: "MASTER-EMBEDDED",
        categoryCode: fixture.categoryCode,
        primaryImage: "",
      },
    ],
    [
      {
        rowKey: "ITEM-EMBEDDED-PHYSICAL",
        masterKey: "MASTER-EMBEDDED",
        outletCode: fixture.outletCode,
        weightGram: "2.5",
        purityPercent: "75",
        sellingAmount: "1750000",
        physicalImage: "",
        availability: "available",
      },
      {
        rowKey: "ITEM-EMBEDDED-FALLBACK",
        masterKey: "MASTER-EMBEDDED",
        outletCode: fixture.outletCode,
        weightGram: "1.75",
        purityPercent: "75",
        sellingAmount: "1250000",
        physicalImage: "",
        availability: "available",
      },
    ],
  );
  const embeddedWorkbook = buildInCellImageWorkbookFixture(workbook, [
    {
      sheetName: "PRODUCT_MASTERS",
      rowNumber: 2,
      columnIndex: 7,
      data: VALID_PNG,
      extension: ".png",
    },
    {
      sheetName: "PHYSICAL_PRODUCTS",
      rowNumber: 2,
      columnIndex: 16,
      data: VALID_PNG,
      extension: ".png",
    },
  ]);

  const session = await createSession(
    fixture,
    embeddedWorkbook,
    "product-batch-embedded.xlsx",
  );
  assert.equal(session.status, "ready");
  const preview = await getProductBatchImportPreview(fixture.auth, session.id);
  assert.ok(preview);
  assert.equal(preview.media.length, 2);
  assert.equal(
    preview.items.find((row) => row.rowKey === "ITEM-EMBEDDED-PHYSICAL")?.effectiveImageSource,
    "physical",
  );
  assert.equal(
    preview.items.find((row) => row.rowKey === "ITEM-EMBEDDED-FALLBACK")?.effectiveImageSource,
    "master",
  );

  const committed = await commitProductBatchImportSession({
    auth: fixture.auth,
    sessionId: session.id,
  });
  assert.equal(committed.committedMasterCount, 1);
  assert.equal(committed.committedItemCount, 2);
  assert.equal(committed.availableItemCount, 2);

  const result = await getProductBatchImportResult(fixture.auth, session.id);
  assert.ok(result);
  assert.equal(result.session.status, "completed");
  const physical = result.items.find((row) => row.rowKey === "ITEM-EMBEDDED-PHYSICAL");
  const fallback = result.items.find((row) => row.rowKey === "ITEM-EMBEDDED-FALLBACK");
  assert.equal(physical?.imageSource, "physical");
  assert.equal(fallback?.imageSource, "master-fallback");
  const lookup = await lookupPosItemByScanValue({
    organizationId: fixture.organizationId,
    outletId: fixture.outletId,
    scanValue: physical!.barcode,
  });
  assert.equal(lookup.status, "found");
});

test("one master with many items covers physical/master fallback, goods receipt, POS scan, labels and reprint idempotency", async () => {
  const fixture = await createOrganizationFixture("MANY");
  const archive = buildPackage({
    masters: [{ masterKey: "MASTER-MANY", categoryCode: fixture.categoryCode }],
    items: [
      {
        rowKey: "ITEM-PHYSICAL",
        masterKey: "MASTER-MANY",
        outletCode: fixture.outletCode,
        weightGram: "3.125",
        purityPercent: "75",
        sellingAmount: "2500000",
        physicalImage: "ITEM-PHYSICAL.png",
        availability: "available",
      },
      {
        rowKey: "ITEM-FALLBACK",
        masterKey: "MASTER-MANY",
        outletCode: fixture.outletCode,
        weightGram: "2.875",
        purityPercent: "75",
        sellingAmount: "2250000",
        availability: "available",
      },
      {
        rowKey: "ITEM-DRAFT",
        masterKey: "MASTER-MANY",
        availability: "draft",
      },
    ],
  });

  const session = await createSession(fixture, archive);
  assert.equal(session.status, "ready");
  assert.equal(session.warningCount >= 1, true);

  const preview = await getProductBatchImportPreview(fixture.auth, session.id);
  assert.ok(preview);
  assert.equal(
    preview.items.find((row) => row.rowKey === "ITEM-PHYSICAL")?.effectiveImageSource,
    "physical",
  );
  assert.equal(
    preview.items.find((row) => row.rowKey === "ITEM-FALLBACK")?.effectiveImageSource,
    "master",
  );

  const committed = await commitProductBatchImportSession({
    auth: fixture.auth,
    sessionId: session.id,
  });
  assert.equal(committed.committedItemCount, 3);
  assert.equal(committed.availableItemCount, 2);
  assert.equal(committed.draftItemCount, 1);

  const result = await getProductBatchImportResult(fixture.auth, session.id);
  assert.ok(result);
  const physical = result.items.find((row) => row.rowKey === "ITEM-PHYSICAL");
  const fallback = result.items.find((row) => row.rowKey === "ITEM-FALLBACK");
  const draft = result.items.find((row) => row.rowKey === "ITEM-DRAFT");
  assert.ok(physical && fallback && draft);
  assert.equal(physical.imageSource, "physical");
  assert.equal(fallback.imageSource, "master-fallback");

  const movements = await db
    .select({ itemId: inventoryMovements.itemId, movementType: inventoryMovements.movementType })
    .from(inventoryMovements)
    .where(inArray(inventoryMovements.itemId, [physical.productItemId, fallback.productItemId, draft.productItemId]));
  assert.equal(movements.filter((row) => row.movementType === "goods_receipt").length, 2);
  assert.equal(movements.some((row) => row.itemId === draft.productItemId), false);

  for (const item of [physical, fallback]) {
    const lookup = await lookupPosItemByScanValue({
      organizationId: fixture.organizationId,
      outletId: fixture.outletId,
      scanValue: item.barcode,
    });
    assert.equal(lookup.status, "found", `Barcode ${item.barcode} harus ditemukan POS.`);
  }

  const allLabels = await printProductBatchImportLabels({
    auth: fixture.auth,
    sessionId: session.id,
    requestId: id(),
    mode: "all",
  });
  assert.equal(allLabels.requestedCount, 3);
  assert.equal(allLabels.printableCount, 2);
  assert.equal(allLabels.createdCount, 2);
  assert.equal(allLabels.skippedCount, 1);

  const reprintRequestId = id();
  const reprint = await printProductBatchImportLabels({
    auth: fixture.auth,
    sessionId: session.id,
    requestId: reprintRequestId,
    mode: "selected",
    selectedItemIds: [physical.productItemId],
  });
  assert.equal(reprint.createdCount, 1);
  assert.equal(reprint.duplicateCount, 0);

  const duplicateTransportRetry = await printProductBatchImportLabels({
    auth: fixture.auth,
    sessionId: session.id,
    requestId: reprintRequestId,
    mode: "selected",
    selectedItemIds: [physical.productItemId],
  });
  assert.equal(duplicateTransportRetry.createdCount, 0);
  assert.equal(duplicateTransportRetry.duplicateCount, 1);

  const jobs = await db
    .select({
      jobType: hardwareJobs.jobType,
      targetAgentId: hardwareJobs.targetAgentId,
      sourceId: hardwareJobs.sourceId,
    })
    .from(hardwareJobs)
    .where(eq(hardwareJobs.sourceId, session.id));
  assert.equal(jobs.length, 3);
  assert.ok(jobs.every((job) => job.jobType === "print_label_sato"));
  assert.ok(jobs.every((job) => job.targetAgentId === fixture.hardwareAgentId));
});

test("multiple masters skip an existing PM code collision while keeping generated codes unique", async () => {
  const fixture = await createOrganizationFixture("MULTI");
  await db.insert(productMasters).values({
    id: id(),
    organizationId: fixture.organizationId,
    categoryId: fixture.categoryId,
    code: "PM-000001",
    name: "Existing Master Collision",
    status: "draft",
  });

  const archive = buildPackage({
    masters: [
      { masterKey: "MASTER-A", categoryCode: fixture.categoryCode },
      { masterKey: "MASTER-B", categoryCode: fixture.categoryCode },
    ],
    items: [
      { rowKey: "ITEM-A", masterKey: "MASTER-A", availability: "draft" },
      { rowKey: "ITEM-B", masterKey: "MASTER-B", availability: "draft" },
    ],
  });
  const session = await createSession(fixture, archive);
  await commitProductBatchImportSession({ auth: fixture.auth, sessionId: session.id });

  const result = await getProductBatchImportResult(fixture.auth, session.id);
  assert.ok(result);
  assert.deepEqual(
    result.masters.map((row) => row.code),
    ["PM-000002", "PM-000003"],
  );
  assert.equal(new Set(result.items.map((row) => row.barcode)).size, 2);
});

test("validation staging persists duplicate keys, invalid category/outlet and invalid numeric values without touching product tables", async () => {
  const fixture = await createOrganizationFixture("INVALID");
  const archive = buildPackage({
    masters: [
      {
        masterKey: "MASTER-DUP",
        categoryCode: "CATEGORY-NOT-FOUND",
        primaryImage: "MASTER-A.png",
      },
      {
        masterKey: "MASTER-DUP",
        categoryCode: fixture.categoryCode,
        primaryImage: "MASTER-B.png",
      },
    ],
    items: [
      {
        rowKey: "ITEM-DUP",
        masterKey: "MASTER-DUP",
        outletCode: fixture.restrictedOutletCode,
        weightGram: "-1",
        sellingAmount: "Rp -5",
        availability: "available",
      },
      {
        rowKey: "ITEM-DUP",
        masterKey: "MASTER-DUP",
        outletCode: "OUTLET-NOT-FOUND",
        availability: "draft",
      },
    ],
  });

  const session = await createSession(fixture, archive);
  assert.equal(session.status, "invalid");
  assert.equal(session.invalidRows > 0, true);

  const preview = await getProductBatchImportPreview(fixture.auth, session.id);
  assert.ok(preview);
  const issueCodes = collectIssueCodes(preview);
  for (const code of [
    "MASTER_KEY_DUPLICATE",
    "CATEGORY_NOT_FOUND_OR_INACTIVE",
    "ROW_KEY_DUPLICATE",
    "OUTLET_ACCESS_DENIED",
    "OUTLET_NOT_FOUND_OR_INACTIVE",
    "NUMERIC_VALUE_INVALID",
  ]) {
    assert.equal(issueCodes.has(code), true, `Validation issue ${code} harus tersimpan.`);
  }

  assert.equal(await queryCount("product_masters", "where organization_id = $1", [fixture.organizationId]), 0);
  assert.equal(await queryCount("product_items", "where organization_id = $1", [fixture.organizationId]), 0);
});

test("missing image and corrupt image bytes are rejected before a staging session is created", async () => {
  const fixture = await createOrganizationFixture("IMAGE");

  const missingImageArchive = buildPackage({
    masters: [{ masterKey: "MASTER-MISSING", categoryCode: fixture.categoryCode }],
    items: [],
    omitImagePaths: ["masters/MASTER-MISSING.png"],
  });
  await expectErrorCode(
    () => createSession(fixture, missingImageArchive, "missing-image.zip"),
    "IMAGE_REFERENCE_MISSING",
  );

  const corruptImageArchive = buildPackage({
    masters: [{ masterKey: "MASTER-CORRUPT", categoryCode: fixture.categoryCode }],
    items: [],
    imageOverrides: { "masters/MASTER-CORRUPT.png": CORRUPT_PNG },
  });
  await expectErrorCode(
    () => createSession(fixture, corruptImageArchive, "corrupt-image.zip"),
    "IMAGE_DECODE_FAILED",
  );

  assert.equal(
    await queryCount("product_batch_import_sessions", "where organization_id = $1", [fixture.organizationId]),
    0,
  );
});

test("duplicate file guard is organization-scoped and cross-organization preview/commit access is blocked", async () => {
  const organizationA = await createOrganizationFixture("TENANT-A");
  const organizationB = await createOrganizationFixture("TENANT-B");
  const archive = buildPackage({
    masters: [{ masterKey: "MASTER-TENANT", categoryCode: "CAT-01" }],
    items: [{ rowKey: "ITEM-TENANT", masterKey: "MASTER-TENANT", availability: "draft" }],
  });

  const sessionA = await createSession(organizationA, archive, "same-file.zip");
  await assert.rejects(
    () => createSession(organizationA, archive, "same-file-again.zip"),
    (error: unknown) =>
      error instanceof ProductBatchImportDuplicateError &&
      error.existingSessionId === sessionA.id,
  );

  const sessionB = await createSession(organizationB, archive, "same-file-other-org.zip");
  assert.equal(sessionB.status, "ready");
  assert.notEqual(sessionB.id, sessionA.id);

  const hiddenPreview = await getProductBatchImportPreview(organizationB.auth, sessionA.id);
  assert.equal(hiddenPreview, null);
  await expectErrorCode(
    () =>
      commitProductBatchImportSession({
        auth: organizationB.auth,
        sessionId: sessionA.id,
      }),
    "SESSION_NOT_FOUND",
  );
});

test("failure after first media promotion leaves no business rows and compensates final media", async () => {
  const fixture = await createOrganizationFixture("FAIL-MEDIA");
  const archive = buildPackage({
    masters: [{ masterKey: "MASTER-FAIL-MEDIA", categoryCode: fixture.categoryCode }],
    items: [{ rowKey: "ITEM-FAIL-MEDIA", masterKey: "MASTER-FAIL-MEDIA", availability: "draft" }],
  });
  const session = await createSession(fixture, archive);

  await assert.rejects(
    () =>
      commitProductBatchImportSession({
        auth: fixture.auth,
        sessionId: session.id,
        testFailpoint: "after_first_media_promotion",
      }),
    (error: unknown) =>
      error instanceof ProductBatchImportCommitError && error.code === "TEST_FAILPOINT",
  );

  const [storedSession] = await db
    .select({ status: productBatchImportSessions.status })
    .from(productBatchImportSessions)
    .where(eq(productBatchImportSessions.id, session.id))
    .limit(1);
  assert.equal(storedSession?.status, "failed");

  const mediaRows = await db
    .select({ status: productBatchImportMedia.status, finalKey: productBatchImportMedia.finalKey })
    .from(productBatchImportMedia)
    .where(eq(productBatchImportMedia.sessionId, session.id));
  assert.ok(mediaRows.length > 0);
  assert.ok(mediaRows.every((row) => row.status === "failed" && row.finalKey === null));
  assert.equal(await queryCount("product_masters", "where organization_id = $1", [fixture.organizationId]), 0);
  assert.equal(await queryCount("product_items", "where organization_id = $1", [fixture.organizationId]), 0);
});

test("failure after Product Item sequence allocation rolls back all business data while allowing sequence gaps", async () => {
  const fixture = await createOrganizationFixture("FAIL-ID");
  const archive = buildPackage({
    masters: [{ masterKey: "MASTER-FAIL-ID", categoryCode: fixture.categoryCode }],
    items: [{ rowKey: "ITEM-FAIL-ID", masterKey: "MASTER-FAIL-ID", availability: "draft" }],
  });
  const session = await createSession(fixture, archive);

  await assert.rejects(
    () =>
      commitProductBatchImportSession({
        auth: fixture.auth,
        sessionId: session.id,
        testFailpoint: "after_first_identifier_allocation",
      }),
    (error: unknown) =>
      error instanceof ProductBatchImportCommitError && error.code === "TEST_FAILPOINT",
  );

  const itemRows = await db
    .select({
      committedProductItemId: productBatchImportItemRows.committedProductItemId,
      generatedSku: productBatchImportItemRows.generatedSku,
      generatedBarcode: productBatchImportItemRows.generatedBarcode,
      generatedQrValue: productBatchImportItemRows.generatedQrValue,
    })
    .from(productBatchImportItemRows)
    .where(eq(productBatchImportItemRows.sessionId, session.id));
  assert.equal(itemRows.length, 1);
  assert.deepEqual(itemRows[0], {
    committedProductItemId: null,
    generatedSku: null,
    generatedBarcode: null,
    generatedQrValue: null,
  });
  assert.equal(await queryCount("product_masters", "where organization_id = $1", [fixture.organizationId]), 0);
  assert.equal(await queryCount("product_items", "where organization_id = $1", [fixture.organizationId]), 0);
  assert.equal(await queryCount("item_barcodes", "where organization_id = $1", [fixture.organizationId]), 0);
});

test("concurrent double commit produces exactly one completed batch", async () => {
  const fixture = await createOrganizationFixture("CONCURRENT");
  const archive = buildPackage({
    masters: [{ masterKey: "MASTER-CONCURRENT", categoryCode: fixture.categoryCode }],
    items: [{ rowKey: "ITEM-CONCURRENT", masterKey: "MASTER-CONCURRENT", availability: "draft" }],
  });
  const session = await createSession(fixture, archive);

  const attempts = await Promise.allSettled([
    commitProductBatchImportSession({ auth: fixture.auth, sessionId: session.id }),
    commitProductBatchImportSession({ auth: fixture.auth, sessionId: session.id }),
  ]);
  const successes = attempts.filter(
    (attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof commitProductBatchImportSession>>> =>
      attempt.status === "fulfilled",
  );
  const failures = attempts.filter(
    (attempt): attempt is PromiseRejectedResult => attempt.status === "rejected",
  );
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  assert.ok(
    failures[0]!.reason instanceof ProductBatchImportCommitError &&
      failures[0]!.reason.code === "SESSION_NOT_READY",
  );

  const result = await getProductBatchImportResult(fixture.auth, session.id);
  assert.ok(result);
  assert.equal(result.session.status, "completed");
  assert.equal(result.masters.length, 1);
  assert.equal(result.items.length, 1);
  assert.equal(await queryCount("product_masters", "where organization_id = $1", [fixture.organizationId]), 1);
  assert.equal(await queryCount("product_items", "where organization_id = $1", [fixture.organizationId]), 1);
  assert.equal(await queryCount("item_barcodes", "where organization_id = $1", [fixture.organizationId]), 1);
});

export async function runProductBatchImportIntegrationSuite() {
  const startedAt = Date.now();
  let passed = 0;

  try {
    await assertDisposablePostgres17();
    console.log(`\nProduct Batch Import Integration Suite (${TEST_CASES.length} cases)`);

    for (const testCase of TEST_CASES) {
      await resetPublicTablesAndStorage();
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
      `\nProduct Batch Import Integration Suite passed: ${passed}/${TEST_CASES.length} cases (${Date.now() - startedAt} ms).`,
    );
  } finally {
    await rm(TEST_STORAGE_ROOT, { recursive: true, force: true }).catch(() => undefined);
    await pool.end();
  }
}
