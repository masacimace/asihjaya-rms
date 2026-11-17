import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { db, pool } from "@/db";
import { getOrCreateLabelBarcodeAlias, LabelBarcodeAliasError } from "@/features/inventory/label-barcode-alias";
import { getProductItemList } from "@/features/inventory/product-item-queries";
import { parseProductItemListFilters } from "@/features/inventory/product-item-contracts";
import { lookupPosItemByScanValue, getPosCatalogPage } from "@/features/pos/queries";
import { buildInventoryLabelPayloadV2 } from "@/lib/hardware/job-payload-contracts-v2";
import { createHardwareJobV2InTransaction } from "@/lib/hardware/job-producer-v2";
import { getLabelHardwareTarget } from "@/lib/hardware/label-target";
import { assertDisposablePostgres17, createBaseFixture, createItem, resetPublicTables } from "./legacy-barcode-pos-suite";

type Fixture = Awaited<ReturnType<typeof createBaseFixture>>;
const tests: Array<[string, () => Promise<void>]> = [];
const test = (name: string, run: () => Promise<void>) => tests.push([name, run]);
const alias = (f: Fixture, itemId: string) => db.transaction(tx => getOrCreateLabelBarcodeAlias(tx, {
  organizationId: f.organizationId, itemId, createdBy: f.actorUserId, outletId: f.outletId,
}));
const lookup = (f: Fixture, value: string) => lookupPosItemByScanValue({ organizationId: f.organizationId, outletId: f.outletId, scanValue: value });

test("alias scan, original barcode, legacy scan, POS search and inventory search resolve the same item", async () => {
  const f = await createBaseFixture();
  const item = await createItem(f, { internalBarcode: "AJ00013447", legacyBarcode: "013447" });
  const value = await alias(f, item.id);
  assert.equal(value, "000001");
  for (const code of [value, item.internalBarcode, item.legacyBarcode!]) {
    const result = await lookup(f, code);
    assert.equal(result.status, "found");
    if (result.status === "found") assert.equal(result.item.id, item.id);
  }
  assert.equal((await lookup(f, "1")).status, "not_found");
  const inventory = await getProductItemList(f.organizationId, parseProductItemListFilters({ q: value }));
  assert.deepEqual(inventory.rows.map(row => row.id), [item.id]);
  const catalog = await getPosCatalogPage({ organizationId: f.organizationId, outletId: f.outletId, searchQuery: value });
  assert.deepEqual(catalog.items.map(row => row.id), [item.id]);
  const original = (await pool.query("select barcode from product_items where id=$1", [item.id])).rows[0];
  assert.equal(original.barcode, "AJ00013447");
});

test("parallel first prints and reprints allocate exactly one stable alias", async () => {
  const f = await createBaseFixture(), item = await createItem(f);
  const values = await Promise.all(Array.from({ length: 12 }, () => alias(f, item.id)));
  assert.deepEqual(new Set(values), new Set(["000001"]));
  assert.equal((await pool.query("select count(*)::int count from item_barcodes where item_id=$1 and barcode_format='code128-c-short-v1'", [item.id])).rows[0].count, 1);
  assert.equal((await pool.query("select next_value from inventory_label_alias_counters where organization_id=$1", [f.organizationId])).rows[0].next_value, 2);
});

test("concurrent different items receive different aliases", async () => {
  const f = await createBaseFixture();
  const items = await Promise.all(Array.from({ length: 8 }, () => createItem(f)));
  const values = await Promise.all(items.map(item => alias(f, item.id)));
  assert.equal(new Set(values).size, items.length);
  for (let i = 0; i < items.length; i++) {
    const result = await lookup(f, values[i]!);
    assert.equal(result.status, "found");
    if (result.status === "found") assert.equal(result.item.id, items[i]!.id);
  }
});

test("allocation skips active/inactive legacy barcodes and direct SKU/QR/serial/internal identifiers", async () => {
  const f = await createBaseFixture(), item = await createItem(f);
  await createItem(f, { legacyBarcode: "000001" });
  await createItem(f, { sku: "000002", qrValue: "000003", serialNumber: "000004" });
  await createItem(f, { legacyBarcode: "000005", legacyBarcodeActive: false });
  await createItem(f, { internalBarcode: "000006" });
  assert.equal(await alias(f, item.id), "000007");
});

test("deleted items do not release aliases for reuse", async () => {
  const f = await createBaseFixture(), item = await createItem(f, { availability: "draft" });
  const old = await alias(f, item.id);
  await pool.query("delete from product_items where id=$1", [item.id]);
  const fresh = await createItem(f);
  assert.equal(await alias(f, fresh.id), "000002");
  assert.equal((await lookup(f, old)).status, "not_found");
});

