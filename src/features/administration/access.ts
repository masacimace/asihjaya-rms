import { hasPermission } from "@/lib/auth/session";

export type AdministrationAccess = {
  canManageStaff: boolean;
  canManageRoles: boolean;
  canManageOutlets: boolean;
  canAccessAdministration: boolean;
};

export function getAdministrationAccess(
  auth: Parameters<typeof hasPermission>[0],
): AdministrationAccess {
  const canManageStaff = hasPermission(auth, "staff.manage");

  const canManageRoles = hasPermission(auth, "roles.manage");

  const canManageOutlets = hasPermission(auth, "outlets.manage");

  return {
    canManageStaff,
    canManageRoles,
    canManageOutlets,

    canAccessAdministration:
      canManageStaff || canManageRoles || canManageOutlets,
  };
}
