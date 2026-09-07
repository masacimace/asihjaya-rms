import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { productCategories, productMasters } from "@/db/schema";
import {
  CATEGORY_PAGE_SIZE,
  type CategoryListFilters,
} from "@/features/products/category-contracts";

export async function getCategoryOverview(organizationId: string) {
  const [categoryRows, productRows] = await Promise.all([
    db
      .select({
        isActive: productCategories.isActive,
        total: count(),
      })
      .from(productCategories)
      .where(eq(productCategories.organizationId, organizationId))
      .groupBy(productCategories.isActive),

    db
      .select({ total: count() })
      .from(productMasters)
      .where(
        and(
          eq(productMasters.organizationId, organizationId),
          eq(productMasters.status, "active"),
        ),
      ),
  ]);

  const activeCategories = Number(
    categoryRows.find((row) => row.isActive)?.total ?? 0,
  );
  const inactiveCategories = Number(
    categoryRows.find((row) => !row.isActive)?.total ?? 0,
  );

  return {
    totalCategories: activeCategories + inactiveCategories,
    activeCategories,
    inactiveCategories,
    activeProducts: Number(productRows[0]?.total ?? 0),
  };
}

export async function getCategoryParentOptions(
  organizationId: string,
  excludeCategoryId?: string,
  includeCategoryId?: string | null,
) {
  const activeCondition = includeCategoryId
    ? or(
        eq(productCategories.isActive, true),
        eq(productCategories.id, includeCategoryId),
      )!
    : eq(productCategories.isActive, true);

  const conditions: SQL[] = [
    eq(productCategories.organizationId, organizationId),
    isNull(productCategories.parentCategoryId),
    activeCondition,
  ];

  if (excludeCategoryId) {
    conditions.push(ne(productCategories.id, excludeCategoryId));
  }

  return db
    .select({
      id: productCategories.id,
      code: productCategories.code,
      name: productCategories.name,
      displayOrder: productCategories.displayOrder,
      isActive: productCategories.isActive,
    })
    .from(productCategories)
    .where(and(...conditions))
    .orderBy(
      asc(productCategories.displayOrder),
      asc(productCategories.name),
    );
}

export async function getCategoryList(
  organizationId: string,
  filters: CategoryListFilters,
) {
  const conditions: SQL[] = [
    eq(productCategories.organizationId, organizationId),
  ];

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;

    conditions.push(
      or(
        ilike(productCategories.code, searchPattern),
        ilike(productCategories.name, searchPattern),
        ilike(productCategories.description, searchPattern),
      )!,
    );
  }

  if (filters.status === "active") {
    conditions.push(eq(productCategories.isActive, true));
  }

  if (filters.status === "inactive") {
    conditions.push(eq(productCategories.isActive, false));
  }

  const whereClause = and(...conditions);

  const totalRows = await db
    .select({ total: count() })
    .from(productCategories)
    .where(whereClause);

  const total = Number(totalRows[0]?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / CATEGORY_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const offset = (page - 1) * CATEGORY_PAGE_SIZE;

  const rows = await db
    .select({
      id: productCategories.id,
      code: productCategories.code,
      name: productCategories.name,
      description: productCategories.description,
      isActive: productCategories.isActive,
      createdAt: productCategories.createdAt,
      updatedAt: productCategories.updatedAt,
    })
    .from(productCategories)
    .where(whereClause)
    .orderBy(asc(productCategories.name), asc(productCategories.code))
    .limit(CATEGORY_PAGE_SIZE)
    .offset(offset);

  const categoryIds = rows.map((row) => row.id);

  const productCountRows =
    categoryIds.length > 0
      ? await db
          .select({
            categoryId: productMasters.categoryId,
            status: productMasters.status,
            total: count(),
          })
          .from(productMasters)
          .where(
            and(
              eq(productMasters.organizationId, organizationId),
              inArray(productMasters.categoryId, categoryIds),
            ),
          )
          .groupBy(productMasters.categoryId, productMasters.status)
      : [];

  return {
    rows: rows.map((row) => {
      const productRowsForCategory = productCountRows.filter(
        (productRow) => productRow.categoryId === row.id,
      );

      return {
        ...row,
        productCount: productRowsForCategory.reduce(
          (sum, productRow) => sum + Number(productRow.total),
          0,
        ),
        activeProductCount: Number(
          productRowsForCategory.find(
            (productRow) => productRow.status === "active",
          )?.total ?? 0,
        ),
      };
    }),
    total,
    page,
    pageCount,
    pageSize: CATEGORY_PAGE_SIZE,
  };
}

