import { NextResponse } from "next/server";

import { getReleaseInfo } from "@/lib/release-info";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "asihjaya-rms",
      timestamp: new Date().toISOString(),
      release: getReleaseInfo(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
