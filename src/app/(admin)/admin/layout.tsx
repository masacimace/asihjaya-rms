import type { ReactNode } from "react";

import { AdminShell } from "@/components/layout/admin-shell";
import { getAdministrationAccess } from "@/features/administration/access";
import { getProductInventoryAccess } from "@/features/products/access";
import { hasPermission, requirePermission } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const auth = await requirePermission("admin.access");

  const administrationAccess = getAdministrationAccess(auth);
  const productInventoryAccess = getProductInventoryAccess(auth);

  return (
    <AdminShell
      user={{
        fullName: auth.user.fullName,
        roleLabel: auth.roles[0]?.name ?? "Pengguna",
        canAccessPos: hasPermission(auth, "pos.access"),
        canAccessAdministration: administrationAccess.canAccessAdministration,
        canAccessProducts: productInventoryAccess.canAccessProducts,
        canAccessInventory: productInventoryAccess.canAccessInventory,
      }}
    >
      {children}
    </AdminShell>
  );
}