export async function getCategoryDetail(
  organizationId: string,
  categoryId: string,
) {
  const categoryRows = await db
    .select({
      id: productCategories.id,
      organizationId: productCategories.organizationId,
      parentCategoryId: productCategories.parentCategoryId,
      code: productCategories.code,
      name: productCategories.name,
      description: productCategories.description,
      displayOrder: productCategories.displayOrder,
      isActive: productCategories.isActive,
      createdAt: productCategories.createdAt,
      updatedAt: productCategories.updatedAt,
    })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.id, categoryId),
        eq(productCategories.organizationId, organizationId),
      ),
    )
    .limit(1);

  const category = categoryRows[0];

  if (!category) {
    return null;
  }

  const [parentRows, productRows, childRows] = await Promise.all([
    category.parentCategoryId
      ? db
          .select({
            id: productCategories.id,
            code: productCategories.code,
            name: productCategories.name,
            displayOrder: productCategories.displayOrder,
            isActive: productCategories.isActive,
          })
          .from(productCategories)
          .where(
            and(
              eq(productCategories.id, category.parentCategoryId),
              eq(productCategories.organizationId, organizationId),
            ),
          )
          .limit(1)
      : Promise.resolve([]),

    db
      .select({
        status: productMasters.status,
        total: count(),
      })
      .from(productMasters)
      .where(
        and(
          eq(productMasters.organizationId, organizationId),
          eq(productMasters.categoryId, category.id),
        ),
      )
      .groupBy(productMasters.status),

    db
      .select({
        id: productCategories.id,
        code: productCategories.code,
        name: productCategories.name,
        description: productCategories.description,
        displayOrder: productCategories.displayOrder,
        isActive: productCategories.isActive,
      })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.organizationId, organizationId),
          eq(productCategories.parentCategoryId, category.id),
        ),
      )
      .orderBy(
        asc(productCategories.displayOrder),
        asc(productCategories.name),
      ),
  ]);

  const childIds = childRows.map((child) => child.id);

  const childProductRows =
    childIds.length > 0
      ? await db
          .select({
            categoryId: productMasters.categoryId,
            status: productMasters.status,
            total: count(),
          })
          .from(productMasters)
          .where(
            and(
              eq(productMasters.organizationId, organizationId),
              inArray(productMasters.categoryId, childIds),
            ),
          )
          .groupBy(productMasters.categoryId, productMasters.status)
      : [];

  const statusCount = (status: "draft" | "active" | "inactive") =>
    Number(productRows.find((row) => row.status === status)?.total ?? 0);

  return {
    ...category,
    parent: parentRows[0] ?? null,
    productCount: productRows.reduce(
      (sum, row) => sum + Number(row.total),
      0,
    ),
    activeProductCount: statusCount("active"),
    draftProductCount: statusCount("draft"),
    inactiveProductCount: statusCount("inactive"),
    childCount: childRows.length,
    activeChildCount: childRows.filter((child) => child.isActive).length,
    children: childRows.map((child) => {
      const rowsForChild = childProductRows.filter(
        (row) => row.categoryId === child.id,
      );

      return {
        ...child,
        productCount: rowsForChild.reduce(
          (sum, row) => sum + Number(row.total),
          0,
        ),
        activeProductCount: Number(
          rowsForChild.find((row) => row.status === "active")?.total ?? 0,
        ),
      };
    }),
  };
}
