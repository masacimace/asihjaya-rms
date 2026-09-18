import { NextResponse } from "next/server";

import { getPosShellStatusWithActiveAgent } from "@/features/pos/shell-hardware-status";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(auth, "pos.access")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

  const status = await getPosShellStatusWithActiveAgent({
    organizationId: auth.organization.id,
    outletId: primaryOutlet?.id,
  });

  return NextResponse.json(
    {
      status,
      generatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
