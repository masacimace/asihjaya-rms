import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  productBatchImportItemRows,
  productBatchImportSessions,
  productItems,
  productMasters,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/session";
import { buildInventoryLabelPayloadV2 } from "@/lib/hardware/job-payload-contracts-v2";
import { createHardwareJobV2InTransaction } from "@/lib/hardware/job-producer-v2";
import { getLabelHardwareTargets } from "@/lib/hardware/label-target";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LABEL_PRINTABLE_AVAILABILITY = new Set(["draft", "available", "reserved"]);
const MAX_BATCH_LABEL_ITEMS = 500;

export class ProductBatchImportLabelError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "SESSION_NOT_COMPLETED"
      | "LABEL_PERMISSION_REQUIRED"
      | "INVALID_SELECTION"
      | "NO_PRINTABLE_ITEMS"
      | "OUTLET_ACCESS_REQUIRED"
      | "HARDWARE_AGENT_REQUIRED",
  ) {
    super(message);
    this.name = "ProductBatchImportLabelError";
  }
}

type PrintProductBatchImportLabelsInput = {
  auth: AuthContext;
  sessionId: string;
  requestId: string;
  mode: "all" | "selected";
  selectedItemIds?: string[];
  requestMetadata?: {
    ipAddress?: string | null;
    userAgent?: string | null;
  };
};

export type PrintProductBatchImportLabelsResult = {
  requestedCount: number;
  printableCount: number;
  createdCount: number;
  duplicateCount: number;
  skippedCount: number;
};

function uniqueUuidList(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => UUID_PATTERN.test(value))),
  );
}

