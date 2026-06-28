import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { serverEnv } from "@/lib/env";
import * as schema from "@/db/schema";

type DatabaseGlobal = typeof globalThis & {
  __asihjayaPool?: Pool;
};

const databaseGlobal = globalThis as DatabaseGlobal;

export const pool =
  databaseGlobal.__asihjayaPool ??
  new Pool({
    connectionString: serverEnv.DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 20 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  databaseGlobal.__asihjayaPool = pool;
}

export const db = drizzle(pool, { schema });
