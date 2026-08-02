import type {
  PosAvailableItem,
  PosCustomerOption,
} from "@/features/pos/contracts";

export const POS_ACTIVE_CART_STORAGE_KEY =
  "asihjaya:pos-workspace-active-cart";

export type StoredPosCartState = {
  version: 1;
  items: PosAvailableItem[];
  customer: PosCustomerOption | null;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isStoredPosAvailableItem(
  value: unknown,
): value is PosAvailableItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sku === "string" &&
    typeof value.barcode === "string" &&
    typeof value.productId === "string" &&
    typeof value.productCode === "string" &&
    typeof value.productName === "string" &&
    typeof value.categoryId === "string" &&
    typeof value.categoryName === "string"
  );
}

export function isStoredPosCustomer(
  value: unknown,
): value is PosCustomerOption {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.fullName === "string"
  );
}

export function parseStoredPosCartStateValue(
  value: unknown,
  fallbackUpdatedAt = new Date().toISOString(),
): StoredPosCartState | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }

  const items = value.items.filter(isStoredPosAvailableItem);
  const customer = isStoredPosCustomer(value.customer) ? value.customer : null;

  if (items.length === 0 && !customer) {
    return null;
  }

  return {
    version: 1,
    items,
    customer,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : fallbackUpdatedAt,
  };
}

export function createStoredPosCartState({
  items,
  customer,
  updatedAt = new Date().toISOString(),
}: {
  items: PosAvailableItem[];
  customer: PosCustomerOption | null;
  updatedAt?: string;
}): StoredPosCartState {
  return {
    version: 1,
    items,
    customer,
    updatedAt,
  };
}

export function getStoredPosCartState(): StoredPosCartState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(POS_ACTIVE_CART_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    return parseStoredPosCartStateValue(JSON.parse(rawValue) as unknown);
  } catch {
    window.sessionStorage.removeItem(POS_ACTIVE_CART_STORAGE_KEY);
    return null;
  }
}

export function saveStoredPosCartState({
  items,
  customer,
}: {
  items: PosAvailableItem[];
  customer: PosCustomerOption | null;
}) {
  if (typeof window === "undefined") {
    return;
  }

  if (items.length === 0 && !customer) {
    removeStoredPosCartState();
    return;
  }

  window.sessionStorage.setItem(
    POS_ACTIVE_CART_STORAGE_KEY,
    JSON.stringify(createStoredPosCartState({ items, customer })),
  );
}

export function removeStoredPosCartState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(POS_ACTIVE_CART_STORAGE_KEY);
}
