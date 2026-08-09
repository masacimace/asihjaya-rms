import "dotenv/config";

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
      "legacy_product_master_mappings",
      "legacy_migration_sessions",
      "legacy_migration_session_assignments",
      "legacy_migration_verifications",
      "legacy_migration_sold_records",
      "legacy_migration_cutover_runs",
      "item_barcodes",
      "finance_closing_snapshots",
      "telegram_destinations",
      "telegram_report_settings",
      "telegram_delivery_outbox",
      "telegram_delivery_attempts",
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
      [
        "legacy_product_master_mappings",
        ["legacy_master_code", "item_count", "status", "target_product_master_id"],
      ],
      [
        "legacy_migration_sessions",
        ["batch_id", "name", "location_code", "status"],
      ],
      [
        "legacy_migration_session_assignments",
        ["session_id", "user_id", "assignment_role"],
      ],
      [
        "legacy_migration_verifications",
        [
          "session_id",
          "barcode_value",
          "source",
          "status",
          "target_product_master_id",
          "submission_fingerprint",
          "submitted_by",
          "product_item_id",
          "revision",
        ],
      ],
      [
        "legacy_migration_sold_records",
        [
          "batch_id",
          "barcode_value",
          "verification_id",
          "product_item_id",
          "previous_verification_status",
          "previous_item_availability",
          "sold_at",
          "reported_by",
          "reverted_at",
          "revert_reason",
        ],
      ],
      [
        "legacy_migration_cutover_runs",
        [
          "batch_id",
          "session_id",
          "organization_id",
          "outlet_id",
          "item_count",
          "executed_by",
          "executed_at",
          "metadata",
        ],
      ],
      ["item_barcodes", ["barcode_value", "source", "is_primary", "is_active"]],
      ["shifts", ["business_date"]],
      ["sale_items", ["cost_amount_snapshot"]],
      [
        "finance_closing_snapshots",
        [
          "shift_id",
          "organization_id",
          "outlet_id",
          "business_date",
          "revision",
          "superseded_at",
          "superseded_by_user_id",
          "superseded_reason",
          "gross_sales",
          "discount_total",
          "net_sales",
          "cost_snapshot_complete",
          "cost_of_goods",
          "gross_margin",
          "gross_margin_rate",
          "cash_total",
          "bank_transfer_total",
          "debit_card_total",
          "credit_card_total",
          "customer_deposit_opening_balance",
          "customer_deposit_in",
          "customer_deposit_used",
          "customer_deposit_withdrawal",
          "customer_deposit_adjustment_in",
          "customer_deposit_adjustment_out",
          "customer_deposit_closing_balance",
          "expected_cash",
          "actual_cash",
          "cash_variance",
          "transaction_count",
          "items_sold_count",
          "held_transaction_count",
          "pending_approval_count",
          "opened_at",
          "closed_at",
          "cashier_id",
        ],
      ],
      [
        "telegram_destinations",
        [
          "organization_id",
          "outlet_id",
          "name",
          "chat_id",
          "destination_type",
          "is_active",
          "created_by",
          "updated_by",
        ],
      ],
      [
        "telegram_report_settings",
        [
          "destination_id",
          "opening_enabled",
          "closing_daily_enabled",
          "weekly_enabled",
          "monthly_enabled",
          "timezone",
          "is_active",
        ],
      ],
      [
        "telegram_delivery_outbox",
        [
          "event_key",
          "destination_id",
          "outlet_id",
          "report_type",
          "business_date",
          "period_start",
          "period_end",
          "payload_snapshot_json",
          "message_text",
          "status",
          "attempt_count",
          "max_attempts",
          "next_attempt_at",
          "locked_at",
          "locked_by",
          "sent_at",
          "telegram_message_id",
          "last_error_code",
          "last_error_message",
        ],
      ],
      [
        "telegram_delivery_attempts",
        [
          "delivery_id",
          "attempt_number",
          "requested_at",
          "completed_at",
          "http_status",
          "telegram_ok",
          "telegram_error_code",
          "telegram_error_description",
          "telegram_message_id",
          "duration_ms",
        ],
      ],
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

    const requiredIndexes = [
      "legacy_migration_verifications_org_barcode_uq",
      "legacy_migration_verifications_legacy_row_uq",
      "legacy_migration_verifications_session_status_idx",
      "legacy_migration_verifications_product_item_uq",
      "legacy_migration_sold_records_org_barcode_active_uq",
      "legacy_migration_sold_records_batch_sold_at_idx",
      "legacy_migration_sold_records_verification_idx",
      "legacy_migration_cutover_runs_session_uq",
      "legacy_migration_cutover_runs_batch_time_idx",
      "item_barcodes_item_value_uq",
      "item_barcodes_org_active_value_uq",
      "item_barcodes_item_active_primary_uq",
      "inventory_movements_migration_opening_item_uq",
      "shifts_outlet_business_date_uq",
      "finance_closing_snapshots_shift_revision_uq",
      "finance_closing_snapshots_outlet_date_revision_uq",
      "finance_closing_snapshots_current_shift_uq",
      "finance_closing_snapshots_current_outlet_date_uq",
      "telegram_destinations_chat_id_uq",
      "telegram_destinations_one_active_per_outlet_uq",
      "telegram_report_settings_destination_uq",
      "telegram_delivery_outbox_event_destination_uq",
      "telegram_delivery_outbox_status_next_attempt_idx",
      "telegram_delivery_attempts_delivery_number_uq",
    ];
    const indexResult = await pool.query<{ indexname: string }>(
      `select indexname
       from pg_indexes
       where schemaname = 'public' and indexname = any($1::text[])`,
      [requiredIndexes],
    );
    const existingIndexes = new Set(
      indexResult.rows.map((row) => row.indexname),
    );
    const missingIndexes = requiredIndexes.filter(
      (indexName) => !existingIndexes.has(indexName),
    );
    assert(
      missingIndexes.length === 0,
      `Index migration verification belum lengkap: ${missingIndexes.join(", ")}.`,
    );

    const requiredConstraints = [
      "legacy_migration_verifications_source_ck",
      "legacy_migration_verifications_weight_ck",
      "legacy_migration_verifications_purity_ck",
      "legacy_migration_verifications_photo_ck",
      "legacy_migration_verifications_revision_ck",
      "sale_items_cost_snapshot_nonnegative_ck",
      "finance_closing_snapshots_cost_state_ck",
      "finance_closing_snapshots_revision_positive_ck",
      "finance_closing_snapshots_superseded_state_ck",
      "telegram_delivery_outbox_attempts_ck",
      "telegram_delivery_outbox_processing_lock_ck",
      "telegram_delivery_outbox_sent_state_ck",
      "telegram_delivery_attempts_number_positive_ck",
    ];
    const constraintResult = await pool.query<{ conname: string }>(
      `select constraint_record.conname
       from pg_constraint as constraint_record
       inner join pg_class as table_record
         on table_record.oid = constraint_record.conrelid
       inner join pg_namespace as namespace_record
         on namespace_record.oid = table_record.relnamespace
       where namespace_record.nspname = 'public'
         and constraint_record.conname = any($1::text[])`,
      [requiredConstraints],
    );
    const existingConstraints = new Set(
      constraintResult.rows.map((row) => row.conname),
    );
    const missingConstraints = requiredConstraints.filter(
      (constraintName) => !existingConstraints.has(constraintName),
    );
    assert(
      missingConstraints.length === 0,
      `Constraint migration verification belum lengkap: ${missingConstraints.join(", ")}.`,
    );

    const soldConstraints = [
      "legacy_migration_sold_records_link_ck",
      "legacy_migration_sold_records_revert_ck",
    ];
    const soldConstraintResult = await pool.query<{ conname: string }>(
      `select constraint_record.conname
       from pg_constraint as constraint_record
       inner join pg_class as table_record
         on table_record.oid = constraint_record.conrelid
       inner join pg_namespace as namespace_record
         on namespace_record.oid = table_record.relnamespace
       where namespace_record.nspname = 'public'
         and table_record.relname = 'legacy_migration_sold_records'
         and constraint_record.conname = any($1::text[])`,
      [soldConstraints],
    );
    const existingSoldConstraints = new Set(
      soldConstraintResult.rows.map((row) => row.conname),
    );
    const missingSoldConstraints = soldConstraints.filter(
      (constraintName) => !existingSoldConstraints.has(constraintName),
    );
    assert(
      missingSoldConstraints.length === 0,
      `Constraint sold during migration belum lengkap: ${missingSoldConstraints.join(", ")}.`,
    );

    const cutoverConstraintResult = await pool.query<{ conname: string }>(
      `select constraint_record.conname
       from pg_constraint as constraint_record
       inner join pg_class as table_record
         on table_record.oid = constraint_record.conrelid
       inner join pg_namespace as namespace_record
         on namespace_record.oid = table_record.relnamespace
       where namespace_record.nspname = 'public'
         and table_record.relname = 'legacy_migration_cutover_runs'
         and constraint_record.conname = 'legacy_migration_cutover_runs_item_count_ck'`,
    );
    assert(
      cutoverConstraintResult.rows.length === 1,
      "Constraint cutover item count belum tersedia.",
    );

    const barcodeNamespaceConstraints = [
      "product_items_barcode_not_blank_ck",
      "item_barcodes_barcode_not_blank_ck",
    ];
    const barcodeConstraintResult = await pool.query<{ conname: string }>(
      `select constraint_record.conname
       from pg_constraint as constraint_record
       inner join pg_class as table_record
         on table_record.oid = constraint_record.conrelid
       inner join pg_namespace as namespace_record
         on namespace_record.oid = table_record.relnamespace
       where namespace_record.nspname = 'public'
         and constraint_record.conname = any($1::text[])`,
      [barcodeNamespaceConstraints],
    );
    const existingBarcodeConstraints = new Set(
      barcodeConstraintResult.rows.map((row) => row.conname),
    );
    const missingBarcodeConstraints = barcodeNamespaceConstraints.filter(
      (constraintName) => !existingBarcodeConstraints.has(constraintName),
    );
    assert(
      missingBarcodeConstraints.length === 0,
      `Constraint namespace barcode belum lengkap: ${missingBarcodeConstraints.join(", ")}.`,
    );

    const barcodeBackfillResult = await pool.query<{ missing_count: number }>(
      `select count(*)::int as missing_count
       from product_items as item
       where not exists (
         select 1
         from item_barcodes as alias
         where alias.organization_id = item.organization_id
           and alias.item_id = item.id
           and alias.barcode_value = item.barcode
           and alias.is_active = true
       )`,
    );
    assert(
      barcodeBackfillResult.rows[0]?.missing_count === 0,
      `Masih ada ${barcodeBackfillResult.rows[0]?.missing_count ?? 0} product item tanpa alias barcode internal aktif.`,
    );

    const movementEnumResult = await pool.query<{ enumlabel: string }>(
      `select enum_value.enumlabel
       from pg_enum as enum_value
       inner join pg_type as enum_type on enum_type.oid = enum_value.enumtypid
       where enum_type.typname = 'inventory_movement_type'`,
    );
    assert(
      movementEnumResult.rows.some(
        (row) => row.enumlabel === "migration_opening",
      ),
      "Enum inventory_movement_type harus memiliki migration_opening.",
    );

    const availabilityEnumResult = await pool.query<{ enumlabel: string }>(
      `select enum_value.enumlabel
       from pg_enum as enum_value
       inner join pg_type as enum_type on enum_type.oid = enum_value.enumtypid
       where enum_type.typname = 'item_availability'`,
    );
    assert(
      availabilityEnumResult.rows.some(
        (row) => row.enumlabel === "migration_hold",
      ),
      "Enum item_availability harus memiliki migration_hold.",
    );
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
