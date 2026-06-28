import { hasPermission, type AuthContext } from "@/lib/auth/session";

export type ProductInventoryAccess = {
  canViewProducts: boolean;
  canManageProducts: boolean;
  canViewInventory: boolean;
  canReceiveInventory: boolean;
  canAdjustInventory: boolean;
  canTransferInventory: boolean;
  canViewCost: boolean;
  canManagePricing: boolean;
  canAccessProducts: boolean;
  canAccessInventory: boolean;
};

export function getProductInventoryAccess(
  auth: AuthContext,
): ProductInventoryAccess {
  const hasLegacyInventoryManage = hasPermission(auth, "inventory.manage");

  const canManageProducts = hasPermission(auth, "products.manage");
  const canViewProducts =
    canManageProducts || hasPermission(auth, "products.view");

  const canViewInventory =
    hasLegacyInventoryManage || hasPermission(auth, "inventory.view");

  const canReceiveInventory =
    hasLegacyInventoryManage || hasPermission(auth, "inventory.receive");

  const canAdjustInventory =
    hasLegacyInventoryManage || hasPermission(auth, "inventory.adjust");

  const canTransferInventory =
    hasLegacyInventoryManage || hasPermission(auth, "inventory.transfer");

  const canViewCost = hasPermission(auth, "pricing.view_cost");
  const canManagePricing = hasPermission(auth, "pricing.manage");

  return {
    canViewProducts,
    canManageProducts,
    canViewInventory,
    canReceiveInventory,
    canAdjustInventory,
    canTransferInventory,
    canViewCost,
    canManagePricing,
    canAccessProducts: canViewProducts,
    canAccessInventory:
      canViewInventory ||
      canReceiveInventory ||
      canAdjustInventory ||
      canTransferInventory,
  };
}
