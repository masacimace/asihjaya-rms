import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import pg, { type PoolClient } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur.");
}

const TARGET_MIGRATIONS = [
  "0020_p1c2_settlement_import_auto_matching",
  "0021_p1c2_import_permission_hotfix",
  "0022_p1c2_import_permission_schema_repair",
] as const;

type JournalEntry = {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type MigrationRecord = {
  tag: (typeof TARGET_MIGRATIONS)[number];
  createdAt: number;
  hash: string;
};

type ExistingMigrationRow = {
  hash: string;
  created_at: string;
};

function hasApplyFlag() {
  return process.argv.slice(2).includes("--apply");
}

async function loadMigrationRecords(): Promise<MigrationRecord[]> {
  const drizzleDirectory = path.resolve(process.cwd(), "drizzle");
  const journalPath = path.join(drizzleDirectory, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
    entries: JournalEntry[];
  };

  return Promise.all(
    TARGET_MIGRATIONS.map(async (tag) => {
      const entry = journal.entries.find((candidate) => candidate.tag === tag);

      if (!entry) {
        throw new Error(`Journal tidak memiliki entry ${tag}.`);
      }

      const sql = await readFile(path.join(drizzleDirectory, `${tag}.sql`), "utf8");

      return {
        tag,
        createdAt: entry.when,
        hash: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}

async function assertSchemaObjects(client: PoolClient) {
  const typeResult = await client.query<{ typname: string }>(`
    select type_record.typname
    from pg_type type_record
    where type_record.typname in (
      'settlement_import_row_status',
      'settlement_import_status'
    )
  `);
  const existingTypes = new Set(typeResult.rows.map((row) => row.typname));
  const requiredTypes = [
    "settlement_import_row_status",
    "settlement_import_status",
  ];
  const missingTypes = requiredTypes.filter((name) => !existingTypes.has(name));

  if (missingTypes.length > 0) {
    throw new Error(
      `Schema P1-C.2 belum lengkap. Enum hilang: ${missingTypes.join(", ")}.`,
    );
  }

  const tableResult = await client.query<{
    batches: string | null;
    mappings: string | null;
    rows: string | null;
  }>(`
    select
      to_regclass('public.settlement_import_batches')::text as batches,
      to_regclass('public.settlement_import_mappings')::text as mappings,
      to_regclass('public.settlement_import_rows')::text as rows
  `);
  const tables = tableResult.rows[0];
  const missingTables = [
    ["settlement_import_batches", tables?.batches],
    ["settlement_import_mappings", tables?.mappings],
    ["settlement_import_rows", tables?.rows],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingTables.length > 0) {
    throw new Error(
      `Schema P1-C.2 belum lengkap. Tabel hilang: ${missingTables.join(", ")}.`,
    );
  }

  const indexResult = await client.query<{ object_name: string }>(`
    select index_record.relname as object_name
    from pg_class index_record
    join pg_namespace namespace_record
      on namespace_record.oid = index_record.relnamespace
    where namespace_record.nspname = 'public'
      and index_record.relkind = 'i'
      and index_record.relname in (
        'settlement_import_batches_org_hash_uq',
        'settlement_import_mappings_profile_uq',
        'settlement_import_rows_batch_row_uq'
      )
  `);
  const existingIndexes = new Set(
    indexResult.rows.map((row) => row.object_name),
  );
  const requiredIndexes = [
    "settlement_import_batches_org_hash_uq",
    "settlement_import_mappings_profile_uq",
    "settlement_import_rows_batch_row_uq",
  ];
  const missingIndexes = requiredIndexes.filter(
    (name) => !existingIndexes.has(name),
  );

  if (missingIndexes.length > 0) {
    throw new Error(
      `Schema P1-C.2 belum lengkap. Index hilang: ${missingIndexes.join(", ")}.`,
    );
  }

  const foreignKeyResult = await client.query<{ relationship_key: string }>(`
    select
      source_table.relname
        || '.'
        || source_column.attname
        || '->'
        || target_table.relname
        || '.'
        || target_column.attname as relationship_key
    from pg_constraint constraint_record
    join pg_class source_table
      on source_table.oid = constraint_record.conrelid
    join pg_namespace source_namespace
      on source_namespace.oid = source_table.relnamespace
    join pg_class target_table
      on target_table.oid = constraint_record.confrelid
    join lateral unnest(constraint_record.conkey) with ordinality
      as source_key(attnum, position)
      on true
    join lateral unnest(constraint_record.confkey) with ordinality
      as target_key(attnum, position)
      on target_key.position = source_key.position
    join pg_attribute source_column
      on source_column.attrelid = source_table.oid
      and source_column.attnum = source_key.attnum
    join pg_attribute target_column
      on target_column.attrelid = target_table.oid
      and target_column.attnum = target_key.attnum
    where constraint_record.contype = 'f'
      and source_namespace.nspname = 'public'
      and source_table.relname in (
        'settlement_import_batches',
        'settlement_import_mappings',
        'settlement_import_rows'
      )
  `);
  const existingForeignKeys = new Set(
    foreignKeyResult.rows.map((row) => row.relationship_key),
  );
  const requiredForeignKeys = [
    "settlement_import_batches.organization_id->organizations.id",
    "settlement_import_batches.outlet_id->outlets.id",
    "settlement_import_batches.profile_id->manual_payment_profiles.id",
    "settlement_import_batches.uploaded_by->users.id",
    "settlement_import_mappings.organization_id->organizations.id",
    "settlement_import_mappings.outlet_id->outlets.id",
    "settlement_import_mappings.profile_id->manual_payment_profiles.id",
    "settlement_import_mappings.updated_by->users.id",
    "settlement_import_rows.batch_id->settlement_import_batches.id",
    "settlement_import_rows.matched_payment_id->payments.id",
  ];
  const missingForeignKeys = requiredForeignKeys.filter(
    (relationship) => !existingForeignKeys.has(relationship),
  );

  if (missingForeignKeys.length > 0) {
    throw new Error(
      `Schema P1-C.2 belum lengkap. Foreign key hilang: ${missingForeignKeys.join(", ")}.`,
    );
  }
}

async function ensurePermission(client: PoolClient) {
  await client.query(`
    insert into permissions (
      id,
      code,
      name,
      description,
      module,
      created_at,
      updated_at
    )
    values (
      gen_random_uuid(),
      'payments.reconciliation.import',
      'Mengimpor settlement dan menjalankan auto-matching',
      'Upload CSV settlement, mapping kolom, auto-match, dan review hasil import.',
      'payments',
      now(),
      now()
    )
    on conflict (code) do update set
      name = excluded.name,
      description = excluded.description,
      module = excluded.module,
      updated_at = now()
  `);

  await client.query(`
    insert into role_permissions (
      id,
      role_id,
      permission_id,
      constraints
    )
    select
      gen_random_uuid(),
      role_record.id,
      permission_record.id,
      null
    from roles role_record
    join permissions permission_record
      on permission_record.code = 'payments.reconciliation.import'
    where role_record.code in (
      'system_admin',
      'owner',
      'manager',
      'finance'
    )
    on conflict (role_id, permission_id) do nothing
  `);
}

async function assertMigrationLedger(client: PoolClient) {
  const tableResult = await client.query<{ ledger: string | null }>(`
    select to_regclass('drizzle.__drizzle_migrations')::text as ledger
  `);

  if (!tableResult.rows[0]?.ledger) {
    throw new Error(
      "Tabel drizzle.__drizzle_migrations tidak ditemukan. Jalankan migration dasar terlebih dahulu.",
    );
  }
}

async function main() {
  const apply = hasApplyFlag();
  const migrations = await loadMigrationRecords();
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    application_name: "asihjaya-p1c2-migration-history-repair",
    max: 1,
  });
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      "asihjaya:p1c2:migration-history-repair",
    ]);

    const identityResult = await client.query<{
      database_name: string;
      database_user: string;
    }>(`
      select
        current_database() as database_name,
        current_user as database_user
    `);
    const identity = identityResult.rows[0];

    console.log(
      `[INFO] target database: ${identity?.database_name ?? "unknown"} (${identity?.database_user ?? "unknown"})`,
    );

    await assertMigrationLedger(client);
    await assertSchemaObjects(client);
    console.log("[OK] Schema settlement import P1-C.2 lengkap.");

    const existingResult = await client.query<ExistingMigrationRow>(
      `
        select hash, created_at::text
        from drizzle.__drizzle_migrations
        where created_at = any($1::bigint[])
      `,
      [migrations.map((migration) => migration.createdAt)],
    );
    const existingByTimestamp = new Map(
      existingResult.rows.map((row) => [Number(row.created_at), row.hash]),
    );

    for (const migration of migrations) {
      const existingHash = existingByTimestamp.get(migration.createdAt);

      if (existingHash && existingHash !== migration.hash) {
        throw new Error(
          `Ledger ${migration.tag} sudah ada tetapi hash berbeda. Repair otomatis dihentikan.`,
        );
      }
    }

    const missing = migrations.filter(
      (migration) => !existingByTimestamp.has(migration.createdAt),
    );

    if (missing.length === 0) {
      console.log("[OK] History migration 0020-0022 sudah sinkron.");
      await client.query("rollback");
      return;
    }

    console.log(
      `[INFO] Ledger yang belum tercatat: ${missing.map((migration) => migration.tag).join(", ")}`,
    );

    if (!apply) {
      console.log(
        "[DRY RUN] Tidak ada perubahan. Jalankan ulang dengan --apply setelah membaca hasil di atas.",
      );
      await client.query("rollback");
      return;
    }

    await ensurePermission(client);

    for (const migration of missing) {
      await client.query(
        `
          insert into drizzle.__drizzle_migrations (hash, created_at)
          select $1, $2::bigint
          where not exists (
            select 1
            from drizzle.__drizzle_migrations
            where created_at = $2::bigint
          )
        `,
        [migration.hash, migration.createdAt],
      );
      console.log(`[APPLIED] ${migration.tag}`);
    }

    await client.query("commit");
    console.log(
      "[OK] History P1-C.2 telah disinkronkan. Lanjutkan dengan npm run db:migrate.",
    );
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Repair history migration P1-C.2 gagal.", error);
  process.exitCode = 1;
});
