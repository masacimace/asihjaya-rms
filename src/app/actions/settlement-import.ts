"use server";

import { createHash } from "node:crypto";

import {
  and,
  eq,
  gte,
  inArray,
  lte,
  ne,
  sql,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  manualPaymentProfiles,
  paymentReconciliations,
  payments,
  sales,
  settlementImportBatches,
  settlementImportMappings,
  settlementImportRows,
} from "@/db/schema";
import {
  normalizeSettlementImportRow,
  parseCsv,
  suggestSettlementImportMapping,
  validateSettlementImportMapping,
} from "@/features/reconciliation/csv-parser";
import { syncSettlementImportCompletedNotificationInTransaction } from "@/features/notifications/reconciliation";
import {
  createEmptySettlementImportMapping,
  settlementImportColumnKeys,
  type SettlementImportColumnMapping,
} from "@/features/reconciliation/import-contracts";
import {
  hasPermission,
  requirePermission,
} from "@/lib/auth/session";
import {
  deleteSettlementImportFile,
  storeSettlementImportFile,
  validateSettlementImportFile,
} from "@/lib/storage/settlement-import-storage";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMPORT_BASE_PATH = "/admin/keuangan/rekonsiliasi/import";
const MATCH_DATE_TOLERANCE_MS = 3 * 24 * 60 * 60 * 1000;

function readText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function redirectImport(
  type: "success" | "error",
  message: string,
): never {
  const query = new URLSearchParams({ type, message });
  redirect(`${IMPORT_BASE_PATH}?${query.toString()}`);
}

function redirectBatch(
  batchId: string,
  type: "success" | "error",
  message: string,
): never {
  const query = new URLSearchParams({ type, message });
  redirect(`${IMPORT_BASE_PATH}/${batchId}?${query.toString()}`);
}

async function getRequestMetadata() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  return {
    ipAddress:
      forwardedFor?.split(",")[0]?.trim().slice(0, 64) ??
      headerStore.get("x-real-ip")?.slice(0, 64) ??
      null,
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function decodeUtf8(buffer: Buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new Error("CSV harus menggunakan encoding UTF-8.");
  }
}

function mappingFromFormData(formData: FormData): SettlementImportColumnMapping {
  const mapping = createEmptySettlementImportMapping();
  for (const key of settlementImportColumnKeys) {
    mapping[key] = readText(formData, key, 160) || null;
  }
  return mapping;
}

function isDateClose(left: Date | null, right: Date) {
  return Boolean(
    left && Math.abs(left.getTime() - right.getTime()) <= MATCH_DATE_TOLERANCE_MS,
  );
}

