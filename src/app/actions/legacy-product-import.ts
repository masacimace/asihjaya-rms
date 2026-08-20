"use server";

import { createHash } from "node:crypto";

import { and, eq, ne, sql } from "drizzle-orm";
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
import {
  importLegacyBatchDirectlyToInventory,
  LegacyDirectImportError,
} from "@/features/legacy-migration/direct-import-service";
import { syncNextLegacyImageBatch } from "@/features/legacy-migration/image-sync-service";
import { collectLegacyMasterMappingSeeds } from "@/features/legacy-migration/master-mapping";
import { isLegacyMigrationUuid } from "@/features/legacy-migration/safety";
import {
  LegacyProductWorkbookError,
  parseLegacyProductWorkbook,
} from "@/features/legacy-migration/xlsx-parser";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

const IMPORT_PATH = "/admin/migrasi-produk";
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

async function markBatchFailed(batchId: string, error: unknown) {
  const message =
    error instanceof Error
      ? error.message.slice(0, 4_000)
      : "Direct import produk legacy gagal.";

  await db
    .update(legacyProductImportBatches)
    .set({
      status: "failed",
      errorMessage: message,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(legacyProductImportBatches.id, batchId),
        ne(legacyProductImportBatches.status, "ready"),
      ),
    )
    .catch(() => undefined);
}

export async function uploadLegacyProductWorkbookAction(formData: FormData) {
  const auth = await requirePermission("migration.import");
  const outletId = readText(formData, "outletId", 36);
  const file = formData.get("file");

  if (!isLegacyMigrationUuid(outletId)) {
    redirectImport("error", "Pilih outlet tujuan import yang valid.");
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
    .select({ id: legacyProductImportBatches.id, status: legacyProductImportBatches.status })
    .from(legacyProductImportBatches)
    .where(
      and(
        eq(legacyProductImportBatches.organizationId, auth.organization.id),
        eq(legacyProductImportBatches.outletId, outletId),
        eq(legacyProductImportBatches.fileHash, fileHash),
      ),
    )
    .limit(1);

  if (existingBatch) {
    redirectBatch(
      existingBatch.id,
      existingBatch.status === "failed" ? "error" : "success",
      existingBatch.status === "failed"
        ? "File yang sama sudah pernah diproses tetapi import gagal. Gunakan tombol Coba Import Lagi pada detail batch."
        : "File yang sama sudah pernah diimport untuk outlet ini.",
    );
  }

  let parsed: ParsedLegacyProductWorkbook;
  try {
    parsed = parseLegacyProductWorkbook(buffer);
  } catch (error) {
    if (
      !(error instanceof LegacyProductWorkbookError) ||
      error.cause !== undefined
    ) {
      console.error("Legacy product workbook parsing failed.", error);
    }

    redirectImport(
      "error",
      error instanceof LegacyProductWorkbookError
        ? error.message
        : "Workbook legacy gagal dianalisis.",
    );
  }

  const requestMetadata = await getRequestMetadata();
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
            eq(legacyProductImportBatches.organizationId, auth.organization.id),
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

      if (!batch) throw new Error("Batch import gagal dibuat.");

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

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId,
        actorUserId: auth.user.id,
        action: "legacy_product_import.uploaded",
        entityType: "legacy_product_import_batch",
        entityId: batch.id,
        afterData: {
          fileName: file.name.trim().slice(0, 255),
          fileHash,
          totalRows: parsed.summary.totalRows,
          warningRows: parsed.summary.warningRows,
          invalidRows: parsed.summary.invalidRows,
          uniqueMasterCount: parsed.summary.uniqueMasterCount,
        },
        reason:
          "Workbook legacy diunggah untuk direct import. Warning sumber tidak memblokir aktivasi item.",
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return batch.id;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("DUPLICATE:")) {
      redirectBatch(
        error.message.slice("DUPLICATE:".length),
        "success",
        "File yang sama sudah pernah diproses untuk outlet ini.",
      );
    }

    console.error("Legacy product workbook staging failed", {
      organizationId: auth.organization.id,
      outletId,
      fileHash,
      error,
    });
    redirectImport("error", "Workbook gagal disimpan untuk proses import.");
  }

  if (!createdBatchId) {
    redirectImport("error", "Batch import tidak berhasil dibuat.");
  }

  let result;
  try {
    result = await importLegacyBatchDirectlyToInventory({
      auth,
      batchId: createdBatchId,
      requestMetadata,
    });
  } catch (error) {
    await markBatchFailed(createdBatchId, error);
    console.error("Legacy direct import failed", {
      organizationId: auth.organization.id,
      batchId: createdBatchId,
      error,
    });
    redirectBatch(
      createdBatchId,
      "error",
      error instanceof LegacyDirectImportError || error instanceof Error
        ? error.message
        : "Direct import produk legacy gagal.",
    );
  }

  revalidatePath(IMPORT_PATH);
  revalidatePath("/admin/produk");
  revalidatePath("/admin/inventaris");
  redirectBatch(
    createdBatchId,
    "success",
    `${result.importedItemCount.toLocaleString("id-ID")} item berhasil diimport dan langsung aktif. ${result.cleanupItemCount.toLocaleString("id-ID")} item ditandai untuk dirapikan sambil berjalan. Foto legacy akan disalin otomatis di halaman ini.`,
  );
}

export async function retryLegacyProductImportBatchAction(formData: FormData) {
  const auth = await requirePermission("migration.import");
  const batchId = readText(formData, "batchId", 36);

  if (!isLegacyMigrationUuid(batchId)) {
    redirectImport("error", "Batch import tidak valid.");
  }

  const requestMetadata = await getRequestMetadata();
  let result;
  try {
    result = await importLegacyBatchDirectlyToInventory({
      auth,
      batchId,
      requestMetadata,
    });
  } catch (error) {
    await markBatchFailed(batchId, error);
    redirectBatch(
      batchId,
      "error",
      error instanceof Error ? error.message : "Import ulang gagal.",
    );
  }

  revalidatePath(IMPORT_PATH);
  revalidatePath(`/admin/migrasi-produk/${batchId}`);
  revalidatePath("/admin/produk");
  revalidatePath("/admin/inventaris");
  redirectBatch(
    batchId,
    "success",
    `${result.importedItemCount.toLocaleString("id-ID")} item berhasil diimport dan langsung aktif.`,
  );
}

export async function syncLegacyProductImagesAction(batchId: string) {
  const auth = await requirePermission("migration.import");
  if (!isLegacyMigrationUuid(batchId)) {
    throw new Error("Batch import tidak valid.");
  }

  const result = await syncNextLegacyImageBatch({ auth, batchId });
  if (result.pendingCount === 0) {
    revalidatePath(`/admin/migrasi-produk/${batchId}`);
    revalidatePath("/admin/inventaris");
    revalidatePath("/admin/produk");
  }
  return result;
}
