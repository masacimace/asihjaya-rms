import type {
  PosCartItem,
  PosCustomerOption,
} from "@/features/pos/contracts";
import { normalizePosTransactionWeight } from "@/features/pos/transaction-pricing";

export const POS_ACTIVE_CART_STORAGE_KEY =
  "asihjaya:pos-workspace-active-cart";

export type StoredPosCartState = {
  version: 2;
  items: PosCartItem[];
  customer: PosCustomerOption | null;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isStoredPosCartItem(value: unknown): value is PosCartItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sku === "string" &&
    typeof value.barcode === "string" &&
    typeof value.productId === "string" &&
    typeof value.productCode === "string" &&
    typeof value.productName === "string" &&
    typeof value.categoryId === "string" &&
    typeof value.categoryName === "string" &&
    (value.transactionWeightGram === undefined ||
      typeof value.transactionWeightGram === "string") &&
    (value.priceSource === undefined ||
      value.priceSource === "global" ||
      value.priceSource === "manual_override") &&
    typeof value.pricePerGram === "string" &&
    typeof value.basePriceAmount === "string" &&
    typeof value.discountAmount === "string" &&
    typeof value.laborAmount === "string" &&
    typeof value.adjustmentAmount === "string" &&
    typeof value.finalPriceAmount === "string"
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
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !Array.isArray(value.items)
  ) {
    return null;
  }

  const parsedItems = value.items.filter(isStoredPosCartItem);
  const customer = isStoredPosCustomer(value.customer) ? value.customer : null;

  if (parsedItems.length !== value.items.length) {
    return null;
  }

  const items = parsedItems.map((item) => ({
    ...item,
    transactionWeightGram:
      normalizePosTransactionWeight(item.transactionWeightGram) ??
      normalizePosTransactionWeight(item.weightGram) ??
      undefined,
    priceSource:
      item.priceSource === "manual_override" ||
      (!item.activePricePerGram || item.activePricePerGram !== item.pricePerGram)
        ? ("manual_override" as const)
        : ("global" as const),
  }));

  if (items.length === 0 && !customer) {
    return null;
  }

  return {
    version: 2,
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
  items: PosCartItem[];
  customer: PosCustomerOption | null;
  updatedAt?: string;
}): StoredPosCartState {
  return {
    version: 2,
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

    const state = parseStoredPosCartStateValue(JSON.parse(rawValue) as unknown);

    if (!state) {
      window.sessionStorage.removeItem(POS_ACTIVE_CART_STORAGE_KEY);
    }

    return state;
  } catch {
    window.sessionStorage.removeItem(POS_ACTIVE_CART_STORAGE_KEY);
    return null;
  }
}

export function saveStoredPosCartState({
  items,
  customer,
}: {
  items: PosCartItem[];
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
