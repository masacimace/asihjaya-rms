"use server";

import { randomUUID } from "node:crypto";

import { and, count, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  legacyMigrationSessionAssignments,
  legacyMigrationSessions,
  legacyMigrationVerifications,
  legacyProductImportBatches,
  legacyProductMasterMappings,
  productCategories,
  productMasters,
  userOutlets,
  users,
} from "@/db/schema";
import {
  buildLegacyProductMasterCode,
  getSuggestedCategoryCode,
} from "@/features/legacy-migration/master-mapping";
import {
  getLegacyMigrationSessionLockKey,
  isLegacyMigrationUuid,
  parseLegacyMigrationUuid,
} from "@/features/legacy-migration/safety";
import { requirePermission } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http/client-ip";

function readText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function readUuid(formData: FormData, name: string) {
  return parseLegacyMigrationUuid(readText(formData, name, 36));
}

function getMigrationAssignmentRole(
  userId: string,
  leadUserId: string | null,
): "operator" | "lead" {
  return userId === leadUserId ? "lead" : "operator";
}

function batchPath(batchId: string) {
  return `/admin/migrasi-produk/${batchId}`;
}

function mappingPath(batchId: string) {
  return `${batchPath(batchId)}/mapping`;
}

function sessionPath(batchId: string) {
  return `${batchPath(batchId)}/sesi`;
}

function redirectWithMessage(
  path: string,
  type: "success" | "error",
  message: string,
): never {
  const query = new URLSearchParams({ type, message });
  redirect(`${path}?${query.toString()}`);
}

async function getRequestMetadata() {
  const headerStore = await headers();
  return {
    ipAddress: getClientIp(headerStore),
    userAgent: headerStore.get("user-agent")?.slice(0, 500) ?? null,
  };
}

async function getAccessibleBatch(
  organizationId: string,
  outletIds: string[],
  batchId: string,
) {
  if (!isLegacyMigrationUuid(batchId) || outletIds.length === 0) return null;

  const [batch] = await db
    .select({
      id: legacyProductImportBatches.id,
      organizationId: legacyProductImportBatches.organizationId,
      outletId: legacyProductImportBatches.outletId,
      status: legacyProductImportBatches.status,
    })
    .from(legacyProductImportBatches)
    .where(
      and(
        eq(legacyProductImportBatches.id, batchId),
        eq(legacyProductImportBatches.organizationId, organizationId),
        inArray(legacyProductImportBatches.outletId, outletIds),
      ),
    )
    .limit(1);

  return batch ?? null;
}

function revalidateMigrationBatch(batchId: string) {
  revalidatePath("/admin/migrasi-produk");
  revalidatePath(batchPath(batchId));
  revalidatePath(mappingPath(batchId));
  revalidatePath(sessionPath(batchId));
}

