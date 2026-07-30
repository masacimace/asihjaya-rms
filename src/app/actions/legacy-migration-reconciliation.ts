"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  legacyMigrationSoldRecords,
  legacyMigrationVerifications,
  productItems,
} from "@/db/schema";
import { LEGACY_PHOTO_MIGRATION_BATCH_SIZE } from "@/features/legacy-migration/reconciliation-contracts";
import { getLegacyPhotoMigrationCandidates } from "@/features/legacy-migration/reconciliation-queries";
import {
  buildLegacyPhotoMigrationMetadata,
  isLegacyPhotoMigrationItemEligible,
} from "@/features/legacy-migration/reconciliation-rules";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";
import {
  deleteImageFile,
} from "@/lib/storage/image-storage";
import {
  importLegacyImageToPrivateStorage,
  LegacyImageImportError,
} from "@/lib/storage/legacy-image-import";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHOTO_IMPORT_CONCURRENCY = 5;

type PhotoOutcome = "copied" | "failed" | "skipped";

function readText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "").trim().slice(0, maxLength);
}

function reconciliationPath(batchId: string) {
  return `/admin/migrasi-produk/${batchId}/rekonsiliasi`;
}

function redirectWithMessage(
  path: string,
  type: "success" | "error",
  message: string,
): never {
  redirect(`${path}?${new URLSearchParams({ type, message }).toString()}`);
}

async function requestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function photoMetadataSql(value: Record<string, unknown>) {
  return sql`jsonb_set(
    coalesce(${productItems.attributes}, '{}'::jsonb),
    '{legacyPhotoMigration}',
    ${JSON.stringify(value)}::jsonb,
    true
  )`;
}

function explainImportError(error: unknown) {
  if (error instanceof LegacyImageImportError) {
    return {
      code: error.code,
      message: error.message.slice(0, 500),
    };
  }

  return {
    code: "UNEXPECTED_ERROR",
    message: "Foto legacy gagal diproses karena kesalahan tidak terduga.",
  };
}

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<PhotoOutcome>,
) {
  const outcomes: PhotoOutcome[] = [];
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (!item) continue;
      outcomes[index] = await worker(item);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => runWorker(),
    ),
  );

  return outcomes;
}

