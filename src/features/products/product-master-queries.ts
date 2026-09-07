import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { productCategories, productMasters } from "@/db/schema";

export type ProductMasterCategoryOption = {
  id: string;
  code: string;
  name: string;
  label: string;
  isActive: boolean;
};

export async function getProductMasterCategoryOptions(
  organizationId: string,
  includeCategoryId?: string | null,
): Promise<ProductMasterCategoryOption[]> {
  const rows = await db
    .select({
      id: productCategories.id,
      code: productCategories.code,
      name: productCategories.name,
      isActive: productCategories.isActive,
    })
    .from(productCategories)
    .where(eq(productCategories.organizationId, organizationId))
    .orderBy(asc(productCategories.name), asc(productCategories.code));

  return rows
    .filter((row) => row.isActive || row.id === includeCategoryId)
    .map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      label: row.name,
      isActive: row.isActive,
    }));
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
