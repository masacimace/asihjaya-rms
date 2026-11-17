import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { inventoryLabelAliasCounters, itemBarcodes, productItems } from "@/db/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const SHORT_LABEL_BARCODE_FORMAT = "code128-c-short-v1";

export class LabelBarcodeAliasError extends Error {}

/** Call inside the same transaction as the print job. Never truncate a SKU. */
export async function getOrCreateLabelBarcodeAlias(transaction: Transaction, input: {
  organizationId: string;
  itemId: string;
  createdBy: string;
  outletId?: string;
}): Promise<string> {
  await transaction.insert(inventoryLabelAliasCounters).values({ organizationId: input.organizationId }).onConflictDoNothing();
  // All writers take the organization cursor first, then the item. Concurrent
  // first prints/reprints and overlapping batches therefore share one alias.
  const [cursor] = await transaction.select().from(inventoryLabelAliasCounters)
    .where(eq(inventoryLabelAliasCounters.organizationId, input.organizationId)).for("update");
  if (!cursor) throw new LabelBarcodeAliasError("Nomor alias label belum tersedia.");
  const [item] = await transaction.select({ id: productItems.id, currentOutletId: productItems.currentOutletId, isActive: productItems.isActive, availability: productItems.availability })
    .from(productItems).where(and(eq(productItems.id, input.itemId), eq(productItems.organizationId, input.organizationId))).for("update");
  if (!item || !item.isActive || input.outletId && item.currentOutletId !== input.outletId || !["draft", "available", "reserved"].includes(item.availability)) {
    throw new LabelBarcodeAliasError("Status item tidak mengizinkan pencetakan label baru.");
  }
  const [existing] = await transaction.select({ value: itemBarcodes.barcodeValue, active: itemBarcodes.isActive })
    .from(itemBarcodes).where(and(eq(itemBarcodes.organizationId, input.organizationId), eq(itemBarcodes.itemId, input.itemId),
      eq(itemBarcodes.barcodeFormat, SHORT_LABEL_BARCODE_FORMAT))).limit(1);
  if (existing) {
    if (!existing.active || !/^\d{6}$/.test(existing.value)) throw new LabelBarcodeAliasError("Alias label item tidak aktif atau tidak valid.");
    return existing.value;
  }
  let nextValue = cursor.nextValue;
  while (nextValue <= 999999) {
    // Small windows avoid scanning the full million-number space on each print.
    // Reserve inactive aliases too; never repurpose an old physical label.
    const result = await transaction.execute<{ value: string }>(sql`
      select lpad(n::text, 6, '0') as value
      from generate_series(${nextValue}::integer, least(${nextValue}::integer + 127, 999999)) n
      where not exists (select 1 from item_barcodes b where b.organization_id = ${input.organizationId} and b.barcode_value = lpad(n::text, 6, '0'))
        and not exists (select 1 from product_items p where p.organization_id = ${input.organizationId}
          and (p.barcode = lpad(n::text, 6, '0') or p.sku = lpad(n::text, 6, '0') or p.qr_value = lpad(n::text, 6, '0') or p.serial_number = lpad(n::text, 6, '0')))
      order by n limit 1`);
    const value = result.rows[0]?.value;
    if (value) {
      // A legacy import may concurrently reserve the same barcode. ON CONFLICT
      // keeps the transaction usable and advances to another candidate.
      const [inserted] = await transaction.insert(itemBarcodes).values({
        organizationId: input.organizationId, itemId: input.itemId, barcodeValue: value,
        barcodeFormat: SHORT_LABEL_BARCODE_FORMAT, source: "system_generated", isPrimary: false, isActive: true, createdBy: input.createdBy,
      }).onConflictDoNothing().returning({ value: itemBarcodes.barcodeValue });
      nextValue = Number(value) + 1;
      await transaction.update(inventoryLabelAliasCounters).set({ nextValue }).where(eq(inventoryLabelAliasCounters.organizationId, input.organizationId));
      if (inserted) return inserted.value;
    } else {
      nextValue = Math.min(nextValue + 128, 1000000);
      await transaction.update(inventoryLabelAliasCounters).set({ nextValue }).where(eq(inventoryLabelAliasCounters.organizationId, input.organizationId));
    }
  }
  throw new LabelBarcodeAliasError("Nomor alias label 6 digit sudah habis. Hubungi administrator; barcode lama tetap dapat digunakan.");
}