export async function autoCreateLegacyDraftMastersAction(formData: FormData) {
  const auth = await requirePermission("migration.mapping.manage");
  const batchId = readUuid(formData, "batchId");

  if (!batchId) {
    redirectWithMessage("/admin/migrasi-produk", "error", "Batch migrasi tidak valid.");
  }

  const batch = await getAccessibleBatch(
    auth.organization.id,
    auth.outlets.map((outlet) => outlet.id),
    batchId,
  );
  if (!batch || batch.status !== "ready") {
    redirectWithMessage(
      mappingPath(batchId),
      "error",
      "Batch staging tidak ditemukan atau belum siap.",
    );
  }

  const requestMetadata = await getRequestMetadata();
  const now = new Date();

  const result = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`legacy-master-mapping:${auth.organization.id}`}))`,
    );

    const [pendingMappings, categories, existingMasters] = await Promise.all([
      transaction
        .select({
          id: legacyProductMasterMappings.id,
          legacyMasterCode: legacyProductMasterMappings.legacyMasterCode,
          legacyMasterName: legacyProductMasterMappings.legacyMasterName,
          legacyCategory: legacyProductMasterMappings.legacyCategory,
        })
        .from(legacyProductMasterMappings)
        .where(
          and(
            eq(legacyProductMasterMappings.batchId, batchId),
            eq(legacyProductMasterMappings.organizationId, auth.organization.id),
            eq(legacyProductMasterMappings.status, "pending"),
          ),
        ),

      transaction
        .select({
          id: productCategories.id,
          code: productCategories.code,
          name: productCategories.name,
        })
        .from(productCategories)
        .where(
          and(
            eq(productCategories.organizationId, auth.organization.id),
            eq(productCategories.isActive, true),
          ),
        ),

      transaction
        .select({
          id: productMasters.id,
          code: productMasters.code,
          categoryId: productMasters.categoryId,
        })
        .from(productMasters)
        .where(eq(productMasters.organizationId, auth.organization.id)),
    ]);

    const categoryByCode = new Map(
      categories.map((category) => [category.code.toUpperCase(), category]),
    );
    const masterByCode = new Map(
      existingMasters.map((master) => [master.code.toUpperCase(), master]),
    );

    let createdCount = 0;
    let reusedCount = 0;
    const unresolved: string[] = [];

    for (const mapping of pendingMappings) {
      const categoryCode = getSuggestedCategoryCode(mapping.legacyCategory);
      const category = categoryCode
        ? categoryByCode.get(categoryCode.toUpperCase())
        : null;

      if (!category) {
        unresolved.push(mapping.legacyMasterCode);
        continue;
      }

      const productCode = buildLegacyProductMasterCode(
        mapping.legacyMasterCode,
      );
      let targetMaster = masterByCode.get(productCode.toUpperCase()) ?? null;
      let mappingSource: "existing" | "created" = "existing";

      if (targetMaster && targetMaster.categoryId !== category.id) {
        unresolved.push(mapping.legacyMasterCode);
        continue;
      }

      if (!targetMaster) {
        const productMasterId = randomUUID();
        await transaction.insert(productMasters).values({
          id: productMasterId,
          organizationId: auth.organization.id,
          categoryId: category.id,
          code: productCode,
          name: mapping.legacyMasterName,
          description:
            "Draft hasil mapping master produk legacy. Wajib direview sebelum diaktifkan.",
          attributes: {
            legacyMigration: {
              batchId,
              legacyMasterCode: mapping.legacyMasterCode,
              legacyCategory: mapping.legacyCategory,
            },
          },
          status: "draft",
        });
        targetMaster = {
          id: productMasterId,
          code: productCode,
          categoryId: category.id,
        };
        masterByCode.set(productCode.toUpperCase(), targetMaster);
        mappingSource = "created";
        createdCount += 1;
      } else {
        reusedCount += 1;
      }

      await transaction
        .update(legacyProductMasterMappings)
        .set({
          status: "mapped",
          mappingSource,
          targetCategoryId: category.id,
          targetProductMasterId: targetMaster.id,
          reviewNotes:
            mappingSource === "created"
              ? "Draft master dibuat otomatis dari data legacy."
              : "Dipetakan otomatis ke draft/master yang sudah tersedia.",
          reviewedBy: auth.user.id,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(legacyProductMasterMappings.id, mapping.id));
    }

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: batch.outletId,
      actorUserId: auth.user.id,
      action: "legacy_master_mapping.auto_draft",
      entityType: "legacy_product_import_batch",
      entityId: batchId,
      afterData: {
        createdCount,
        reusedCount,
        unresolvedCount: unresolved.length,
        unresolvedMasterCodes: unresolved.slice(0, 100),
      },
      reason:
        "Membuat draft Product Master dari mapping legacy tanpa mengaktifkan produk atau inventaris.",
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });

    return { createdCount, reusedCount, unresolvedCount: unresolved.length };
  });

  revalidateMigrationBatch(batchId);
  redirectWithMessage(
    mappingPath(batchId),
    "success",
    `${result.createdCount} draft dibuat, ${result.reusedCount} mapping memakai master yang sudah ada, dan ${result.unresolvedCount} master perlu review manual.`,
  );
}

export async function mapLegacyMasterToExistingAction(formData: FormData) {
  const auth = await requirePermission("migration.mapping.manage");
  const batchId = readUuid(formData, "batchId");
  const mappingId = readUuid(formData, "mappingId");
  const targetProductMasterId = readUuid(formData, "targetProductMasterId");
  const notes = readText(formData, "notes", 1000);

  if (!batchId || !mappingId || !targetProductMasterId) {
    redirectWithMessage(
      batchId ? mappingPath(batchId) : "/admin/migrasi-produk",
      "error",
      "Mapping atau Product Master tujuan tidak valid.",
    );
  }

  const batch = await getAccessibleBatch(
    auth.organization.id,
    auth.outlets.map((outlet) => outlet.id),
    batchId,
  );
  if (!batch) {
    redirectWithMessage(mappingPath(batchId), "error", "Batch migrasi tidak ditemukan.");
  }

  const [mapping, targetMaster] = await Promise.all([
    db
      .select({ id: legacyProductMasterMappings.id })
      .from(legacyProductMasterMappings)
      .where(
        and(
          eq(legacyProductMasterMappings.id, mappingId),
          eq(legacyProductMasterMappings.batchId, batchId),
          eq(legacyProductMasterMappings.organizationId, auth.organization.id),
        ),
      )
      .limit(1),
    db
      .select({
        id: productMasters.id,
        categoryId: productMasters.categoryId,
        code: productMasters.code,
        name: productMasters.name,
      })
      .from(productMasters)
      .where(
        and(
          eq(productMasters.id, targetProductMasterId),
          eq(productMasters.organizationId, auth.organization.id),
        ),
      )
      .limit(1),
  ]);

  const mappingRow = mapping[0];
  const targetMasterRow = targetMaster[0];

  if (!mappingRow || !targetMasterRow) {
    redirectWithMessage(
      mappingPath(batchId),
      "error",
      "Mapping atau Product Master tujuan tidak ditemukan.",
    );
  }

  const requestMetadata = await getRequestMetadata();
  const now = new Date();
  await db.transaction(async (transaction) => {
    await transaction
      .update(legacyProductMasterMappings)
      .set({
        status: "mapped",
        mappingSource: "existing",
        targetCategoryId: targetMasterRow.categoryId,
        targetProductMasterId: targetMasterRow.id,
        reviewNotes: notes || "Dipetakan manual oleh manager.",
        reviewedBy: auth.user.id,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(legacyProductMasterMappings.id, mappingId));

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: batch.outletId,
      actorUserId: auth.user.id,
      action: "legacy_master_mapping.map_existing",
      entityType: "legacy_product_master_mapping",
      entityId: mappingId,
      afterData: {
        targetProductMasterId: targetMasterRow.id,
        targetProductMasterCode: targetMasterRow.code,
        targetProductMasterName: targetMasterRow.name,
      },
      reason: notes || "Mapping manual ke Product Master yang sudah tersedia.",
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });
  });

  revalidateMigrationBatch(batchId);
  redirectWithMessage(mappingPath(batchId), "success", "Mapping master berhasil disimpan.");
}

export async function resetLegacyMasterMappingAction(formData: FormData) {
  const auth = await requirePermission("migration.mapping.manage");
  const batchId = readUuid(formData, "batchId");
  const mappingId = readUuid(formData, "mappingId");

  if (!batchId || !mappingId) {
    redirectWithMessage("/admin/migrasi-produk", "error", "Mapping tidak valid.");
  }

  const batch = await getAccessibleBatch(
    auth.organization.id,
    auth.outlets.map((outlet) => outlet.id),
    batchId,
  );
  if (!batch) redirectWithMessage(mappingPath(batchId), "error", "Batch tidak ditemukan.");

  const requestMetadata = await getRequestMetadata();
  await db.transaction(async (transaction) => {
    await transaction
      .update(legacyProductMasterMappings)
      .set({
        status: "pending",
        mappingSource: null,
        targetCategoryId: null,
        targetProductMasterId: null,
        reviewNotes: null,
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(legacyProductMasterMappings.id, mappingId),
          eq(legacyProductMasterMappings.batchId, batchId),
          eq(legacyProductMasterMappings.organizationId, auth.organization.id),
        ),
      );

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: batch.outletId,
      actorUserId: auth.user.id,
      action: "legacy_master_mapping.reset",
      entityType: "legacy_product_master_mapping",
      entityId: mappingId,
      reason: "Mapping dikembalikan ke pending untuk direview ulang.",
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });
  });

  revalidateMigrationBatch(batchId);
  redirectWithMessage(mappingPath(batchId), "success", "Mapping dikembalikan ke status pending.");
}

export async function ignoreLegacyMasterMappingAction(formData: FormData) {
  const auth = await requirePermission("migration.mapping.manage");
  const batchId = readUuid(formData, "batchId");
  const mappingId = readUuid(formData, "mappingId");
  const reason = readText(formData, "reason", 1000);

  if (!batchId || !mappingId || reason.length < 5) {
    redirectWithMessage(
      batchId ? mappingPath(batchId) : "/admin/migrasi-produk",
      "error",
      "Alasan mengabaikan master wajib diisi minimal 5 karakter.",
    );
  }

  const batch = await getAccessibleBatch(
    auth.organization.id,
    auth.outlets.map((outlet) => outlet.id),
    batchId,
  );
  if (!batch) redirectWithMessage(mappingPath(batchId), "error", "Batch tidak ditemukan.");

  const requestMetadata = await getRequestMetadata();
  await db.transaction(async (transaction) => {
    await transaction
      .update(legacyProductMasterMappings)
      .set({
        status: "ignored",
        mappingSource: null,
        targetCategoryId: null,
        targetProductMasterId: null,
        reviewNotes: reason,
        reviewedBy: auth.user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(legacyProductMasterMappings.id, mappingId),
          eq(legacyProductMasterMappings.batchId, batchId),
          eq(legacyProductMasterMappings.organizationId, auth.organization.id),
        ),
      );

    await transaction.insert(auditLogs).values({
      organizationId: auth.organization.id,
      outletId: batch.outletId,
      actorUserId: auth.user.id,
      action: "legacy_master_mapping.ignore",
      entityType: "legacy_product_master_mapping",
      entityId: mappingId,
      reason,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
    });
  });

  revalidateMigrationBatch(batchId);
  redirectWithMessage(mappingPath(batchId), "success", "Master legacy ditandai diabaikan.");
}

function readAssignedUserIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("assignedUserIds")
        .map((value) => String(value).trim())
        .filter((value) => isLegacyMigrationUuid(value)),
    ),
  );
}

function readExpectedItemCount(formData: FormData) {
  const raw = readText(formData, "expectedItemCount", 8);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 && value <= 50_000
    ? value
    : Number.NaN;
}

async function validateAssignedUsers(
  organizationId: string,
  outletId: string,
  assignedUserIds: string[],
) {
  if (assignedUserIds.length === 0) return [];

  return db
    .selectDistinct({ id: users.id })
    .from(users)
    .innerJoin(userOutlets, eq(users.id, userOutlets.userId))
    .where(
      and(
        eq(users.organizationId, organizationId),
        eq(users.status, "active"),
        eq(userOutlets.outletId, outletId),
        inArray(users.id, assignedUserIds),
      ),
    );
}

export async function createLegacyMigrationSessionAction(formData: FormData) {
  const auth = await requirePermission("migration.session.manage");
  const batchId = readUuid(formData, "batchId");
  const name = readText(formData, "name", 160);
  const locationCode = readText(formData, "locationCode", 80);
  const notes = readText(formData, "notes", 2000);
  const expectedItemCount = readExpectedItemCount(formData);
  const assignedUserIds = readAssignedUserIds(formData);
  const leadUserId = readUuid(formData, "leadUserId");

  if (!batchId) {
    redirectWithMessage("/admin/migrasi-produk", "error", "Batch migrasi tidak valid.");
  }
  if (name.length < 2) {
    redirectWithMessage(sessionPath(batchId), "error", "Nama sesi minimal 2 karakter.");
  }
  if (Number.isNaN(expectedItemCount)) {
    redirectWithMessage(
      sessionPath(batchId),
      "error",
      "Jika diisi, target item harus berupa angka 1–50.000.",
    );
  }
  if (assignedUserIds.length === 0) {
    redirectWithMessage(
      sessionPath(batchId),
      "error",
      "Pilih minimal satu staff untuk sesi migrasi.",
    );
  }
  if (leadUserId && !assignedUserIds.includes(leadUserId)) {
    redirectWithMessage(
      sessionPath(batchId),
      "error",
      "Migration Lead harus termasuk staff yang ditugaskan.",
    );
  }

  const batch = await getAccessibleBatch(
    auth.organization.id,
    auth.outlets.map((outlet) => outlet.id),
    batchId,
  );
  if (!batch) redirectWithMessage(sessionPath(batchId), "error", "Batch tidak ditemukan.");

  const validUsers = await validateAssignedUsers(
    auth.organization.id,
    batch.outletId,
    assignedUserIds,
  );
  if (validUsers.length !== assignedUserIds.length) {
    redirectWithMessage(
      sessionPath(batchId),
      "error",
      "Ada staff yang tidak aktif atau tidak ditugaskan ke outlet batch.",
    );
  }

  const requestMetadata = await getRequestMetadata();
  const sessionId = randomUUID();

  try {
    await db.transaction(async (transaction) => {
      await transaction.insert(legacyMigrationSessions).values({
        id: sessionId,
        batchId,
        organizationId: auth.organization.id,
        outletId: batch.outletId,
        name,
        locationCode: locationCode || null,
        expectedItemCount,
        notes: notes || null,
        status: "draft",
        createdBy: auth.user.id,
      });

      await transaction.insert(legacyMigrationSessionAssignments).values(
        assignedUserIds.map((userId) => ({
          sessionId,
          userId,
          assignmentRole: getMigrationAssignmentRole(userId, leadUserId),
          assignedBy: auth.user.id,
        })),
      );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: batch.outletId,
        actorUserId: auth.user.id,
        action: "legacy_migration_session.create",
        entityType: "legacy_migration_session",
        entityId: sessionId,
        afterData: {
          batchId,
          name,
          locationCode: locationCode || null,
          expectedItemCount,
          assignedUserIds,
          leadUserId,
        },
        reason: notes || "Membuat pembagian kerja migrasi per etalase/lokasi.",
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    const code =
      typeof error === "object" && error
        ? ((error as { code?: string; cause?: { code?: string } }).code ??
          (error as { cause?: { code?: string } }).cause?.code)
        : null;
    if (code === "23505") {
      redirectWithMessage(
        sessionPath(batchId),
        "error",
        "Nama sesi sudah digunakan pada batch ini.",
      );
    }
    throw error;
  }

  revalidateMigrationBatch(batchId);
  redirectWithMessage(sessionPath(batchId), "success", "Sesi migrasi berhasil dibuat.");
}

export async function updateLegacyMigrationSessionAssignmentsAction(
  formData: FormData,
) {
  const auth = await requirePermission("migration.session.manage");
  const batchId = readUuid(formData, "batchId");
  const sessionId = readUuid(formData, "sessionId");
  const assignedUserIds = readAssignedUserIds(formData);
  const leadUserId = readUuid(formData, "leadUserId");

  if (!batchId || !sessionId || assignedUserIds.length === 0) {
    redirectWithMessage(
      batchId ? sessionPath(batchId) : "/admin/migrasi-produk",
      "error",
      "Sesi dan minimal satu staff wajib dipilih.",
    );
  }
  if (leadUserId && !assignedUserIds.includes(leadUserId)) {
    redirectWithMessage(
      sessionPath(batchId),
      "error",
      "Migration Lead harus ikut ditugaskan.",
    );
  }

  const batch = await getAccessibleBatch(
    auth.organization.id,
    auth.outlets.map((outlet) => outlet.id),
    batchId,
  );
  if (!batch) {
    redirectWithMessage(sessionPath(batchId), "error", "Batch tidak ditemukan.");
  }

  const validUsers = await validateAssignedUsers(
    auth.organization.id,
    batch.outletId,
    assignedUserIds,
  );
  if (validUsers.length !== assignedUserIds.length) {
    redirectWithMessage(
      sessionPath(batchId),
      "error",
      "Penugasan staff tidak valid.",
    );
  }

  const requestMetadata = await getRequestMetadata();
  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${getLegacyMigrationSessionLockKey({
          organizationId: auth.organization.id,
          sessionId,
        })}, 0))`,
      );

      const [session] = await transaction
        .select({
          id: legacyMigrationSessions.id,
          status: legacyMigrationSessions.status,
        })
        .from(legacyMigrationSessions)
        .where(
          and(
            eq(legacyMigrationSessions.id, sessionId),
            eq(legacyMigrationSessions.batchId, batchId),
            eq(legacyMigrationSessions.organizationId, auth.organization.id),
            eq(legacyMigrationSessions.outletId, batch.outletId),
          ),
        )
        .limit(1)
        .for("update");

      if (!session) throw new Error("SESSION_NOT_FOUND");
      if (session.status !== "draft" && session.status !== "active") {
        throw new Error("SESSION_ASSIGNMENT_STATUS_INVALID");
      }

      await transaction
        .delete(legacyMigrationSessionAssignments)
        .where(eq(legacyMigrationSessionAssignments.sessionId, sessionId));
      await transaction.insert(legacyMigrationSessionAssignments).values(
        assignedUserIds.map((userId) => ({
          sessionId,
          userId,
          assignmentRole: getMigrationAssignmentRole(userId, leadUserId),
          assignedBy: auth.user.id,
        })),
      );

      const updatedSessions = await transaction
        .update(legacyMigrationSessions)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(legacyMigrationSessions.id, sessionId),
            eq(legacyMigrationSessions.organizationId, auth.organization.id),
            eq(legacyMigrationSessions.status, session.status),
          ),
        )
        .returning({ id: legacyMigrationSessions.id });
      if (updatedSessions.length !== 1) {
        throw new Error("SESSION_ASSIGNMENT_UPDATE_COUNT_MISMATCH");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: batch.outletId,
        actorUserId: auth.user.id,
        action: "legacy_migration_session.assignments_update",
        entityType: "legacy_migration_session",
        entityId: sessionId,
        afterData: { assignedUserIds, leadUserId },
        reason: "Memperbarui operator dan Migration Lead sesi.",
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SESSION_NOT_FOUND") {
      redirectWithMessage(sessionPath(batchId), "error", "Sesi tidak ditemukan.");
    }
    if (code === "SESSION_ASSIGNMENT_STATUS_INVALID") {
      redirectWithMessage(
        sessionPath(batchId),
        "error",
        "Penugasan hanya dapat diubah saat sesi Draft atau Aktif.",
      );
    }
    if (code === "SESSION_ASSIGNMENT_UPDATE_COUNT_MISMATCH") {
      redirectWithMessage(
        sessionPath(batchId),
        "error",
        "Status sesi berubah saat penugasan diperbarui. Muat ulang halaman lalu coba kembali.",
      );
    }
    throw error;
  }

  revalidateMigrationBatch(batchId);
  redirectWithMessage(
    sessionPath(batchId),
    "success",
    "Penugasan staff diperbarui.",
  );
}

