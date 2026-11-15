import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { inventoryMovements, itemBarcodes, legacyProductRows, productItems } from "@/db/schema";
import {
  normalizeLegacySyncBarcode,
  readLegacyStockStatus,
  sameLegacySyncIdentity,
  type LegacySyncIdentity,
  type LegacySyncOutcome,
} from "@/features/legacy-migration/sync-policy";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type LegacySyncSourceRow = LegacySyncIdentity & {
  id: string;
  normalizedBarcode: string | null;
  rawData: Record<string, unknown>;
  validationStatus: "valid" | "warning" | "invalid";
};

const noOperationalActivity = sql`not exists (
  select 1 from inventory_movements sync_movement
  where sync_movement.item_id = ${productItems.id}
    and sync_movement.movement_type <> 'migration_opening'
) and not exists (
  select 1 from sale_items sync_sale where sync_sale.product_item_id = ${productItems.id}
) and not exists (
  select 1 from sale_return_items sync_return where sync_return.product_item_id = ${productItems.id}
) and not exists (
  select 1 from pos_held_cart_items sync_cart where sync_cart.product_item_id = ${productItems.id}
) and not exists (
  select 1 from product_batch_import_item_rows sync_batch where sync_batch.committed_product_item_id = ${productItems.id}
)`;

