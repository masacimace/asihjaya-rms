import type { ReactNode } from "react";

import { AdminShell } from "@/components/layout/admin-shell";
import { getAdministrationAccess } from "@/features/administration/access";
import { canAccessApprovalInbox } from "@/features/approvals/authorization";
import { getAdminApprovalDrawerData } from "@/features/approvals/queries";
import { getAdminNotificationDrawerData } from "@/features/notifications/queries";
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
  const [approvalDrawerData, notificationDrawerData] = await Promise.all([
    getAdminApprovalDrawerData(auth),
    getAdminNotificationDrawerData(auth),
  ]);

  return (
    <AdminShell
      user={{
        fullName: auth.user.fullName,
        roleLabel: auth.roles[0]?.name ?? "Pengguna",
        canAccessPos: hasPermission(auth, "pos.access"),
        canAccessAdministration: administrationAccess.canAccessAdministration,
        canAccessProducts: productInventoryAccess.canAccessProducts,
        canAccessInventory: productInventoryAccess.canAccessInventory,
        canAccessMigration:
          hasPermission(auth, "migration.view") ||
          hasPermission(auth, "migration.import") ||
          hasPermission(auth, "migration.mapping.manage") ||
          hasPermission(auth, "migration.session.manage") ||
          hasPermission(auth, "migration.verification.review") ||
          hasPermission(auth, "migration.verification.approve") ||
          hasPermission(auth, "migration.cutover.execute"),
        canAccessApprovals: canAccessApprovalInbox(auth),
        canAccessSettings: hasPermission(auth, "settings.manage"),
        canAccessReconciliation: hasPermission(
          auth,
          "payments.reconciliation.view",
        ),
        canImportReconciliation: hasPermission(
          auth,
          "payments.reconciliation.import",
        ),
      }}
      approvalDrawerData={approvalDrawerData}
      notificationDrawerData={notificationDrawerData}
    >
      {children}
    </AdminShell>
  );
}
