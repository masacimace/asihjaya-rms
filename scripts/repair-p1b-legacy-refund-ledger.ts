import "dotenv/config";

import { Pool, type PoolClient } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum diatur.");
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CliOptions = {
  saleId: string;
  apply: boolean;
};

type SaleRow = {
  id: string;
  organization_id: string;
  outlet_id: string;
  shift_id: string;
  cashier_id: string;
  invoice_number: string;
  status: string;
  cancelled_at: Date | null;
  updated_at: Date;
};

type ApprovalRow = {
  id: string;
  requested_by: string;
  approved_by: string | null;
  executed_by: string | null;
  created_at: Date;
  resolved_at: Date | null;
  executed_at: Date | null;
  notes: string | null;
  response_notes: string | null;
};

type PaymentRow = {
  id: string;
  amount: string;
  method: string;
  provider: string | null;
  provider_reference: string | null;
  updated_at: Date;
};

type ExistingRefundRow = {
  id: string;
  payment_id: string;
  status: string;
};

type CashMovementRow = {
  shift_id: string;
  amount: string;
  created_at: Date;
};

function parseArgs(argv: string[]): CliOptions {
  let saleId = "";
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--apply") {
      apply = true;
      continue;
    }

    if (argument === "--sale-id") {
      saleId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
  }

  if (!UUID_PATTERN.test(saleId)) {
    throw new Error(
      "Gunakan --sale-id <uuid>. Contoh: npm run db:repair:p1b-legacy-refund -- --sale-id <uuid>",
    );
  }

  return { saleId, apply };
}

