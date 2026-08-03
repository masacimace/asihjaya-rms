import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum diatur.");
}

const migrationsDirectory = process.env.DRIZZLE_MIGRATIONS_DIR?.trim() || "./drizzle";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: migrationsDirectory,
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
