import type { ReactNode } from "react";

import { PosShell } from "@/components/layout/pos-shell";
import { getPosShellStatus } from "@/features/pos/queries";
import { hasPermission, requirePermission } from "@/lib/auth/session";

export default async function PosLayout({ children }: { children: ReactNode }) {
  const auth = await requirePermission("pos.access");

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  const posShellStatus = await getPosShellStatus({
    organizationId: auth.organization.id,
    outletId: primaryOutlet?.id,
  });

  return (
    <PosShell
      user={{
        fullName: auth.user.fullName,
        roleLabel: auth.roles[0]?.name ?? "Pengguna",
        canAccessAdmin: hasPermission(auth, "admin.access"),
        outletName: primaryOutlet?.name ?? "Outlet belum dipilih",
      }}
      status={posShellStatus}
    >
      {children}
    </PosShell>
  );
}
