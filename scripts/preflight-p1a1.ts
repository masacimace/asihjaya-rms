import "dotenv/config";

import { Pool, type QueryResultRow } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur.");
}

type Check = {
  name: string;
  description: string;
  query: string;
};

const checks: Check[] = [
  {
    name: "active_checkout_attempts",
    description:
      "Checkout berstatus processing harus diselesaikan atau dipastikan gagal sebelum payload P1-A.1 diberlakukan.",
    query: `
      select
        attempt.id::text,
        attempt.idempotency_key,
        attempt.cashier_id::text,
        attempt.outlet_id::text,
        attempt.started_at,
        attempt.updated_at
      from pos_checkout_attempts attempt
      where attempt.status = 'processing'
      order by attempt.updated_at
      limit 50
    `,
  },
  {
    name: "pending_manual_payment_approvals",
    description:
      "Approval pembayaran manual lama harus diselesaikan atau dibatalkan karena payload lamanya belum memiliki payment profile.",
    query: `
      select
        approval.id::text,
        approval.outlet_id::text,
        approval.requested_by::text,
        approval.created_at
      from approvals approval
      where approval.type = 'manual_payment_verification'
        and approval.status = 'pending'
      order by approval.created_at
      limit 50
    `,
  },
];

function printRows(rows: QueryResultRow[]) {
  for (const row of rows) {
    console.error(`  - ${JSON.stringify(row)}`);
  }
}

async function main() {
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "asihjaya-p1a1-preflight",
    max: 1,
  });
  const client = await pool.connect();
  let blockerCount = 0;

  try {
    await client.query("begin transaction read only");

    for (const check of checks) {
      const result = await client.query(check.query);

      if (!result.rowCount) {
        console.log(`[OK] ${check.name}`);
        continue;
      }

      blockerCount += 1;
      console.error(`\n[BLOCKER] ${check.name}`);
      console.error(check.description);
      printRows(result.rows);
    }

    await client.query("rollback");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  if (blockerCount > 0) {
    console.error(
      `\nP1-A.1 preflight gagal: ${blockerCount} kategori blocker ditemukan. Selesaikan checkout/approval aktif sebelum rollout.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "\nP1-A.1 preflight lulus. Migration payment profile dapat diterapkan.",
  );
}

main().catch((error: unknown) => {
  console.error("P1-A.1 preflight tidak dapat dijalankan.", error);
  process.exitCode = 1;
});