async function refreshBatchCounts(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  batchId: string,
  completedAt?: Date,
) {
  const [counts] = await transaction
    .select({
      validRowCount: sql<number>`count(*) filter (where ${settlementImportRows.status} <> 'failed')::int`,
      matchedCount: sql<number>`count(*) filter (where ${settlementImportRows.status} = 'matched')::int`,
      appliedCount: sql<number>`count(*) filter (where ${settlementImportRows.status} = 'applied')::int`,
      ambiguousCount: sql<number>`count(*) filter (where ${settlementImportRows.status} = 'ambiguous')::int`,
      mismatchCount: sql<number>`count(*) filter (where ${settlementImportRows.status} = 'mismatch')::int`,
      notFoundCount: sql<number>`count(*) filter (where ${settlementImportRows.status} = 'not_found')::int`,
      duplicateCount: sql<number>`count(*) filter (where ${settlementImportRows.status} = 'duplicate')::int`,
      ignoredCount: sql<number>`count(*) filter (where ${settlementImportRows.status} = 'ignored')::int`,
      failedCount: sql<number>`count(*) filter (where ${settlementImportRows.status} = 'failed')::int`,
    })
    .from(settlementImportRows)
    .where(eq(settlementImportRows.batchId, batchId));

  if (!counts) throw new Error("Batch count gagal dihitung.");

  const unresolved =
    counts.matchedCount +
    counts.ambiguousCount +
    counts.mismatchCount +
    counts.notFoundCount +
    counts.duplicateCount +
    counts.failedCount;

  await transaction
    .update(settlementImportBatches)
    .set({
      ...counts,
      ...(completedAt
        ? {
            status:
              unresolved === 0 ? "completed" : "completed_with_issues",
            completedAt,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(settlementImportBatches.id, batchId));

  if (completedAt) {
    const [batch] = await transaction
      .select({
        organizationId: settlementImportBatches.organizationId,
        outletId: settlementImportBatches.outletId,
        uploadedById: settlementImportBatches.uploadedBy,
        fileName: settlementImportBatches.fileName,
        rowCount: settlementImportBatches.rowCount,
      })
      .from(settlementImportBatches)
      .where(eq(settlementImportBatches.id, batchId))
      .limit(1);

    if (!batch) {
      throw new Error("Batch import tidak ditemukan saat membuat notifikasi.");
    }

    await syncSettlementImportCompletedNotificationInTransaction(transaction, {
      organizationId: batch.organizationId,
      outletId: batch.outletId,
      batchId,
      uploadedById: batch.uploadedById,
      fileName: batch.fileName,
      rowCount: batch.rowCount,
      appliedCount: counts.appliedCount,
      ambiguousCount: counts.ambiguousCount,
      mismatchCount: counts.mismatchCount,
      notFoundCount: counts.notFoundCount,
      duplicateCount: counts.duplicateCount,
      failedCount: counts.failedCount,
      unresolvedCount: unresolved,
      occurredAt: completedAt,
    });
  }

  return { ...counts, unresolved };
}

export async function uploadSettlementCsvAction(formData: FormData) {
  const auth = await requirePermission("payments.reconciliation.import");
  const outletId = readText(formData, "outletId", 36);
  const profileId = readText(formData, "profileId", 36);
  const file = formData.get("file");

  if (!UUID_PATTERN.test(outletId) || !UUID_PATTERN.test(profileId)) {
    redirectImport("error", "Outlet atau payment profile tidak valid.");
  }
  if (!auth.outlets.some((outlet) => outlet.id === outletId)) {
    redirectImport("error", "Kamu tidak memiliki akses ke outlet tersebut.");
  }
  if (!(file instanceof File)) {
    redirectImport("error", "Pilih file CSV settlement terlebih dahulu.");
  }

  try {
    validateSettlementImportFile(file);
  } catch (error) {
    redirectImport(
      "error",
      error instanceof Error ? error.message : "File CSV tidak valid.",
    );
  }

  const [profile] = await db
    .select({
      id: manualPaymentProfiles.id,
      outletId: manualPaymentProfiles.outletId,
      isActive: manualPaymentProfiles.isActive,
      savedDelimiter: settlementImportMappings.delimiter,
      savedMapping: settlementImportMappings.columnMapping,
    })
    .from(manualPaymentProfiles)
    .leftJoin(
      settlementImportMappings,
      eq(manualPaymentProfiles.id, settlementImportMappings.profileId),
    )
    .where(
      and(
        eq(manualPaymentProfiles.id, profileId),
        eq(manualPaymentProfiles.organizationId, auth.organization.id),
        eq(manualPaymentProfiles.outletId, outletId),
        eq(manualPaymentProfiles.isActive, true),
      ),
    )
    .limit(1);

  if (!profile) {
    redirectImport("error", "Payment profile tidak aktif atau tidak ditemukan.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buffer).digest("hex");
  const [existing] = await db
    .select({ id: settlementImportBatches.id })
    .from(settlementImportBatches)
    .where(
      and(
        eq(settlementImportBatches.organizationId, auth.organization.id),
        eq(settlementImportBatches.fileHash, fileHash),
      ),
    )
    .limit(1);
  if (existing) {
    redirectBatch(
      existing.id,
      "error",
      "File yang sama sudah pernah diunggah. Gunakan batch import yang sudah ada.",
    );
  }

  let parsed;
  try {
    parsed = parseCsv(decodeUtf8(buffer));
  } catch (error) {
    redirectImport(
      "error",
      error instanceof Error ? error.message : "CSV gagal dibaca.",
    );
  }

  const suggested = suggestSettlementImportMapping(parsed.headers);
  const savedMapping = {
    ...createEmptySettlementImportMapping(),
    ...(profile.savedMapping ?? {}),
  };
  const mapping = Object.fromEntries(
    settlementImportColumnKeys.map((key) => [
      key,
      savedMapping[key] && parsed.headers.includes(savedMapping[key]!)
        ? savedMapping[key]
        : suggested[key],
    ]),
  ) as SettlementImportColumnMapping;

  let fileKey: string | null = null;
  let createdBatchId: string | null = null;
  try {
    const stored = await storeSettlementImportFile({
      buffer,
      organizationId: auth.organization.id,
    });
    fileKey = stored.key;
    const requestMetadata = await getRequestMetadata();
    const now = new Date();

    createdBatchId = await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`settlement-import:${auth.organization.id}:${fileHash}`}))`,
      );
      const [duplicate] = await transaction
        .select({ id: settlementImportBatches.id })
        .from(settlementImportBatches)
        .where(
          and(
            eq(settlementImportBatches.organizationId, auth.organization.id),
            eq(settlementImportBatches.fileHash, fileHash),
          ),
        )
        .limit(1);
      if (duplicate) throw new Error(`DUPLICATE:${duplicate.id}`);

      const [batch] = await transaction
        .insert(settlementImportBatches)
        .values({
          organizationId: auth.organization.id,
          outletId,
          profileId,
          uploadedBy: auth.user.id,
          fileName: file.name.slice(0, 255),
          fileKey: stored.key,
          fileHash,
          fileSizeBytes: stored.sizeBytes,
          status: "uploaded",
          delimiter: parsed.delimiter,
          headers: parsed.headers,
          columnMapping: mapping,
          rowCount: parsed.rows.length,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: settlementImportBatches.id });
      if (!batch) throw new Error("Batch import gagal dibuat.");

      await transaction.insert(settlementImportRows).values(
        parsed.rows.map((rawData, index) => ({
          batchId: batch.id,
          rowNumber: index + 2,
          rawData,
          status: "pending" as const,
          createdAt: now,
          updatedAt: now,
        })),
      );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId,
        actorUserId: auth.user.id,
        action: "payment.reconciliation.import.upload",
        entityType: "settlement_import_batch",
        entityId: batch.id,
        afterData: {
          fileName: file.name.slice(0, 255),
          fileHash,
          rowCount: parsed.rows.length,
          profileId,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: { source: "admin.finance.settlement_import" },
        createdAt: now,
      });
      return batch.id;
    });

  } catch (error) {
    if (fileKey) await deleteSettlementImportFile(fileKey).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Upload CSV gagal.";
    if (message.startsWith("DUPLICATE:")) {
      redirectBatch(
        message.slice("DUPLICATE:".length),
        "error",
        "File yang sama sudah pernah diunggah.",
      );
    }
    redirectImport("error", message);
  }

  if (!createdBatchId) {
    redirectImport("error", "Batch import gagal dibuat.");
  }
  revalidatePath(IMPORT_BASE_PATH);
  redirectBatch(
    createdBatchId,
    "success",
    "CSV berhasil diunggah. Periksa mapping kolom sebelum analisis.",
  );
}

export async function analyzeSettlementImportAction(formData: FormData) {
  const auth = await requirePermission("payments.reconciliation.import");
  const batchId = readText(formData, "batchId", 36);
  if (!UUID_PATTERN.test(batchId)) {
    redirectImport("error", "Batch import tidak valid.");
  }
  const mapping = mappingFromFormData(formData);
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const now = new Date();

  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`settlement-import-batch:${batchId}`}))`,
      );
      const [batch] = await transaction
        .select({
          id: settlementImportBatches.id,
          organizationId: settlementImportBatches.organizationId,
          outletId: settlementImportBatches.outletId,
          profileId: settlementImportBatches.profileId,
          status: settlementImportBatches.status,
          headers: settlementImportBatches.headers,
          delimiter: settlementImportBatches.delimiter,
        })
        .from(settlementImportBatches)
        .where(
          and(
            eq(settlementImportBatches.id, batchId),
            eq(settlementImportBatches.organizationId, auth.organization.id),
            inArray(settlementImportBatches.outletId, outletIds),
          ),
        )
        .limit(1);
      if (!batch || !["uploaded", "ready"].includes(batch.status)) {
        throw new Error("Batch tidak ditemukan atau tidak dapat dianalisis ulang.");
      }
      validateSettlementImportMapping(batch.headers ?? [], mapping);

      await transaction
        .update(settlementImportBatches)
        .set({ status: "processing", startedAt: now, errorMessage: null, updatedAt: now })
        .where(eq(settlementImportBatches.id, batchId));

      const rawRows = await transaction
        .select({ id: settlementImportRows.id, rawData: settlementImportRows.rawData })
        .from(settlementImportRows)
        .where(eq(settlementImportRows.batchId, batchId))
        .orderBy(settlementImportRows.rowNumber);

      const normalizedRows = rawRows.map((row) => {
        try {
          return { id: row.id, value: normalizeSettlementImportRow(row.rawData ?? {}, mapping), error: null };
        } catch (error) {
          return {
            id: row.id,
            value: null,
            error: error instanceof Error ? error.message : "Baris tidak valid.",
          };
        }
      });
      const valid = normalizedRows.filter(
        (row): row is typeof row & { value: NonNullable<typeof row.value> } => Boolean(row.value),
      );
      const duplicateReferences = new Set(
        Array.from(
          valid.reduce((map, row) => {
            const count = map.get(row.value.normalizedReference) ?? 0;
            map.set(row.value.normalizedReference, count + 1);
            return map;
          }, new Map<string, number>()),
        )
          .filter(([, count]) => count > 1)
          .map(([reference]) => reference),
      );

      const references = Array.from(
        new Set(valid.map((row) => row.value.normalizedReference)),
      );
      const dates = valid.map((row) => row.value.transactionDate.getTime());
      const dateStart = dates.length
        ? new Date(Math.min(...dates) - MATCH_DATE_TOLERANCE_MS)
        : new Date(0);
      const dateEnd = dates.length
        ? new Date(Math.max(...dates) + MATCH_DATE_TOLERANCE_MS)
        : new Date();

      const candidateRows = references.length
        ? await transaction
            .select({
              paymentId: payments.id,
              normalizedReference: payments.normalizedReference,
              amount: payments.amount,
              paidAt: payments.paidAt,
              settlementStatus: payments.settlementStatus,
              reconciliationId: paymentReconciliations.id,
            })
            .from(payments)
            .innerJoin(sales, eq(payments.saleId, sales.id))
            .leftJoin(
              paymentReconciliations,
              eq(payments.id, paymentReconciliations.paymentId),
            )
            .where(
              and(
                eq(sales.organizationId, auth.organization.id),
                eq(sales.outletId, batch.outletId),
                eq(payments.manualPaymentProfileId, batch.profileId),
                inArray(payments.status, ["paid", "partially_refunded", "refunded"]),
                ne(payments.settlementStatus, "not_applicable"),
                gte(payments.paidAt, dateStart),
                lte(payments.paidAt, dateEnd),
              ),
            )
            .limit(10_000)
        : [];
      const byReference = new Map<string, typeof candidateRows>();
      const byAmount = new Map<number, typeof candidateRows>();
      for (const candidate of candidateRows) {
        if (candidate.normalizedReference) {
          const existing = byReference.get(candidate.normalizedReference) ?? [];
          existing.push(candidate);
          byReference.set(candidate.normalizedReference, existing);
        }
        const amount = Number(candidate.amount);
        const sameAmount = byAmount.get(amount) ?? [];
        sameAmount.push(candidate);
        byAmount.set(amount, sameAmount);
      }

      for (const row of normalizedRows) {
        if (!row.value) {
          await transaction
            .update(settlementImportRows)
            .set({
              status: "failed",
              errorMessage: row.error,
              matchedPaymentId: null,
              candidatePaymentIds: [],
              updatedAt: now,
            })
            .where(eq(settlementImportRows.id, row.id));
          continue;
        }
        const exactCandidates = byReference.get(row.value.normalizedReference) ?? [];
        const amountSuggestions = (byAmount.get(row.value.grossAmount) ?? [])
          .filter((candidate) => isDateClose(candidate.paidAt, row.value!.transactionDate))
          .slice(0, 5);

        let status: "matched" | "ambiguous" | "mismatch" | "not_found" | "duplicate";
        let matchedPaymentId: string | null = null;
        let candidates = exactCandidates;
        let matchReason: string;

        if (duplicateReferences.has(row.value.normalizedReference)) {
          status = "duplicate";
          matchReason = "Reference muncul lebih dari sekali di file yang sama.";
        } else if (exactCandidates.length === 0) {
          status = "not_found";
          candidates = amountSuggestions;
          matchReason = amountSuggestions.length
            ? "Reference tidak ditemukan; kandidat nominal dan tanggal serupa tersedia."
            : "Tidak ada payment POS dengan reference yang sama.";
        } else if (exactCandidates.length > 1) {
          status = "ambiguous";
          matchReason = "Lebih dari satu payment POS memiliki reference yang sama.";
        } else {
          const candidate = exactCandidates[0];
          if (!candidate) throw new Error("Kandidat payment tidak tersedia.");
          matchedPaymentId = candidate.paymentId;
          if (
            candidate.settlementStatus !== "unreconciled" ||
            candidate.reconciliationId
          ) {
            status = "duplicate";
            matchReason = "Payment POS sudah pernah diproses rekonsiliasi.";
          } else if (Number(candidate.amount) === row.value.grossAmount) {
            status = "matched";
            matchReason = "Reference, profile, outlet, dan gross amount cocok.";
          } else {
            status = "mismatch";
            matchReason = "Reference cocok tetapi gross amount berbeda.";
          }
        }

        await transaction
          .update(settlementImportRows)
          .set({
            transactionDate: row.value.transactionDate,
            paymentReference: row.value.paymentReference,
            normalizedReference: row.value.normalizedReference,
            grossAmount: String(row.value.grossAmount),
            feeAmount: String(row.value.feeAmount),
            taxAmount: String(row.value.taxAmount),
            netAmount: String(row.value.netAmount),
            settlementReference: row.value.settlementReference,
            providerStatus: row.value.providerStatus,
            status,
            matchedPaymentId,
            candidatePaymentIds: candidates.map((candidate) => candidate.paymentId),
            matchReason,
            errorMessage: null,
            reviewNotes: null,
            appliedAt: null,
            updatedAt: now,
          })
          .where(eq(settlementImportRows.id, row.id));
      }

      await transaction
        .insert(settlementImportMappings)
        .values({
          organizationId: batch.organizationId,
          outletId: batch.outletId,
          profileId: batch.profileId,
          delimiter: batch.delimiter,
          columnMapping: mapping,
          updatedBy: auth.user.id,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: settlementImportMappings.profileId,
          set: {
            delimiter: batch.delimiter,
            columnMapping: mapping,
            updatedBy: auth.user.id,
            updatedAt: now,
          },
        });

      await transaction
        .update(settlementImportBatches)
        .set({
          status: "ready",
          columnMapping: mapping,
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(settlementImportBatches.id, batchId));
      await refreshBatchCounts(transaction, batchId);

      await transaction.insert(auditLogs).values({
        organizationId: batch.organizationId,
        outletId: batch.outletId,
        actorUserId: auth.user.id,
        action: "payment.reconciliation.import.analyze",
        entityType: "settlement_import_batch",
        entityId: batchId,
        afterData: { mapping },
        metadata: { source: "admin.finance.settlement_import" },
        createdAt: now,
      });
    });
  } catch (error) {
    redirectBatch(
      batchId,
      "error",
      error instanceof Error ? error.message : "Analisis CSV gagal.",
    );
  }

  revalidatePath(`${IMPORT_BASE_PATH}/${batchId}`);
  redirectBatch(
    batchId,
    "success",
    "Analisis selesai. Periksa hasil sebelum mengimpor exact match.",
  );
}

