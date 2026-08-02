import { sql } from "drizzle-orm";

import { db } from "@/db";

export type ManualPaymentReferenceTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export type ManualPaymentReferenceScope = {
  organizationId: string;
  outletId: string;
  method: string;
  normalizedProvider: string;
  normalizedReference: string;
};

export function createManualPaymentReferenceLockKey(
  scope: ManualPaymentReferenceScope,
) {
  return [
    scope.organizationId,
    scope.outletId,
    scope.method,
    scope.normalizedProvider,
    scope.normalizedReference,
  ].join(":");
}

/** Serializes duplicate-reference detection and payment insertion. */
export async function lockManualPaymentReference(
  transaction: ManualPaymentReferenceTransaction,
  scope: ManualPaymentReferenceScope,
) {
  const lockKey = createManualPaymentReferenceLockKey(scope);

  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
  );

  return lockKey;
}
