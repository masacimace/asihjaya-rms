"use server";

import { createHash, randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { db } from "@/db";
import {
  auditLogs,
  itemBarcodes,
  legacyMigrationSoldRecords,
  legacyMigrationSessionAssignments,
  legacyMigrationSessions,
  legacyMigrationVerifications,
  legacyProductImportBatches,
  legacyProductMasterMappings,
  legacyProductRows,
  productItems,
  productMasters,
} from "@/db/schema";
import type {
  LegacyMigrationLookupResult,
  LegacyMigrationSubmissionResult,
} from "@/features/legacy-migration/verification-contracts";
import {
  collectVerificationReviewFlags,
  createVerificationFingerprint,
  normalizePhysicalBarcode,
  normalizeVerificationText,
  parsePositiveDecimal,
} from "@/features/legacy-migration/verification-rules";
import {
  getLegacyMigrationSessionLockKey,
  isLegacyMigrationUuid,
} from "@/features/legacy-migration/safety";
import {
  hasPermission,
  requirePermission,
  type AuthContext,
} from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";
import {
  deleteImageFile,
  storeImageFile,
} from "@/lib/storage/image-storage";
import { validateImageFile } from "@/lib/storage/image-validation";

function readText(formData: FormData, name: string, maxLength: number) {
  return normalizeVerificationText(formData.get(name), maxLength);
}

async function getRequestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

async function getAuthorizedSession(
  auth: AuthContext,
  sessionId: string,
  options: { requireActive: boolean },
) {
  if (!isLegacyMigrationUuid(sessionId)) return null;
  const outletIds = auth.outlets.map((outlet) => outlet.id);
  if (outletIds.length === 0) return null;

  const [session] = await db
    .select({
      id: legacyMigrationSessions.id,
      batchId: legacyMigrationSessions.batchId,
      organizationId: legacyMigrationSessions.organizationId,
      outletId: legacyMigrationSessions.outletId,
      status: legacyMigrationSessions.status,
      barcodeLength: legacyProductImportBatches.barcodeLength,
      assignmentRole: legacyMigrationSessionAssignments.assignmentRole,
    })
    .from(legacyMigrationSessions)
    .innerJoin(
      legacyProductImportBatches,
      eq(legacyMigrationSessions.batchId, legacyProductImportBatches.id),
    )
    .leftJoin(
      legacyMigrationSessionAssignments,
      and(
        eq(
          legacyMigrationSessionAssignments.sessionId,
          legacyMigrationSessions.id,
        ),
        eq(legacyMigrationSessionAssignments.userId, auth.user.id),
      ),
    )
    .where(
      and(
        eq(legacyMigrationSessions.id, sessionId),
        eq(legacyMigrationSessions.organizationId, auth.organization.id),
        inArray(legacyMigrationSessions.outletId, outletIds),
      ),
    )
    .limit(1);

  if (!session) return null;

  const managerOverride = hasPermission(auth, "migration.session.manage");
  if (!managerOverride && !session.assignmentRole) return null;
  if (options.requireActive && session.status !== "active") return null;

  return session;
}

async function findExistingBarcodeRegistration(input: {
  organizationId: string;
  barcode: string;
}) {
  const [verification, productItem, barcodeAlias] = await Promise.all([
    db
      .select({
        id: legacyMigrationVerifications.id,
        status: legacyMigrationVerifications.status,
        sessionId: legacyMigrationVerifications.sessionId,
        submissionFingerprint:
          legacyMigrationVerifications.submissionFingerprint,
        legacyRowId: legacyMigrationVerifications.legacyRowId,
        source: legacyMigrationVerifications.source,
        targetProductMasterId:
          legacyMigrationVerifications.targetProductMasterId,
        verifiedItemName: legacyMigrationVerifications.verifiedItemName,
        verifiedWeightGram:
          legacyMigrationVerifications.verifiedWeightGram,
        verifiedPurity: legacyMigrationVerifications.verifiedPurity,
        verifiedExchangePurity:
          legacyMigrationVerifications.verifiedExchangePurity,
        verifiedColor: legacyMigrationVerifications.verifiedColor,
        condition: legacyMigrationVerifications.condition,
        useLegacyImage: legacyMigrationVerifications.useLegacyImage,
        imageKey: legacyMigrationVerifications.imageKey,
        staffNotes: legacyMigrationVerifications.staffNotes,
        reviewNotes: legacyMigrationVerifications.reviewNotes,
        revision: legacyMigrationVerifications.revision,
      })
      .from(legacyMigrationVerifications)
      .where(
        and(
          eq(
            legacyMigrationVerifications.organizationId,
            input.organizationId,
          ),
          eq(legacyMigrationVerifications.barcodeValue, input.barcode),
        ),
      )
      .limit(1),

    db
      .select({ id: productItems.id })
      .from(productItems)
      .where(
        and(
          eq(productItems.organizationId, input.organizationId),
          eq(productItems.barcode, input.barcode),
        ),
      )
      .limit(1),

    db
      .select({ id: itemBarcodes.id })
      .from(itemBarcodes)
      .where(
        and(
          eq(itemBarcodes.organizationId, input.organizationId),
          eq(itemBarcodes.barcodeValue, input.barcode),
          eq(itemBarcodes.isActive, true),
        ),
      )
      .limit(1),
  ]);

  return {
    verification: verification[0] ?? null,
    alreadyProductItem: Boolean(productItem[0] || barcodeAlias[0]),
  };
}

export async function lookupLegacyMigrationBarcodeAction(input: {
  sessionId: string;
  barcode: string;
}): Promise<LegacyMigrationLookupResult> {
  const auth = await requirePermission("migration.scan");
  const session = await getAuthorizedSession(auth, input.sessionId, {
    requireActive: true,
  });

  if (!session) {
    return {
      ok: false,
      code: "SESSION_UNAVAILABLE",
      message:
        "Sesi tidak aktif, tidak ditugaskan kepadamu, atau sudah dikunci.",
    };
  }

  const barcode = normalizePhysicalBarcode(
    input.barcode,
    session.barcodeLength,
  );
  if (!barcode) {
    return {
      ok: false,
      code: "INVALID_BARCODE",
      message: "Barcode kosong atau memiliki format yang tidak didukung.",
    };
  }

  const [soldRecord] = await db
    .select({ id: legacyMigrationSoldRecords.id })
    .from(legacyMigrationSoldRecords)
    .where(
      and(
        eq(legacyMigrationSoldRecords.organizationId, auth.organization.id),
        eq(legacyMigrationSoldRecords.barcodeValue, barcode),
        sql`${legacyMigrationSoldRecords.revertedAt} is null`,
      ),
    )
    .limit(1);
  if (soldRecord) {
    return {
      ok: false,
      code: "SOLD_DURING_MIGRATION",
      message:
        "Barcode sudah ditandai terjual di sistem lama dan dikecualikan dari migrasi.",
    };
  }

  const registration = await findExistingBarcodeRegistration({
    organizationId: auth.organization.id,
    barcode,
  });

  if (registration.alreadyProductItem) {
    return {
      ok: false,
      code: "ALREADY_REGISTERED",
      message: "Barcode sudah terhubung ke item pada sistem baru.",
    };
  }

  const returnedVerification =
    registration.verification?.status === "returned" &&
    registration.verification.sessionId === session.id
      ? registration.verification
      : null;

  if (registration.verification && !returnedVerification) {
    return {
      ok: false,
      code: "ALREADY_VERIFIED",
      message: `Barcode sudah diproses dengan status ${registration.verification.status}.`,
    };
  }

  const legacyRows = await db
    .select({
      id: legacyProductRows.id,
      rowNumber: legacyProductRows.rowNumber,
      validationStatus: legacyProductRows.validationStatus,
      validationIssues: legacyProductRows.validationIssues,
      category: legacyProductRows.legacyCategory,
      masterCode: legacyProductRows.legacyMasterCode,
      masterName: legacyProductRows.legacyMasterName,
      itemName: legacyProductRows.legacyItemName,
      purity: legacyProductRows.legacyPurity,
      exchangePurity: legacyProductRows.legacyExchangePurity,
      weightGram: legacyProductRows.legacyWeightGram,
      color: legacyProductRows.legacyColor,
      imageUrl: legacyProductRows.legacyImageUrl,
      mappingStatus: legacyProductMasterMappings.status,
      mappedProductMasterId:
        legacyProductMasterMappings.targetProductMasterId,
      mappedProductMasterName: productMasters.name,
    })
    .from(legacyProductRows)
    .leftJoin(
      legacyProductMasterMappings,
      and(
        eq(
          legacyProductMasterMappings.batchId,
          legacyProductRows.batchId,
        ),
        eq(
          legacyProductMasterMappings.legacyMasterCode,
          legacyProductRows.legacyMasterCode,
        ),
      ),
    )
    .leftJoin(
      productMasters,
      eq(
        legacyProductMasterMappings.targetProductMasterId,
        productMasters.id,
      ),
    )
    .where(
      and(
        eq(legacyProductRows.batchId, session.batchId),
        eq(legacyProductRows.organizationId, auth.organization.id),
        eq(legacyProductRows.outletId, session.outletId),
        eq(legacyProductRows.normalizedBarcode, barcode),
      ),
    )
    .limit(3);

  if (legacyRows.length > 1) {
    return {
      ok: false,
      code: "DUPLICATE_LEGACY_ROW",
      message:
        "Barcode muncul lebih dari sekali pada data legacy. Manager harus menyelesaikan konflik ini.",
    };
  }

  const legacy = legacyRows[0];
  if (!legacy) {
    return {
      ok: true,
      barcode,
      source: returnedVerification?.source ?? "physical_unmatched",
      existingVerification: returnedVerification
        ? {
            id: returnedVerification.id,
            targetProductMasterId: returnedVerification.targetProductMasterId,
            verifiedItemName: returnedVerification.verifiedItemName,
            verifiedWeightGram: returnedVerification.verifiedWeightGram,
            verifiedPurity: returnedVerification.verifiedPurity,
            verifiedExchangePurity:
              returnedVerification.verifiedExchangePurity,
            verifiedColor: returnedVerification.verifiedColor,
            condition:
              returnedVerification.condition === "damaged"
                ? "damaged"
                : "good",
            useLegacyImage: returnedVerification.useLegacyImage,
            hasActualImage: Boolean(returnedVerification.imageKey),
            staffNotes: returnedVerification.staffNotes,
            reviewNotes: returnedVerification.reviewNotes,
            revision: returnedVerification.revision,
          }
        : null,
      legacy: null,
      messages: returnedVerification
        ? [
            "Verification dikembalikan manager. Perbaiki data sesuai catatan dan kirim ulang.",
            returnedVerification.reviewNotes ?? "Periksa kembali seluruh data fisik.",
          ]
        : [
            "Barcode tidak ditemukan di export legacy.",
            "Isi data fisik dan unggah foto. Item otomatis masuk antrean needs review.",
          ],
    };
  }

  const messages: string[] = [];
  if (legacy.validationStatus !== "valid") {
    messages.push(
      "Baris legacy memiliki warning/invalid dan wajib diperiksa manager.",
    );
  }
  if (legacy.mappingStatus !== "mapped") {
    messages.push(
      "Master legacy belum dipetakan. Pilih master yang sesuai; hasil akan masuk needs review.",
    );
  }

  if (returnedVerification) {
    messages.unshift(
      returnedVerification.reviewNotes ??
        "Verification dikembalikan manager. Perbaiki dan kirim ulang.",
    );
  }

  return {
    ok: true,
    barcode,
    source: returnedVerification?.source ?? "legacy_match",
    existingVerification: returnedVerification
      ? {
          id: returnedVerification.id,
          targetProductMasterId: returnedVerification.targetProductMasterId,
          verifiedItemName: returnedVerification.verifiedItemName,
          verifiedWeightGram: returnedVerification.verifiedWeightGram,
          verifiedPurity: returnedVerification.verifiedPurity,
          verifiedExchangePurity: returnedVerification.verifiedExchangePurity,
          verifiedColor: returnedVerification.verifiedColor,
          condition:
            returnedVerification.condition === "damaged"
              ? "damaged"
              : "good",
          useLegacyImage: returnedVerification.useLegacyImage,
          hasActualImage: Boolean(returnedVerification.imageKey),
          staffNotes: returnedVerification.staffNotes,
          reviewNotes: returnedVerification.reviewNotes,
          revision: returnedVerification.revision,
        }
      : null,
    legacy: {
      rowId: legacy.id,
      rowNumber: legacy.rowNumber,
      validationStatus: legacy.validationStatus,
      validationIssues: legacy.validationIssues,
      category: legacy.category,
      masterCode: legacy.masterCode,
      masterName: legacy.masterName,
      itemName: legacy.itemName,
      purity: legacy.purity,
      exchangePurity: legacy.exchangePurity,
      weightGram: legacy.weightGram,
      color: legacy.color,
      imageUrl:
        legacy.imageUrl && /^https?:\/\//i.test(legacy.imageUrl)
          ? legacy.imageUrl
          : null,
      mappedProductMasterId: legacy.mappedProductMasterId,
      mappedProductMasterName: legacy.mappedProductMasterName,
      mappingStatus: legacy.mappingStatus,
    },
    messages,
  };
}

export async function submitLegacyMigrationVerificationAction(
  formData: FormData,
): Promise<LegacyMigrationSubmissionResult> {
  const auth = await requirePermission("migration.verification.submit");
  const sessionId = readText(formData, "sessionId", 36) ?? "";
  const session = await getAuthorizedSession(auth, sessionId, {
    requireActive: true,
  });

  if (!session) {
    return {
      ok: false,
      message:
        "Sesi tidak aktif, tidak ditugaskan kepadamu, atau sudah dikunci.",
    };
  }

  const barcode = normalizePhysicalBarcode(
    formData.get("barcode"),
    session.barcodeLength,
  );
  const source = readText(formData, "source", 32);
  const legacyRowId = readText(formData, "legacyRowId", 36);
  const existingVerificationId = readText(
    formData,
    "existingVerificationId",
    36,
  );
  const targetProductMasterId =
    readText(formData, "targetProductMasterId", 36) ?? "";
  const verifiedItemName = readText(formData, "verifiedItemName", 240);
  const weight = parsePositiveDecimal(
    formData.get("verifiedWeightGram"),
    1_000_000,
  );
  const purity = parsePositiveDecimal(
    formData.get("verifiedPurity"),
    10_000,
  );
  const exchangePurityRaw = String(
    formData.get("verifiedExchangePurity") ?? "",
  ).trim();
  const exchangePurity = parsePositiveDecimal(
    exchangePurityRaw,
    10_000,
  );
  const verifiedColor = readText(formData, "verifiedColor", 120);
  const conditionRaw = readText(formData, "condition", 20);
  const condition = conditionRaw === "damaged" ? "damaged" : "good";
  const useLegacyImage = formData.get("useLegacyImage") === "on";
  const staffNotes = readText(formData, "staffNotes", 2_000);
  const image = formData.get("image");

  const fieldErrors: Record<string, string> = {};
  if (!barcode) fieldErrors.barcode = "Barcode tidak valid.";
  if (!["legacy_match", "physical_unmatched"].includes(source ?? "")) {
    fieldErrors.source = "Sumber verifikasi tidak valid.";
  }
  if (source === "legacy_match" && !isLegacyMigrationUuid(legacyRowId ?? "")) {
    fieldErrors.legacyRowId = "Referensi baris legacy tidak valid.";
  }
  if (source === "physical_unmatched" && legacyRowId) {
    fieldErrors.legacyRowId = "Item unmatched tidak boleh memiliki baris legacy.";
  }
  if (!isLegacyMigrationUuid(targetProductMasterId)) {
    fieldErrors.targetProductMasterId = "Pilih Product Master yang valid.";
  }
  if (!verifiedItemName || verifiedItemName.length < 2) {
    fieldErrors.verifiedItemName = "Nama item wajib diisi minimal 2 karakter.";
  }
  if (!weight.value || weight.numberValue === null) {
    fieldErrors.verifiedWeightGram = "Berat wajib lebih dari 0.";
  }
  if (!purity.value || purity.numberValue === null) {
    fieldErrors.verifiedPurity = "Kadar wajib lebih dari 0.";
  }
  if (exchangePurityRaw && !exchangePurity.value) {
    fieldErrors.verifiedExchangePurity =
      "Kadar tukaran harus berupa angka lebih dari 0.";
  }

  const existingReturnedVerification =
    barcode && isLegacyMigrationUuid(existingVerificationId ?? "")
      ? (
          await db
            .select({
              id: legacyMigrationVerifications.id,
              status: legacyMigrationVerifications.status,
              sessionId: legacyMigrationVerifications.sessionId,
              imageKey: legacyMigrationVerifications.imageKey,
              revision: legacyMigrationVerifications.revision,
            })
            .from(legacyMigrationVerifications)
            .where(
              and(
                eq(legacyMigrationVerifications.id, existingVerificationId!),
                eq(
                  legacyMigrationVerifications.organizationId,
                  auth.organization.id,
                ),
                eq(legacyMigrationVerifications.sessionId, session.id),
                eq(legacyMigrationVerifications.barcodeValue, barcode),
                eq(legacyMigrationVerifications.status, "returned"),
              ),
            )
            .limit(1)
        )[0] ?? null
      : null;

  const selectedImage = image instanceof File && image.size > 0 ? image : null;
  if (selectedImage) {
    const validation = validateImageFile(selectedImage);
    if (!validation.valid) fieldErrors.image = validation.message;
  }
  if (
    !useLegacyImage &&
    !selectedImage &&
    !existingReturnedVerification?.imageKey
  ) {
    fieldErrors.image =
      "Gunakan foto legacy, pertahankan foto aktual sebelumnya, atau unggah foto baru.";
  }
  if (source === "physical_unmatched" && useLegacyImage) {
    fieldErrors.image = "Item unmatched tidak memiliki foto legacy.";
  }
  if (useLegacyImage && selectedImage) {
    fieldErrors.image =
      "Pilih salah satu: gunakan foto legacy atau unggah foto aktual.";
  }
  if (conditionRaw !== "good" && conditionRaw !== "damaged") {
    fieldErrors.condition = "Kondisi fisik tidak valid.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Periksa kembali data verifikasi.",
      fieldErrors,
    };
  }

  const [targetMasterRow] = await db
    .select({ id: productMasters.id })
    .from(productMasters)
    .where(
      and(
        eq(productMasters.id, targetProductMasterId),
        eq(productMasters.organizationId, auth.organization.id),
        inArray(productMasters.status, ["draft", "active"]),
      ),
    )
    .limit(1);

  if (!targetMasterRow) {
    return {
      ok: false,
      message: "Product Master tidak tersedia untuk organisasi ini.",
    };
  }

  const legacyRows =
    source === "legacy_match"
      ? await db
          .select({
            id: legacyProductRows.id,
            validationStatus: legacyProductRows.validationStatus,
            itemName: legacyProductRows.legacyItemName,
            weightGram: legacyProductRows.legacyWeightGram,
            purity: legacyProductRows.legacyPurity,
            exchangePurity: legacyProductRows.legacyExchangePurity,
            color: legacyProductRows.legacyColor,
            imageUrl: legacyProductRows.legacyImageUrl,
            mappedProductMasterId:
              legacyProductMasterMappings.targetProductMasterId,
          })
          .from(legacyProductRows)
          .leftJoin(
            legacyProductMasterMappings,
            and(
              eq(
                legacyProductMasterMappings.batchId,
                legacyProductRows.batchId,
              ),
              eq(
                legacyProductMasterMappings.legacyMasterCode,
                legacyProductRows.legacyMasterCode,
              ),
            ),
          )
          .where(
            and(
              eq(legacyProductRows.id, legacyRowId!),
              eq(legacyProductRows.batchId, session.batchId),
              eq(legacyProductRows.organizationId, auth.organization.id),
              eq(legacyProductRows.outletId, session.outletId),
              eq(legacyProductRows.normalizedBarcode, barcode!),
            ),
          )
          .limit(1)
      : [];

  const legacyRow = legacyRows[0] ?? null;
  if (source === "legacy_match" && !legacyRow) {
    return {
      ok: false,
      message: "Data legacy berubah atau tidak lagi cocok dengan barcode.",
    };
  }
  const safeLegacyImageUrl =
    legacyRow?.imageUrl && /^https?:\/\//i.test(legacyRow.imageUrl)
      ? legacyRow.imageUrl
      : null;
  if (useLegacyImage && !safeLegacyImageUrl) {
    return {
      ok: false,
      message: "Foto legacy tidak tersedia. Unggah foto aktual.",
    };
  }

  const reviewFlags = collectVerificationReviewFlags({
    source: source as "legacy_match" | "physical_unmatched",
    legacyValidationStatus: legacyRow?.validationStatus ?? null,
    mappedProductMasterId: legacyRow?.mappedProductMasterId ?? null,
    selectedProductMasterId: targetProductMasterId,
    legacyItemName: legacyRow?.itemName ?? null,
    verifiedItemName: verifiedItemName!,
    legacyWeightGram: legacyRow?.weightGram ?? null,
    verifiedWeightGram: weight.numberValue!,
    legacyPurity: legacyRow?.purity ?? null,
    verifiedPurity: purity.numberValue!,
    legacyExchangePurity: legacyRow?.exchangePurity ?? null,
    verifiedExchangePurity: exchangePurity.numberValue,
    legacyColor: legacyRow?.color ?? null,
    verifiedColor,
    condition,
    useLegacyImage,
    hasUploadedImage: Boolean(
      selectedImage || existingReturnedVerification?.imageKey,
    ),
  });

  const imageSha256 = selectedImage
    ? createHash("sha256")
        .update(Buffer.from(await selectedImage.arrayBuffer()))
        .digest("hex")
    : existingReturnedVerification?.imageKey
      ? `existing:${existingReturnedVerification.imageKey}`
      : null;
  const fingerprint = createVerificationFingerprint({
    sessionId,
    barcode: barcode!,
    legacyRowId: legacyRow?.id ?? null,
    targetProductMasterId,
    verifiedItemName: verifiedItemName!,
    verifiedWeightGram: weight.value!,
    verifiedPurity: purity.value!,
    verifiedExchangePurity: exchangePurity.value,
    verifiedColor,
    condition,
    useLegacyImage,
    staffNotes,
    imageSha256,
  });

  const earlyRegistration = await findExistingBarcodeRegistration({
    organizationId: auth.organization.id,
    barcode: barcode!,
  });
  if (earlyRegistration.alreadyProductItem) {
    return {
      ok: false,
      message: "Barcode sudah terhubung ke item sistem baru.",
    };
  }
  if (
    earlyRegistration.verification &&
    !(
      earlyRegistration.verification.status === "returned" &&
      earlyRegistration.verification.id === existingReturnedVerification?.id &&
      earlyRegistration.verification.sessionId === session.id
    )
  ) {
    if (earlyRegistration.verification.submissionFingerprint === fingerprint) {
      return {
        ok: true,
        verificationId: earlyRegistration.verification.id,
        status:
          earlyRegistration.verification.status === "needs_review"
            ? "needs_review"
            : "submitted",
        message: "Verifikasi sebelumnya sudah tersimpan. Retry tidak membuat data ganda.",
      };
    }
    return {
      ok: false,
      message: "Barcode sudah diverifikasi dengan data berbeda.",
    };
  }

  const verificationId = existingReturnedVerification?.id ?? randomUUID();
  const previousImageKey = existingReturnedVerification?.imageKey ?? null;
  let imageKey: string | null = previousImageKey;
  let storedNewImage = false;
  try {
    if (selectedImage) {
      imageKey = await storeImageFile({
        file: selectedImage,
        organizationId: auth.organization.id,
        entityType: "items",
        entityId: verificationId,
      });
      storedNewImage = true;
    }

    const requestMetadata = await getRequestMetadata();
    const status = reviewFlags.length > 0 ? "needs_review" : "submitted";

    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${getLegacyMigrationSessionLockKey({
          organizationId: auth.organization.id,
          sessionId: session.id,
        })}, 0))`,
      );
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`legacy-barcode:${auth.organization.id}:${barcode}`}, 0))`,
      );

      const [freshSoldRecord] = await transaction
        .select({ id: legacyMigrationSoldRecords.id })
        .from(legacyMigrationSoldRecords)
        .where(
          and(
            eq(
              legacyMigrationSoldRecords.organizationId,
              auth.organization.id,
            ),
            eq(legacyMigrationSoldRecords.barcodeValue, barcode!),
            sql`${legacyMigrationSoldRecords.revertedAt} is null`,
          ),
        )
        .limit(1);
      if (freshSoldRecord) {
        throw new Error("BARCODE_SOLD_DURING_MIGRATION");
      }

      const managerOverride = hasPermission(
        auth,
        "migration.session.manage",
      );
      const [freshSession] = await transaction
        .select({ status: legacyMigrationSessions.status })
        .from(legacyMigrationSessions)
        .where(
          and(
            eq(legacyMigrationSessions.id, session.id),
            eq(legacyMigrationSessions.batchId, session.batchId),
            eq(legacyMigrationSessions.organizationId, auth.organization.id),
            eq(legacyMigrationSessions.outletId, session.outletId),
          ),
        )
        .limit(1)
        .for("update");
      if (freshSession?.status !== "active") {
        throw new Error("SESSION_NOT_ACTIVE");
      }

      if (!managerOverride) {
        const [freshAssignment] = await transaction
          .select({
            assignmentRole:
              legacyMigrationSessionAssignments.assignmentRole,
          })
          .from(legacyMigrationSessionAssignments)
          .where(
            and(
              eq(
                legacyMigrationSessionAssignments.sessionId,
                session.id,
              ),
              eq(
                legacyMigrationSessionAssignments.userId,
                auth.user.id,
              ),
            ),
          )
          .limit(1);
        if (!freshAssignment) {
          throw new Error("SESSION_ASSIGNMENT_REMOVED");
        }
      }

      const [freshTargetMaster] = await transaction
        .select({ id: productMasters.id })
        .from(productMasters)
        .where(
          and(
            eq(productMasters.id, targetProductMasterId),
            eq(productMasters.organizationId, auth.organization.id),
            inArray(productMasters.status, ["draft", "active"]),
          ),
        )
        .limit(1);
      if (!freshTargetMaster) {
        throw new Error("TARGET_MASTER_UNAVAILABLE");
      }

      const existingVerification = await transaction
        .select({
          id: legacyMigrationVerifications.id,
          submissionFingerprint:
            legacyMigrationVerifications.submissionFingerprint,
          status: legacyMigrationVerifications.status,
          sessionId: legacyMigrationVerifications.sessionId,
          imageKey: legacyMigrationVerifications.imageKey,
          revision: legacyMigrationVerifications.revision,
        })
        .from(legacyMigrationVerifications)
        .where(
          and(
            eq(
              legacyMigrationVerifications.organizationId,
              auth.organization.id,
            ),
            eq(legacyMigrationVerifications.barcodeValue, barcode!),
          ),
        )
        .limit(1);

      const existingProductItem = await transaction
        .select({ id: productItems.id })
        .from(productItems)
        .where(
          and(
            eq(productItems.organizationId, auth.organization.id),
            eq(productItems.barcode, barcode!),
          ),
        )
        .limit(1);

      const existingAlias = await transaction
        .select({ id: itemBarcodes.id })
        .from(itemBarcodes)
        .where(
          and(
            eq(itemBarcodes.organizationId, auth.organization.id),
            eq(itemBarcodes.barcodeValue, barcode!),
            eq(itemBarcodes.isActive, true),
          ),
        )
        .limit(1);

      if (existingProductItem[0] || existingAlias[0]) {
        throw new Error("BARCODE_ALREADY_REGISTERED");
      }
      const existingRow = existingVerification[0] ?? null;
      const isReturnedResubmission =
        existingRow?.status === "returned" &&
        existingRow.id === existingReturnedVerification?.id &&
        existingRow.sessionId === session.id;

      if (existingRow && !isReturnedResubmission) {
        if (existingRow.submissionFingerprint === fingerprint) {
          throw new Error(`IDEMPOTENT:${existingRow.id}`);
        }
        throw new Error("BARCODE_ALREADY_VERIFIED");
      }

      if (isReturnedResubmission && existingRow) {
        const updatedVerifications = await transaction
          .update(legacyMigrationVerifications)
          .set({
            legacyRowId: legacyRow?.id ?? null,
            source: source as "legacy_match" | "physical_unmatched",
            status,
            targetProductMasterId,
            verifiedItemName: verifiedItemName!,
            verifiedWeightGram: weight.value!,
            verifiedPurity: purity.value!,
            verifiedExchangePurity: exchangePurity.value,
            verifiedColor,
            condition,
            useLegacyImage,
            legacyImageUrl: useLegacyImage ? safeLegacyImageUrl : null,
            imageKey: useLegacyImage ? null : imageKey,
            staffNotes,
            reviewFlags,
            submissionFingerprint: fingerprint,
            submittedBy: auth.user.id,
            submittedAt: new Date(),
            reviewedBy: null,
            reviewedAt: null,
            reviewNotes: null,
            revision: sql`${legacyMigrationVerifications.revision} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(legacyMigrationVerifications.id, existingRow.id),
              eq(legacyMigrationVerifications.sessionId, session.id),
              eq(legacyMigrationVerifications.status, "returned"),
            ),
          )
          .returning({ id: legacyMigrationVerifications.id });
        if (updatedVerifications.length !== 1) {
          throw new Error("VERIFICATION_RESUBMIT_STATE_CHANGED");
        }
      } else {
        await transaction.insert(legacyMigrationVerifications).values({
          id: verificationId,
          sessionId: session.id,
          batchId: session.batchId,
          organizationId: auth.organization.id,
          outletId: session.outletId,
          barcodeValue: barcode!,
          legacyRowId: legacyRow?.id ?? null,
          source: source as "legacy_match" | "physical_unmatched",
          status,
          targetProductMasterId,
          verifiedItemName: verifiedItemName!,
          verifiedWeightGram: weight.value!,
          verifiedPurity: purity.value!,
          verifiedExchangePurity: exchangePurity.value,
          verifiedColor,
          condition,
          useLegacyImage,
          legacyImageUrl: useLegacyImage ? safeLegacyImageUrl : null,
          imageKey: useLegacyImage ? null : imageKey,
          staffNotes,
          reviewFlags,
          submissionFingerprint: fingerprint,
          submittedBy: auth.user.id,
        });
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: session.outletId,
        actorUserId: auth.user.id,
        action: existingReturnedVerification
          ? "legacy_migration_verification.resubmit"
          : "legacy_migration_verification.submit",
        entityType: "legacy_migration_verification",
        entityId: verificationId,
        afterData: {
          sessionId: session.id,
          batchId: session.batchId,
          barcode,
          source,
          status,
          legacyRowId: legacyRow?.id ?? null,
          targetProductMasterId,
          reviewFlags,
          useLegacyImage,
          hasUploadedImage: Boolean(imageKey),
        },
        reason: existingReturnedVerification
          ? "Verification yang dikembalikan manager diperbaiki dan dikirim ulang."
          : "Verifikasi fisik dikirim ke antrean manager tanpa membuat inventory aktif.",
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });

    if (
      previousImageKey &&
      (useLegacyImage || (storedNewImage && previousImageKey !== imageKey))
    ) {
      await deleteImageFile(previousImageKey).catch(() => undefined);
    }

    revalidatePath(`/pos/migrasi-barang/${session.id}`);
    revalidatePath(`/admin/migrasi-produk/${session.batchId}/sesi`);
    revalidatePath(`/admin/migrasi-produk/${session.batchId}/review`);
    revalidatePath(
      `/admin/migrasi-produk/${session.batchId}/review/${verificationId}`,
    );

    return {
      ok: true,
      verificationId,
      status: reviewFlags.length > 0 ? "needs_review" : "submitted",
      message: existingReturnedVerification
        ? "Perbaikan tersimpan dan verification dikirim ulang ke manager."
        : reviewFlags.length > 0
          ? "Verifikasi tersimpan dan masuk antrean needs review manager."
          : "Verifikasi tersimpan dan siap direview manager.",
    };
  } catch (error) {
    if (storedNewImage && imageKey) {
      await deleteImageFile(imageKey).catch(() => undefined);
    }

    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("IDEMPOTENT:")) {
      return {
        ok: true,
        verificationId: message.slice("IDEMPOTENT:".length),
        status: reviewFlags.length > 0 ? "needs_review" : "submitted",
        message: "Verifikasi sebelumnya sudah tersimpan. Retry aman.",
      };
    }
    if (message === "SESSION_NOT_ACTIVE") {
      return {
        ok: false,
        message: "Sesi sudah dikunci atau tidak lagi aktif.",
      };
    }
    if (message === "SESSION_ASSIGNMENT_REMOVED") {
      return {
        ok: false,
        message: "Penugasanmu pada sesi ini sudah dicabut oleh manager.",
      };
    }
    if (message === "VERIFICATION_RESUBMIT_STATE_CHANGED") {
      return {
        ok: false,
        message:
          "Status verification berubah saat dikirim ulang. Muat ulang form lalu coba kembali.",
      };
    }
    if (message === "TARGET_MASTER_UNAVAILABLE") {
      return {
        ok: false,
        message: "Product Master berubah atau tidak lagi dapat digunakan.",
      };
    }
    if (message === "BARCODE_SOLD_DURING_MIGRATION") {
      return {
        ok: false,
        message:
          "Barcode sudah ditandai terjual di sistem lama dan dikecualikan dari migrasi.",
      };
    }
    if (message === "BARCODE_ALREADY_REGISTERED") {
      return {
        ok: false,
        message: "Barcode sudah terhubung ke item sistem baru.",
      };
    }
    if (message === "BARCODE_ALREADY_VERIFIED") {
      return {
        ok: false,
        message: "Barcode sudah diverifikasi dengan data berbeda.",
      };
    }

    console.error("legacy_migration_verification.submit_failed", error);
    return { ok: false, message: "Verifikasi gagal disimpan. Coba kembali." };
  }
}