test("organization/outlet/status scope and inactive alias guards remain enforced", async () => {
  const f = await createBaseFixture(), other = await createBaseFixture();
  const item = await createItem(f), foreign = await createItem(other);
  assert.equal(await alias(f, item.id), "000001");
  assert.equal((await lookup(other, "000001")).status, "not_found");
  assert.equal(await alias(other, foreign.id), "000001");
  await assert.rejects(() => alias(f, foreign.id), LabelBarcodeAliasError);
  const wrongOutlet = await createItem(f, { outletId: f.otherOutletId });
  await assert.rejects(() => alias(f, wrongOutlet.id), LabelBarcodeAliasError);
  const sold = await createItem(f, { availability: "sold" });
  await assert.rejects(() => alias(f, sold.id), LabelBarcodeAliasError);
  await pool.query("update item_barcodes set is_active=false where item_id=$1 and barcode_format='code128-c-short-v1'", [item.id]);
  await assert.rejects(() => alias(f, item.id), LabelBarcodeAliasError);
});

test("the final six-digit alias fits the namespace and exhaustion never wraps", async () => {
  const f = await createBaseFixture();
  await pool.query("insert into inventory_label_alias_counters values($1,999999)", [f.organizationId]);
  const last = await createItem(f);
  assert.equal(await alias(f, last.id), "999999");
  assert.equal(await alias(f, last.id), "999999");
  const next = await createItem(f);
  await assert.rejects(() => alias(f, next.id), /sudah habis/);
  assert.equal((await pool.query("select next_value from inventory_label_alias_counters where organization_id=$1", [f.organizationId])).rows[0].next_value, 1000000);
});

test("production alias jobs select only Hubs advertising V4 support", async () => {
  const f = await createBaseFixture(), agentId = randomUUID();
  await pool.query("update registers set is_hardware_hub=true where id=$1", [f.registerId]);
  await pool.query(`insert into hardware_agents(id,organization_id,outlet_id,register_id,code,name,secret_hash,status,capabilities,is_active)
    values($1,$2,$3,$4,'alias-agent','Alias Test','test-hash','online','{"print_label_sato":true}',true)`, [agentId,f.organizationId,f.outletId,f.registerId]);
  assert.equal((await getLabelHardwareTarget({ organizationId:f.organizationId,outletId:f.outletId }))?.agentId, agentId);
  assert.equal(await getLabelHardwareTarget({ organizationId:f.organizationId,outletId:f.outletId,requireShortAlias:true }), null);
  await pool.query(`update hardware_agents set capabilities='{"print_label_sato":true,"supported_label_templates":["jewelry_barbell_alias_v4"]}' where id=$1`, [agentId]);
  assert.equal((await getLabelHardwareTarget({ organizationId:f.organizationId,outletId:f.outletId,requireShortAlias:true }))?.agentId, agentId);
});

test("print job and alias commit atomically; duplicate requests reuse the same alias/job", async () => {
  const f = await createBaseFixture(), item = await createItem(f, { internalBarcode: "AJ00013447" });
  await assert.rejects(() => db.transaction(async tx => {
    await getOrCreateLabelBarcodeAlias(tx, { organizationId: f.organizationId, itemId: item.id, createdBy: f.actorUserId });
    throw new Error("abort-before-job");
  }), /abort-before-job/);
  assert.equal((await pool.query("select count(*)::int count from item_barcodes where barcode_format='code128-c-short-v1'")).rows[0].count, 0);
  const requestId = randomUUID();
  const print = () => db.transaction(async tx => {
    const value = await getOrCreateLabelBarcodeAlias(tx, { organizationId: f.organizationId, itemId: item.id, createdBy: f.actorUserId });
    return createHardwareJobV2InTransaction(tx, {
      organizationId: f.organizationId, outletId: f.outletId, registerId: f.registerId, createdByUserId: f.actorUserId,
      jobType: "print_label_sato", mode: "manual", sourceType: "product_item_label", sourceId: item.id, idempotencyKey: `label:${item.id}:${requestId}`,
      payload: buildInventoryLabelPayloadV2({ itemId: item.id, copies: 1, sku: item.sku, barcode: item.internalBarcode, labelBarcode: value,
        masterProductName: "CINCIN", itemDisplayName: "CINCIN 6K", weightGram: "2.1", purityPercent: null, exchangePurityPercent: null, size: null, color: null, gemstone: null, sellingAmount: null }),
    });
  });
  const first = await print(), second = await print();
  assert.equal(second.duplicate, true);
  assert.equal(first.job.id, second.job.id);
  assert.equal(first.job.payload.templateVersion, 4);
  assert.equal((first.job.payload.fields as Record<string, unknown>).labelBarcode, "000001");
  assert.equal((first.job.payload.fields as Record<string, unknown>).barcode, "AJ00013447");
});

export async function runLabelBarcodeAliasSuite() {
  await assertDisposablePostgres17();
  try {
    for (const [name, run] of tests) {
      await resetPublicTables();
      await run();
      console.log(`PASS ${name}`);
    }
    console.log(`Label barcode alias suite passed: ${tests.length}/${tests.length}`);
  } finally { await pool.end(); }
}
