import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNotNull,
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
        parentCategoryId: productCategories.parentCategoryId,
        isActive: productCategories.isActive,
        total: count(),
      })
      .from(productCategories)
      .where(eq(productCategories.organizationId, organizationId))
      .groupBy(
        productCategories.parentCategoryId,
        productCategories.isActive,
      ),

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

  const categoryCount = ({
    active,
    child,
  }: {
    active?: boolean;
    child?: boolean;
  }) =>
    categoryRows.reduce((total, row) => {
      if (active !== undefined && row.isActive !== active) {
        return total;
      }

      if (child !== undefined) {
        const rowIsChild = row.parentCategoryId !== null;

        if (rowIsChild !== child) {
          return total;
        }
      }

      return total + Number(row.total);
    }, 0);

  return {
    totalCategories: categoryCount({}),
    activeRootCategories: categoryCount({ active: true, child: false }),
    activeChildCategories: categoryCount({ active: true, child: true }),
    inactiveCategories: categoryCount({ active: false }),
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

  if (filters.type === "root") {
    conditions.push(isNull(productCategories.parentCategoryId));
  }

  if (filters.type === "child") {
    conditions.push(isNotNull(productCategories.parentCategoryId));
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
    .where(whereClause)
    .orderBy(
      asc(productCategories.displayOrder),
      asc(productCategories.name),
    )
    .limit(CATEGORY_PAGE_SIZE)
    .offset(offset);

  const categoryIds = rows.map((row) => row.id);
  const parentIds = Array.from(
    new Set(
      rows
        .map((row) => row.parentCategoryId)
        .filter((id): id is string => id !== null),
    ),
  );

  const [parentRows, productCountRows, childCountRows] = await Promise.all([
    parentIds.length > 0
      ? db
          .select({
            id: productCategories.id,
            code: productCategories.code,
            name: productCategories.name,
          })
          .from(productCategories)
          .where(
            and(
              eq(productCategories.organizationId, organizationId),
              inArray(productCategories.id, parentIds),
            ),
          )
      : Promise.resolve([]),

    categoryIds.length > 0
      ? db
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
      : Promise.resolve([]),

    categoryIds.length > 0
      ? db
          .select({
            parentCategoryId: productCategories.parentCategoryId,
            isActive: productCategories.isActive,
            total: count(),
          })
          .from(productCategories)
          .where(
            and(
              eq(productCategories.organizationId, organizationId),
              inArray(productCategories.parentCategoryId, categoryIds),
            ),
          )
          .groupBy(
            productCategories.parentCategoryId,
            productCategories.isActive,
          )
      : Promise.resolve([]),
  ]);

  const parentById = new Map(parentRows.map((parent) => [parent.id, parent]));

  return {
    rows: rows.map((row) => {
      const productRowsForCategory = productCountRows.filter(
        (productRow) => productRow.categoryId === row.id,
      );

      const childRowsForCategory = childCountRows.filter(
        (childRow) => childRow.parentCategoryId === row.id,
      );

      return {
        ...row,
        parent: row.parentCategoryId
          ? (parentById.get(row.parentCategoryId) ?? null)
          : null,
        productCount: productRowsForCategory.reduce(
          (sum, productRow) => sum + Number(productRow.total),
          0,
        ),
        activeProductCount: Number(
          productRowsForCategory.find(
            (productRow) => productRow.status === "active",
          )?.total ?? 0,
        ),
        childCount: childRowsForCategory.reduce(
          (sum, childRow) => sum + Number(childRow.total),
          0,
        ),
        activeChildCount: Number(
          childRowsForCategory.find((childRow) => childRow.isActive)?.total ??
            0,
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
