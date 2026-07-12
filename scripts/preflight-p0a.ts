import "dotenv/config";

import { Pool, type QueryResultRow } from "pg";

type PreflightCheck = {
  name: string;
  description: string;
  query: string;
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur.");
}

const checks: PreflightCheck[] = [
  {
    name: "active_shift_duplicates",
    description: "Lebih dari satu shift open/closing pada register yang sama.",
    query: `
      select
        register_id::text as register_id,
        count(*)::int as duplicate_count,
        array_agg(id::text order by opened_at) as shift_ids
      from shifts
      where status in ('open', 'closing')
      group by register_id
      having count(*) > 1
      order by count(*) desc
      limit 20
    `,
  },
  {
    name: "cash_movement_reference_duplicates",
    description: "Financial event yang sama tercatat lebih dari sekali di cash ledger.",
    query: `
      select
        type::text as type,
        reference_type,
        reference_id::text as reference_id,
        count(*)::int as duplicate_count,
        array_agg(id::text order by created_at) as movement_ids
      from cash_movements
      where reference_type is not null and reference_id is not null
      group by type, reference_type, reference_id
      having count(*) > 1
      order by count(*) desc
      limit 20
    `,
  },
  {
    name: "inventory_movement_reference_duplicates",
    description: "Reversal/movement item yang sama tercatat lebih dari sekali.",
    query: `
      select
        item_id::text as item_id,
        movement_type::text as movement_type,
        reference_type,
        reference_id::text as reference_id,
        count(*)::int as duplicate_count,
        array_agg(id::text order by occurred_at) as movement_ids
      from inventory_movements
      where reference_type is not null and reference_id is not null
      group by item_id, movement_type, reference_type, reference_id
      having count(*) > 1
      order by count(*) desc
      limit 20
    `,
  },
  {
    name: "invalid_cash_movements",
    description: "Nominal atau system reference cash movement tidak valid.",
    query: `
      select id::text, shift_id::text, type::text, amount::text, reference_type,
        reference_id::text
      from cash_movements
      where
        (type = 'opening_balance' and amount < 0)
        or (type <> 'opening_balance' and amount <= 0)
        or (
          type in ('opening_balance', 'cash_sale', 'cash_refund')
          and (reference_type is null or reference_id is null)
        )
      order by created_at
      limit 20
    `,
  },
  {
    name: "invalid_payments",
    description: "Payment bernilai nonpositif atau payment paid belum memiliki verifikasi lengkap.",
    query: `
      select id::text, sale_id::text, method::text, status::text, amount::text,
        verified_by::text, verified_at::text, paid_at::text
      from payments
      where
        amount <= 0
        or (
          status = 'paid'
          and (verified_by is null or verified_at is null or paid_at is null)
        )
      order by created_at
      limit 20
    `,
  },
  {
    name: "invalid_sales",
    description: "Total transaksi, diskon, atau timestamp status tidak konsisten.",
    query: `
      select id::text, invoice_number, status::text,
        subtotal_amount::text, discount_amount::text,
        additional_fee_amount::text, total_amount::text,
        completed_at::text, cancelled_at::text
      from sales
      where
        subtotal_amount < 0
        or discount_amount < 0
        or additional_fee_amount < 0
        or total_amount < 0
        or discount_amount > subtotal_amount
        or total_amount <> subtotal_amount - discount_amount + additional_fee_amount
        or (status = 'completed' and completed_at is null)
        or (status in ('cancelled', 'voided', 'refunded') and cancelled_at is null)
      order by created_at
      limit 20
    `,
  },
  {
    name: "invalid_sale_items",
    description: "Harga line item atau formula diskonnya tidak konsisten.",
    query: `
      select id::text, sale_id::text, product_item_id::text,
        list_price_amount::text, discount_amount::text, final_price_amount::text
      from sale_items
      where
        list_price_amount <= 0
        or discount_amount < 0
        or discount_amount > list_price_amount
        or final_price_amount <> list_price_amount - discount_amount
      order by created_at
      limit 20
    `,
  },
  {
    name: "invalid_shifts",
    description: "Nilai kas shift atau data closed shift belum lengkap.",
    query: `
      select id::text, register_id::text, status::text,
        opening_cash::text, expected_cash::text, actual_cash::text,
        cash_variance::text, closed_by::text, closed_at::text
      from shifts
      where
        opening_cash < 0
        or actual_cash < 0
        or (
          status = 'closed'
          and (
            closed_by is null
            or expected_cash is null
            or actual_cash is null
            or cash_variance is null
            or closed_at is null
          )
        )
      order by opened_at
      limit 20
    `,
  },
  {
    name: "legacy_executed_approvals_without_executor",
    description: "Approval lama sudah dieksekusi di JSON tetapi tidak memiliki executor yang dapat dibackfill.",
    query: `
      select id::text, type::text, status::text, approved_by::text,
        request_data ->> 'executionStatus' as legacy_execution_status,
        request_data ->> 'executedBy' as legacy_executed_by
      from approvals
      where
        request_data ->> 'executionStatus' in ('void_executed', 'refund_executed')
        and not exists (
          select 1
          from users executor
          where executor.id = approvals.approved_by
            or (
              request_data ->> 'executedBy' ~*
                '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              and executor.id = (request_data ->> 'executedBy')::uuid
            )
        )
      order by created_at
      limit 20
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
    application_name: "asihjaya-p0a-preflight",
    max: 1,
  });

  const client = await pool.connect();
  let failedChecks = 0;

  try {
    await client.query("begin transaction read only");

    for (const check of checks) {
      const result = await client.query(check.query);

      if (result.rowCount && result.rowCount > 0) {
        failedChecks += 1;
        console.error(`\n[BLOCKER] ${check.name}`);
        console.error(check.description);
        printRows(result.rows);
      } else {
        console.log(`[OK] ${check.name}`);
      }
    }

    await client.query("rollback");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  if (failedChecks > 0) {
    console.error(
      `\nP0-A preflight gagal: ${failedChecks} kategori blocker ditemukan. Rapikan data sebelum menjalankan migration.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log("\nP0-A preflight lulus. Database siap menerima migration safety guard.");
}

main().catch((error: unknown) => {
  console.error("P0-A preflight tidak dapat dijalankan.", error);
  process.exitCode = 1;
});
