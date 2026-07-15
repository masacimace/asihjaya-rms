import { PosWorkspace } from "@/components/pos/pos-workspace";
import { getPosInitialData } from "@/features/pos/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "POS",
};

export default async function PosPage() {
  const auth = await requirePermission("pos.access");

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  const initialData = await getPosInitialData({
    organizationId: auth.organization.id,
    outletId: primaryOutlet?.id,
  });

  return (
    <PosWorkspace
      {...initialData}
      canManageShifts={auth.permissionCodes.includes("shifts.manage")}
    />
  );
}
