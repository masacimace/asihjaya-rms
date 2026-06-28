export const PRODUCT_ITEM_PAGE_SIZE = 20;

export type ItemAvailability = "draft" | "available" | "reserved" | "sold";
export type ItemCondition = "good" | "damaged" | "lost" | "returned";
export type ItemLocationState =
  | "outlet"
  | "warehouse"
  | "in_transit"
  | "customer"
  | "repair";

export type ProductItemListFilters = {
  search: string;
  outletId: string | null;
  availability: ItemAvailability | null;
  condition: ItemCondition | null;
  status: "active" | "archived";
  page: number;
};

export type ProductItemActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialProductItemActionState: ProductItemActionState = {
  status: "idle",
};

const AVAILABILITIES: readonly ItemAvailability[] = [
  "draft",
  "available",
  "reserved",
  "sold",
];

const CONDITIONS: readonly ItemCondition[] = [
  "good",
  "damaged",
  "lost",
  "returned",
];

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function isItemAvailability(value: string): value is ItemAvailability {
  return AVAILABILITIES.includes(value as ItemAvailability);
}

export function isItemCondition(value: string): value is ItemCondition {
  return CONDITIONS.includes(value as ItemCondition);
}

function readSearchParam(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function parseProductItemListFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ProductItemListFilters {
  const search = readSearchParam(searchParams.q).trim().slice(0, 160);
  const outletIdRaw = readSearchParam(searchParams.outletId).trim();
  const availabilityRaw = readSearchParam(searchParams.availability).trim();
  const conditionRaw = readSearchParam(searchParams.condition).trim();
  const statusRaw = readSearchParam(searchParams.status).trim();
  const parsedPage = Number.parseInt(readSearchParam(searchParams.page), 10);

  return {
    search,
    outletId: isUuid(outletIdRaw) ? outletIdRaw : null,
    availability: isItemAvailability(availabilityRaw)
      ? availabilityRaw
      : null,
    condition: isItemCondition(conditionRaw) ? conditionRaw : null,
    status: statusRaw === "archived" ? "archived" : "active",
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}
