import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { PosShellNotification, PosShellStatus } from "@/features/pos/queries";

type ReceiptPrintSummary = {
  sourceType: "sale" | "buyback";
  state: "active" | "failed" | "uncertain";
  count: number;
  sourceId: string;
};

export async function getReceiptPrintSummary(input: {
  organizationId: string;
  outletId: string;
  registerId: string;
}): Promise<ReceiptPrintSummary[]> {
  const result = await db.execute<ReceiptPrintSummary>(sql`
    with candidate_documents as (
      select h.source_type, h.source_id,
        bool_or(h.status = 'unknown_outcome') as uncertain,
        bool_or(h.status in ('pending', 'claimed', 'processing', 'printing', 'submitted')) as active,
        max(h.created_at) as requested_at
      from hardware_jobs h
      where h.organization_id = ${input.organizationId}
        and h.outlet_id = ${input.outletId} and h.register_id = ${input.registerId}
        and h.job_type = 'print_receipt_certificate'
        and h.status in ('pending', 'claimed', 'processing', 'printing', 'submitted', 'failed', 'unknown_outcome')
        and (
          (h.source_type = 'sale' and exists (select 1 from sales s
            where s.id = case when h.source_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then h.source_id::uuid end and s.organization_id = h.organization_id
              and s.outlet_id = h.outlet_id and s.status = 'completed'))
          or (h.source_type = 'buyback' and exists (select 1 from buybacks b
            where b.id = case when h.source_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then h.source_id::uuid end and b.organization_id = h.organization_id
              and b.outlet_id = h.outlet_id and b.status = 'completed'))
        )
        -- Buyback receipts are now optional/manual. Historical automatic
        -- failures must not request a receipt the customer never asked for.
        -- An uncertain physical outcome always remains visible.
        and not (h.source_type = 'buyback' and h.status = 'failed' and (
          coalesce(h.idempotency_key, '') like 'buyback-receipt:%:initial'
          or coalesce(h.payload #>> '{metadata,requestSource}', '') = 'pos.buyback'
        ))
      group by h.source_type, h.source_id
    ), document_states as (
      select d.source_type, d.source_id, d.requested_at,
        -- A replacement cannot resolve an uncertain physical outcome. Also keep
        -- genuinely queued jobs visible even if another copy already completed.
        case when d.uncertain then 'uncertain'
          when d.active then 'active'
          when latest.status = 'failed' then 'failed'
          else null end as state
      from candidate_documents d
      cross join lateral (
        select j.status from hardware_jobs j
        where j.organization_id = ${input.organizationId} and j.outlet_id = ${input.outletId}
          and j.job_type = 'print_receipt_certificate'
          and j.source_type = d.source_type and j.source_id = d.source_id
        order by j.created_at desc, j.id desc limit 1
      ) latest
    )
    select source_type as "sourceType", state, count(*)::int as count,
      (array_agg(source_id order by requested_at desc, source_id))[1] as "sourceId"
    from document_states where state is not null group by source_type, state
    order by source_type, state
  `);
  return result.rows;
}

export function getActiveReceiptPrintDescription(hardwareStatus: PosShellStatus["hardware"]["status"]) {
  return hardwareStatus === "online"
    ? "Hardware Hub sedang memproses permintaan cetak nota."
    : "Permintaan cetak akan diproses saat Hardware Hub kembali online.";
}

export function buildReceiptPrintNotifications(
  summaries: ReceiptPrintSummary[],
  hardwareStatus: PosShellStatus["hardware"]["status"],
): PosShellNotification[] {
  return summaries.map((summary) => {
    const isBuyback = summary.sourceType === "buyback";
    const documentLabel = isBuyback ? "nota buyback" : "nota penjualan";
    const href = isBuyback
      ? `/pos/buyback?detail=${encodeURIComponent(summary.sourceId)}`
      : `/pos/transaksi?range=all&detail=${encodeURIComponent(summary.sourceId)}`;
    const prefix = isBuyback ? "buyback-" : "";
    if (summary.state === "uncertain") {
      return {
        id: `${prefix}uncertain-print-jobs`,
        title: `${summary.count} ${documentLabel} perlu konfirmasi`,
        description: "Hasil cetak belum terkonfirmasi. Periksa nota fisik dan konfirmasikan di Hardware Hub sebelum mencetak ulang.",
        href, actionLabel: "Periksa Transaksi", tone: "warning", icon: "print",
      };
    }
    if (summary.state === "failed") {
      return {
        id: `${prefix}failed-print-jobs`,
        title: `${summary.count} ${documentLabel} gagal dicetak`,
        description: "Percobaan cetak terakhir gagal. Buka transaksi terkait untuk memeriksa atau mencetak ulang nota.",
        href, actionLabel: "Buka Transaksi", tone: "danger", icon: "print",
      };
    }
    return {
      id: `${prefix}active-print-jobs`,
      title: `${summary.count} ${documentLabel} sedang diproses`,
      description: getActiveReceiptPrintDescription(hardwareStatus),
      href, actionLabel: "Cek Cetak Nota", tone: hardwareStatus === "online" ? "info" : "warning", icon: "print",
    };
  });
}
