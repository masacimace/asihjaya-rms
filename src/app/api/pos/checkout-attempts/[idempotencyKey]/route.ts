import { NextResponse } from "next/server";

import { getPosCheckoutRecoveryStatus } from "@/features/pos/checkout-recovery";
import { isValidPosCheckoutIdempotencyKey } from "@/features/pos/checkout-fingerprint";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    idempotencyKey: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (
    !hasPermission(auth, "pos.access") ||
    !hasPermission(auth, "sales.create")
  ) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { idempotencyKey } = await context.params;

  if (!isValidPosCheckoutIdempotencyKey(idempotencyKey)) {
    return NextResponse.json(
      {
        status: "not_found",
        message: "Checkout attempt tidak ditemukan.",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }

  const result = await getPosCheckoutRecoveryStatus({
    auth,
    idempotencyKey,
    recordRepairAudit: true,
  });

  return NextResponse.json(result, {
    status: result.status === "not_found" ? 404 : 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
