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
  severity: "blocker" | "warning";
};

const checks: Check[] = [
  {
    name: "invalid_legacy_manual_payment_identity",
    description:
      "Payment manual non-tunai memiliki provider placeholder/kosong atau reference yang tidak dapat dinormalisasi.",
    severity: "blocker",
    query: `
      select
        payment.id::text,
        sale.invoice_number,
        payment.method::text,
        payment.provider,
        payment.provider_reference,
        upper(regexp_replace(coalesce(payment.provider_reference, ''), '[^A-Za-z0-9]', '', 'g')) as normalized_reference
      from payments payment
      inner join sales sale on sale.id = payment.sale_id
      where payment.method in ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer')
        and (
          payment.provider_reference is null
          or btrim(payment.provider_reference) = ''
          or length(upper(regexp_replace(payment.provider_reference, '[^A-Za-z0-9]', '', 'g'))) < 4
          or btrim(payment.provider) = ''
          or lower(btrim(payment.provider)) = 'manual'
        )
      order by payment.created_at
      limit 50
    `,
  },
  {
    name: "legacy_duplicate_manual_references",
    description:
      "Reference manual yang sama sudah pernah dipakai lebih dari sekali. Migration tetap dapat berjalan, tetapi baris ini perlu direkonsiliasi dan akan memicu co-verification saat dipakai kembali.",
    severity: "warning",
    query: `
      select
        sale.organization_id::text,
        sale.outlet_id::text,
        payment.method::text,
        upper(regexp_replace(payment.provider, '\\s+', ' ', 'g')) as provider,
        upper(regexp_replace(payment.provider_reference, '[^A-Za-z0-9]', '', 'g')) as normalized_reference,
        count(*)::int as payment_count,
        array_agg(sale.invoice_number order by payment.created_at) as invoices
      from payments payment
      inner join sales sale on sale.id = payment.sale_id
      where payment.method in ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer')
        and payment.status = 'paid'
        and payment.provider_reference is not null
      group by
        sale.organization_id,
        sale.outlet_id,
        payment.method,
        upper(regexp_replace(payment.provider, '\\s+', ' ', 'g')),
        upper(regexp_replace(payment.provider_reference, '[^A-Za-z0-9]', '', 'g'))
      having count(*) > 1
      order by count(*) desc
      limit 50
    `,
  },
  {
    name: "legacy_manual_payment_backfill_count",
    description:
      "Daftar ringkas payment yang akan diberi status legacy self-verified dan unreconciled.",
    severity: "warning",
    query: `
      select
        payment.method::text,
        count(*)::int as payment_count,
        coalesce(sum(payment.amount), 0)::text as total_amount
      from payments payment
      where payment.method in ('qris_manual', 'debit_card', 'credit_card', 'bank_transfer')
      group by payment.method
      order by payment.method
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
    application_name: "asihjaya-p1a-preflight",
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

      if (check.severity === "blocker") {
        blockerCount += 1;
        console.error(`\n[BLOCKER] ${check.name}`);
      } else {
        console.error(`\n[INFO] ${check.name}`);
      }

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
      `\nP1-A preflight gagal: ${blockerCount} kategori blocker ditemukan. Rapikan provider/reference legacy sebelum migration.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "\nP1-A preflight lulus. Payment legacy dapat dibackfill oleh migration.",
  );
}

main().catch((error: unknown) => {
  console.error("P1-A preflight tidak dapat dijalankan.", error);
  process.exitCode = 1;
});
