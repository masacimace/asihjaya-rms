import { createHmac, randomBytes } from "node:crypto";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import {
  customerHistoryCredentials,
  customerHistoryIpRateLimits,
  customerHistorySessions,
  customers,
} from "@/db/schema";
import {
  hashCustomerHistoryPin,
  verifyCustomerHistoryPinHash,
} from "@/features/customers/history-pin-crypto";
import {
  generateTemporaryCustomerHistoryPin,
  validateCustomerHistoryPin,
} from "@/features/customers/history-pin-policy";
import { serverEnv } from "@/lib/env";

export const CUSTOMER_HISTORY_COOKIE_NAME = "asihjaya_customer_history";
export const CUSTOMER_HISTORY_IDLE_TIMEOUT_MINUTES = 30;
export const CUSTOMER_HISTORY_ABSOLUTE_TIMEOUT_HOURS = 4;

const PIN_CHANGE_SESSION_DURATION_MS = 10 * 60 * 1000;
const SESSION_IDLE_TIMEOUT_MS =
  CUSTOMER_HISTORY_IDLE_TIMEOUT_MINUTES * 60 * 1000;
const SESSION_ABSOLUTE_TIMEOUT_MS =
  CUSTOMER_HISTORY_ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000;
const CUSTOMER_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const CUSTOMER_FAILURE_LIMIT = 5;
const CUSTOMER_LOCK_DURATION_MS = 15 * 60 * 1000;
const IP_FAILURE_WINDOW_MS = 60 * 60 * 1000;
const IP_FAILURE_LIMIT = 20;
const IP_LOCK_DURATION_MS = 60 * 60 * 1000;

export {
  generateTemporaryCustomerHistoryPin,
  hashCustomerHistoryPin,
  validateCustomerHistoryPin,
  verifyCustomerHistoryPinHash,
};
export type { CustomerHistoryPinValidationResult } from "@/features/customers/history-pin-policy";

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

type CreateCustomerHistorySessionInput = {
  organizationId: string;
  customerId: string;
  credentialVersion: number;
  requiresPinChange: boolean;
  requestMetadata: RequestMetadata;
};

export type CustomerHistorySession = {
  id: string;
  organizationId: string;
  customerId: string;
  credentialVersion: number;
  requiresPinChange: boolean;
  absoluteExpiresAt: Date;
  idleExpiresAt: Date;
};

export type CustomerHistoryCredentialStatus = {
  exists: boolean;
  isActive: boolean;
  mustChangePin: boolean;
  lockedUntil: Date | null;
  pinCreatedAt: Date | null;
  pinResetAt: Date | null;
  lastSuccessfulAccessAt: Date | null;
};

function hashOpaqueToken(token: string) {
  return createHmac("sha256", serverEnv.CUSTOMER_HISTORY_SESSION_SECRET)
    .update(token)
    .digest("hex");
}

function hashIpRateLimitKey(ipAddress: string) {
  return createHmac("sha256", serverEnv.CUSTOMER_HISTORY_SESSION_SECRET)
    .update(`customer-history-ip:${ipAddress}`)
    .digest("hex");
}

function addMilliseconds(date: Date, durationMs: number) {
  return new Date(date.getTime() + durationMs);
}

function getSlidingIdleExpiry(now: Date, absoluteExpiresAt: Date) {
  return new Date(
    Math.min(
      now.getTime() + SESSION_IDLE_TIMEOUT_MS,
      absoluteExpiresAt.getTime(),
    ),
  );
}

