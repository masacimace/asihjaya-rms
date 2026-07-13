import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  inventoryMovements,
  outlets,
  productItems,
  productMasters,
  users,
} from "@/db/schema";
import {
  PRODUCT_ITEM_PAGE_SIZE,
  type ProductItemListFilters,
} from "@/features/inventory/product-item-contracts";

export type ProductItemPurityOption = {
  id: string;
  label: string;
  purityPercentage: string;
};

export type ProductItemOutletOption = {
  id: string;
  code: string;
  name: string;
};

export async function getProductItemCreateContext({
  organizationId,
  productId,
  allowedOutletIds,
}: {
  organizationId: string;
  productId: string;
  allowedOutletIds: string[];
}) {
  const productRows = await db
    .select({
      id: productMasters.id,
      code: productMasters.code,
      name: productMasters.name,
      status: productMasters.status,
      imageKey: productMasters.imageKey,
    })
    .from(productMasters)
    .where(
      and(
        eq(productMasters.id, productId),
        eq(productMasters.organizationId, organizationId),
      ),
    )
    .limit(1);

  const product = productRows[0];

  if (!product) {
    return null;
  }

  const outletConditions: SQL[] = [
    eq(outlets.organizationId, organizationId),
    eq(outlets.isActive, true),
  ];

  if (allowedOutletIds.length > 0) {
    outletConditions.push(inArray(outlets.id, allowedOutletIds));
  } else {
    outletConditions.push(
      eq(outlets.id, "00000000-0000-0000-0000-000000000000"),
    );
  }

  const outletRows = await db
    .select({
      id: outlets.id,
      code: outlets.code,
      name: outlets.name,
    })
    .from(outlets)
    .where(and(...outletConditions))
    .orderBy(asc(outlets.name));

  return {
    product,
    outlets: outletRows satisfies ProductItemOutletOption[],
  };
}

export async function getInventoryOutletOptions(organizationId: string) {
  return db
    .select({
      id: outlets.id,
      code: outlets.code,
      name: outlets.name,
      isActive: outlets.isActive,
    })
    .from(outlets)
    .where(eq(outlets.organizationId, organizationId))
    .orderBy(desc(outlets.isActive), asc(outlets.name));
}

export async function getProductItemOverview(organizationId: string) {
  const rows = await db
    .select({
      availability: productItems.availability,
      condition: productItems.condition,
      total: count(),
      totalWeightGram: sql<string>`coalesce(sum(${productItems.weightGram}), 0)`,
      totalCostAmount: sql<string>`coalesce(sum(${productItems.costAmount}), 0)`,
    })
    .from(productItems)
    .where(
      and(
        eq(productItems.organizationId, organizationId),
        eq(productItems.isActive, true),
      ),
    )
    .groupBy(productItems.availability, productItems.condition);

  const totalFor = (
    availability: "draft" | "available" | "reserved" | "inspection" | "sold",
  ) =>
    rows
      .filter((row) => row.availability === availability)
      .reduce((sum, row) => sum + Number(row.total), 0);

  const sumForAvailable = (field: "totalWeightGram" | "totalCostAmount") =>
    rows
      .filter((row) => row.availability === "available")
      .reduce((sum, row) => sum + Number(row[field] ?? 0), 0);

  const attention = rows
    .filter((row) => row.condition !== "good")
    .reduce((sum, row) => sum + Number(row.total), 0);

  return {
    total: rows.reduce((sum, row) => sum + Number(row.total), 0),
    draft: totalFor("draft"),
    available: totalFor("available"),
    reserved: totalFor("reserved"),
    sold: totalFor("sold"),
    availableWeightGram: sumForAvailable("totalWeightGram"),
    availableCostAmount: sumForAvailable("totalCostAmount"),
    attention,
  };
}

