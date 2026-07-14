import "dotenv/config";

import pg from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL belum diatur.");

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const enumResult = await client.query<{ enumlabel: string }>(`
      select enum_value.enumlabel
      from pg_enum enum_value
      join pg_type enum_type on enum_type.oid = enum_value.enumtypid
      where enum_type.typname = 'payment_settlement_status'
      order by enum_value.enumsortorder
    `);
    const values = new Set(enumResult.rows.map((row) => row.enumlabel));
    const required = [
      "not_applicable",
      "unreconciled",
      "pending_settlement",
      "reconciled",
      "mismatch",
      "not_found",
      "waived",
    ];
    const missing = required.filter((value) => !values.has(value));
    if (missing.length) {
      console.error(
        `[BLOCKER] reconciliation_enum: nilai enum belum lengkap (${missing.join(", ")}).`,
      );
      process.exitCode = 1;
      return;
    }
    console.log("[OK] reconciliation_enum");

    const tableResult = await client.query<{ table_name: string | null }>(`
      select to_regclass('public.payment_reconciliations')::text as table_name
    `);
    if (!tableResult.rows[0]?.table_name) {
      console.error(
        "[BLOCKER] payment_reconciliations: migration P1-C.1 belum lengkap.",
      );
      process.exitCode = 1;
      return;
    }
    console.log("[OK] payment_reconciliations");

    const profileResult = await client.query<{ count: string }>(`
      select count(*)::text as count
      from manual_payment_profiles
      where is_active = true
    `);
    console.log(
      `[INFO] active_manual_payment_profiles: ${profileResult.rows[0]?.count ?? "0"}`,
    );
    console.log(
      "P1-C.2 preflight lulus. Migration import settlement dapat diterapkan.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("P1-C.2 preflight tidak dapat dijalankan.", error);
  process.exitCode = 1;
});