export async function getCustomerHistoryCredentialStatus({
  organizationId,
  customerId,
}: {
  organizationId: string;
  customerId: string;
}): Promise<CustomerHistoryCredentialStatus> {
  const [credential] = await db
    .select({
      isActive: customerHistoryCredentials.isActive,
      mustChangePin: customerHistoryCredentials.mustChangePin,
      lockedUntil: customerHistoryCredentials.lockedUntil,
      pinCreatedAt: customerHistoryCredentials.pinCreatedAt,
      pinResetAt: customerHistoryCredentials.pinResetAt,
      lastSuccessfulAccessAt:
        customerHistoryCredentials.lastSuccessfulAccessAt,
    })
    .from(customerHistoryCredentials)
    .where(
      and(
        eq(customerHistoryCredentials.organizationId, organizationId),
        eq(customerHistoryCredentials.customerId, customerId),
      ),
    )
    .limit(1);

  if (!credential) {
    return {
      exists: false,
      isActive: false,
      mustChangePin: false,
      lockedUntil: null,
      pinCreatedAt: null,
      pinResetAt: null,
      lastSuccessfulAccessAt: null,
    };
  }

  return {
    exists: true,
    ...credential,
  };
}

export async function createCustomerHistorySession({
  organizationId,
  customerId,
  credentialVersion,
  requiresPinChange,
  requestMetadata,
}: CreateCustomerHistorySessionInput) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashOpaqueToken(token);
  const now = new Date();
  const absoluteExpiresAt = addMilliseconds(
    now,
    requiresPinChange
      ? PIN_CHANGE_SESSION_DURATION_MS
      : SESSION_ABSOLUTE_TIMEOUT_MS,
  );
  const idleExpiresAt = requiresPinChange
    ? absoluteExpiresAt
    : getSlidingIdleExpiry(now, absoluteExpiresAt);

  await db.insert(customerHistorySessions).values({
    organizationId,
    customerId,
    credentialVersion,
    tokenHash,
    requiresPinChange,
    absoluteExpiresAt,
    idleExpiresAt,
    lastSeenAt: now,
    ipAddress: requestMetadata.ipAddress?.slice(0, 64) ?? null,
    userAgent: requestMetadata.userAgent,
    createdAt: now,
    updatedAt: now,
  });

  const cookieStore = await cookies();

  cookieStore.set({
    name: CUSTOMER_HISTORY_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/v",
    expires: absoluteExpiresAt,
    priority: "high",
  });

  return {
    absoluteExpiresAt,
    idleExpiresAt,
  };
}

export async function getCurrentCustomerHistorySession({
  organizationId,
  customerId,
  touch = false,
}: {
  organizationId: string;
  customerId: string;
  touch?: boolean;
}): Promise<CustomerHistorySession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_HISTORY_COOKIE_NAME)?.value;

  if (!token || token.length > 128) {
    return null;
  }

  const tokenHash = hashOpaqueToken(token);
  const now = new Date();
  const [session] = await db
    .select({
      id: customerHistorySessions.id,
      organizationId: customerHistorySessions.organizationId,
      customerId: customerHistorySessions.customerId,
      credentialVersion: customerHistorySessions.credentialVersion,
      requiresPinChange: customerHistorySessions.requiresPinChange,
      absoluteExpiresAt: customerHistorySessions.absoluteExpiresAt,
      idleExpiresAt: customerHistorySessions.idleExpiresAt,
    })
    .from(customerHistorySessions)
    .innerJoin(
      customerHistoryCredentials,
      eq(
        customerHistorySessions.customerId,
        customerHistoryCredentials.customerId,
      ),
    )
    .where(
      and(
        eq(customerHistorySessions.tokenHash, tokenHash),
        eq(customerHistorySessions.organizationId, organizationId),
        eq(customerHistorySessions.customerId, customerId),
        eq(customerHistoryCredentials.organizationId, organizationId),
        eq(customerHistoryCredentials.isActive, true),
        eq(
          customerHistorySessions.credentialVersion,
          customerHistoryCredentials.credentialVersion,
        ),
        isNull(customerHistorySessions.revokedAt),
        gt(customerHistorySessions.absoluteExpiresAt, now),
        gt(customerHistorySessions.idleExpiresAt, now),
      ),
    )
    .limit(1);

  if (!session) {
    return null;
  }

  if (touch && !session.requiresPinChange) {
    const idleExpiresAt = getSlidingIdleExpiry(now, session.absoluteExpiresAt);

    await db
      .update(customerHistorySessions)
      .set({
        lastSeenAt: now,
        idleExpiresAt,
        updatedAt: now,
      })
      .where(eq(customerHistorySessions.id, session.id));

    return {
      ...session,
      idleExpiresAt,
    };
  }

  return session;
}

export async function revokeCurrentCustomerHistorySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_HISTORY_COOKIE_NAME)?.value;

  if (token && token.length <= 128) {
    await db
      .update(customerHistorySessions)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerHistorySessions.tokenHash, hashOpaqueToken(token)));
  }

  cookieStore.set({
    name: CUSTOMER_HISTORY_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/v",
    maxAge: 0,
  });
}

export async function revokeCustomerHistorySessions({
  organizationId,
  customerId,
}: {
  organizationId: string;
  customerId: string;
}) {
  const now = new Date();

  await db
    .update(customerHistorySessions)
    .set({
      revokedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(customerHistorySessions.organizationId, organizationId),
        eq(customerHistorySessions.customerId, customerId),
        isNull(customerHistorySessions.revokedAt),
      ),
    );
}

async function getIpRateLimit(ipAddress: string | null) {
  if (!ipAddress) {
    return null;
  }

  const [rateLimit] = await db
    .select({
      windowStartedAt: customerHistoryIpRateLimits.windowStartedAt,
      failureCount: customerHistoryIpRateLimits.failureCount,
      blockedUntil: customerHistoryIpRateLimits.blockedUntil,
    })
    .from(customerHistoryIpRateLimits)
    .where(
      eq(customerHistoryIpRateLimits.keyHash, hashIpRateLimitKey(ipAddress)),
    )
    .limit(1);

  return rateLimit ?? null;
}

