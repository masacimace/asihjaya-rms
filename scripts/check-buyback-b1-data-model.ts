import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  assert(existsSync(file), `${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

const schema = read("src/db/schema/index.ts");

assert(
  /itemAvailabilityEnum\s*=\s*pgEnum\("item_availability",\s*\[[\s\S]*?"processing"[\s\S]*?\]\);/.test(
    schema,
  ),
  "item_availability wajib mempunyai state processing.",
);
assert(
  schema.includes('pgEnum("buyback_processing_type", [') &&
    schema.includes('"cleaning"') &&
    schema.includes('"recondition"'),
  "Enum buyback_processing_type wajib menyediakan cleaning dan recondition.",
);
assert(
  schema.includes('pgEnum("buyback_processing_status", [') &&
    schema.includes('"pending"') &&
    schema.includes('"completed"'),
  "Enum buyback_processing_status wajib menyediakan pending dan completed.",
);
assert(
  schema.includes('export const buybackItemProcessings = pgTable(') &&
    schema.includes('"buyback_item_processings"'),
  "Tabel buyback_item_processings wajib tersedia pada schema.",
);
assert(
  schema.includes('buybackItemId: uuid("buyback_item_id")') &&
    schema.includes('processingType: buybackProcessingTypeEnum("processing_type").notNull()') &&
    schema.includes('status: buybackProcessingStatusEnum("status").default("pending").notNull()'),
  "Processing wajib terikat ke buyback item dan default ke pending.",
);
assert(
  schema.includes('resultProductItemId: uuid("result_product_item_id")') &&
    schema.includes('resultSnapshot: jsonb("result_snapshot")') &&
    schema.includes('processedBy: uuid("processed_by")') &&
    schema.includes('processedAt: timestamp("processed_at"'),
  "Result processing wajib menyimpan item hasil, snapshot, operator, dan waktu proses.",
);
assert(
  schema.includes('uniqueIndex("buyback_item_processings_buyback_item_uq")'),
  "Satu buyback item hanya boleh memiliki satu processing lifecycle.",
);
assert(
  schema.includes('"buyback_item_processings_completion_ck"'),
  "Completion invariant processing wajib tersedia.",
);

const journal = JSON.parse(read("drizzle/meta/_journal.json")) as {
  entries?: Array<{ idx?: number; tag?: string }>;
};
const lastEntry = journal.entries?.at(-1);
assert(lastEntry?.idx === 22, "Migration B1 harus menjadi idx 22 setelah R4/0021.");
assert(
  lastEntry?.tag === "0022_buyback_processing_lifecycle",
  "Migration B1 harus bernama 0022_buyback_processing_lifecycle.",
);

const migrationPath = "drizzle/0022_buyback_processing_lifecycle.sql";
const migration = read(migrationPath);
assert(
  /ALTER TYPE\s+"public"\."item_availability"\s+ADD VALUE(?: IF NOT EXISTS)?\s+'processing'/i.test(
    migration,
  ),
  "Migration harus menambahkan item_availability=processing.",
);
assert(
  migration.includes('CREATE TYPE "public"."buyback_processing_type"') &&
    migration.includes("'cleaning'") &&
    migration.includes("'recondition'"),
  "Migration harus membuat enum type Cuci/Rongsok.",
);
assert(
  migration.includes('CREATE TYPE "public"."buyback_processing_status"') &&
    migration.includes("'pending'") &&
    migration.includes("'completed'"),
  "Migration harus membuat enum status processing.",
);
assert(
  migration.includes('CREATE TABLE "buyback_item_processings"'),
  "Migration harus membuat buyback_item_processings.",
);
assert(
  migration.includes('"buyback_item_id" uuid NOT NULL') &&
    migration.includes('"processing_type" "buyback_processing_type" NOT NULL') &&
    migration.includes('"status" "buyback_processing_status" DEFAULT \'pending\' NOT NULL'),
  "Kolom lifecycle processing pada migration belum lengkap.",
);
assert(
  migration.includes('buyback_item_processings_buyback_item_uq') &&
    migration.includes('buyback_item_processings_completion_ck'),
  "Migration harus membawa unique guard dan completion invariant.",
);
assert(
  !/INSERT\s+INTO\s+"buyback_item_processings"/i.test(migration) &&
    !/UPDATE\s+"product_items"/i.test(migration),
  "B1 tidak boleh backfill processing atau mengubah state inventory lama.",
);

const snapshotPath = "drizzle/meta/0022_snapshot.json";
const snapshot = read(snapshotPath);
assert(
  snapshot.includes('"public.buyback_item_processings"') &&
    snapshot.includes('"public.buyback_processing_type"') &&
    snapshot.includes('"public.buyback_processing_status"'),
  "Snapshot 0022 belum merekam processing domain.",
);

console.log("OK: B1 Buyback Data Model & Lifecycle contract valid.");