type LegacySessionTransitionUpdate = {
  status: "active" | "locked" | "cancelled";
  startedAt?: Date;
  lockedAt?: Date | null;
  cancelledAt?: Date;
  updatedAt: Date;
};

export async function transitionLegacyMigrationSessionAction(formData: FormData) {
  const auth = await requirePermission("migration.session.manage");
  const batchId = readUuid(formData, "batchId");
  const sessionId = readUuid(formData, "sessionId");
  const transition = readText(formData, "transition", 20);

  if (!batchId || !sessionId) {
    redirectWithMessage(
      "/admin/migrasi-produk",
      "error",
      "Sesi migrasi tidak valid.",
    );
  }

  const batch = await getAccessibleBatch(
    auth.organization.id,
    auth.outlets.map((outlet) => outlet.id),
    batchId,
  );
  if (!batch) {
    redirectWithMessage(sessionPath(batchId), "error", "Batch tidak ditemukan.");
  }

  const requestMetadata = await getRequestMetadata();
  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${getLegacyMigrationSessionLockKey({
          organizationId: auth.organization.id,
          sessionId,
        })}, 0))`,
      );

      const [session] = await transaction
        .select({
          id: legacyMigrationSessions.id,
          status: legacyMigrationSessions.status,
        })
        .from(legacyMigrationSessions)
        .where(
          and(
            eq(legacyMigrationSessions.id, sessionId),
            eq(legacyMigrationSessions.batchId, batchId),
            eq(legacyMigrationSessions.organizationId, auth.organization.id),
            eq(legacyMigrationSessions.outletId, batch.outletId),
          ),
        )
        .limit(1)
        .for("update");
      if (!session) throw new Error("SESSION_NOT_FOUND");

      const now = new Date();
      let update: LegacySessionTransitionUpdate | null = null;

      if (transition === "start" && session.status === "draft") {
        const [assignmentCount] = await transaction
          .select({ total: count() })
          .from(legacyMigrationSessionAssignments)
          .where(eq(legacyMigrationSessionAssignments.sessionId, sessionId));
        if (Number(assignmentCount?.total ?? 0) === 0) {
          throw new Error("SESSION_ASSIGNMENT_REQUIRED");
        }
        update = { status: "active", startedAt: now, updatedAt: now };
      } else if (transition === "lock" && session.status === "active") {
        update = { status: "locked", lockedAt: now, updatedAt: now };
      } else if (transition === "reopen" && session.status === "locked") {
        update = { status: "active", lockedAt: null, updatedAt: now };
      } else if (
        transition === "cancel" &&
        ["draft", "active", "locked"].includes(session.status)
      ) {
        const [sessionData] = await transaction
          .select({
            verificationCount: count(),
            linkedItemCount:
              sql<number>`count(*) filter (where ${legacyMigrationVerifications.productItemId} is not null)::int`.mapWith(
                Number,
              ),
          })
          .from(legacyMigrationVerifications)
          .where(
            and(
              eq(legacyMigrationVerifications.sessionId, sessionId),
              eq(
                legacyMigrationVerifications.organizationId,
                auth.organization.id,
              ),
            ),
          );
        const verificationCount = Number(sessionData?.verificationCount ?? 0);
        const linkedItemCount = Number(sessionData?.linkedItemCount ?? 0);
        if (verificationCount > 0 || linkedItemCount > 0) {
          throw new Error("SESSION_CANCEL_HAS_DATA");
        }
        update = { status: "cancelled", cancelledAt: now, updatedAt: now };
      }

      if (!update) throw new Error("SESSION_TRANSITION_INVALID");

      const updatedSessions = await transaction
        .update(legacyMigrationSessions)
        .set(update)
        .where(
          and(
            eq(legacyMigrationSessions.id, sessionId),
            eq(legacyMigrationSessions.organizationId, auth.organization.id),
            eq(legacyMigrationSessions.status, session.status),
          ),
        )
        .returning({ id: legacyMigrationSessions.id });
      if (updatedSessions.length !== 1) {
        throw new Error("SESSION_STATE_CHANGED");
      }

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: batch.outletId,
        actorUserId: auth.user.id,
        action: `legacy_migration_session.${transition}`,
        entityType: "legacy_migration_session",
        entityId: sessionId,
        beforeData: { status: session.status },
        afterData: { status: update.status },
        reason: "Perubahan status sesi migrasi oleh manager.",
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SESSION_NOT_FOUND") {
      redirectWithMessage(sessionPath(batchId), "error", "Sesi tidak ditemukan.");
    }
    if (code === "SESSION_ASSIGNMENT_REQUIRED") {
      redirectWithMessage(
        sessionPath(batchId),
        "error",
        "Tugaskan staff sebelum memulai sesi.",
      );
    }
    if (code === "SESSION_CANCEL_HAS_DATA") {
      redirectWithMessage(
        sessionPath(batchId),
        "error",
        "Sesi yang sudah memiliki verification atau item migration hold tidak dapat dibatalkan. Lanjutkan sesi sampai selesai agar data tidak tertinggal.",
      );
    }
    if (code === "SESSION_TRANSITION_INVALID") {
      redirectWithMessage(
        sessionPath(batchId),
        "error",
        "Perubahan status tidak sesuai kondisi sesi saat ini.",
      );
    }
    if (code === "SESSION_STATE_CHANGED") {
      redirectWithMessage(
        sessionPath(batchId),
        "error",
        "Status sesi berubah oleh proses lain. Muat ulang halaman lalu coba kembali.",
      );
    }
    throw error;
  }

  revalidateMigrationBatch(batchId);
  redirectWithMessage(
    sessionPath(batchId),
    "success",
    "Status sesi migrasi diperbarui.",
  );
}
