import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getOnlinePresence,
  getPresenceActivities,
} from "@/features/presence/server";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (!hasPermission(auth, "admin.access")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";

  if (userId) {
    const activity = await getPresenceActivities(auth, userId);

    if (!activity) {
      return NextResponse.json({ error: "USER_NOT_ONLINE" }, { status: 404 });
    }

    return NextResponse.json(activity, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const presence = await getOnlinePresence(auth);

  return NextResponse.json(presence, {
    headers: { "Cache-Control": "no-store" },
  });
}
