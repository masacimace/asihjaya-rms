"use server";

import { createHash } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  legacyProductImportBatches,
  legacyProductMasterMappings,
  legacyProductRows,
} from "@/db/schema";
import {
  LEGACY_PRODUCT_IMPORT_MAX_BYTES,
  type ParsedLegacyProductRow,
  type ParsedLegacyProductWorkbook,
} from "@/features/legacy-migration/contracts";
import { collectLegacyMasterMappingSeeds } from "@/features/legacy-migration/master-mapping";
import { parseLegacyProductWorkbook } from "@/features/legacy-migration/xlsx-parser";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const IMPORT_PATH = "/admin/migrasi-produk";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INSERT_CHUNK_SIZE = 250;

function readText(formData: FormData, name: string, maxLength: number): string {
  return String(formData.get(name) ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function redirectImport(type: "success" | "error", message: string): never {
  const query = new URLSearchParams({ type, message });
  redirect(`${IMPORT_PATH}?${query.toString()}`);
}

function redirectBatch(
  batchId: string,
  type: "success" | "error",
  message: string,
): never {
  const query = new URLSearchParams({ type, message });
  redirect(`${IMPORT_PATH}/${batchId}?${query.toString()}`);
}

function validateWorkbookFile(file: File): void {
  const lowerName = file.name.trim().toLowerCase();

  if (!lowerName.endsWith(".xlsx")) {
    throw new Error("File harus menggunakan format .xlsx.");
  }

  if (file.size < 1 || file.size > LEGACY_PRODUCT_IMPORT_MAX_BYTES) {
    throw new Error(
      `Ukuran file harus antara 1 byte dan ${Math.floor(
        LEGACY_PRODUCT_IMPORT_MAX_BYTES / 1024 / 1024,
      )} MB.`,
    );
  }

  const acceptedMimeTypes = new Set([
    "",
    "application/octet-stream",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);

  if (!acceptedMimeTypes.has(file.type.toLowerCase())) {
    throw new Error("Tipe file tidak dikenali sebagai workbook XLSX.");
  }
}

function toNumericString(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return String(value);
}

function rowInsertValue(
  row: ParsedLegacyProductRow,
  context: {
    batchId: string;
    organizationId: string;
    outletId: string;
  },
) {
  return {
    ...context,
    rowNumber: row.rowNumber,
    sourceSequence: row.sourceSequence,
    legacyBarcode: row.legacyBarcode,
    normalizedBarcode: row.normalizedBarcode,
    legacyCategory: row.legacyCategory,
    legacyMasterCode: row.legacyMasterCode,
    legacyMasterName: row.legacyMasterName,
    legacyItemName: row.legacyItemName,
    legacyPurity: toNumericString(row.legacyPurity),
    legacyExchangePurity: toNumericString(row.legacyExchangePurity),
    legacyPricePerGram: toNumericString(row.legacyPricePerGram),
    legacyDeductionPerGram: toNumericString(row.legacyDeductionPerGram),
    legacyWeightGram: toNumericString(row.legacyWeightGram),
    legacyColor: row.legacyColor,
    legacyImageUrl: row.legacyImageUrl,
    validationStatus: row.validationStatus,
    validationIssues: row.validationIssues,
    rowFingerprint: row.rowFingerprint,
    rawData: row.rawData,
  };
}

async function getRequestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

export async function uploadLegacyProductWorkbookAction(formData: FormData) {
  const auth = await requirePermission("migration.import");
  const outletId = readText(formData, "outletId", 36);
  const file = formData.get("file");

  if (!UUID_PATTERN.test(outletId)) {
    redirectImport("error", "Pilih outlet tujuan migrasi yang valid.");
  }

  if (!auth.outlets.some((outlet) => outlet.id === outletId)) {
    redirectImport("error", "Kamu tidak memiliki akses ke outlet tersebut.");
  }

  if (!(file instanceof File)) {
    redirectImport("error", "Pilih file master produk XLSX terlebih dahulu.");
  }

  try {
    validateWorkbookFile(file);
  } catch (error) {
    redirectImport(
      "error",
      error instanceof Error ? error.message : "File XLSX tidak valid.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  const [existingBatch] = await db
    .select({ id: legacyProductImportBatches.id })
    .from(legacyProductImportBatches)
    .where(
      and(
        eq(
          legacyProductImportBatches.organizationId,
          auth.organization.id,
        ),
        eq(legacyProductImportBatches.outletId, outletId),
        eq(legacyProductImportBatches.fileHash, fileHash),
      ),
    )
    .limit(1);

  if (existingBatch) {
    redirectBatch(
      existingBatch.id,
      "error",
      "File yang sama sudah pernah dianalisis untuk outlet ini.",
    );
  }

  let parsed: ParsedLegacyProductWorkbook;
  try {
    parsed = parseLegacyProductWorkbook(buffer);
  } catch (error) {
    redirectImport(
      "error",
      error instanceof Error
        ? error.message
        : "Workbook legacy gagal dianalisis.",
    );
  }

  const requestMetadata = await getRequestMetadata();
  const now = new Date();
  let createdBatchId: string | null = null;

  try {
    createdBatchId = await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`legacy-product-import:${auth.organization.id}:${outletId}:${fileHash}`}))`,
      );

      const [duplicate] = await transaction
        .select({ id: legacyProductImportBatches.id })
        .from(legacyProductImportBatches)
        .where(
          and(
            eq(
              legacyProductImportBatches.organizationId,
              auth.organization.id,
            ),
            eq(legacyProductImportBatches.outletId, outletId),
            eq(legacyProductImportBatches.fileHash, fileHash),
          ),
        )
        .limit(1);

      if (duplicate) {
        throw new Error(`DUPLICATE:${duplicate.id}`);
      }

      const [batch] = await transaction
        .insert(legacyProductImportBatches)
        .values({
          organizationId: auth.organization.id,
          outletId,
          uploadedBy: auth.user.id,
          fileName: file.name.trim().slice(0, 255),
          fileHash,
          fileSizeBytes: file.size,
          worksheetName: parsed.worksheetName,
          barcodeLength: parsed.barcodeLength,
          status: "processing",
          totalRows: parsed.summary.totalRows,
          validRows: parsed.summary.validRows,
          warningRows: parsed.summary.warningRows,
          invalidRows: parsed.summary.invalidRows,
          uniqueMasterCount: parsed.summary.uniqueMasterCount,
          duplicateBarcodeCount: parsed.summary.duplicateBarcodeCount,
          leadingZeroBarcodeCount: parsed.summary.leadingZeroBarcodeCount,
          imageUrlCount: parsed.summary.imageUrlCount,
          headers: parsed.headers,
          validationSummary: parsed.summary,
        })
        .returning({ id: legacyProductImportBatches.id });

      if (!batch) throw new Error("Batch staging gagal dibuat.");

      const context = {
        batchId: batch.id,
        organizationId: auth.organization.id,
        outletId,
      };

      for (
        let offset = 0;
        offset < parsed.rows.length;
        offset += INSERT_CHUNK_SIZE
      ) {
        const values = parsed.rows
          .slice(offset, offset + INSERT_CHUNK_SIZE)
          .map((row) => rowInsertValue(row, context));

        await transaction.insert(legacyProductRows).values(values);
      }

      const masterMappingSeeds = collectLegacyMasterMappingSeeds(parsed.rows);
      if (masterMappingSeeds.length > 0) {
        await transaction.insert(legacyProductMasterMappings).values(
          masterMappingSeeds.map((mapping) => ({
            ...context,
            ...mapping,
          })),
        );
      }

      await transaction
        .update(legacyProductImportBatches)
        .set({
          status: "ready",
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(legacyProductImportBatches.id, batch.id));

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId,
        actorUserId: auth.user.id,
        action: "legacy_product_import.staged",
        entityType: "legacy_product_import_batch",
        entityId: batch.id,
        afterData: {
          fileName: file.name.trim().slice(0, 255),
          fileHash,
          totalRows: parsed.summary.totalRows,
          validRows: parsed.summary.validRows,
          warningRows: parsed.summary.warningRows,
          invalidRows: parsed.summary.invalidRows,
          uniqueMasterCount: parsed.summary.uniqueMasterCount,
        },
        reason:
          "Workbook legacy dianalisis dan disimpan ke staging tanpa mengubah inventaris aktif.",
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          worksheetName: parsed.worksheetName,
          duplicateBarcodeCount: parsed.summary.duplicateBarcodeCount,
          leadingZeroBarcodeCount: parsed.summary.leadingZeroBarcodeCount,
          imageUrlCount: parsed.summary.imageUrlCount,
        },
      });

      return batch.id;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("DUPLICATE:")) {
      redirectBatch(
        error.message.slice("DUPLICATE:".length),
        "error",
        "File yang sama sudah pernah dianalisis untuk outlet ini.",
      );
    }

    console.error("Legacy product workbook staging failed", {
      organizationId: auth.organization.id,
      outletId,
      fileHash,
      error,
    });
    redirectImport(
      "error",
      "Import staging gagal disimpan. Tidak ada stok aktif yang berubah.",
    );
  }

  if (!createdBatchId) {
    redirectImport(
      "error",
      "Batch staging tidak terbentuk. Tidak ada stok aktif yang berubah.",
    );
  }

  revalidatePath(IMPORT_PATH);
  redirectBatch(
    createdBatchId,
    "success",
    "Workbook berhasil dianalisis ke staging. Belum ada item yang masuk inventaris aktif.",
  );
}
