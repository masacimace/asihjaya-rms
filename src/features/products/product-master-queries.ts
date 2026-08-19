import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { productCategories, productMasters } from "@/db/schema";

export type ProductMasterCategoryOption = {
  id: string;
  code: string;
  name: string;
  label: string;
  parentCategoryId: string | null;
  isActive: boolean;
};

export async function getProductMasterCategoryOptions(
  organizationId: string,
  includeCategoryId?: string | null,
): Promise<ProductMasterCategoryOption[]> {
  const rows = await db
    .select({
      id: productCategories.id,
      parentCategoryId: productCategories.parentCategoryId,
      code: productCategories.code,
      name: productCategories.name,
      displayOrder: productCategories.displayOrder,
      isActive: productCategories.isActive,
    })
    .from(productCategories)
    .where(eq(productCategories.organizationId, organizationId))
    .orderBy(
      asc(productCategories.displayOrder),
      asc(productCategories.name),
    );

  const categoryById = new Map(rows.map((row) => [row.id, row]));

  return rows
    .filter((row) => row.isActive || row.id === includeCategoryId)
    .map((row) => {
      const parent = row.parentCategoryId
        ? categoryById.get(row.parentCategoryId)
        : null;

      return {
        id: row.id,
        code: row.code,
        name: row.name,
        label: parent ? `${parent.name} / ${row.name}` : row.name,
        parentCategoryId: row.parentCategoryId,
        isActive: row.isActive,
      };
    });
}


export type ProductMasterOption = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  status: "draft" | "active" | "inactive";
};

export async function getActiveProductMasterOptions(
  organizationId: string,
): Promise<ProductMasterOption[]> {
  return db
    .select({
      id: productMasters.id,
      categoryId: productMasters.categoryId,
      code: productMasters.code,
      name: productMasters.name,
      status: productMasters.status,
    })
    .from(productMasters)
    .where(
      and(
        eq(productMasters.organizationId, organizationId),
        eq(productMasters.status, "active"),
      ),
    )
    .orderBy(asc(productMasters.name), asc(productMasters.code));
}