export async function migrateLegacyPhotosAction(formData: FormData) {
  const auth = await requirePermission("migration.verification.approve");
  const batchId = readText(formData, "batchId", 36);
  const mode = readText(formData, "mode", 16) === "failed" ? "failed" : "pending";

  if (!UUID_PATTERN.test(batchId)) {
    redirectWithMessage(
      "/admin/migrasi-produk",
      "error",
      "Batch migrasi tidak valid.",
    );
  }

  const candidateData = await getLegacyPhotoMigrationCandidates(
    auth,
    batchId,
    mode,
    LEGACY_PHOTO_MIGRATION_BATCH_SIZE,
  );
  if (!candidateData) {
    redirectWithMessage(
      "/admin/migrasi-produk",
      "error",
      "Batch migrasi tidak ditemukan atau tidak dapat diakses.",
    );
  }
  if (candidateData.rows.length === 0) {
    redirectWithMessage(
      reconciliationPath(batchId),
      "success",
      mode === "failed"
        ? "Tidak ada foto gagal yang perlu diulang."
        : "Tidak ada foto legacy pending yang perlu disalin.",
    );
  }

  const metadata = await requestMetadata();
  const outcomes = await processWithConcurrency(
    candidateData.rows,
    PHOTO_IMPORT_CONCURRENCY,
    async (candidate): Promise<PhotoOutcome> => {
      const sourceUrl = candidate.legacyImageUrl;
      if (!sourceUrl) return "skipped";

      let uploadedImageKey: string | null = null;
      try {
        const imported = await importLegacyImageToPrivateStorage({
          sourceUrl,
          organizationId: auth.organization.id,
          itemId: candidate.productItemId,
        });
        uploadedImageKey = imported.imageKey;
        const attemptedAt = new Date();
        const migrationMetadata = buildLegacyPhotoMigrationMetadata({
          status: "copied",
          attemptedAt,
          sourceUrl,
          finalUrl: imported.finalUrl,
          imageKey: imported.imageKey,
          sourceBytes: imported.sourceBytes,
          contentType: imported.contentType,
        });

        const outcome = await db.transaction(async (transaction) => {
          await transaction.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-photo:${auth.organization.id}:${candidate.productItemId}`}, 0))`,
          );

          const [current] = await transaction
            .select({
              verificationId: legacyMigrationVerifications.id,
              verificationStatus: legacyMigrationVerifications.status,
              useLegacyImage: legacyMigrationVerifications.useLegacyImage,
              legacyImageUrl: legacyMigrationVerifications.legacyImageUrl,
              itemId: productItems.id,
              itemImageKey: productItems.imageKey,
              itemAvailability: productItems.availability,
              itemIsActive: productItems.isActive,
            })
            .from(legacyMigrationVerifications)
            .innerJoin(
              productItems,
              eq(legacyMigrationVerifications.productItemId, productItems.id),
            )
            .where(
              and(
                eq(
                  legacyMigrationVerifications.id,
                  candidate.verificationId,
                ),
                eq(legacyMigrationVerifications.batchId, batchId),
                eq(
                  legacyMigrationVerifications.organizationId,
                  auth.organization.id,
                ),
                eq(productItems.id, candidate.productItemId),
              ),
            )
            .limit(1)
            .for("update");

          const [soldRecord] = await transaction
            .select({ id: legacyMigrationSoldRecords.id })
            .from(legacyMigrationSoldRecords)
            .where(
              and(
                eq(
                  legacyMigrationSoldRecords.organizationId,
                  auth.organization.id,
                ),
                eq(
                  legacyMigrationSoldRecords.barcodeValue,
                  candidate.barcodeValue,
                ),
                isNull(legacyMigrationSoldRecords.revertedAt),
              ),
            )
            .limit(1);

          if (
            !current ||
            soldRecord ||
            !isLegacyPhotoMigrationItemEligible({
              verificationStatus: current.verificationStatus,
              itemAvailability: current.itemAvailability,
            }) ||
            !current.useLegacyImage ||
            current.legacyImageUrl !== sourceUrl ||
            !current.itemIsActive ||
            current.itemImageKey
          ) {
            return "skipped" as const;
          }

          await transaction
            .update(productItems)
            .set({
              imageKey: imported.imageKey,
              attributes: photoMetadataSql(migrationMetadata),
              updatedAt: attemptedAt,
            })
            .where(eq(productItems.id, current.itemId));

          await transaction.insert(auditLogs).values({
            organizationId: auth.organization.id,
            outletId: candidateData.batch.outletId,
            actorUserId: auth.user.id,
            action: "legacy_migration_photo.copy",
            entityType: "product_item",
            entityId: current.itemId,
            afterData: {
              batchId,
              verificationId: current.verificationId,
              barcodeValue: candidate.barcodeValue,
              imageKey: imported.imageKey,
              sourceBytes: imported.sourceBytes,
              contentType: imported.contentType,
            },
            reason: "Menyalin foto item legacy ke private image storage.",
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
          });

          return "copied" as const;
        });

        if (outcome === "skipped") {
          await deleteImageFile(uploadedImageKey);
        }
        return outcome;
      } catch (error) {
        if (uploadedImageKey) {
          await deleteImageFile(uploadedImageKey);
        }

        const failure = explainImportError(error);
        const attemptedAt = new Date();
        const migrationMetadata = buildLegacyPhotoMigrationMetadata({
          status: "failed",
          attemptedAt,
          sourceUrl,
          errorCode: failure.code,
          errorMessage: failure.message,
        });

        try {
          return await db.transaction(async (transaction) => {
            await transaction.execute(
              sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-photo:${auth.organization.id}:${candidate.productItemId}`}, 0))`,
            );
            const [current] = await transaction
              .select({
                id: productItems.id,
                imageKey: productItems.imageKey,
                availability: productItems.availability,
                isActive: productItems.isActive,
                verificationStatus: legacyMigrationVerifications.status,
              })
              .from(productItems)
              .innerJoin(
                legacyMigrationVerifications,
                eq(legacyMigrationVerifications.productItemId, productItems.id),
              )
              .where(
                and(
                  eq(productItems.id, candidate.productItemId),
                  eq(productItems.organizationId, auth.organization.id),
                  eq(
                    legacyMigrationVerifications.id,
                    candidate.verificationId,
                  ),
                  eq(legacyMigrationVerifications.batchId, batchId),
                ),
              )
              .limit(1)
              .for("update");

            if (
              !current ||
              current.imageKey ||
              !isLegacyPhotoMigrationItemEligible({
                verificationStatus: current.verificationStatus,
                itemAvailability: current.availability,
              }) ||
              !current.isActive
            ) {
              return "skipped" as const;
            }

            await transaction
              .update(productItems)
              .set({
                attributes: photoMetadataSql(migrationMetadata),
                updatedAt: attemptedAt,
              })
              .where(eq(productItems.id, current.id));

            await transaction.insert(auditLogs).values({
              organizationId: auth.organization.id,
              outletId: candidateData.batch.outletId,
              actorUserId: auth.user.id,
              action: "legacy_migration_photo.copy_failed",
              entityType: "product_item",
              entityId: current.id,
              afterData: {
                batchId,
                verificationId: candidate.verificationId,
                barcodeValue: candidate.barcodeValue,
                errorCode: failure.code,
              },
              reason: failure.message,
              ipAddress: metadata.ipAddress,
              userAgent: metadata.userAgent,
            });

            return "failed" as const;
          });
        } catch (databaseError) {
          console.error(
            "legacy_migration_photo.failure_state_write_failed",
            databaseError,
          );
          return "failed";
        }
      }
    },
  );

  const copied = outcomes.filter((outcome) => outcome === "copied").length;
  const failed = outcomes.filter((outcome) => outcome === "failed").length;
  const skipped = outcomes.filter((outcome) => outcome === "skipped").length;

  revalidatePath(reconciliationPath(batchId));
  revalidatePath(`/admin/migrasi-produk/${batchId}`);
  revalidatePath(`/admin/inventaris`);

  redirectWithMessage(
    reconciliationPath(batchId),
    failed > 0 ? "error" : "success",
    `Foto diproses: ${copied} tersalin, ${failed} gagal, ${skipped} dilewati. Kegagalan foto tidak memblokir cutover.`,
  );
}
