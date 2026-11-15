import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, inventoryMovements, productCategories, productItems, productMasters } from "@/db/schema";
import { isUuid } from "@/features/inventory/product-item-contracts";
import type { ProductLifecycleEntity, ProductLifecycleOperation, ProductLifecycleState } from "@/features/products/lifecycle-contracts";
import type { AuthContext } from "@/lib/auth/session";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Transaction;

export class ProductLifecycleError extends Error {}

export function canManageProductLifecycle(auth: AuthContext, entity: ProductLifecycleEntity) {
  return entity === "master"
    ? auth.permissionCodes.includes("products.manage")
    : ["inventory.adjust", "inventory.manage"].some(code => auth.permissionCodes.includes(code));
}

function requireAccess(auth: AuthContext, entity: ProductLifecycleEntity, id: string) {
  if (entity !== "item" && entity !== "master") throw new ProductLifecycleError("Jenis produk tidak valid.");
  if (!isUuid(id)) throw new ProductLifecycleError("Identitas produk tidak valid.");
  if (!canManageProductLifecycle(auth, entity)) throw new ProductLifecycleError("Kamu tidak memiliki izin untuk mengelola produk ini.");
}

function lifecycleData(attributes: Record<string, unknown> | null) {
  const value = attributes?.productLifecycle;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function readItem(reader: Reader, auth: AuthContext, id: string, lock = false) {
  const query = reader.select().from(productItems).where(and(eq(productItems.id, id), eq(productItems.organizationId, auth.organization.id)));
  const [item] = lock ? await query.for("update") : await query;
  if (!item || item.currentOutletId && !auth.outlets.some(outlet => outlet.id === item.currentOutletId) || !auth.outlets.length) {
    throw new ProductLifecycleError("Item tidak ditemukan atau outletnya tidak dapat diakses.");
  }
  const [refs] = await reader.select({
    hasHistory: sql<boolean>`exists (select 1 from inventory_movements where item_id = ${id})
      or exists (select 1 from sale_items where product_item_id = ${id})
      or exists (select 1 from sale_return_items where product_item_id = ${id})
      or exists (select 1 from buyback_items where product_item_id = ${id})
      or exists (select 1 from buyback_item_processings where result_product_item_id = ${id})
      or exists (select 1 from pos_held_cart_items where product_item_id = ${id})
      or exists (select 1 from product_batch_import_item_rows where committed_product_item_id = ${id})
      or exists (select 1 from item_barcodes where item_id = ${id} and source = 'legacy_import')`,
    activeHold: sql<boolean>`exists (
      select 1 from pos_held_cart_items held_item join pos_held_carts cart on cart.id = held_item.held_cart_id
      where held_item.product_item_id = ${id} and held_item.is_active = true and cart.status = 'active'
    )`,
  }).from(productItems).where(eq(productItems.id, id));
  const hasHistory = Boolean(refs?.hasHistory || item.legacyId || item.attributes?.legacyImport || item.attributes?.productBatchImport);
  let blockedReason = refs?.activeHold ? "Item masih ditahan di keranjang POS. Lepaskan hold terlebih dahulu."
    : !["draft", "available", "sold"].includes(item.availability) ? "Item sedang direservasi, diperiksa, atau diproses. Selesaikan proses tersebut terlebih dahulu."
    : ["in_transit", "repair"].includes(item.locationState) ? "Item sedang dalam pengiriman atau perbaikan. Selesaikan proses tersebut terlebih dahulu." : null;
  const operation = !item.isActive ? "restore" : item.availability === "draft" && !hasHistory ? "delete" : "archive";
  if (operation === "restore" && item.availability === "available") {
    const parentQuery = reader.select({status:productMasters.status,categoryActive:productCategories.isActive})
      .from(productMasters).innerJoin(productCategories,eq(productCategories.id,productMasters.categoryId)).where(eq(productMasters.id,item.productMasterId));
    const [parent] = lock ? await parentQuery.for("share",{of:productMasters}) : await parentQuery;
    if (parent?.status !== "active" || !parent.categoryActive) blockedReason = "Aktifkan master dan kategori produk terlebih dahulu sebelum memulihkan stok tersedia.";
  }
  return { item, state: describe(operation, blockedReason) };
}

async function readMaster(reader: Reader, auth: AuthContext, id: string, lock = false) {
  const query = reader.select().from(productMasters).where(and(eq(productMasters.id, id), eq(productMasters.organizationId, auth.organization.id)));
  const [master] = lock ? await query.for("update") : await query;
  if (!master) throw new ProductLifecycleError("Master produk tidak ditemukan atau tidak dapat diakses.");
  const [refs] = await reader.select({
    hasHistory: sql<boolean>`exists (select 1 from product_items where product_master_id = ${id})
      or exists (select 1 from legacy_product_master_mappings where target_product_master_id = ${id})
      or exists (select 1 from product_batch_import_master_rows where committed_product_master_id = ${id})`,
    hasOperationalItems: sql<boolean>`exists (select 1 from product_items where product_master_id = ${id} and is_active = true and availability <> 'sold')`,
  }).from(productMasters).where(eq(productMasters.id, id));
  const lifecycle = lifecycleData(master.attributes);
  const archived = lifecycle.archived === true;
  const operation = archived ? "restore" : refs?.hasHistory || master.attributes?.legacyImport || master.attributes?.productBatchImport ? "archive" : "delete";
  let blockedReason = !archived && refs?.hasOperationalItems ? "Masih ada item operasional aktif. Arsipkan atau selesaikan item tersebut terlebih dahulu." : null;
  if (archived && lifecycle.previousStatus === "active") {
    const [category] = await reader.select({active: productCategories.isActive}).from(productCategories).where(eq(productCategories.id, master.categoryId));
    if (!category?.active) blockedReason = "Aktifkan kategori produk terlebih dahulu sebelum memulihkan master aktif.";
  }
  return { master, state: describe(operation, blockedReason) };
}

function describe(operation: ProductLifecycleOperation, blockedReason: string | null): ProductLifecycleState {
  return {
    operation, blockedReason,
    label: operation === "delete" ? "Hapus Produk" : operation === "archive" ? "Arsipkan Produk" : "Pulihkan Produk",
    description: operation === "delete" ? "Produk belum memiliki riwayat penggunaan dan akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
      : operation === "archive" ? "Produk dikeluarkan dari daftar aktif dan POS. Riwayat tetap tersimpan, dan produk dapat dipulihkan melalui daftar arsip/nonaktif."
      : "Produk dipulihkan dari arsip dengan status sebelumnya. Produk yang sudah terjual tetap terjual.",
  };
}

export async function getProductLifecycleState(auth: AuthContext, entity: ProductLifecycleEntity, id: string) {
  requireAccess(auth, entity, id);
  return entity === "item" ? (await readItem(db, auth, id)).state : (await readMaster(db, auth, id)).state;
}

export async function changeProductLifecycle(input: {
  auth: AuthContext; entity: ProductLifecycleEntity; id: string; operation: ProductLifecycleOperation;
  requestMetadata?: {ipAddress?: string | null; userAgent?: string | null}; now?: Date;
}) {
  const {auth, entity, id, operation} = input;
  requireAccess(auth, entity, id);
  if (!["delete", "archive", "restore"].includes(operation)) throw new ProductLifecycleError("Tindakan produk tidak valid.");
  const now = input.now ?? new Date();
  return db.transaction(async transaction => {
    // Same order as legacy synchronization, so an import cannot undo an archive.
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`legacy-inventory-sync:${auth.organization.id}`}))`);
    const record = entity === "item" ? await readItem(transaction, auth, id, true) : await readMaster(transaction, auth, id, true);
    if (record.state.blockedReason) throw new ProductLifecycleError(record.state.blockedReason);
    if (record.state.operation !== operation && !(operation === "archive" && record.state.operation === "delete")) throw new ProductLifecycleError("Data produk berubah. Muat ulang halaman sebelum melanjutkan.");
    const entityData = "item" in record ? record.item : record.master;
    const outletId = "item" in record ? record.item.currentOutletId : null;
    const lifecycle = lifecycleData(entityData.attributes);
    const attributes = { ...entityData.attributes, productLifecycle: {
      ...lifecycle, archived: operation === "archive", changedAt: now.toISOString(), changedBy: auth.user.id,
      ...(entity === "master" && operation === "archive" && "master" in record ? {previousStatus: record.master.status} : {}),
    }};
    if (operation === "delete") {
      // FOR UPDATE also blocks concurrent FK references. Barcode aliases cascade;
      // business/history references are never removed to make deletion possible.
      if (entity === "item") await transaction.delete(productItems).where(eq(productItems.id, id));
      else await transaction.delete(productMasters).where(eq(productMasters.id, id));
    } else if ("item" in record) {
      await transaction.update(productItems).set({isActive: operation === "restore", attributes, updatedAt: now}).where(eq(productItems.id, id));
      if (record.item.availability === "available" && outletId) await transaction.insert(inventoryMovements).values({
        organizationId: auth.organization.id, itemId: id, movementType: "adjustment",
        fromOutletId: operation === "archive" ? outletId : null,
        toOutletId: operation === "restore" ? outletId : null,
        referenceType: "product_item_lifecycle", referenceId: randomUUID(),
        reason: operation === "archive" ? "Item dikeluarkan dari stok aktif karena diarsipkan." : "Item dipulihkan ke stok aktif dari arsip.",
        metadata: {operation, previousAvailability: record.item.availability}, performedBy: auth.user.id, occurredAt: now,
      });
    } else {
      const status = operation === "archive" ? "inactive" : lifecycle.previousStatus === "draft" ? "draft" : lifecycle.previousStatus === "inactive" ? "inactive" : "active";
      await transaction.update(productMasters).set({status, attributes, updatedAt: now}).where(eq(productMasters.id, id));
    }
    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id, outletId, actorUserId: auth.user.id,
      action: `product_${entity}.${operation}`, entityType: `product_${entity}`, entityId: id,
      beforeData: entityData, afterData: {operation, deleted: operation === "delete", ...(operation === "delete" ? {} : {attributes})},
      reason: describe(operation, null).label, ipAddress: input.requestMetadata?.ipAddress ?? null, userAgent: input.requestMetadata?.userAgent?.slice(0,500) ?? null,
    });
    return {deleted: operation === "delete", productId: "item" in record ? record.item.productMasterId : id};
  });
}
