import {
  productStatuses,
  type ProductStatus,
} from "@/features/products/contracts";

export type ProductMasterActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialProductMasterActionState: ProductMasterActionState = {
  status: "idle",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isProductStatus(value: string): value is ProductStatus {
  return productStatuses.includes(value as ProductStatus);
}
