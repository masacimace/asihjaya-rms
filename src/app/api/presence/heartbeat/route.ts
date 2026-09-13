import { NextResponse } from "next/server";

import { touchCurrentSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const touched = await touchCurrentSession();

  if (!touched) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return new NextResponse(null, { status: 204 });
}