async function readRepairContext(client: PoolClient, saleId: string) {
  const saleResult = await client.query<SaleRow>(
    `
      select
        sale.id::text,
        sale.organization_id::text,
        sale.outlet_id::text,
        sale.shift_id::text,
        sale.cashier_id::text,
        sale.invoice_number,
        sale.status::text,
        sale.cancelled_at,
        sale.updated_at
      from sales sale
      where sale.id = $1::uuid
      limit 1
    `,
    [saleId],
  );

  const sale = saleResult.rows[0];

  if (!sale) {
    throw new Error(`Sale ${saleId} tidak ditemukan.`);
  }

  if (sale.status !== "refunded") {
    throw new Error(
      `Sale ${sale.invoice_number} berstatus ${sale.status}, bukan refunded. Script dihentikan.`,
    );
  }

  const paymentsResult = await client.query<PaymentRow>(
    `
      select
        payment.id::text,
        payment.amount::text,
        payment.method::text,
        payment.provider,
        payment.provider_reference,
        payment.updated_at
      from payments payment
      where payment.sale_id = $1::uuid
        and payment.status = 'refunded'
      order by payment.created_at, payment.id
    `,
    [saleId],
  );

  if (paymentsResult.rows.length === 0) {
    throw new Error(
      `Sale ${sale.invoice_number} tidak memiliki payment berstatus refunded.`,
    );
  }

  const approvalResult = await client.query<ApprovalRow>(
    `
      select
        approval.id::text,
        approval.requested_by::text,
        approval.approved_by::text,
        approval.executed_by::text,
        approval.created_at,
        approval.resolved_at,
        approval.executed_at,
        approval.notes,
        approval.response_notes
      from approvals approval
      where approval.organization_id = $1::uuid
        and approval.type = 'refund_transaction'
        and approval.reference_type = 'sale'
        and approval.reference_id = $2::uuid
      order by
        approval.executed_at desc nulls last,
        approval.resolved_at desc nulls last,
        approval.created_at desc
      limit 1
    `,
    [sale.organization_id, sale.id],
  );

  const existingRefundResult = await client.query<ExistingRefundRow>(
    `
      select
        payment_refund.id::text,
        payment_refund.payment_id::text,
        payment_refund.status::text
      from payment_refunds payment_refund
      where payment_refund.sale_id = $1::uuid
      order by payment_refund.created_at, payment_refund.id
    `,
    [sale.id],
  );

  const cashMovementResult = await client.query<CashMovementRow>(
    `
      select
        movement.shift_id::text,
        movement.amount::text,
        movement.created_at
      from cash_movements movement
      where movement.type = 'cash_refund'
        and movement.reference_id = $1::uuid
      order by movement.created_at desc
      limit 1
    `,
    [sale.id],
  );

  return {
    sale,
    payments: paymentsResult.rows,
    approval: approvalResult.rows[0] ?? null,
    existingRefunds: existingRefundResult.rows,
    cashMovement: cashMovementResult.rows[0] ?? null,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "asihjaya-p1b-legacy-refund-repair",
    max: 1,
  });
  const client = await pool.connect();

  try {
    await client.query("begin");

    const context = await readRepairContext(client, options.saleId);
    const existingByPayment = new Map<string, ExistingRefundRow[]>();

    for (const refund of context.existingRefunds) {
      const rows = existingByPayment.get(refund.payment_id) ?? [];
      rows.push(refund);
      existingByPayment.set(refund.payment_id, rows);
    }

    for (const payment of context.payments) {
      const existingRows = existingByPayment.get(payment.id) ?? [];

      if (existingRows.length > 1) {
        throw new Error(
          `Payment ${payment.id} memiliki lebih dari satu ledger refund. Rapikan manual sebelum melanjutkan.`,
        );
      }

      if (payment.method === "cash" && !context.cashMovement) {
        throw new Error(
          `Payment cash ${payment.id} tidak memiliki cash_refund movement. Script tidak akan mengarang refund shift.`,
        );
      }
    }

    const totalCashPayment = context.payments
      .filter((payment) => payment.method === "cash")
      .reduce((total, payment) => total + BigInt(payment.amount), BigInt(0));

    if (totalCashPayment > BigInt(0) && context.cashMovement) {
      const cashMovementAmount = BigInt(context.cashMovement.amount);

      if (cashMovementAmount !== totalCashPayment) {
        throw new Error(
          `Nominal cash_refund movement (${cashMovementAmount}) tidak sama dengan total payment cash (${totalCashPayment}). Script dihentikan.`,
        );
      }
    }

    const eventAt =
      context.approval?.executed_at ??
      context.sale.cancelled_at ??
      context.sale.updated_at;
    const requestedBy =
      context.approval?.requested_by ?? context.sale.cashier_id;
    const approvedBy = context.approval?.approved_by ?? null;
    const executedBy =
      context.approval?.executed_by ??
      context.approval?.approved_by ??
      context.sale.cashier_id;
    const reason =
      context.approval?.response_notes?.trim() ||
      context.approval?.notes?.trim() ||
      `Backfill ledger refund legacy untuk ${context.sale.invoice_number}.`;

    console.log(`Sale       : ${context.sale.invoice_number}`);
    console.log(`Sale ID    : ${context.sale.id}`);
    console.log(`Payments   : ${context.payments.length}`);
    console.log(`Approval   : ${context.approval?.id ?? "tidak ditemukan"}`);
    console.log(
      `Mode       : ${options.apply ? "APPLY" : "DRY RUN (tidak menulis data)"}`,
    );

    let changedCount = 0;

    for (const payment of context.payments) {
      const existing = (existingByPayment.get(payment.id) ?? [])[0] ?? null;
      const refundShiftId =
        payment.method === "cash" ? context.cashMovement?.shift_id ?? null : null;
      const metadata = {
        legacyBackfill: true,
        source: "repair.p1b.legacy_refund_ledger",
        invoiceNumber: context.sale.invoice_number,
        originalPaymentStatus: "refunded",
        originalProvider: payment.provider,
        originalProviderReference: payment.provider_reference,
        cashMovementDetected: Boolean(context.cashMovement),
        repairedAt: new Date().toISOString(),
      };

      if (existing?.status === "confirmed") {
        console.log(`  [SKIP] payment ${payment.id}: ledger sudah confirmed`);
        continue;
      }

      if (existing) {
        await client.query(
          `
            update payment_refunds
            set
              approval_id = coalesce(approval_id, $2::uuid),
              original_shift_id = $3::uuid,
              refund_shift_id = $4::uuid,
              provider = coalesce(nullif(provider, ''), $5),
              provider_reference = coalesce(provider_reference, $6),
              reason = case when btrim(reason) = '' then $7 else reason end,
              status = 'confirmed',
              requested_by = coalesce(requested_by, $8::uuid),
              approved_by = coalesce(approved_by, $9::uuid),
              executed_by = coalesce(executed_by, $10::uuid),
              confirmed_by = coalesce(confirmed_by, $10::uuid),
              requested_at = coalesce(requested_at, $11::timestamptz),
              approved_at = coalesce(approved_at, $12::timestamptz),
              executed_at = coalesce(executed_at, $13::timestamptz),
              confirmed_at = coalesce(confirmed_at, $13::timestamptz),
              metadata = coalesce(metadata, '{}'::jsonb) || $14::jsonb,
              updated_at = now()
            where id = $1::uuid
          `,
          [
            existing.id,
            context.approval?.id ?? null,
            context.sale.shift_id,
            refundShiftId,
            payment.provider?.trim() || "manual_legacy",
            payment.provider_reference,
            reason,
            requestedBy,
            approvedBy,
            executedBy,
            context.approval?.created_at ?? eventAt,
            context.approval?.resolved_at ?? null,
            eventAt,
            JSON.stringify(metadata),
          ],
        );
        changedCount += 1;
        console.log(`  [UPDATE] payment ${payment.id}: ledger ${existing.id}`);
        continue;
      }

      await client.query(
        `
          insert into payment_refunds (
            organization_id,
            outlet_id,
            sale_id,
            payment_id,
            approval_id,
            original_shift_id,
            refund_shift_id,
            amount,
            method,
            provider,
            provider_reference,
            reason,
            status,
            idempotency_key,
            requested_by,
            approved_by,
            executed_by,
            confirmed_by,
            requested_at,
            approved_at,
            executed_at,
            confirmed_at,
            metadata,
            created_at,
            updated_at
          )
          values (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::uuid,
            $6::uuid,
            $7::uuid,
            $8::numeric,
            $9::payment_method,
            $10,
            $11,
            $12,
            'confirmed',
            $13,
            $14::uuid,
            $15::uuid,
            $16::uuid,
            $16::uuid,
            $17::timestamptz,
            $18::timestamptz,
            $19::timestamptz,
            $19::timestamptz,
            $20::jsonb,
            $19::timestamptz,
            now()
          )
        `,
        [
          context.sale.organization_id,
          context.sale.outlet_id,
          context.sale.id,
          payment.id,
          context.approval?.id ?? null,
          context.sale.shift_id,
          refundShiftId,
          payment.amount,
          payment.method,
          payment.provider?.trim() || "manual_legacy",
          payment.provider_reference,
          reason,
          `legacy:p1b:${context.sale.id}:${payment.id}`,
          requestedBy,
          approvedBy,
          executedBy,
          context.approval?.created_at ?? eventAt,
          context.approval?.resolved_at ?? null,
          eventAt,
          JSON.stringify(metadata),
        ],
      );
      changedCount += 1;
      console.log(`  [INSERT] payment ${payment.id}: ledger legacy dibuat`);
    }

    const validation = await client.query<{ missing_count: string }>(
      `
        select count(*)::text as missing_count
        from payments payment
        where payment.sale_id = $1::uuid
          and payment.status = 'refunded'
          and not exists (
            select 1
            from payment_refunds payment_refund
            where payment_refund.payment_id = payment.id
              and payment_refund.status = 'confirmed'
          )
      `,
      [context.sale.id],
    );

    if (Number(validation.rows[0]?.missing_count ?? "0") !== 0) {
      throw new Error("Validasi akhir gagal: masih ada payment tanpa ledger confirmed.");
    }

    if (!options.apply) {
      await client.query("rollback");
      console.log(
        `\nDry run selesai. ${changedCount} ledger akan diperbaiki. Jalankan ulang dengan --apply untuk menyimpan perubahan.`,
      );
      return;
    }

    await client.query("commit");
    console.log(`\nSelesai. ${changedCount} ledger legacy diperbaiki.`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Repair ledger refund legacy gagal.", error);
  process.exitCode = 1;
});
