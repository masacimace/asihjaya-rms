import { createHmac } from "node:crypto";

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { securityRateLimits } from "@/db/schema";
import { serverEnv } from "@/lib/env";

export type SecurityRateLimitPolicy = {
  limit: number;
  windowMs: number;
  blockMs: number;
};

export type SecurityRateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  blockedUntil: Date | null;
};

type RateLimitInput = {
  scope: string;
  key: string;
  policy: SecurityRateLimitPolicy;
  now?: Date;
};

const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/;

const RATE_LIMIT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

type SecurityRateLimitMaintenanceState = {
  lastCleanupAt: number;
};

const globalMaintenanceState = globalThis as typeof globalThis & {
  __asihjayaSecurityRateLimitMaintenance?: SecurityRateLimitMaintenanceState;
};

const maintenanceState =
  globalMaintenanceState.__asihjayaSecurityRateLimitMaintenance ??
  (globalMaintenanceState.__asihjayaSecurityRateLimitMaintenance = {
    lastCleanupAt: 0,
  });

function validateInput(input: RateLimitInput) {
  if (!SCOPE_PATTERN.test(input.scope)) {
    throw new Error(`Security rate-limit scope tidak valid: ${input.scope}`);
  }

  if (!input.key.trim() || input.key.length > 2048) {
    throw new Error("Security rate-limit key tidak valid.");
  }

  for (const [name, value] of Object.entries(input.policy)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`Security rate-limit policy ${name} tidak valid.`);
    }
  }
}

function hashRateLimitKey(scope: string, key: string): string {
  return createHmac("sha256", serverEnv.SECURITY_RATE_LIMIT_SECRET)
    .update(`${scope}\n${key}`, "utf8")
    .digest("hex");
}

function retryAfterSeconds(now: Date, until: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

async function maybeCleanupSecurityRateLimits(now: Date) {
  if (
    now.getTime() - maintenanceState.lastCleanupAt <
    RATE_LIMIT_CLEANUP_INTERVAL_MS
  ) {
    return;
  }

  maintenanceState.lastCleanupAt = now.getTime();
  const retentionHours = positiveInteger(
    "SECURITY_RATE_LIMIT_RETENTION_HOURS",
    48,
  );
  const retentionCutoff = new Date(
    now.getTime() - retentionHours * 60 * 60 * 1000,
  );

  try {
    await db
      .delete(securityRateLimits)
      .where(
        and(
          lt(securityRateLimits.updatedAt, retentionCutoff),
          or(
            isNull(securityRateLimits.blockedUntil),
            lt(securityRateLimits.blockedUntil, now),
          ),
        ),
      );
  } catch (error) {
    console.warn("Failed to cleanup stale security rate limits", error);
  }
}

function allowedDecision(remaining: number): SecurityRateLimitDecision {
  return {
    allowed: true,
    remaining: Math.max(0, remaining),
    retryAfterSeconds: 0,
    blockedUntil: null,
  };
}

export async function inspectSecurityRateLimit(
  input: RateLimitInput,
): Promise<SecurityRateLimitDecision> {
  validateInput(input);
  const now = input.now ?? new Date();
  await maybeCleanupSecurityRateLimits(now);
  const keyHash = hashRateLimitKey(input.scope, input.key);

  const [row] = await db
    .select({
      attemptCount: securityRateLimits.attemptCount,
      blockedUntil: securityRateLimits.blockedUntil,
      windowStartedAt: securityRateLimits.windowStartedAt,
    })
    .from(securityRateLimits)
    .where(
      and(
        eq(securityRateLimits.scope, input.scope),
        eq(securityRateLimits.keyHash, keyHash),
      ),
    )
    .limit(1);

  if (!row) {
    return allowedDecision(input.policy.limit);
  }

  if (row.blockedUntil && row.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: retryAfterSeconds(now, row.blockedUntil),
      blockedUntil: row.blockedUntil,
    };
  }

  const blockHasExpired = Boolean(
    row.blockedUntil && row.blockedUntil <= now,
  );
  const windowExpiresAt = new Date(
    row.windowStartedAt.getTime() + input.policy.windowMs,
  );
  if (blockHasExpired || windowExpiresAt <= now) {
    return allowedDecision(input.policy.limit);
  }

  return allowedDecision(input.policy.limit - row.attemptCount);
}

async function mutateSecurityRateLimit(
  input: RateLimitInput & { blockAtLimit: boolean },
): Promise<SecurityRateLimitDecision> {
  validateInput(input);
  const now = input.now ?? new Date();
  await maybeCleanupSecurityRateLimits(now);
  const keyHash = hashRateLimitKey(input.scope, input.key);

  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${input.scope}:${keyHash}`}, 0))`,
    );

    const [row] = await transaction
      .select()
      .from(securityRateLimits)
      .where(
        and(
          eq(securityRateLimits.scope, input.scope),
          eq(securityRateLimits.keyHash, keyHash),
        ),
      )
      .limit(1);

    if (row?.blockedUntil && row.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: retryAfterSeconds(now, row.blockedUntil),
        blockedUntil: row.blockedUntil,
      };
    }

    const blockHasExpired = Boolean(
      row?.blockedUntil && row.blockedUntil <= now,
    );
    const windowCutoff = new Date(now.getTime() - input.policy.windowMs);
    const windowIsActive = Boolean(
      !blockHasExpired &&
        row?.windowStartedAt &&
        row.windowStartedAt > windowCutoff,
    );
    const attemptCount = windowIsActive ? (row?.attemptCount ?? 0) + 1 : 1;
    const windowStartedAt = windowIsActive
      ? (row?.windowStartedAt ?? now)
      : now;
    const limitReached = input.blockAtLimit
      ? attemptCount >= input.policy.limit
      : attemptCount > input.policy.limit;
    const blockedUntil = limitReached
      ? new Date(now.getTime() + input.policy.blockMs)
      : null;

    if (row) {
      await transaction
        .update(securityRateLimits)
        .set({
          windowStartedAt,
          attemptCount,
          blockedUntil,
          updatedAt: now,
        })
        .where(eq(securityRateLimits.id, row.id));
    } else {
      await transaction.insert(securityRateLimits).values({
        scope: input.scope,
        keyHash,
        windowStartedAt,
        attemptCount,
        blockedUntil,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (limitReached && blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: retryAfterSeconds(now, blockedUntil),
        blockedUntil,
      };
    }

    return allowedDecision(input.policy.limit - attemptCount);
  });
}

/** Fixed-window limiter untuk semua request, misalnya generate PDF. */
export function consumeSecurityRateLimit(input: RateLimitInput) {
  return mutateSecurityRateLimit({ ...input, blockAtLimit: false });
}

/** Failure limiter untuk autentikasi. Failure ke-N langsung memulai cooldown. */
export function recordSecurityRateLimitFailure(input: RateLimitInput) {
  return mutateSecurityRateLimit({ ...input, blockAtLimit: true });
}

export async function clearSecurityRateLimit(
  input: Pick<RateLimitInput, "scope" | "key">,
) {
  const policy = { limit: 1, windowMs: 1, blockMs: 1 };
  validateInput({ ...input, policy });
  const keyHash = hashRateLimitKey(input.scope, input.key);

  await db
    .delete(securityRateLimits)
    .where(
      and(
        eq(securityRateLimits.scope, input.scope),
        eq(securityRateLimits.keyHash, keyHash),
      ),
    );
}