export async function commitSettlementImportMatchesAction(formData: FormData) {
  const auth = await requirePermission("payments.reconciliation.import");
  if (!hasPermission(auth, "payments.reconciliation.manage")) {
    redirectImport("error", "Import settlement membutuhkan izin manage rekonsiliasi.");
  }
  const batchId = readText(formData, "batchId", 36);
  if (!UUID_PATTERN.test(batchId)) redirectImport("error", "Batch tidak valid.");
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const requestMetadata = await getRequestMetadata();
  const now = new Date();

  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`settlement-import-commit:${batchId}`}))`,
      );
      const [batch] = await transaction
        .select()
        .from(settlementImportBatches)
        .where(
          and(
            eq(settlementImportBatches.id, batchId),
            eq(settlementImportBatches.organizationId, auth.organization.id),
            inArray(settlementImportBatches.outletId, outletIds),
          ),
        )
        .limit(1);
      if (!batch || batch.status !== "ready") {
        throw new Error("Batch belum siap atau sudah pernah diproses.");
      }

      const rows = await transaction
        .select()
        .from(settlementImportRows)
        .where(
          and(
            eq(settlementImportRows.batchId, batchId),
            eq(settlementImportRows.status, "matched"),
          ),
        )
        .orderBy(settlementImportRows.rowNumber);
      if (!rows.length) throw new Error("Tidak ada exact match yang dapat diimpor.");

      await transaction
        .update(settlementImportBatches)
        .set({ status: "processing", updatedAt: now })
        .where(eq(settlementImportBatches.id, batchId));

      for (const row of rows) {
        if (!row.matchedPaymentId || row.grossAmount == null || !row.transactionDate) {
          await transaction
            .update(settlementImportRows)
            .set({ status: "failed", errorMessage: "Data exact match tidak lengkap.", updatedAt: now })
            .where(eq(settlementImportRows.id, row.id));
          continue;
        }

        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`payment-reconciliation:${row.matchedPaymentId}`}))`,
        );
        const [payment] = await transaction
          .select({
            paymentId: payments.id,
            saleId: sales.id,
            organizationId: sales.organizationId,
            outletId: sales.outletId,
            amount: payments.amount,
            settlementStatus: payments.settlementStatus,
            reconciliationId: paymentReconciliations.id,
          })
          .from(payments)
          .innerJoin(sales, eq(payments.saleId, sales.id))
          .leftJoin(
            paymentReconciliations,
            eq(payments.id, paymentReconciliations.paymentId),
          )
          .where(
            and(
              eq(payments.id, row.matchedPaymentId),
              eq(sales.organizationId, batch.organizationId),
              eq(sales.outletId, batch.outletId),
              eq(payments.manualPaymentProfileId, batch.profileId),
            ),
          )
          .limit(1);

        if (
          !payment ||
          payment.settlementStatus !== "unreconciled" ||
          payment.reconciliationId ||
          Number(payment.amount) !== Number(row.grossAmount)
        ) {
          await transaction
            .update(settlementImportRows)
            .set({
              status: "duplicate",
              errorMessage: "Payment berubah atau sudah direkonsiliasi oleh proses lain.",
              updatedAt: now,
            })
            .where(eq(settlementImportRows.id, row.id));
          continue;
        }

        const settlementReference =
          row.settlementReference ??
          `IMPORT-${batch.id.slice(0, 8).toUpperCase()}-${row.rowNumber}`;
        const [reconciliation] = await transaction
          .insert(paymentReconciliations)
          .values({
            organizationId: batch.organizationId,
            outletId: batch.outletId,
            paymentId: payment.paymentId,
            status: "reconciled",
            expectedAmount: payment.amount,
            settlementGrossAmount: row.grossAmount,
            feeAmount: row.feeAmount,
            taxAmount: row.taxAmount,
            netSettlementAmount: row.netAmount,
            differenceAmount: "0",
            settlementDate: row.transactionDate,
            settlementReference,
            notes: "Direkonsiliasi otomatis dari import CSV settlement.",
            reconciledBy: auth.user.id,
            reconciledAt: now,
            metadata: {
              source: "settlement_import_v1",
              importBatchId: batch.id,
              importRowId: row.id,
              fileHash: batch.fileHash,
              providerStatus: row.providerStatus,
            },
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: paymentReconciliations.id });

        const [updatedPayment] = await transaction
          .update(payments)
          .set({ settlementStatus: "reconciled", updatedAt: now })
          .where(
            and(
              eq(payments.id, payment.paymentId),
              eq(payments.settlementStatus, "unreconciled"),
            ),
          )
          .returning({ id: payments.id });
        if (!reconciliation || !updatedPayment) {
          throw new Error("Exact match gagal diterapkan secara atomik.");
        }

        await transaction
          .update(settlementImportRows)
          .set({ status: "applied", appliedAt: now, errorMessage: null, updatedAt: now })
          .where(
            and(
              eq(settlementImportRows.id, row.id),
              eq(settlementImportRows.status, "matched"),
            ),
          );

        await transaction.insert(auditLogs).values({
          organizationId: payment.organizationId,
          outletId: payment.outletId,
          actorUserId: auth.user.id,
          action: "payment.reconciliation.import.apply",
          entityType: "payment_reconciliation",
          entityId: reconciliation.id,
          afterData: {
            paymentId: payment.paymentId,
            status: "reconciled",
            settlementGrossAmount: row.grossAmount,
            feeAmount: row.feeAmount,
            taxAmount: row.taxAmount,
            netSettlementAmount: row.netAmount,
            settlementReference,
          },
          ipAddress: requestMetadata.ipAddress,
          userAgent: requestMetadata.userAgent,
          metadata: {
            source: "admin.finance.settlement_import",
            importBatchId: batch.id,
            importRowId: row.id,
            saleId: payment.saleId,
          },
          createdAt: now,
        });
      }

      await refreshBatchCounts(transaction, batchId, now);
    });
  } catch (error) {
    redirectBatch(
      batchId,
      "error",
      error instanceof Error ? error.message : "Import exact match gagal.",
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/keuangan/rekonsiliasi");
  revalidatePath(`${IMPORT_BASE_PATH}/${batchId}`);
  redirectBatch(
    batchId,
    "success",
    "Exact match berhasil direkonsiliasi. Baris lain tetap tersedia untuk review.",
  );
}

export async function applySettlementImportRowAction(formData: FormData) {
  const auth = await requirePermission("payments.reconciliation.import");
  if (!hasPermission(auth, "payments.reconciliation.manage")) {
    redirectImport("error", "Aksi ini membutuhkan izin manage rekonsiliasi.");
  }
  const batchId = readText(formData, "batchId", 36);
  const rowId = readText(formData, "rowId", 36);
  const paymentId = readText(formData, "paymentId", 36);
  if (![batchId, rowId, paymentId].every((value) => UUID_PATTERN.test(value))) {
    redirectImport("error", "Pilihan baris atau payment tidak valid.");
  }
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const now = new Date();
  const requestMetadata = await getRequestMetadata();

  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`settlement-import-row:${rowId}`}))`,
      );
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`payment-reconciliation:${paymentId}`}))`,
      );
      const [record] = await transaction
        .select({
          batchId: settlementImportBatches.id,
          organizationId: settlementImportBatches.organizationId,
          outletId: settlementImportBatches.outletId,
          profileId: settlementImportBatches.profileId,
          fileHash: settlementImportBatches.fileHash,
          rowId: settlementImportRows.id,
          rowNumber: settlementImportRows.rowNumber,
          rowStatus: settlementImportRows.status,
          grossAmount: settlementImportRows.grossAmount,
          feeAmount: settlementImportRows.feeAmount,
          taxAmount: settlementImportRows.taxAmount,
          netAmount: settlementImportRows.netAmount,
          transactionDate: settlementImportRows.transactionDate,
          settlementReference: settlementImportRows.settlementReference,
          providerStatus: settlementImportRows.providerStatus,
          matchedPaymentId: settlementImportRows.matchedPaymentId,
          candidatePaymentIds: settlementImportRows.candidatePaymentIds,
        })
        .from(settlementImportRows)
        .innerJoin(
          settlementImportBatches,
          eq(settlementImportRows.batchId, settlementImportBatches.id),
        )
        .where(
          and(
            eq(settlementImportRows.id, rowId),
            eq(settlementImportBatches.id, batchId),
            eq(settlementImportBatches.organizationId, auth.organization.id),
            inArray(settlementImportBatches.outletId, outletIds),
          ),
        )
        .limit(1);
      if (!record || !["ambiguous", "mismatch", "not_found", "duplicate"].includes(record.rowStatus)) {
        throw new Error("Baris import tidak tersedia untuk review manual.");
      }
      const allowedCandidates = new Set([
        ...(record.candidatePaymentIds ?? []),
        ...(record.matchedPaymentId ? [record.matchedPaymentId] : []),
      ]);
      if (!allowedCandidates.has(paymentId)) {
        throw new Error("Payment tersebut bukan kandidat yang dihasilkan sistem.");
      }
      if (!record.grossAmount || !record.transactionDate || !record.netAmount) {
        throw new Error("Data settlement pada baris ini tidak lengkap.");
      }

      const [payment] = await transaction
        .select({
          paymentId: payments.id,
          saleId: sales.id,
          organizationId: sales.organizationId,
          outletId: sales.outletId,
          amount: payments.amount,
          settlementStatus: payments.settlementStatus,
          reconciliationId: paymentReconciliations.id,
        })
        .from(payments)
        .innerJoin(sales, eq(payments.saleId, sales.id))
        .leftJoin(
          paymentReconciliations,
          eq(payments.id, paymentReconciliations.paymentId),
        )
        .where(
          and(
            eq(payments.id, paymentId),
            eq(sales.organizationId, record.organizationId),
            eq(sales.outletId, record.outletId),
            eq(payments.manualPaymentProfileId, record.profileId),
          ),
        )
        .limit(1);
      if (!payment || payment.settlementStatus !== "unreconciled" || payment.reconciliationId) {
        throw new Error("Payment kandidat sudah berubah atau telah direkonsiliasi.");
      }

      const difference = Number(record.grossAmount) - Number(payment.amount);
      const status = difference === 0 ? "reconciled" : "mismatch";
      const settlementReference =
        record.settlementReference ??
        `IMPORT-${record.batchId.slice(0, 8).toUpperCase()}-${record.rowNumber}`;
      const notes =
        status === "mismatch"
          ? `Review import CSV: gross settlement berbeda ${difference.toLocaleString("id-ID")} dari payment POS.`
          : "Dicocokkan manual dari kandidat import CSV settlement.";

      const [reconciliation] = await transaction
        .insert(paymentReconciliations)
        .values({
          organizationId: record.organizationId,
          outletId: record.outletId,
          paymentId,
          status,
          expectedAmount: payment.amount,
          settlementGrossAmount: record.grossAmount,
          feeAmount: record.feeAmount,
          taxAmount: record.taxAmount,
          netSettlementAmount: record.netAmount,
          differenceAmount: String(difference),
          settlementDate: record.transactionDate,
          settlementReference,
          notes,
          reconciledBy: auth.user.id,
          reconciledAt: now,
          metadata: {
            source: "settlement_import_manual_review_v1",
            importBatchId: record.batchId,
            importRowId: record.rowId,
            fileHash: record.fileHash,
            providerStatus: record.providerStatus,
          },
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: paymentReconciliations.id });
      const [updatedPayment] = await transaction
        .update(payments)
        .set({ settlementStatus: status, updatedAt: now })
        .where(
          and(eq(payments.id, paymentId), eq(payments.settlementStatus, "unreconciled")),
        )
        .returning({ id: payments.id });
      if (!reconciliation || !updatedPayment) {
        throw new Error("Review manual gagal diterapkan secara atomik.");
      }

      await transaction
        .update(settlementImportRows)
        .set({
          status: "applied",
          matchedPaymentId: paymentId,
          reviewNotes: notes,
          appliedAt: now,
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(settlementImportRows.id, rowId));
      await refreshBatchCounts(transaction, batchId, now);

      await transaction.insert(auditLogs).values({
        organizationId: record.organizationId,
        outletId: record.outletId,
        actorUserId: auth.user.id,
        action: "payment.reconciliation.import.review_apply",
        entityType: "payment_reconciliation",
        entityId: reconciliation.id,
        afterData: { paymentId, status, differenceAmount: difference, settlementReference },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "admin.finance.settlement_import",
          importBatchId: batchId,
          importRowId: rowId,
          saleId: payment.saleId,
        },
        createdAt: now,
      });
    });
  } catch (error) {
    redirectBatch(
      batchId,
      "error",
      error instanceof Error ? error.message : "Review baris gagal.",
    );
  }

  revalidatePath("/admin/keuangan/rekonsiliasi");
  revalidatePath(`${IMPORT_BASE_PATH}/${batchId}`);
  redirectBatch(batchId, "success", "Baris settlement berhasil diterapkan.");
}

