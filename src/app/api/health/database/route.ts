import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();

  try {
    // Database baru di-import ketika endpoint benar-benar dipanggil.
    const { db } = await import("@/db");

    await db.execute(sql`select 1`);

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health/database] Database health check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      },
      {
        status: 503,
      },
    );
  }
}
