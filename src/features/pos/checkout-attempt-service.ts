import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { posCheckoutAttempts } from "@/db/schema";
import { type PosCheckoutPayload } from "@/features/pos/contracts";
import {
  createPosCheckoutRequestFingerprint,
  type PosCheckoutFingerprintContext,
} from "@/features/pos/checkout-fingerprint";

type CheckoutAttemptRow = {
  id: string;
  organizationId: string;
  outletId: string;
  registerId: string;
  shiftId: string;
  cashierId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  status: "processing" | "completed" | "failed";
  saleId: string | null;
  attemptCount: number;
  updatedAt: Date;
};

const POS_CHECKOUT_STALE_PROCESSING_MS = 5 * 60 * 1000;

export type ClaimPosCheckoutAttemptResult =
  | {
      status: "claimed";
      attempt: CheckoutAttemptRow;
      fingerprint: string;
      replay: boolean;
    }
  | {
      status: "processing";
      attempt: CheckoutAttemptRow;
      fingerprint: string;
    }
  | {
      status: "completed";
      attempt: CheckoutAttemptRow;
      fingerprint: string;
    }
  | {
      status: "conflict";
      attempt: CheckoutAttemptRow;
      fingerprint: string;
    };

const attemptSelection = {
  id: posCheckoutAttempts.id,
  organizationId: posCheckoutAttempts.organizationId,
  outletId: posCheckoutAttempts.outletId,
  registerId: posCheckoutAttempts.registerId,
  shiftId: posCheckoutAttempts.shiftId,
  cashierId: posCheckoutAttempts.cashierId,
  idempotencyKey: posCheckoutAttempts.idempotencyKey,
  requestFingerprint: posCheckoutAttempts.requestFingerprint,
  status: posCheckoutAttempts.status,
  saleId: posCheckoutAttempts.saleId,
  attemptCount: posCheckoutAttempts.attemptCount,
  updatedAt: posCheckoutAttempts.updatedAt,
};

export async function getPosCheckoutAttemptByKey(idempotencyKey: string) {
  const [attempt] = await db
    .select(attemptSelection)
    .from(posCheckoutAttempts)
    .where(eq(posCheckoutAttempts.idempotencyKey, idempotencyKey))
    .limit(1);

  return attempt ?? null;
}

export async function claimPosCheckoutAttempt({
  context,
  payload,
}: {
  context: PosCheckoutFingerprintContext;
  payload: PosCheckoutPayload;
}): Promise<ClaimPosCheckoutAttemptResult> {
  const idempotencyKey = payload.idempotencyKey;
  const fingerprint = createPosCheckoutRequestFingerprint({ context, payload });
  const now = new Date();

  const [inserted] = await db
    .insert(posCheckoutAttempts)
    .values({
      organizationId: context.organizationId,
      outletId: context.outletId,
      registerId: context.registerId,
      shiftId: context.shiftId,
      cashierId: context.cashierId,
      idempotencyKey,
      requestFingerprint: fingerprint,
      status: "processing",
      attemptCount: 1,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: posCheckoutAttempts.idempotencyKey })
    .returning(attemptSelection);

  if (inserted) {
    return {
      status: "claimed",
      attempt: inserted,
      fingerprint,
      replay: false,
    };
  }

  const existing = await getPosCheckoutAttemptByKey(idempotencyKey);

  if (!existing) {
    throw new Error("POS_CHECKOUT_ATTEMPT_CONFLICT_WITHOUT_ROW");
  }

  const sameScope =
    existing.organizationId === context.organizationId &&
    existing.outletId === context.outletId &&
    existing.registerId === context.registerId &&
    existing.shiftId === context.shiftId &&
    existing.cashierId === context.cashierId;

  if (!sameScope || existing.requestFingerprint !== fingerprint) {
    return {
      status: "conflict",
      attempt: existing,
      fingerprint,
    };
  }

  if (existing.status === "completed") {
    return {
      status: "completed",
      attempt: existing,
      fingerprint,
    };
  }

  if (existing.status === "processing") {
    const isStale =
      now.getTime() - existing.updatedAt.getTime() >=
      POS_CHECKOUT_STALE_PROCESSING_MS;

    if (!isStale) {
      return {
        status: "processing",
        attempt: existing,
        fingerprint,
      };
    }

    const [reclaimedStaleAttempt] = await db
      .update(posCheckoutAttempts)
      .set({
        attemptCount: sql`${posCheckoutAttempts.attemptCount} + 1`,
        lastErrorCode: null,
        lastErrorMessage: null,
        failedAt: null,
        startedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(posCheckoutAttempts.id, existing.id),
          eq(posCheckoutAttempts.status, "processing"),
          eq(posCheckoutAttempts.requestFingerprint, fingerprint),
          eq(posCheckoutAttempts.updatedAt, existing.updatedAt),
        ),
      )
      .returning(attemptSelection);

    if (reclaimedStaleAttempt) {
      return {
        status: "claimed",
        attempt: reclaimedStaleAttempt,
        fingerprint,
        replay: true,
      };
    }

    const latest = await getPosCheckoutAttemptByKey(idempotencyKey);

    if (!latest) {
      throw new Error("POS_CHECKOUT_STALE_ATTEMPT_RECLAIM_LOST");
    }

    return latest.status === "completed"
      ? { status: "completed", attempt: latest, fingerprint }
      : { status: "processing", attempt: latest, fingerprint };
  }

  const [reclaimed] = await db
    .update(posCheckoutAttempts)
    .set({
      status: "processing",
      attemptCount: sql`${posCheckoutAttempts.attemptCount} + 1`,
      lastErrorCode: null,
      lastErrorMessage: null,
      failedAt: null,
      startedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(posCheckoutAttempts.id, existing.id),
        eq(posCheckoutAttempts.status, "failed"),
        eq(posCheckoutAttempts.requestFingerprint, fingerprint),
      ),
    )
    .returning(attemptSelection);

  if (!reclaimed) {
    const latest = await getPosCheckoutAttemptByKey(idempotencyKey);

    if (!latest) {
      throw new Error("POS_CHECKOUT_ATTEMPT_RECLAIM_LOST");
    }

    return latest.status === "completed"
      ? { status: "completed", attempt: latest, fingerprint }
      : { status: "processing", attempt: latest, fingerprint };
  }

  return {
    status: "claimed",
    attempt: reclaimed,
    fingerprint,
    replay: true,
  };
}

export async function markPosCheckoutAttemptCompleted({
  attemptId,
  attemptCount,
  saleId,
}: {
  attemptId: string;
  attemptCount: number;
  saleId: string;
}) {
  const now = new Date();

  await db
    .update(posCheckoutAttempts)
    .set({
      status: "completed",
      saleId,
      completedAt: now,
      failedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(posCheckoutAttempts.id, attemptId),
        eq(posCheckoutAttempts.status, "processing"),
        eq(posCheckoutAttempts.attemptCount, attemptCount),
      ),
    );
}

export async function markPosCheckoutAttemptFailed({
  attemptId,
  attemptCount,
  errorCode,
  errorMessage,
}: {
  attemptId: string;
  attemptCount: number;
  errorCode: string;
  errorMessage: string;
}) {
  const now = new Date();

  await db
    .update(posCheckoutAttempts)
    .set({
      status: "failed",
      lastErrorCode: errorCode.slice(0, 80),
      lastErrorMessage: errorMessage.slice(0, 2000),
      failedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(posCheckoutAttempts.id, attemptId),
        eq(posCheckoutAttempts.status, "processing"),
        eq(posCheckoutAttempts.attemptCount, attemptCount),
      ),
    );
}
