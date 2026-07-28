import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { customerDepositLedger } from "@/db/schema";

export type CustomerDepositBalanceTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export type CustomerDepositBalanceScope = {
  organizationId: string;
  outletId: string;
  customerId: string;
};

export function createCustomerDepositBalanceLockKey(
  scope: CustomerDepositBalanceScope,
) {
  return [scope.organizationId, scope.outletId, scope.customerId].join(":");
}

function parseBalance(value: string | null | undefined) {
  const parsed = Number(value ?? 0);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(
      "Saldo Dana Titip pada database tidak valid dan perlu diperiksa administrator.",
    );
  }

  return parsed;
}

/**
 * Serializes every balance mutation for one organization/outlet/customer and
 * returns the latest committed balance while the transaction owns the lock.
 */
export async function lockCustomerDepositBalance(
  transaction: CustomerDepositBalanceTransaction,
  scope: CustomerDepositBalanceScope,
): Promise<number> {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtext(${createCustomerDepositBalanceLockKey(scope)}))`,
  );

  const [latestEntry] = await transaction
    .select({ balanceAfter: customerDepositLedger.balanceAfter })
    .from(customerDepositLedger)
    .where(
      and(
        eq(customerDepositLedger.organizationId, scope.organizationId),
        eq(customerDepositLedger.outletId, scope.outletId),
        eq(customerDepositLedger.customerId, scope.customerId),
      ),
    )
    .orderBy(
      desc(customerDepositLedger.occurredAt),
      desc(customerDepositLedger.createdAt),
    )
    .limit(1)
    .for("update");

  return parseBalance(latestEntry?.balanceAfter);
}
