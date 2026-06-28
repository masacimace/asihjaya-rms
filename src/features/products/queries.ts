import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  ilike,
  or,
  sum,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  productCategories,
  productItems,
  productMasters,
} from "@/db/schema";
import {
  PRODUCT_PAGE_SIZE,
  type ProductListFilters,
} from "@/features/products/contracts";

export async function getProductOverview(organizationId: string) {
  const [productStatusRows, categoryRows, itemStatusRows] =
    await Promise.all([
      db
        .select({
          status: productMasters.status,
          total: count(),
        })
        .from(productMasters)
        .where(eq(productMasters.organizationId, organizationId))
        .groupBy(productMasters.status),

      db
        .select({ total: count() })
        .from(productCategories)
        .where(
          and(
            eq(productCategories.organizationId, organizationId),
            eq(productCategories.isActive, true),
          ),
        ),

      db
        .select({
          availability: productItems.availability,
          total: count(),
          totalWeight: sum(productItems.weightGram),
        })
        .from(productItems)
        .where(eq(productItems.organizationId, organizationId))
        .groupBy(productItems.availability),
    ]);

  const productCount = (status: "draft" | "active" | "inactive") =>
    Number(productStatusRows.find((row) => row.status === status)?.total ?? 0);

  const itemCount = (
    availability: "draft" | "available" | "reserved" | "sold",
  ) =>
    Number(
      itemStatusRows.find((row) => row.availability === availability)?.total ??
        0,
    );

  return {
    totalProducts: productStatusRows.reduce(
      (total, row) => total + Number(row.total),
      0,
    ),
    activeProducts: productCount("active"),
    draftProducts: productCount("draft"),
    inactiveProducts: productCount("inactive"),
    activeCategories: Number(categoryRows[0]?.total ?? 0),
    availableItems: itemCount("available"),
    totalWeightGram: itemStatusRows.reduce(
      (total, row) => total + Number(row.totalWeight ?? 0),
      0,
    ),
  };
}

export async function getProductCategoryOptions(organizationId: string) {
  return db
    .select({
      id: productCategories.id,
      code: productCategories.code,
      name: productCategories.name,
      isActive: productCategories.isActive,
    })
    .from(productCategories)
    .where(eq(productCategories.organizationId, organizationId))
    .orderBy(
      asc(productCategories.displayOrder),
      asc(productCategories.name),
    );
}

export async function getProductList(
  organizationId: string,
  filters: ProductListFilters,
) {
  const conditions: SQL[] = [
    eq(productMasters.organizationId, organizationId),
  ];

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;

    conditions.push(
      or(
        ilike(productMasters.code, searchPattern),
        ilike(productMasters.name, searchPattern),
        ilike(productMasters.brand, searchPattern),
        ilike(productMasters.collection, searchPattern),
      )!,
    );
  }

  if (filters.categoryId) {
    conditions.push(eq(productMasters.categoryId, filters.categoryId));
  }

  if (filters.status) {
    conditions.push(eq(productMasters.status, filters.status));
  }

  const whereClause = and(...conditions);

  const totalRows = await db
    .select({ total: count() })
    .from(productMasters)
    .where(whereClause);

  const total = Number(totalRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const offset = (page - 1) * PRODUCT_PAGE_SIZE;

  const rows = await db
    .select({
      id: productMasters.id,
      code: productMasters.code,
      name: productMasters.name,
      brand: productMasters.brand,
      collection: productMasters.collection,
      status: productMasters.status,
      imageKey: productMasters.imageKey,
      updatedAt: productMasters.updatedAt,
      categoryId: productCategories.id,
      categoryCode: productCategories.code,
      categoryName: productCategories.name,
      itemCount: countDistinct(productItems.id),
      activeItemCount: sql<number>`count(distinct case when ${productItems.isActive} = true then ${productItems.id} end)`.mapWith(Number),
      archivedItemCount: sql<number>`count(distinct case when ${productItems.isActive} = false then ${productItems.id} end)`.mapWith(Number),
      totalWeightGram: sql<number>`sum(case when ${productItems.isActive} = true then ${productItems.weightGram} else 0 end)`.mapWith(Number),
    })
    .from(productMasters)
    .innerJoin(
      productCategories,
      eq(productMasters.categoryId, productCategories.id),
    )
    .leftJoin(
      productItems,
      eq(productItems.productMasterId, productMasters.id),
    )
    .where(whereClause)
    .groupBy(
      productMasters.id,
      productCategories.id,
      productCategories.code,
      productCategories.name,
    )
    .orderBy(desc(productMasters.updatedAt), asc(productMasters.name))
    .limit(PRODUCT_PAGE_SIZE)
    .offset(offset);

  return {
    rows: rows.map((row) => ({
      ...row,
      itemCount: Number(row.itemCount),
      activeItemCount: Number(row.activeItemCount),
      archivedItemCount: Number(row.archivedItemCount),
      totalWeightGram: Number(row.totalWeightGram),
    })),
    total,
    page,
    pageCount,
    pageSize: PRODUCT_PAGE_SIZE,
  };
}

export async function getProductDetail(
  organizationId: string,
  productId: string,
) {
  const productRows = await db
    .select({
      id: productMasters.id,
      code: productMasters.code,
      name: productMasters.name,
      brand: productMasters.brand,
      material: productMasters.material,
      collection: productMasters.collection,
      description: productMasters.description,
      imageKey: productMasters.imageKey,
      status: productMasters.status,
      attributes: productMasters.attributes,
      createdAt: productMasters.createdAt,
      updatedAt: productMasters.updatedAt,
      categoryId: productCategories.id,
      categoryCode: productCategories.code,
      categoryName: productCategories.name,
    })
    .from(productMasters)
    .innerJoin(
      productCategories,
      eq(productMasters.categoryId, productCategories.id),
    )
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

  const itemStatusRows = await db
    .select({
      availability: productItems.availability,
      total: count(),
    })
    .from(productItems)
    .where(
      and(
        eq(productItems.organizationId, organizationId),
        eq(productItems.productMasterId, product.id),
      ),
    )
    .groupBy(productItems.availability);

  const availabilityCount = (
    availability: "draft" | "available" | "reserved" | "sold",
  ) =>
    Number(
      itemStatusRows.find((row) => row.availability === availability)?.total ??
        0,
    );

  const totalItems = itemStatusRows.reduce(
    (total, row) => total + Number(row.total),
    0,
  );

  return {
    ...product,
    totalItems,
    availableItems: availabilityCount("available"),
    reservedItems: availabilityCount("reserved"),
    soldItems: availabilityCount("sold"),
  };
}