export async function ignoreSettlementImportRowAction(formData: FormData) {
  const auth = await requirePermission("payments.reconciliation.import");
  const batchId = readText(formData, "batchId", 36);
  const rowId = readText(formData, "rowId", 36);
  const notes = readText(formData, "notes", 500);
  if (!UUID_PATTERN.test(batchId) || !UUID_PATTERN.test(rowId)) {
    redirectImport("error", "Baris import tidak valid.");
  }
  if (notes.length < 8) {
    redirectBatch(batchId, "error", "Alasan mengabaikan minimal 8 karakter.");
  }
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  const now = new Date();

  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`settlement-import-row:${rowId}`}))`,
      );
      const [row] = await transaction
        .select({
          id: settlementImportRows.id,
          organizationId: settlementImportBatches.organizationId,
          outletId: settlementImportBatches.outletId,
          status: settlementImportRows.status,
        })
        .from(settlementImportRows)
        .innerJoin(
          settlementImportBatches,
          eq(settlementImportRows.batchId, settlementImportBatches.id),
        )
        .where(
          and(
            eq(settlementImportRows.id, rowId),
            eq(settlementImportBatches.id, batchId),
            eq(settlementImportBatches.organizationId, auth.organization.id),
            inArray(settlementImportBatches.outletId, outletIds),
          ),
        )
        .limit(1);
      if (!row || ["applied", "ignored"].includes(row.status)) {
        throw new Error("Baris sudah selesai atau tidak ditemukan.");
      }
      await transaction
        .update(settlementImportRows)
        .set({ status: "ignored", reviewNotes: notes, updatedAt: now })
        .where(eq(settlementImportRows.id, rowId));
      await refreshBatchCounts(transaction, batchId, now);
      await transaction.insert(auditLogs).values({
        organizationId: row.organizationId,
        outletId: row.outletId,
        actorUserId: auth.user.id,
        action: "payment.reconciliation.import.ignore",
        entityType: "settlement_import_row",
        entityId: rowId,
        reason: notes,
        metadata: { importBatchId: batchId },
        createdAt: now,
      });
    });
  } catch (error) {
    redirectBatch(
      batchId,
      "error",
      error instanceof Error ? error.message : "Baris gagal diabaikan.",
    );
  }

  revalidatePath(`${IMPORT_BASE_PATH}/${batchId}`);
  redirectBatch(batchId, "success", "Baris ditandai diabaikan dengan audit trail.");
}