export async function getProductItemList(
  organizationId: string,
  filters: ProductItemListFilters,
) {
  const conditions: SQL[] = [
    eq(productItems.organizationId, organizationId),
    eq(productItems.isActive, filters.status === "active"),
  ];

  if (filters.search) {
    const pattern = `%${filters.search}%`;

    conditions.push(
      or(
        ilike(productItems.sku, pattern),
        ilike(productItems.barcode, pattern),
        ilike(productItems.displayName, pattern),
        ilike(productMasters.code, pattern),
        ilike(productMasters.name, pattern),
      )!,
    );
  }

  if (filters.outletId) {
    conditions.push(eq(productItems.currentOutletId, filters.outletId));
  }

  if (filters.availability) {
    conditions.push(eq(productItems.availability, filters.availability));
  }

  if (filters.condition) {
    conditions.push(eq(productItems.condition, filters.condition));
  }

  const whereClause = and(...conditions);
  const totalRows = await db
    .select({ total: count() })
    .from(productItems)
    .innerJoin(
      productMasters,
      eq(productItems.productMasterId, productMasters.id),
    )
    .where(whereClause);

  const total = Number(totalRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PRODUCT_ITEM_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const rows = await db
    .select({
      id: productItems.id,
      sku: productItems.sku,
      barcode: productItems.barcode,
      displayName: productItems.displayName,
      weightGram: productItems.weightGram,
      sellingAmount: productItems.sellingAmount,
      availability: productItems.availability,
      condition: productItems.condition,
      locationCode: productItems.locationCode,
      imageKey: productItems.imageKey,
      updatedAt: productItems.updatedAt,
      productId: productMasters.id,
      productCode: productMasters.code,
      productName: sql<string>`coalesce(${productItems.displayName}, ${productMasters.name})`,
      masterProductName: productMasters.name,
      productImageKey: productMasters.imageKey,
      outletCode: outlets.code,
      outletName: outlets.name,
    })
    .from(productItems)
    .innerJoin(
      productMasters,
      eq(productItems.productMasterId, productMasters.id),
    )
    .leftJoin(outlets, eq(productItems.currentOutletId, outlets.id))
    .where(whereClause)
    .orderBy(desc(productItems.updatedAt), desc(productItems.createdAt))
    .limit(PRODUCT_ITEM_PAGE_SIZE)
    .offset((page - 1) * PRODUCT_ITEM_PAGE_SIZE);

  return {
    rows,
    total,
    page,
    pageCount,
    pageSize: PRODUCT_ITEM_PAGE_SIZE,
  };
}

export async function getProductItemDetail(
  organizationId: string,
  itemId: string,
) {
  const itemRows = await db
    .select({
      id: productItems.id,
      organizationId: productItems.organizationId,
      sku: productItems.sku,
      barcode: productItems.barcode,
      qrValue: productItems.qrValue,
      displayName: productItems.displayName,
      weightGram: productItems.weightGram,
      purityPercent: productItems.purityPercent,
      exchangePurityPercent: productItems.exchangePurityPercent,
      size: productItems.size,
      color: productItems.color,
      gemstone: productItems.gemstone,
      costAmount: productItems.costAmount,
      sellingAmount: productItems.sellingAmount,
      pricePerGram: productItems.pricePerGram,
      deductionPerGram: productItems.deductionPerGram,
      availability: productItems.availability,
      condition: productItems.condition,
      locationState: productItems.locationState,
      locationCode: productItems.locationCode,
      imageKey: productItems.imageKey,
      internalNotes: productItems.internalNotes,
      isActive: productItems.isActive,
      createdAt: productItems.createdAt,
      updatedAt: productItems.updatedAt,
      productId: productMasters.id,
      productCode: productMasters.code,
      productName: productMasters.name,
      productImageKey: productMasters.imageKey,
      productStatus: productMasters.status,
      currentOutletId: productItems.currentOutletId,
      outletId: outlets.id,
      outletCode: outlets.code,
      outletName: outlets.name,
    })
    .from(productItems)
    .innerJoin(
      productMasters,
      eq(productItems.productMasterId, productMasters.id),
    )
    .leftJoin(outlets, eq(productItems.currentOutletId, outlets.id))
    .where(
      and(
        eq(productItems.id, itemId),
        eq(productItems.organizationId, organizationId),
      ),
    )
    .limit(1);

  const item = itemRows[0];

  if (!item) {
    return null;
  }

  const fromOutlet = alias(outlets, "movement_from_outlet");
  const toOutlet = alias(outlets, "movement_to_outlet");

  const movements = await db
    .select({
      id: inventoryMovements.id,
      movementType: inventoryMovements.movementType,
      reason: inventoryMovements.reason,
      referenceType: inventoryMovements.referenceType,
      occurredAt: inventoryMovements.occurredAt,
      createdAt: inventoryMovements.createdAt,
      fromOutletName: fromOutlet.name,
      toOutletName: toOutlet.name,
      performerName: users.fullName,
    })
    .from(inventoryMovements)
    .leftJoin(fromOutlet, eq(inventoryMovements.fromOutletId, fromOutlet.id))
    .leftJoin(toOutlet, eq(inventoryMovements.toOutletId, toOutlet.id))
    .innerJoin(users, eq(inventoryMovements.performedBy, users.id))
    .where(
      and(
        eq(inventoryMovements.organizationId, organizationId),
        eq(inventoryMovements.itemId, item.id),
      ),
    )
    .orderBy(desc(inventoryMovements.occurredAt));

  return { ...item, movements };
}

export async function getRecentProductItems(
  organizationId: string,
  productId: string,
  limit = 12,
) {
  return db
    .select({
      id: productItems.id,
      sku: productItems.sku,
      barcode: productItems.barcode,
      displayName: productItems.displayName,
      weightGram: productItems.weightGram,
      sellingAmount: productItems.sellingAmount,
      availability: productItems.availability,
      condition: productItems.condition,
      imageKey: productItems.imageKey,
      outletName: outlets.name,
    })
    .from(productItems)
    .leftJoin(outlets, eq(productItems.currentOutletId, outlets.id))
    .where(
      and(
        eq(productItems.organizationId, organizationId),
        eq(productItems.productMasterId, productId),
      ),
    )
    .orderBy(desc(productItems.createdAt))
    .limit(limit);
}

export async function getProductItemEditContext({
  organizationId,
  itemId,
  allowedOutletIds,
}: {
  organizationId: string;
  itemId: string;
  allowedOutletIds: string[];
}) {
  const item = await getProductItemDetail(organizationId, itemId);

  if (!item) {
    return null;
  }

  const outletConditions: SQL[] = [
    eq(outlets.organizationId, organizationId),
    eq(outlets.isActive, true),
  ];

  if (allowedOutletIds.length > 0) {
    outletConditions.push(inArray(outlets.id, allowedOutletIds));
  } else {
    outletConditions.push(
      eq(outlets.id, "00000000-0000-0000-0000-000000000000"),
    );
  }

  const outletRows = await db
    .select({
      id: outlets.id,
      code: outlets.code,
      name: outlets.name,
    })
    .from(outlets)
    .where(and(...outletConditions))
    .orderBy(asc(outlets.name));

  return {
    item,
    outlets: outletRows satisfies ProductItemOutletOption[],
  };
}