export async function printProductBatchImportLabels(
  input: PrintProductBatchImportLabelsInput,
): Promise<PrintProductBatchImportLabelsResult> {
  if (!hasPermission(input.auth, "inventory.print_label")) {
    throw new ProductBatchImportLabelError(
      "Anda tidak memiliki permission inventory.print_label untuk mencetak label.",
      "LABEL_PERMISSION_REQUIRED",
    );
  }
  if (!UUID_PATTERN.test(input.sessionId) || !UUID_PATTERN.test(input.requestId)) {
    throw new ProductBatchImportLabelError(
      "Intent cetak label Batch Import tidak valid.",
      "INVALID_SELECTION",
    );
  }

  const selectedIds = uniqueUuidList(input.selectedItemIds ?? []);
  if (
    input.mode === "selected" &&
    (selectedIds.length === 0 || selectedIds.length > MAX_BATCH_LABEL_ITEMS)
  ) {
    throw new ProductBatchImportLabelError(
      `Pilih 1-${MAX_BATCH_LABEL_ITEMS} Product Item untuk dicetak.`,
      "INVALID_SELECTION",
    );
  }

  const [session] = await db
    .select({ id: productBatchImportSessions.id, status: productBatchImportSessions.status })
    .from(productBatchImportSessions)
    .where(
      and(
        eq(productBatchImportSessions.id, input.sessionId),
        eq(productBatchImportSessions.organizationId, input.auth.organization.id),
      ),
    )
    .limit(1);

  if (!session || session.status !== "completed") {
    throw new ProductBatchImportLabelError(
      "Label hanya dapat dibuat dari Product Batch Import yang sudah completed.",
      "SESSION_NOT_COMPLETED",
    );
  }

  const rows = await db
    .select({
      itemId: productItems.id,
      currentOutletId: productItems.currentOutletId,
      sku: productItems.sku,
      barcode: productItems.barcode,
      displayName: productItems.displayName,
      productName: productMasters.name,
      weightGram: productItems.weightGram,
      purityPercent: productItems.purityPercent,
      exchangePurityPercent: productItems.exchangePurityPercent,
      size: productItems.size,
      color: productItems.color,
      gemstone: productItems.gemstone,
      sellingAmount: productItems.sellingAmount,
      availability: productItems.availability,
      isActive: productItems.isActive,
    })
    .from(productBatchImportItemRows)
    .innerJoin(
      productItems,
      eq(productBatchImportItemRows.committedProductItemId, productItems.id),
    )
    .innerJoin(productMasters, eq(productItems.productMasterId, productMasters.id))
    .where(eq(productBatchImportItemRows.sessionId, input.sessionId))
    .orderBy(asc(productBatchImportItemRows.rowNumber));

  const candidateRows =
    input.mode === "all"
      ? rows
      : rows.filter((row) => selectedIds.includes(row.itemId));

  if (input.mode === "selected" && candidateRows.length !== selectedIds.length) {
    throw new ProductBatchImportLabelError(
      "Pilihan label mengandung item yang bukan bagian dari session import ini.",
      "INVALID_SELECTION",
    );
  }

  const accessibleOutletIds = new Set(input.auth.outlets.map((outlet) => outlet.id));
  const itemOutletIds = Array.from(
    new Set(
      candidateRows.flatMap((row) =>
        row.currentOutletId && accessibleOutletIds.has(row.currentOutletId)
          ? [row.currentOutletId]
          : [],
      ),
    ),
  );

  const targetByOutletId = await getLabelHardwareTargets({
    organizationId: input.auth.organization.id,
    outletIds: itemOutletIds,
  });

  const printableRows = candidateRows.flatMap((row) => {
    if (
      !row.isActive ||
      !LABEL_PRINTABLE_AVAILABILITY.has(row.availability) ||
      !row.currentOutletId ||
      !accessibleOutletIds.has(row.currentOutletId) ||
      !targetByOutletId.has(row.currentOutletId)
    ) {
      return [];
    }
    return [row];
  });

  if (printableRows.length === 0) {
    const hasAccessibleOutlet = candidateRows.some(
      (row) => row.currentOutletId && accessibleOutletIds.has(row.currentOutletId),
    );
    if (!hasAccessibleOutlet) {
      throw new ProductBatchImportLabelError(
        "Tidak ada item terpilih yang mempunyai outlet yang dapat Anda akses.",
        "OUTLET_ACCESS_REQUIRED",
      );
    }
    const hasRegister = candidateRows.some(
      (row) => row.currentOutletId && targetByOutletId.has(row.currentOutletId),
    );
    if (!hasRegister) {
      throw new ProductBatchImportLabelError(
        "Hardware Agent label dengan capability print_label_sato belum tersedia pada outlet item terpilih. Pastikan Agent Hardware Hub aktif pada register yang benar lalu jalankan Test Label Printer.",
        "HARDWARE_AGENT_REQUIRED",
      );
    }
    throw new ProductBatchImportLabelError(
      "Tidak ada item terpilih yang eligible untuk dicetak label.",
      "NO_PRINTABLE_ITEMS",
    );
  }

  let createdCount = 0;
  let duplicateCount = 0;

  await db.transaction(async (transaction) => {
    for (const row of printableRows) {
      const outletId = row.currentOutletId!;
      const target = targetByOutletId.get(outletId)!;
      const registerId = target.registerId;
      const payload = buildInventoryLabelPayloadV2({
        itemId: row.itemId,
        copies: 1,
        sku: row.sku,
        barcode: row.barcode,
        productName: row.displayName ?? row.productName,
        weightGram: row.weightGram,
        purityPercent: row.purityPercent,
        exchangePurityPercent: row.exchangePurityPercent,
        size: row.size,
        color: row.color,
        gemstone: row.gemstone,
        sellingAmount: row.sellingAmount,
      });

      const { duplicate } = await createHardwareJobV2InTransaction(transaction, {
        organizationId: input.auth.organization.id,
        outletId,
        registerId,
        createdByUserId: input.auth.user.id,
        targetAgentId: target.agentId,
        jobType: "print_label_sato",
        mode: "manual",
        payload,
        idempotencyKey: `batch-label:${input.sessionId}:${row.itemId}:${input.requestId}`,
        sourceType: "product_batch_import",
        sourceId: input.sessionId,
        audit: {
          source: "admin.products.batch_import",
          requestId: input.requestId,
          ipAddress: input.requestMetadata?.ipAddress ?? null,
          userAgent: input.requestMetadata?.userAgent ?? null,
          reason: `Print label dari Product Batch Import ${input.sessionId}.`,
        },
      });

      if (duplicate) duplicateCount += 1;
      else createdCount += 1;
    }
  });

  return {
    requestedCount: candidateRows.length,
    printableCount: printableRows.length,
    createdCount,
    duplicateCount,
    skippedCount: candidateRows.length - printableRows.length,
  };
}
