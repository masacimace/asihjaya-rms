import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  productItems,
  productMasters,
  saleItems,
  sales,
} from "@/db/schema";

export type AdminSaleListImagePreview = {
  productItemId: string;
  imageKey: string | null;
};

const ADMIN_SALE_LIST_IMAGE_PREVIEW_LIMIT = 3;

export async function getAdminSaleListImagePreviews({
  organizationId,
  saleIds,
  productItemIds,
}: {
  organizationId: string;
  saleIds: string[];
  productItemIds: string[];
}) {
  const imagePreviewsBySaleId = new Map<
    string,
    AdminSaleListImagePreview[]
  >();

  if (saleIds.length === 0 || productItemIds.length === 0) {
    return imagePreviewsBySaleId;
  }

  const rows = await db
    .select({
      saleId: saleItems.saleId,
      productItemId: saleItems.productItemId,
      imageKey: sql<string | null>`coalesce(
        nullif(${saleItems.snapshot}->>'imageKey', ''),
        nullif(${saleItems.snapshot}->>'productImageKey', ''),
        ${productItems.imageKey},
        ${productMasters.imageKey}
      )`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
    .innerJoin(
      productMasters,
      eq(productItems.productMasterId, productMasters.id),
    )
    .where(
      and(
        eq(sales.organizationId, organizationId),
        inArray(saleItems.saleId, saleIds),
        inArray(saleItems.productItemId, productItemIds),
      ),
    )
    .orderBy(asc(saleItems.saleId), asc(saleItems.lineNumber));

  for (const row of rows) {
    const previews = imagePreviewsBySaleId.get(row.saleId) ?? [];

    if (previews.length >= ADMIN_SALE_LIST_IMAGE_PREVIEW_LIMIT) {
      continue;
    }

    previews.push({
      productItemId: row.productItemId,
      imageKey: row.imageKey,
    });
    imagePreviewsBySaleId.set(row.saleId, previews);
  }

  return imagePreviewsBySaleId;
}
