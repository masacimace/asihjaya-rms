import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";

export async function GET() {
  try {
    await db.execute(sql`select 1`);

    return NextResponse.json({
      status: "ok",
      database: "reachable",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
