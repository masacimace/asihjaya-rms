import type { PosAvailableItem } from "@/features/pos/contracts";

export type PosCartAddIssue =
  | {
      type: "invalid_price";
      message: string;
    }
  | {
      type: "duplicate";
      message: string;
    };

export type RemovePosCartItemResult =
  | {
      status: "removed";
      items: PosAvailableItem[];
      removedItem: PosAvailableItem;
    }
  | {
      status: "not_found";
      items: PosAvailableItem[];
      removedItem: null;
    };

function parseCartAmount(amount: string | null) {
  if (!amount) {
    return 0;
  }

  const parsedAmount = Number(amount);

  return Number.isFinite(parsedAmount) ? parsedAmount : 0;
}

export function getPosCartItemIds(items: PosAvailableItem[]) {
  return new Set(items.map((item) => item.id));
}

export function getPosCartSubtotal(items: PosAvailableItem[]) {
  return items.reduce(
    (total, item) => total + parseCartAmount(item.sellingAmount),
    0,
  );
}

export function getPosCartAddIssue({
  item,
  itemIds,
}: {
  item: PosAvailableItem;
  itemIds: ReadonlySet<string>;
}): PosCartAddIssue | null {
  if (parseCartAmount(item.sellingAmount) <= 0) {
    return {
      type: "invalid_price",
      message: `${item.sku} belum memiliki harga jual. Lengkapi harga sebelum transaksi.`,
    };
  }

  if (itemIds.has(item.id)) {
    return {
      type: "duplicate",
      message: `${item.sku} sudah ada di keranjang.`,
    };
  }

  return null;
}

export function removePosCartItem(
  items: PosAvailableItem[],
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