export async function getCustomerHistoryPinAccessState({
  organizationId,
  customerId,
  ipAddress,
}: {
  organizationId: string;
  customerId: string;
  ipAddress: string | null;
}) {
  const now = new Date();
  const [credential, ipRateLimit] = await Promise.all([
    db
      .select({
        id: customerHistoryCredentials.id,
        pinHash: customerHistoryCredentials.pinHash,
        credentialVersion: customerHistoryCredentials.credentialVersion,
        mustChangePin: customerHistoryCredentials.mustChangePin,
        isActive: customerHistoryCredentials.isActive,
        failedAttemptCount: customerHistoryCredentials.failedAttemptCount,
        failedWindowStartedAt:
          customerHistoryCredentials.failedWindowStartedAt,
        lockedUntil: customerHistoryCredentials.lockedUntil,
        customerPhone: customers.phone,
      })
      .from(customerHistoryCredentials)
      .innerJoin(
        customers,
        eq(customerHistoryCredentials.customerId, customers.id),
      )
      .where(
        and(
          eq(customerHistoryCredentials.organizationId, organizationId),
          eq(customerHistoryCredentials.customerId, customerId),
          eq(customers.organizationId, organizationId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getIpRateLimit(ipAddress),
  ]);

  const customerBlocked = Boolean(
    credential?.lockedUntil && credential.lockedUntil > now,
  );
  const ipBlocked = Boolean(
    ipRateLimit?.blockedUntil && ipRateLimit.blockedUntil > now,
  );

  return {
    credential,
    blocked: customerBlocked || ipBlocked,
    retryAt:
      [credential?.lockedUntil, ipRateLimit?.blockedUntil]
        .filter((value): value is Date => Boolean(value && value > now))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
  };
}

export async function recordCustomerHistoryPinFailure({
  organizationId,
  customerId,
  ipAddress,
}: {
  organizationId: string;
  customerId: string;
  ipAddress: string | null;
}) {
  const now = new Date();
  const customerWindowCutoff = new Date(
    now.getTime() - CUSTOMER_FAILURE_WINDOW_MS,
  );

  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`customer-history:${customerId}`}, 0))`,
    );

    const [credential] = await transaction
      .select({
        failedAttemptCount: customerHistoryCredentials.failedAttemptCount,
        failedWindowStartedAt:
          customerHistoryCredentials.failedWindowStartedAt,
      })
      .from(customerHistoryCredentials)
      .where(
        and(
          eq(customerHistoryCredentials.organizationId, organizationId),
          eq(customerHistoryCredentials.customerId, customerId),
        ),
      )
      .limit(1);

    let customerFailureCount = 1;
    let customerWindowStartedAt = now;

    if (
      credential?.failedWindowStartedAt &&
      credential.failedWindowStartedAt > customerWindowCutoff
    ) {
      customerFailureCount = credential.failedAttemptCount + 1;
      customerWindowStartedAt = credential.failedWindowStartedAt;
    }

    const customerLockedUntil =
      customerFailureCount >= CUSTOMER_FAILURE_LIMIT
        ? addMilliseconds(now, CUSTOMER_LOCK_DURATION_MS)
        : null;

    await transaction
      .update(customerHistoryCredentials)
      .set({
        failedAttemptCount: customerFailureCount,
        failedWindowStartedAt: customerWindowStartedAt,
        lockedUntil: customerLockedUntil,
        updatedAt: now,
      })
      .where(
        and(
          eq(customerHistoryCredentials.organizationId, organizationId),
          eq(customerHistoryCredentials.customerId, customerId),
        ),
      );

    let ipFailureCount = 0;
    let ipLockedUntil: Date | null = null;

    if (ipAddress) {
      const keyHash = hashIpRateLimitKey(ipAddress);
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`customer-history-ip:${keyHash}`}, 0))`,
      );

      const [rateLimit] = await transaction
        .select({
          id: customerHistoryIpRateLimits.id,
          windowStartedAt: customerHistoryIpRateLimits.windowStartedAt,
          failureCount: customerHistoryIpRateLimits.failureCount,
        })
        .from(customerHistoryIpRateLimits)
        .where(eq(customerHistoryIpRateLimits.keyHash, keyHash))
        .limit(1);
      const ipWindowCutoff = new Date(now.getTime() - IP_FAILURE_WINDOW_MS);
      const windowIsActive = Boolean(
        rateLimit?.windowStartedAt && rateLimit.windowStartedAt > ipWindowCutoff,
      );
      ipFailureCount = windowIsActive
        ? (rateLimit?.failureCount ?? 0) + 1
        : 1;
      const ipWindowStartedAt = windowIsActive
        ? (rateLimit?.windowStartedAt ?? now)
        : now;
      ipLockedUntil =
        ipFailureCount >= IP_FAILURE_LIMIT
          ? addMilliseconds(now, IP_LOCK_DURATION_MS)
          : null;

      if (rateLimit) {
        await transaction
          .update(customerHistoryIpRateLimits)
          .set({
            windowStartedAt: ipWindowStartedAt,
            failureCount: ipFailureCount,
            blockedUntil: ipLockedUntil,
            updatedAt: now,
          })
          .where(eq(customerHistoryIpRateLimits.id, rateLimit.id));
      } else {
        await transaction.insert(customerHistoryIpRateLimits).values({
          keyHash,
          windowStartedAt: ipWindowStartedAt,
          failureCount: ipFailureCount,
          blockedUntil: ipLockedUntil,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      customerFailureCount,
      customerLockedUntil,
      ipFailureCount,
      ipLockedUntil,
    };
  });
}

export async function recordCustomerHistoryPinSuccess({
  organizationId,
  customerId,
}: {
  organizationId: string;
  customerId: string;
}) {
  const now = new Date();

  await db
    .update(customerHistoryCredentials)
    .set({
      failedAttemptCount: 0,
      failedWindowStartedAt: null,
      lockedUntil: null,
      lastSuccessfulAccessAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(customerHistoryCredentials.organizationId, organizationId),
        eq(customerHistoryCredentials.customerId, customerId),
      ),
    );
}
