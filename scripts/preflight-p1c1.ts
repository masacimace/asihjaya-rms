import "dotenv/config";

import { Pool, type QueryResultRow } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL belum diatur.");

type Check = {
  name: string;
  description: string;
  query: string;
};

const checks: Check[] = [
  {
    name: "manual_noncash_not_reconcilable",
    description:
      "Payment manual non-tunai yang sudah paid/refunded wajib memiliki settlement_status selain not_applicable.",
    query: `
      select
        payment.id::text,
        sale.invoice_number,
        payment.method::text,
        payment.provider,
        payment.provider_reference,
        payment.amount
      from payments payment
      join sales sale on sale.id = payment.sale_id
      where payment.method in ('debit_card', 'credit_card')
        and payment.status in ('paid', 'partially_refunded', 'refunded')
        and payment.settlement_status = 'not_applicable'
      order by payment.created_at
      limit 50
    `,
  },
  {
    name: "cash_marked_for_settlement",
    description:
      "Payment cash harus tetap not_applicable karena rekonsiliasinya dilakukan melalui closing shift.",
    query: `
      select
        payment.id::text,
        sale.invoice_number,
        payment.amount,
        payment.settlement_status::text
      from payments payment
      join sales sale on sale.id = payment.sale_id
      where payment.method = 'cash'
        and payment.settlement_status <> 'not_applicable'
      order by payment.created_at
      limit 50
    `,
  },
];

function printRows(rows: QueryResultRow[]) {
  for (const row of rows) console.error(`  - ${JSON.stringify(row)}`);
}

async function main() {
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "asihjaya-p1c1-preflight",
    max: 1,
  });
  const client = await pool.connect();
  let blockers = 0;

  try {
    await client.query("begin transaction read only");

    for (const check of checks) {
      const result = await client.query(check.query);
      if (!result.rowCount) {
        console.log(`[OK] ${check.name}`);
        continue;
      }

      blockers += 1;
      console.error(`\n[BLOCKER] ${check.name}`);
      console.error(check.description);
      printRows(result.rows);
    }

    const legacyResult = await client.query(`
      select settlement_status::text as status, count(*)::int as total
      from payments
      where settlement_status::text in ('matched', 'settled')
      group by settlement_status
      order by settlement_status
    `);

    for (const row of legacyResult.rows) {
      console.log(
        `[INFO] legacy_${row.status}: ${row.total} payment akan dipetakan otomatis oleh migration.`,
      );
    }

    await client.query("rollback");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  if (blockers > 0) {
    console.error(
      `\nP1-C.1 preflight gagal: ${blockers} kategori blocker ditemukan. Perbaiki data sebelum migration.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "\nP1-C.1 preflight lulus. Migration manual payment reconciliation dapat diterapkan.",
  );
}

main().catch((error: unknown) => {
  console.error("P1-C.1 preflight tidak dapat dijalankan.", error);
  process.exitCode = 1;
});
