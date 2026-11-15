export type ProductLifecycleEntity = "item" | "master";
export type ProductLifecycleOperation = "delete" | "archive" | "restore";

export type ProductLifecycleState = {
  operation: ProductLifecycleOperation;
  blockedReason: string | null;
  label: string;
  description: string;
};

export type ProductLifecycleResult = {
  status: "success" | "error";
  message: string;
  deleted?: boolean;
};

export function isProductLifecycleArchived(attributes: unknown) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return false;
  const lifecycle = (attributes as Record<string, unknown>).productLifecycle;
  return Boolean(lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle) && (lifecycle as Record<string, unknown>).archived === true);
}
