import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { hardwareJobs, outlets } from "@/db/schema";
import {
  RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN_FRONT_ONLY,
  RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
} from "@/features/sales/documents/receipt-certificate-render-modes";

export const RECEIPT_PRINT_MODE_ENV_KEY = "RECEIPT_PRINT_MODE";

export type OutletReceiptPrintMode =
  | typeof RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY
  | typeof RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN_FRONT_ONLY;

export function isOutletReceiptPrintMode(value: unknown): value is OutletReceiptPrintMode {
  return (
    value === RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY ||
    value === RECEIPT_CERTIFICATE_RENDER_MODE_FULL_DESIGN_FRONT_ONLY
  );
}

export function getDefaultOutletReceiptPrintMode(): OutletReceiptPrintMode {
  const configured = process.env[RECEIPT_PRINT_MODE_ENV_KEY]?.trim();
  if (!configured) return RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY;
  if (isOutletReceiptPrintMode(configured)) return configured;
  throw new Error(`${RECEIPT_PRINT_MODE_ENV_KEY} tidak valid: ${configured}`);
}

// The transaction connection may be passed by checkout/buyback so the choice is
// read in the same transaction as the immutable print-job payload.
export async function getOutletReceiptPrintMode(
  organizationId: string,
  outletId: string,
  executor: Pick<typeof db, "select"> = db,
): Promise<OutletReceiptPrintMode> {
  const [row] = await executor
    .select({ mode: outlets.receiptPrintMode })
    .from(outlets)
    .where(and(eq(outlets.organizationId, organizationId), eq(outlets.id, outletId)))
    .limit(1)
    .for("share");
  if (!row) throw new Error("Outlet nota tidak ditemukan atau bukan milik organisasi.");
  if (row.mode === null) return getDefaultOutletReceiptPrintMode();
  if (!isOutletReceiptPrintMode(row.mode)) {
    throw new Error(`Mode cetak outlet tidak valid: ${row.mode}`);
  }
  return row.mode;
}

export async function getOutletReceiptPrintModeDashboard(
  organizationId: string,
  outletIds: string[],
): Promise<Record<string, { mode: OutletReceiptPrintMode; pendingJobs: number }>> {
  if (outletIds.length === 0) return {};
  const [settings, pending] = await Promise.all([
    db.select({ id: outlets.id, mode: outlets.receiptPrintMode })
      .from(outlets)
      .where(and(eq(outlets.organizationId, organizationId), inArray(outlets.id, outletIds))),
    db.select({ outletId: hardwareJobs.outletId, total: sql<number>`count(*)::int` })
      .from(hardwareJobs)
      .where(and(
        eq(hardwareJobs.organizationId, organizationId),
        eq(hardwareJobs.jobType, "print_receipt_certificate"),
        inArray(hardwareJobs.outletId, outletIds),
        inArray(hardwareJobs.status, ["pending", "claimed", "processing", "printing", "submitted"]),
      ))
      .groupBy(hardwareJobs.outletId),
  ]);
  const counts = new Map(pending.map((row) => [row.outletId, Number(row.total)]));
  const result: Record<string, { mode: OutletReceiptPrintMode; pendingJobs: number }> = {};
  for (const row of settings) {
    const mode = row.mode ?? getDefaultOutletReceiptPrintMode();
    if (!isOutletReceiptPrintMode(mode)) throw new Error(`Mode outlet tidak valid: ${mode}`);
    result[row.id] = { mode, pendingJobs: counts.get(row.id) ?? 0 };
  }
  return result;
}
