import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { productItems } from "@/db/schema";

export type InventorySaleClaimTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export type ClaimProductItemsForSaleInput = {
  organizationId: string;
  outletId: string;
  itemIds: string[];
  now?: Date;
};

export type ClaimProductItemsForSaleResult = {
  claimedItemIds: string[];
  allClaimed: boolean;
};

/**
 * Atomically moves currently sellable items to sold/customer state.
 *
 * The conditional UPDATE is the final concurrency guard for POS checkout. Two
 * transactions may read the same item as available, but only one transaction
 * can satisfy the UPDATE predicate and claim it.
 */
export async function claimProductItemsForSale(
  transaction: InventorySaleClaimTransaction,
  input: ClaimProductItemsForSaleInput,
): Promise<ClaimProductItemsForSaleResult> {
  const itemIds = Array.from(new Set(input.itemIds));

  if (itemIds.length === 0) {
    return { claimedItemIds: [], allClaimed: false };
  }

  const claimedRows = await transaction
    .update(productItems)
    .set({
      availability: "sold",
      locationState: "customer",
      updatedAt: input.now ?? new Date(),
    })
    .where(
      and(
        eq(productItems.organizationId, input.organizationId),
        inArray(productItems.id, itemIds),
        eq(productItems.currentOutletId, input.outletId),
        eq(productItems.isActive, true),
        eq(productItems.availability, "available"),
        inArray(productItems.condition, ["good", "used"]),
        eq(productItems.locationState, "outlet"),
      ),
    )
    .returning({ id: productItems.id });

  return {
    claimedItemIds: claimedRows.map((row: { id: string }) => row.id),
    allClaimed: claimedRows.length === itemIds.length,
  };
}
