import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  buybackItemProcessings,
  buybackItems,
  buybackPayouts,
  buybacks,
  customers,
  outlets,
  registers,
  users,
} from "@/db/schema";
import { createBuybackHistoryPeriod } from "@/features/buybacks/history-filters";
import type {
  BuybackReportFilters,
  BuybackReportPayout,
  BuybackReportRow,
} from "@/features/buybacks/report-contracts";

function buildBuybackReportConditions({
  organizationId,
  outletId,
  filters,
  timeZone,
}: {
  organizationId: string;
  outletId: string;
  filters: BuybackReportFilters;
  timeZone: string;
}) {
  const conditions = [
    eq(buybacks.organizationId, organizationId),
    eq(buybacks.outletId, outletId),
  ];
  const period = createBuybackHistoryPeriod(filters.dateRange, timeZone);

  if (period.start) {
    conditions.push(
      sql`coalesce(${buybacks.completedAt}, ${buybacks.createdAt}) >= ${period.start}`,
    );
  }
  if (period.end) {
    conditions.push(
      sql`coalesce(${buybacks.completedAt}, ${buybacks.createdAt}) < ${period.end}`,
    );
  }

  const normalizedSearch = filters.search.trim().slice(0, 160);
  if (normalizedSearch) {
    const pattern = `%${normalizedSearch}%`;
    const searchCondition = or(
      ilike(buybacks.buybackNumber, pattern),
      ilike(customers.fullName, pattern),
      ilike(customers.customerCode, pattern),
      ilike(customers.phone, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  if (filters.processingFilter === "pending") {
    conditions.push(sql`exists (
      select 1
      from ${buybackItems} report_item
      inner join ${buybackItemProcessings} report_processing
        on report_processing.buyback_item_id = report_item.id
      where report_item.buyback_id = ${buybacks.id}
        and report_processing.status = 'pending'
    )`);
  } else if (filters.processingFilter === "clear") {
    conditions.push(sql`not exists (
      select 1
      from ${buybackItems} report_item
      inner join ${buybackItemProcessings} report_processing
        on report_processing.buyback_item_id = report_item.id
      where report_item.buyback_id = ${buybacks.id}
        and report_processing.status = 'pending'
    )`);
  }

  if (filters.payoutFilter !== "all") {
    conditions.push(sql`exists (
      select 1
      from ${buybackPayouts} report_payout
      where report_payout.buyback_id = ${buybacks.id}
        and report_payout.method = ${filters.payoutFilter}
    )`);
  }

  return conditions;
}

export async function getBuybackReportRows({
  organizationId,
  outletId,
  filters,
  timeZone,
}: {
  organizationId: string;
  outletId: string;
  filters: BuybackReportFilters;
  timeZone: string;
}): Promise<BuybackReportRow[]> {
  const conditions = buildBuybackReportConditions({
    organizationId,
    outletId,
    filters,
    timeZone,
  });

  const rows = await db
    .select({
      id: buybacks.id,
      buybackNumber: buybacks.buybackNumber,
      status: buybacks.status,
      totalAmount: buybacks.totalAmount,
      notes: buybacks.notes,
      completedAt: buybacks.completedAt,
      createdAt: buybacks.createdAt,
      outletCode: outlets.code,
      outletName: outlets.name,
      registerCode: registers.code,
      registerName: registers.name,
      processedByName: users.fullName,
      customerCode: customers.customerCode,
      customerName: customers.fullName,
      customerPhone: customers.phone,
    })
    .from(buybacks)
    .innerJoin(customers, eq(buybacks.customerId, customers.id))
    .innerJoin(users, eq(buybacks.processedBy, users.id))
    .innerJoin(outlets, eq(buybacks.outletId, outlets.id))
    .innerJoin(registers, eq(buybacks.registerId, registers.id))
    .where(and(...conditions))
    .orderBy(desc(buybacks.completedAt), desc(buybacks.createdAt));

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];

  const [payoutRows, itemRows] = await Promise.all([
    db
      .select({
        buybackId: buybackPayouts.buybackId,
        method: buybackPayouts.method,
        amount: buybackPayouts.amount,
        reference: buybackPayouts.reference,
      })
      .from(buybackPayouts)
      .where(inArray(buybackPayouts.buybackId, ids))
      .orderBy(asc(buybackPayouts.createdAt)),
    db
      .select({
        id: buybackItems.id,
        buybackId: buybackItems.buybackId,
        lineNumber: buybackItems.lineNumber,
        source: buybackItems.source,
        weightGram: buybackItems.weightGram,
        purityPercent: buybackItems.purityPercent,
        finalAmount: buybackItems.finalAmount,
        snapshot: buybackItems.snapshot,
        processingType: buybackItemProcessings.processingType,
        processingStatus: buybackItemProcessings.status,
      })
      .from(buybackItems)
      .leftJoin(
        buybackItemProcessings,
        eq(buybackItemProcessings.buybackItemId, buybackItems.id),
      )
      .where(inArray(buybackItems.buybackId, ids))
      .orderBy(asc(buybackItems.buybackId), asc(buybackItems.lineNumber)),
  ]);

  const payoutsByBuyback = new Map<string, BuybackReportPayout[]>();
  for (const payout of payoutRows) {
    const current = payoutsByBuyback.get(payout.buybackId) ?? [];
    current.push({
      method: payout.method,
      amount: payout.amount,
      reference: payout.reference,
    });
    payoutsByBuyback.set(payout.buybackId, current);
  }

  const itemsByBuyback = new Map<string, BuybackReportRow["items"]>();
  for (const item of itemRows) {
    const current = itemsByBuyback.get(item.buybackId) ?? [];
    current.push({
      id: item.id,
      lineNumber: item.lineNumber,
      source: item.source,
      weightGram: item.weightGram,
      purityPercent: item.purityPercent,
      finalAmount: item.finalAmount,
      snapshot: item.snapshot,
      processingType: item.processingType,
      processingStatus: item.processingStatus,
    });
    itemsByBuyback.set(item.buybackId, current);
  }

  return rows.map((row) => ({
    ...row,
    payouts: payoutsByBuyback.get(row.id) ?? [],
    items: itemsByBuyback.get(row.id) ?? [],
  }));
}