/** Resolve the original source row, not mutable POS prices or staff-edited labels. */
export async function planLegacyInventorySync<Row extends LegacySyncSourceRow>(
  transaction: Transaction,
  input: { organizationId: string; outletId: string; batchId: string; actorUserId: string; now: Date; rows: Row[] },
) {
  const candidates = await transaction.select({
    id: productItems.id,
    barcode: productItems.barcode,
    legacyId: productItems.legacyId,
    attributes: productItems.attributes,
    currentOutletId: productItems.currentOutletId,
    availability: productItems.availability,
    condition: productItems.condition,
    locationState: productItems.locationState,
    isActive: productItems.isActive,
    sourceOutletId: legacyProductRows.outletId,
    source: {
      legacyCategory: legacyProductRows.legacyCategory,
      legacyMasterCode: legacyProductRows.legacyMasterCode,
      legacyMasterName: legacyProductRows.legacyMasterName,
      legacyItemName: legacyProductRows.legacyItemName,
      legacyPurity: legacyProductRows.legacyPurity,
      legacyWeightGram: legacyProductRows.legacyWeightGram,
      legacyColor: legacyProductRows.legacyColor,
    },
    canChangeStock: sql<boolean>`${noOperationalActivity}`,
  }).from(productItems).leftJoin(legacyProductRows, and(
    sql`${legacyProductRows.id}::text = ${productItems.attributes}->'legacyImport'->>'rowId'`,
    eq(legacyProductRows.organizationId, input.organizationId),
  )).where(eq(productItems.organizationId, input.organizationId));
  const aliases = await transaction.select({itemId:itemBarcodes.itemId,barcode:itemBarcodes.barcodeValue})
    .from(itemBarcodes).where(eq(itemBarcodes.organizationId,input.organizationId));
  const byId = new Map(candidates.map(item => [item.id,item]));
  const byBarcode = new Map<string, Set<string>>();
  const add = (value: unknown, itemId: string) => {
    const barcode = normalizeLegacySyncBarcode(value);
    if (!barcode) return;
    const ids = byBarcode.get(barcode) ?? new Set<string>();
    ids.add(itemId);
    byBarcode.set(barcode,ids);
  };
  for (const item of candidates) {
    add(item.barcode,item.id);
    add(item.legacyId,item.id);
    const metadata = item.attributes?.legacyImport as Record<string,unknown> | undefined;
    add(metadata?.sourceBarcode,item.id);
  }
  for (const alias of aliases) add(alias.barcode,alias.itemId);
  const counts = new Map<string,number>();
  for (const row of input.rows) {
    const barcode = normalizeLegacySyncBarcode(row.normalizedBarcode);
    if (barcode) counts.set(barcode,(counts.get(barcode) ?? 0)+1);
  }
  const newRows: Row[] = [];
  const outcomes: LegacySyncOutcome[] = [];
  const pendingUpdates: LegacySyncOutcome[] = [];
  for (const row of input.rows) {
    const barcode = normalizeLegacySyncBarcode(row.normalizedBarcode);
    const stockStatus = readLegacyStockStatus(row.rawData);
    const outcome: LegacySyncOutcome = {rowId:row.id,kind:"deferred",itemId:null,stockStatus,reason:"invalid_identity"};
    outcomes.push(outcome);
    if (barcode && (counts.get(barcode) ?? 0)>1) { outcome.reason="duplicate_barcode"; continue; }
    if (!barcode || !row.legacyMasterCode || !row.legacyItemName || row.validationStatus === "invalid") continue;
    if (stockStatus === "unknown") { outcome.reason="unknown_stock"; continue; }
    const ids = [...(byBarcode.get(barcode) ?? [])];
    if (ids.length>1) { outcome.reason="multiple_matches"; continue; }
    if (ids.length === 0) {
      newRows.push(row);
      outcome.kind="created";
      outcome.reason="created";
      continue;
    }
    const item = byId.get(ids[0]!);
    if (!item) { outcome.reason="different_product"; continue; }
    outcome.itemId=item.id;
    if (!item.source || !sameLegacySyncIdentity(row,item.source)) { outcome.reason="different_product"; continue; }
    if (item.sourceOutletId!==input.outletId || item.currentOutletId!==input.outletId) { outcome.reason="different_outlet"; continue; }
    if (stockStatus === "available" || item.availability === "sold") {
      outcome.kind="existing";
      outcome.reason=item.availability === "available" || item.availability === "sold" && stockStatus === "sold" ? "already_exists" : "status_preserved";
      continue;
    }
    if (!item.isActive || item.availability!=="available" || item.locationState!=="outlet" || item.condition!=="good" || !item.canChangeStock) {
      outcome.reason="operational_activity";
      continue;
    }
    pendingUpdates.push(outcome);
  }
  // Conditional updates share the POS claim lock. A concurrent checkout wins or
  // loses atomically; source status never overwrites an operational movement.
  for (let offset=0;offset<pendingUpdates.length;offset+=250) {
    const chunk=pendingUpdates.slice(offset,offset+250);
    const changed=await transaction.update(productItems).set({
      availability:"sold",locationState:"customer",updatedAt:input.now,
      attributes:sql`coalesce(${productItems.attributes}, '{}'::jsonb) || jsonb_build_object('legacySync', jsonb_build_object(
        'batchId', ${input.batchId}::text, 'stockStatus', 'sold', 'syncedAt', ${input.now.toISOString()}::text
      ))`,
    }).where(and(
      eq(productItems.organizationId,input.organizationId),
      inArray(productItems.id,chunk.map(row=>row.itemId!)),
      eq(productItems.currentOutletId,input.outletId),eq(productItems.availability,"available"),
      eq(productItems.locationState,"outlet"),eq(productItems.condition,"good"),eq(productItems.isActive,true),noOperationalActivity,
    )).returning({id:productItems.id});
    const updated = new Set(changed.map(item=>item.id));
    for (const outcome of chunk) {
      outcome.kind=updated.has(outcome.itemId!) ? "stock_updated" : "deferred";
      outcome.reason=updated.has(outcome.itemId!) ? "stock_updated" : "operational_activity";
    }
    if (changed.length) await transaction.insert(inventoryMovements).values(changed.map(item=>({
      organizationId:input.organizationId,itemId:item.id,movementType:"adjustment" as const,
      fromOutletId:input.outletId,toOutletId:null,referenceType:"legacy_stock_sync",referenceId:input.batchId,
      reason:"Status stok legacy diperbarui menjadi habis/terjual. Bukan transaksi penjualan RMS.",
      metadata:{source:"legacy_excel",fromAvailability:"available",toAvailability:"sold"},
      performedBy:input.actorUserId,occurredAt:input.now,
    })));
  }
  return {newRows,outcomes};
}
