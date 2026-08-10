import "dotenv/config";

import { Pool } from "pg";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireLocalDatabase(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const allowedHosts = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "host.docker.internal",
  ]);

  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      `Safety stop: DATABASE_URL mengarah ke host "${parsed.hostname}", bukan database lokal.`,
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL belum tersedia.");
  }
  requireLocalDatabase(databaseUrl);

  const sessionId = readArg("--session-id");
  if (!sessionId || !UUID_PATTERN.test(sessionId)) {
    throw new Error(
      "Gunakan --session-id <UUID> dari hasil Upload & validasi ZIP.",
    );
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const sessionResult = await pool.query<{
      id: string;
      organization_id: string;
      status: string;
      file_sha256: string;
      storage_key: string;
      total_master_rows: number;
      total_item_rows: number;
      valid_master_rows: number;
      valid_item_rows: number;
      invalid_rows: number;
      warning_count: number;
      committed_master_count: number;
      committed_item_count: number;
    }>(
      `
        select
          id,
          organization_id,
          status,
          file_sha256,
          storage_key,
          total_master_rows,
          total_item_rows,
          valid_master_rows,
          valid_item_rows,
          invalid_rows,
          warning_count,
          committed_master_count,
          committed_item_count
        from product_batch_import_sessions
        where id = $1
      `,
      [sessionId],
    );
    const session = sessionResult.rows[0];
    assert(session, "Session Product Batch Import tidak ditemukan.");
    assert(
      session.status === "ready" || session.status === "invalid",
      `Session harus ready/invalid setelah validation staging, saat ini ${session.status}.`,
    );
    assert(
      /^[0-9a-f]{64}$/.test(session.file_sha256),
      "SHA-256 session tidak valid.",
    );
    assert(
      session.storage_key ===
        `organizations/${session.organization_id}/product-batch-import/${sessionId}/archive.zip`,
      "storage_key archive tidak organization/session scoped.",
    );
    assert(
      session.committed_master_count === 0 && session.committed_item_count === 0,
      "2B.4 tidak boleh mempunyai committed Product Master/Product Item.",
    );

    const countsResult = await pool.query<{
      master_count: number;
      item_count: number;
      valid_master_count: number;
      valid_item_count: number;
      invalid_count: number;
      warning_count: number;
      generated_identity_count: number;
      committed_identity_count: number;
    }>(
      `
        with master_stats as (
          select
            count(*)::int as row_count,
            count(*) filter (where validation_status <> 'invalid')::int as valid_count,
            count(*) filter (where validation_status = 'invalid')::int as invalid_count,
            coalesce(sum(jsonb_array_length(validation_warnings)), 0)::int as warning_count,
            count(*) filter (
              where planned_product_master_id is not null
                 or committed_product_master_id is not null
            )::int as committed_identity_count
          from product_batch_import_master_rows
          where session_id = $1
        ),
        item_stats as (
          select
            count(*)::int as row_count,
            count(*) filter (where validation_status <> 'invalid')::int as valid_count,
            count(*) filter (where validation_status = 'invalid')::int as invalid_count,
            coalesce(sum(jsonb_array_length(validation_warnings)), 0)::int as warning_count,
            count(*) filter (
              where generated_sku is not null
                 or generated_barcode is not null
                 or generated_qr_value is not null
            )::int as generated_identity_count,
            count(*) filter (
              where planned_product_item_id is not null
                 or committed_product_item_id is not null
            )::int as committed_identity_count
          from product_batch_import_item_rows
          where session_id = $1
        )
        select
          master_stats.row_count as master_count,
          item_stats.row_count as item_count,
          master_stats.valid_count as valid_master_count,
          item_stats.valid_count as valid_item_count,
          (master_stats.invalid_count + item_stats.invalid_count)::int as invalid_count,
          (master_stats.warning_count + item_stats.warning_count)::int as warning_count,
          item_stats.generated_identity_count as generated_identity_count,
          (master_stats.committed_identity_count + item_stats.committed_identity_count)::int as committed_identity_count
        from master_stats, item_stats
      `,
      [sessionId],
    );
    const counts = countsResult.rows[0]!;

    assert(counts.master_count === session.total_master_rows, "Jumlah staging master tidak cocok dengan session.");
    assert(counts.item_count === session.total_item_rows, "Jumlah staging item tidak cocok dengan session.");
    assert(counts.valid_master_count === session.valid_master_rows, "Jumlah valid master tidak cocok dengan session.");
    assert(counts.valid_item_count === session.valid_item_rows, "Jumlah valid item tidak cocok dengan session.");
    assert(counts.invalid_count === session.invalid_rows, "Jumlah invalid row tidak cocok dengan session.");
    assert(counts.warning_count === session.warning_count, "Jumlah warning tidak cocok dengan session.");
    assert(counts.generated_identity_count === 0, "2B.4 belum boleh mengalokasikan SKU/barcode/QR.");
    assert(counts.committed_identity_count === 0, "2B.4 belum boleh merencanakan/commit product identity.");

    const isolationResult = await pool.query<{
      wrong_category_org: number;
      wrong_outlet_org: number;
      wrong_media_scope: number;
      final_media_count: number;
    }>(
      `
        select
          (
            select count(*)::int
            from product_batch_import_master_rows r
            join product_categories c on c.id = r.resolved_category_id
            where r.session_id = $1
              and c.organization_id <> $2
          ) as wrong_category_org,
          (
            select count(*)::int
            from product_batch_import_item_rows r
            join outlets o on o.id = r.resolved_outlet_id
            where r.session_id = $1
              and o.organization_id <> $2
          ) as wrong_outlet_org,
          (
            select count(*)::int
            from product_batch_import_media m
            where m.session_id = $1
              and m.staging_key not like $3
          ) as wrong_media_scope,
          (
            select count(*)::int
            from product_batch_import_media m
            where m.session_id = $1
              and m.final_key is not null
          ) as final_media_count
      `,
      [
        sessionId,
        session.organization_id,
        `organizations/${session.organization_id}/product-batch-import/${sessionId}/%`,
      ],
    );
    const isolation = isolationResult.rows[0]!;
    assert(isolation.wrong_category_org === 0, "Resolved category menembus organization boundary.");
    assert(isolation.wrong_outlet_org === 0, "Resolved outlet menembus organization boundary.");
    assert(isolation.wrong_media_scope === 0, "Media staging key menembus organization/session boundary.");
    assert(isolation.final_media_count === 0, "2B.4 belum boleh mempunyai final media key.");

    console.log("Pemeriksaan Product Batch Import staging live berhasil.");
    console.log(`- Session ${sessionId}: ${session.status}.`);
    console.log(`- Master ${counts.master_count}, item ${counts.item_count}, invalid ${counts.invalid_count}, warning ${counts.warning_count}.`);
    console.log("- Category/outlet/media organization isolation valid.");
    console.log("- Belum ada SKU/barcode/QR, planned/committed product, atau final media.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Staging live check gagal.",
  );
  process.exitCode = 1;
});
