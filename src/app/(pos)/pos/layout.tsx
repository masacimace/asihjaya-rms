import type { ReactNode } from "react";

import { PresenceHeartbeat } from "@/components/auth/presence-heartbeat";
import { PosShell } from "@/components/layout/pos-shell";
import { getPosShellStatusWithActiveAgent } from "@/features/pos/shell-hardware-status";
import { hasPermission, requirePermission } from "@/lib/auth/session";

export default async function PosLayout({ children }: { children: ReactNode }) {
  const auth = await requirePermission("pos.access");

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  const posShellStatus = await getPosShellStatusWithActiveAgent({
    organizationId: auth.organization.id,
    outletId: primaryOutlet?.id,
  });

  return (
    <>
      <PresenceHeartbeat />
      <PosShell
        user={{
          fullName: auth.user.fullName,
          roleLabel: auth.roles[0]?.name ?? "Pengguna",
          canAccessAdmin: hasPermission(auth, "admin.access"),
          outletName: primaryOutlet?.name ?? "Outlet belum dipilih",
          canCreateProducts: hasPermission(auth, "sales.create"),
          canAccessBuybacks: hasPermission(auth, "buybacks.view"),
        }}
        status={posShellStatus}
      >
        {children}
      </PosShell>
    </>
  );
}
