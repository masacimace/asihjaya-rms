"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  auditLogs,
  customerHistoryCredentials,
  customerHistorySessions,
  customers,
} from "@/db/schema";
import {
  type AdminCustomerHistoryPinActionState,
  isUuid,
  type PublicCustomerHistoryPinActionState,
} from "@/features/customers/contracts";
import {
  createCustomerHistorySession,
  generateTemporaryCustomerHistoryPin,
  getCurrentCustomerHistorySession,
  getCustomerHistoryPinAccessState,
  hashCustomerHistoryPin,
  recordCustomerHistoryPinFailure,
  recordCustomerHistoryPinSuccess,
  revokeCurrentCustomerHistorySession,
  validateCustomerHistoryPin,
  verifyCustomerHistoryPinHash,
} from "@/features/customers/history-access";
import { getPublicCustomerHistoryAccessContext } from "@/features/customers/public-history";
import { requirePermission } from "@/lib/auth/session";

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function delay(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function getRequestMetadata() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim().slice(0, 64) ??
    headerStore.get("x-real-ip")?.trim().slice(0, 64) ??
    null;

  return {
    ipAddress,
    userAgent: headerStore.get("user-agent")?.slice(0, 1000) ?? null,
  };
}

async function createSafeTemporaryPin(phone: string | null) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const pin = generateTemporaryCustomerHistoryPin();

    if (validateCustomerHistoryPin({ pin, phone }).valid) {
      return pin;
    }
  }

  throw new Error("CUSTOMER_HISTORY_PIN_GENERATION_FAILED");
}

async function writePublicAuditLog({
  organizationId,
  outletId,
  customerId,
  action,
  requestMetadata,
  metadata,
}: {
  organizationId: string;
  outletId: string;
  customerId: string;
  action: string;
  requestMetadata: Awaited<ReturnType<typeof getRequestMetadata>>;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      organizationId,
      outletId,
      actorUserId: null,
      action,
      entityType: "customer",
      entityId: customerId,
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      metadata: {
        source: "public.customer-history",
        ...metadata,
      },
    });
  } catch (error) {
    console.error("Failed to write public customer history audit log", error);
  }
}

