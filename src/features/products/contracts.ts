export const PRODUCT_PAGE_SIZE = 12;

export const productStatuses = ["draft", "active", "inactive"] as const;

export type ProductStatus = (typeof productStatuses)[number];

export type ProductListFilters = {
  search: string;
  categoryId: string | null;
  status: ProductStatus | null;
  page: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export function parseProductListFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ProductListFilters {
  const rawSearch = readFirst(searchParams.q).slice(0, 120);
  const rawCategoryId = readFirst(searchParams.categoryId);
  const rawStatus = readFirst(searchParams.status);
  const rawPage = Number.parseInt(readFirst(searchParams.page), 10);

  const status = productStatuses.includes(rawStatus as ProductStatus)
    ? (rawStatus as ProductStatus)
    : null;

  return {
    search: rawSearch,
    categoryId: UUID_PATTERN.test(rawCategoryId) ? rawCategoryId : null,
    status,
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}
