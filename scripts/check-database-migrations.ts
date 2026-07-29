import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const drizzleRoot = path.join(projectRoot, "drizzle");
const metadataRoot = path.join(drizzleRoot, "meta");
const shouldCheckDatabase = process.argv.includes("--database");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type JournalEntry = {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type Journal = {
  version: string;
  dialect: string;
  entries: JournalEntry[];
};

type Snapshot = {
  id: string;
  prevId: string;
  version: string;
  dialect: string;
};

const journalPath = path.join(metadataRoot, "_journal.json");
assert(existsSync(journalPath), "drizzle/meta/_journal.json wajib tersedia.");
const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
assert(journal.version === "7", "Versi Drizzle journal harus 7.");
assert(journal.dialect === "postgresql", "Dialect migration harus PostgreSQL.");
assert(journal.entries.length > 0, "Migration journal tidak boleh kosong.");

const tags = new Set<string>();
const snapshotIds = new Set<string>();
let previousSnapshot: Snapshot | null = null;

for (const [position, entry] of journal.entries.entries()) {
  assert(entry.idx === position, `Migration idx ${entry.idx} tidak berurutan pada posisi ${position}.`);
  assert(entry.version === journal.version, `Migration ${entry.tag} memakai versi journal berbeda.`);
  assert(Number.isSafeInteger(entry.when) && entry.when > 0, `Migration ${entry.tag} memiliki timestamp tidak valid.`);
  assert(!tags.has(entry.tag), `Migration tag duplikat: ${entry.tag}.`);
  tags.add(entry.tag);

  const expectedPrefix = String(entry.idx).padStart(4, "0");
  assert(entry.tag.startsWith(`${expectedPrefix}_`), `Migration ${entry.tag} tidak sesuai idx ${entry.idx}.`);

  const migrationPath = path.join(drizzleRoot, `${entry.tag}.sql`);
  assert(existsSync(migrationPath), `Migration SQL tidak ditemukan: drizzle/${entry.tag}.sql.`);
  const migrationSql = readFileSync(migrationPath, "utf8").trim();
  assert(migrationSql.length > 0, `Migration SQL kosong: drizzle/${entry.tag}.sql.`);
  assert(!/\bDROP\s+DATABASE\b/i.test(migrationSql), `Migration ${entry.tag} tidak boleh DROP DATABASE.`);
  assert(!/^\\(?:connect|c)\b/im.test(migrationSql), `Migration ${entry.tag} tidak boleh mengganti koneksi psql.`);

  const snapshotPath = path.join(metadataRoot, `${expectedPrefix}_snapshot.json`);
  assert(existsSync(snapshotPath), `Snapshot tidak ditemukan: drizzle/meta/${expectedPrefix}_snapshot.json.`);
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;
  assert(snapshot.version === journal.version, `Snapshot ${expectedPrefix} memakai versi berbeda.`);
  assert(snapshot.dialect === journal.dialect, `Snapshot ${expectedPrefix} memakai dialect berbeda.`);
  assert(!snapshotIds.has(snapshot.id), `Snapshot ID duplikat: ${snapshot.id}.`);
  snapshotIds.add(snapshot.id);

  if (entry.idx === 0) {
    assert(
      snapshot.prevId === "00000000-0000-0000-0000-000000000000",
      "Snapshot baseline harus memakai zero prevId.",
    );
  } else if (entry.idx >= 2 && previousSnapshot) {
    assert(
      snapshot.prevId === previousSnapshot.id,
      `Rantai snapshot ${expectedPrefix} tidak menunjuk snapshot sebelumnya.`,
    );
  }

  previousSnapshot = snapshot;
}

const migrationFiles = readdirSync(drizzleRoot)
  .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
  .sort();
const expectedMigrationFiles = journal.entries.map((entry) => `${entry.tag}.sql`).sort();
assert(
  JSON.stringify(migrationFiles) === JSON.stringify(expectedMigrationFiles),
  "Daftar migration SQL dan Drizzle journal tidak sinkron.",
);

async function checkLiveDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  assert(databaseUrl, "DATABASE_URL wajib diatur untuk check:database:live.");

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const versionResult = await pool.query<{ server_version_num: string }>(
      "select current_setting('server_version_num') as server_version_num",
    );
    const majorVersion = Number(versionResult.rows[0]?.server_version_num.slice(0, 2));
    assert(majorVersion === 17, `Database rehearsal harus PostgreSQL 17, ditemukan versi ${majorVersion}.`);

    const migrationTableResult = await pool.query<{ migration_table: string | null }>(
      "select to_regclass('drizzle.__drizzle_migrations')::text as migration_table",
    );
    assert(
      migrationTableResult.rows[0]?.migration_table === "drizzle.__drizzle_migrations",
      "Tabel drizzle.__drizzle_migrations belum tersedia.",
    );

    const migrationCountResult = await pool.query<{ migration_count: number }>(
      "select count(*)::int as migration_count from drizzle.__drizzle_migrations",
    );
    assert(
      migrationCountResult.rows[0]?.migration_count === journal.entries.length,
      `Database memiliki ${migrationCountResult.rows[0]?.migration_count ?? 0} migration, journal memiliki ${journal.entries.length}.`,
    );

    const requiredTables = [
      "organizations",
      "outlets",
      "users",
      "sales",
      "hardware_agents",
      "hardware_jobs",
      "customer_deposit_ledger",
      "customer_history_credentials",
      "customer_history_sessions",
      "customer_history_ip_rate_limits",
      "security_rate_limits",
      "legacy_product_import_batches",
      "legacy_product_rows",
      "item_barcodes",
    ];

    const tableResult = await pool.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public' and table_name = any($1::text[])`,
      [requiredTables],
    );
    const existingTables = new Set(tableResult.rows.map((row) => row.table_name));
    const missingTables = requiredTables.filter((tableName) => !existingTables.has(tableName));
    assert(missingTables.length === 0, `Tabel hasil migration belum lengkap: ${missingTables.join(", ")}.`);

    const requiredColumns = new Map<string, string[]>([
      ["organizations", ["timezone"]],
      ["hardware_agents", ["secret_hash"]],
      ["customer_history_credentials", ["pin_hash", "credential_version", "must_change_pin"]],
      ["customer_history_sessions", ["token_hash", "absolute_expires_at", "idle_expires_at"]],
      ["security_rate_limits", ["scope", "key_hash", "attempt_count", "blocked_until"]],
      ["legacy_product_import_batches", ["file_hash", "validation_summary", "status"]],
      ["legacy_product_rows", ["normalized_barcode", "validation_status", "row_fingerprint"]],
      ["item_barcodes", ["barcode_value", "source", "is_primary", "is_active"]],
    ]);

    for (const [tableName, columns] of requiredColumns) {
      const columnResult = await pool.query<{ column_name: string }>(
        `select column_name
         from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = any($2::text[])`,
        [tableName, columns],
      );
      const existingColumns = new Set(columnResult.rows.map((row) => row.column_name));
      const missingColumns = columns.filter((columnName) => !existingColumns.has(columnName));
      assert(
        missingColumns.length === 0,
        `Kolom ${tableName} belum lengkap: ${missingColumns.join(", ")}.`,
      );
    }
  } finally {
    await pool.end();
  }
}

if (shouldCheckDatabase) {
  await checkLiveDatabase();
  console.log(
    `OK: ${journal.entries.length} migration dan schema PostgreSQL 17 hasil rehearsal tervalidasi.`,
  );
} else {
  console.log(
    `OK: metadata ${journal.entries.length} migration, SQL, journal, dan snapshot tervalidasi.`,
  );
}