export async function generateOrResetCustomerHistoryPinAction(
  customerId: string,
  _previousState: AdminCustomerHistoryPinActionState,
  _formData: FormData,
): Promise<AdminCustomerHistoryPinActionState> {
  const auth = await requirePermission("customers.history_pin.manage");

  if (!isUuid(customerId)) {
    return {
      status: "error",
      message: "ID pelanggan tidak valid.",
    };
  }

  const [customer] = await db
    .select({
      id: customers.id,
      phone: customers.phone,
      fullName: customers.fullName,
    })
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  if (!customer) {
    return {
      status: "error",
      message: "Pelanggan tidak ditemukan pada organisasi aktif.",
    };
  }

  const temporaryPin = await createSafeTemporaryPin(customer.phone);
  const pinHash = await hashCustomerHistoryPin(temporaryPin);
  const requestMetadata = await getRequestMetadata();
  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0] ?? null;
  const now = new Date();

  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`customer-history:${customer.id}`}, 0))`,
      );

      const [existingCredential] = await transaction
        .select({
          id: customerHistoryCredentials.id,
          credentialVersion: customerHistoryCredentials.credentialVersion,
        })
        .from(customerHistoryCredentials)
        .where(
          and(
            eq(
              customerHistoryCredentials.organizationId,
              auth.organization.id,
            ),
            eq(customerHistoryCredentials.customerId, customer.id),
          ),
        )
        .limit(1);

      const nextCredentialVersion =
        (existingCredential?.credentialVersion ?? 0) + 1;

      if (existingCredential) {
        await transaction
          .update(customerHistoryCredentials)
          .set({
            pinHash,
            credentialVersion: nextCredentialVersion,
            mustChangePin: true,
            isActive: true,
            failedAttemptCount: 0,
            failedWindowStartedAt: null,
            lockedUntil: null,
            pinCreatedAt: now,
            pinResetAt: now,
            pinCreatedByUserId: auth.user.id,
            updatedAt: now,
          })
          .where(eq(customerHistoryCredentials.id, existingCredential.id));
      } else {
        await transaction.insert(customerHistoryCredentials).values({
          organizationId: auth.organization.id,
          customerId: customer.id,
          pinHash,
          credentialVersion: nextCredentialVersion,
          mustChangePin: true,
          isActive: true,
          failedAttemptCount: 0,
          pinCreatedAt: now,
          pinCreatedByUserId: auth.user.id,
          createdAt: now,
          updatedAt: now,
        });
      }

      await transaction
        .update(customerHistorySessions)
        .set({
          revokedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(
              customerHistorySessions.organizationId,
              auth.organization.id,
            ),
            eq(customerHistorySessions.customerId, customer.id),
            isNull(customerHistorySessions.revokedAt),
          ),
        );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet?.id ?? null,
        actorUserId: auth.user.id,
        action: existingCredential
          ? "customer.history_pin.reset"
          : "customer.history_pin.create",
        entityType: "customer",
        entityId: customer.id,
        beforeData: existingCredential
          ? {
              credentialVersion: existingCredential.credentialVersion,
            }
          : null,
        afterData: {
          credentialVersion: nextCredentialVersion,
          mustChangePin: true,
          sessionsRevoked: true,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "admin.customer-detail",
          temporaryPinDisplayedOnce: true,
        },
      });
    });
  } catch (error) {
    console.error("Failed to generate customer history PIN", error);

    return {
      status: "error",
      message: "PIN sementara belum berhasil dibuat. Coba ulang.",
    };
  }

  revalidatePath(`/admin/pelanggan/${customer.id}`);

  return {
    status: "success",
    message: `PIN sementara untuk ${customer.fullName} berhasil dibuat. Berikan secara privat dan minta pelanggan menggantinya saat akses pertama.`,
    temporaryPin,
  };
}

export async function revokeCustomerHistorySessionsAction(
  customerId: string,
  _previousState: AdminCustomerHistoryPinActionState,
  _formData: FormData,
): Promise<AdminCustomerHistoryPinActionState> {
  const auth = await requirePermission("customers.history_pin.manage");

  if (!isUuid(customerId)) {
    return {
      status: "error",
      message: "ID pelanggan tidak valid.",
    };
  }

  const requestMetadata = await getRequestMetadata();
  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0] ?? null;
  const now = new Date();
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.id, customerId),
        eq(customers.organizationId, auth.organization.id),
      ),
    )
    .limit(1);

  if (!customer) {
    return {
      status: "error",
      message: "Pelanggan tidak ditemukan pada organisasi aktif.",
    };
  }

  try {
    await db.transaction(async (transaction) => {
      await transaction
        .update(customerHistorySessions)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(customerHistorySessions.organizationId, auth.organization.id),
            eq(customerHistorySessions.customerId, customer.id),
            isNull(customerHistorySessions.revokedAt),
          ),
        );

      await transaction.insert(auditLogs).values({
        organizationId: auth.organization.id,
        outletId: primaryOutlet?.id ?? null,
        actorUserId: auth.user.id,
        action: "customer.history_session.revoke_all",
        entityType: "customer",
        entityId: customer.id,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "admin.customer-detail",
        },
      });
    });
  } catch (error) {
    console.error("Failed to revoke customer history sessions", error);

    return {
      status: "error",
      message: "Sesi pelanggan belum berhasil dicabut. Coba ulang.",
    };
  }

  revalidatePath(`/admin/pelanggan/${customer.id}`);

  return {
    status: "success",
    message: "Semua sesi histori pelanggan berhasil dicabut.",
  };
}

export async function verifyPublicCustomerHistoryPinAction(
  token: string,
  _previousState: PublicCustomerHistoryPinActionState,
  formData: FormData,
): Promise<PublicCustomerHistoryPinActionState> {
  const pin = readText(formData, "pin");

  if (!/^\d{6}$/.test(pin)) {
    return {
      status: "error",
      message: "PIN tidak valid atau akses sementara dibatasi.",
      fieldErrors: {
        pin: "Masukkan tepat 6 angka.",
      },
    };
  }

  const context = await getPublicCustomerHistoryAccessContext(token);

  if (context.status !== "valid") {
    await delay(300);
    return {
      status: "error",
      message: "PIN tidak valid atau akses sementara dibatasi.",
    };
  }

  const requestMetadata = await getRequestMetadata();
  const accessState = await getCustomerHistoryPinAccessState({
    organizationId: context.organizationId,
    customerId: context.customer.id,
    ipAddress: requestMetadata.ipAddress,
  });

  if (
    !accessState.credential ||
    !accessState.credential.isActive ||
    accessState.blocked
  ) {
    await delay(500);
    return {
      status: "error",
      message: "PIN tidak valid atau akses sementara dibatasi.",
    };
  }

  const isValid = await verifyCustomerHistoryPinHash(
    pin,
    accessState.credential.pinHash,
  );

  if (!isValid) {
    const failure = await recordCustomerHistoryPinFailure({
      organizationId: context.organizationId,
      customerId: context.customer.id,
      ipAddress: requestMetadata.ipAddress,
    });
    const failureCount = Math.max(
      failure.customerFailureCount,
      failure.ipFailureCount,
    );

    if (
      failure.customerLockedUntil ||
      failure.ipLockedUntil ||
      failureCount >= 3
    ) {
      await writePublicAuditLog({
        organizationId: context.organizationId,
        outletId: context.outlet.id,
        customerId: context.customer.id,
        action: "customer.history_pin.verify_failed",
        requestMetadata,
        metadata: {
          failureCount,
          cooldownApplied: Boolean(
            failure.customerLockedUntil || failure.ipLockedUntil,
          ),
        },
      });
    }

    await delay(failureCount >= 4 ? 2_000 : failureCount >= 3 ? 750 : 300);

    return {
      status: "error",
      message: "PIN tidak valid atau akses sementara dibatasi.",
    };
  }

  await recordCustomerHistoryPinSuccess({
    organizationId: context.organizationId,
    customerId: context.customer.id,
  });
  await createCustomerHistorySession({
    organizationId: context.organizationId,
    customerId: context.customer.id,
    credentialVersion: accessState.credential.credentialVersion,
    requiresPinChange: accessState.credential.mustChangePin,
    requestMetadata,
  });
  await writePublicAuditLog({
    organizationId: context.organizationId,
    outletId: context.outlet.id,
    customerId: context.customer.id,
    action: "customer.history_pin.verify_success",
    requestMetadata,
    metadata: {
      requiresPinChange: accessState.credential.mustChangePin,
      receiptTokenVersion: token.startsWith("v2.") ? "v2" : "legacy",
    },
  });

  redirect(`/v/${token}`);
}

export async function changePublicCustomerHistoryPinAction(
  token: string,
  _previousState: PublicCustomerHistoryPinActionState,
  formData: FormData,
): Promise<PublicCustomerHistoryPinActionState> {
  const newPin = readText(formData, "newPin");
  const confirmPin = readText(formData, "confirmPin");
  const context = await getPublicCustomerHistoryAccessContext(token);

  if (context.status !== "valid") {
    return {
      status: "error",
      message: "Sesi perubahan PIN tidak valid atau sudah berakhir.",
    };
  }

  const session = await getCurrentCustomerHistorySession({
    organizationId: context.organizationId,
    customerId: context.customer.id,
  });

  if (!session?.requiresPinChange) {
    return {
      status: "error",
      message: "Sesi perubahan PIN tidak valid atau sudah berakhir.",
    };
  }

  const accessState = await getCustomerHistoryPinAccessState({
    organizationId: context.organizationId,
    customerId: context.customer.id,
    ipAddress: null,
  });
  const validation = validateCustomerHistoryPin({
    pin: newPin,
    phone: accessState.credential?.customerPhone ?? null,
  });
  const fieldErrors: Record<string, string> = {};

  if (!accessState.credential?.isActive) {
    return {
      status: "error",
      message: "Sesi perubahan PIN tidak valid atau sudah berakhir.",
    };
  }

  if (!validation.valid) {
    fieldErrors.newPin = validation.message;
  } else if (
    await verifyCustomerHistoryPinHash(
      newPin,
      accessState.credential.pinHash,
    )
  ) {
    fieldErrors.newPin = "PIN baru harus berbeda dari PIN sementara.";
  }

  if (newPin !== confirmPin) {
    fieldErrors.confirmPin = "Konfirmasi PIN belum sama.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Periksa PIN baru yang dimasukkan.",
      fieldErrors,
    };
  }

  const pinHash = await hashCustomerHistoryPin(newPin);
  const requestMetadata = await getRequestMetadata();
  const now = new Date();
  let nextCredentialVersion = session.credentialVersion + 1;

  try {
    await db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`customer-history:${context.customer.id}`}, 0))`,
      );

      const [credential] = await transaction
        .select({
          id: customerHistoryCredentials.id,
          credentialVersion: customerHistoryCredentials.credentialVersion,
          mustChangePin: customerHistoryCredentials.mustChangePin,
        })
        .from(customerHistoryCredentials)
        .where(
          and(
            eq(
              customerHistoryCredentials.organizationId,
              context.organizationId,
            ),
            eq(customerHistoryCredentials.customerId, context.customer.id),
          ),
        )
        .limit(1);

      if (
        !credential ||
        !credential.mustChangePin ||
        credential.credentialVersion !== session.credentialVersion
      ) {
        throw new Error("CUSTOMER_HISTORY_PIN_CHANGE_SESSION_STALE");
      }

      nextCredentialVersion = credential.credentialVersion + 1;

      await transaction
        .update(customerHistoryCredentials)
        .set({
          pinHash,
          credentialVersion: nextCredentialVersion,
          mustChangePin: false,
          failedAttemptCount: 0,
          failedWindowStartedAt: null,
          lockedUntil: null,
          pinResetAt: now,
          updatedAt: now,
        })
        .where(eq(customerHistoryCredentials.id, credential.id));

      await transaction
        .update(customerHistorySessions)
        .set({
          revokedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(
              customerHistorySessions.organizationId,
              context.organizationId,
            ),
            eq(customerHistorySessions.customerId, context.customer.id),
            isNull(customerHistorySessions.revokedAt),
          ),
        );

      await transaction.insert(auditLogs).values({
        organizationId: context.organizationId,
        outletId: context.outlet.id,
        actorUserId: null,
        action: "customer.history_pin.change_initial",
        entityType: "customer",
        entityId: context.customer.id,
        beforeData: {
          credentialVersion: credential.credentialVersion,
          mustChangePin: true,
        },
        afterData: {
          credentialVersion: nextCredentialVersion,
          mustChangePin: false,
        },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata: {
          source: "public.customer-history",
        },
      });
    });
  } catch (error) {
    console.error("Failed to change initial customer history PIN", error);

    return {
      status: "error",
      message: "PIN belum berhasil diganti. Scan ulang QR lalu coba kembali.",
    };
  }

  await createCustomerHistorySession({
    organizationId: context.organizationId,
    customerId: context.customer.id,
    credentialVersion: nextCredentialVersion,
    requiresPinChange: false,
    requestMetadata,
  });

  redirect(`/v/${token}`);
}

export async function logoutPublicCustomerHistoryAction(token: string) {
  await revokeCurrentCustomerHistorySession();
  redirect(`/v/${token}`);
}
