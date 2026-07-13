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
    name: "refunded_sales_without_items",
    description:
      "Sale refunded tanpa item tidak dapat dibackfill ke return case karena expected item count wajib lebih dari nol.",
    query: `
      select
        sale.id::text,
        sale.invoice_number,
        sale.cancelled_at
      from sales sale
      left join sale_items sale_item on sale_item.sale_id = sale.id
      where sale.status = 'refunded'
      group by sale.id, sale.invoice_number, sale.cancelled_at
      having count(sale_item.id) = 0
      order by sale.cancelled_at nulls last
      limit 50
    `,
  },
  {
    name: "refund_execution_in_progress",
    description:
      "Refund yang sedang dieksekusi harus selesai atau dipastikan rollback sebelum migration P1-B diterapkan.",
    query: `
      select
        approval.id::text,
        approval.reference_id::text as sale_id,
        approval.execution_started_at,
        approval.created_at
      from approvals approval
      where approval.type = 'refund_transaction'
        and approval.execution_status = 'executing'
      order by approval.execution_started_at nulls last, approval.created_at
      limit 50
    `,
  },
  {
    name: "inconsistent_refund_payment_ledger",
    description:
      "Sale refunded wajib memiliki payment refund ledger agar return workflow tidak menutupi masalah finansial lama.",
    query: `
      select
        sale.id::text,
        sale.invoice_number,
        count(distinct payment.id) filter (where payment.status = 'refunded') as refunded_payments,
        count(payment_refund.id) filter (where payment_refund.status = 'confirmed') as confirmed_refunds
      from sales sale
      left join payments payment on payment.sale_id = sale.id
      left join payment_refunds payment_refund on payment_refund.sale_id = sale.id
      where sale.status = 'refunded'
      group by sale.id, sale.invoice_number
      having count(distinct payment.id) filter (where payment.status = 'refunded')
          <> count(distinct payment_refund.payment_id) filter (where payment_refund.status = 'confirmed')
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
    application_name: "asihjaya-p1b-preflight",
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
      `\nP1-B preflight gagal: ${blockerCount} kategori blocker ditemukan. Rapikan data legacy sebelum migration.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "\nP1-B preflight lulus. Migration refund dan return inspection dapat diterapkan.",
  );
}

main().catch((error: unknown) => {
  console.error("P1-B preflight tidak dapat dijalankan.", error);
  process.exitCode = 1;
});
