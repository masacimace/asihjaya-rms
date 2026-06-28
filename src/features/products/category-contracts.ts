export const CATEGORY_PAGE_SIZE = 20;

export const categoryStatuses = ["active", "inactive"] as const;

export type CategoryStatus = (typeof categoryStatuses)[number];

export const categoryTypes = ["root", "child"] as const;

export type CategoryType = (typeof categoryTypes)[number];

export type CategoryListFilters = {
  search: string;
  status: CategoryStatus | null;
  type: CategoryType | null;
  page: number;
};

export type CategoryActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialCategoryActionState: CategoryActionState = {
  status: "idle",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function parseCategoryListFilters(
  searchParams: Record<string, string | string[] | undefined>,
): CategoryListFilters {
  const rawSearch = readFirst(searchParams.q).slice(0, 120);
  const rawStatus = readFirst(searchParams.status);
  const rawType = readFirst(searchParams.type);
  const rawPage = Number.parseInt(readFirst(searchParams.page), 10);

  const status = categoryStatuses.includes(rawStatus as CategoryStatus)
    ? (rawStatus as CategoryStatus)
    : null;

  const type = categoryTypes.includes(rawType as CategoryType)
    ? (rawType as CategoryType)
    : null;

  return {
    search: rawSearch,
    status,
    type,
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}
