import type { PosAvailableItem, PosCartItem } from "@/features/pos/contracts";
import { getPosCartPricingTotals } from "@/features/pos/transaction-pricing";

export type PosCartAddIssue = {
  type: "duplicate";
  message: string;
};

export type RemovePosCartItemResult =
  | {
      status: "removed";
      items: PosCartItem[];
      removedItem: PosCartItem;
    }
  | {
      status: "not_found";
      items: PosCartItem[];
      removedItem: null;
    };

export function getPosCartItemIds(items: readonly PosCartItem[]) {
  return new Set(items.map((item) => item.id));
}

export function getPosCartSummary(items: readonly PosCartItem[]) {
  return getPosCartPricingTotals(items);
}

export function getPosCartAddIssue({
  item,
  itemIds,
}: {
  item: PosAvailableItem;
  itemIds: ReadonlySet<string>;
}): PosCartAddIssue | null {
  if (itemIds.has(item.id)) {
    return {
      type: "duplicate",
      message: `${item.sku} sudah ada di keranjang. Gunakan Edit Harga jika ingin mengubah Harga/Gram, Diskon, Ongkos, atau Round.`,
    };
  }

  return null;
}

export function removePosCartItem(
  items: PosCartItem[],
  itemId: string,
): RemovePosCartItemResult {
  const removedItem = items.find((item) => item.id === itemId) ?? null;
  const nextItems = items.filter((item) => item.id !== itemId);

  if (!removedItem) {
    return {
      status: "not_found",
      items: nextItems,
      removedItem: null,
    };
  }

  return {
    status: "removed",
    items: nextItems,
    removedItem,
  };
}
