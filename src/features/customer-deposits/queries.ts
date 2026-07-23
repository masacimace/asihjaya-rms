import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  customerDepositLedger,
  customers,
  outlets,
  sales,
  users,
} from "@/db/schema";
import type {
  CreateCustomerDepositLedgerEntryInput,
  CustomerDepositBalance,
  CustomerDepositLedgerDirection,
  CustomerDepositLedgerEntryType,
  CustomerDepositLedgerErrorCode,
  CustomerDepositLedgerListFilters,
  CustomerDepositLedgerListRow,
  CustomerDepositLedgerRow,
  CustomerDepositOutletBalance,
  CustomerDepositScope,
} from "@/features/customer-deposits/contracts";

const DEFAULT_LEDGER_LIMIT = 50;
const MAX_LEDGER_LIMIT = 200;

const customerDepositLedgerSelectFields = {
  id: customerDepositLedger.id,
  organizationId: customerDepositLedger.organizationId,
  outletId: customerDepositLedger.outletId,
  customerId: customerDepositLedger.customerId,
  saleId: customerDepositLedger.saleId,
  paymentId: customerDepositLedger.paymentId,
  cashMovementId: customerDepositLedger.cashMovementId,
  approvalId: customerDepositLedger.approvalId,
  entryType: customerDepositLedger.entryType,
  direction: customerDepositLedger.direction,
  amount: customerDepositLedger.amount,
  balanceAfter: customerDepositLedger.balanceAfter,
  idempotencyKey: customerDepositLedger.idempotencyKey,
  referenceType: customerDepositLedger.referenceType,
  referenceId: customerDepositLedger.referenceId,
  description: customerDepositLedger.description,
  metadata: customerDepositLedger.metadata,
  createdByUserId: customerDepositLedger.createdBy,
  occurredAt: customerDepositLedger.occurredAt,
  createdAt: customerDepositLedger.createdAt,
};

export class CustomerDepositLedgerError extends Error {
  readonly code: CustomerDepositLedgerErrorCode;

  constructor({
    code,
    message,
  }: {
    code: CustomerDepositLedgerErrorCode;
    message: string;
  }) {
    super(message);
    this.name = "CustomerDepositLedgerError";
    this.code = code;
  }
}

function parseAmount(value: string | null | undefined) {
  const parsedValue = Number(value ?? 0);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function normalizeLedgerAmount(value: number | string) {
  const parsedValue = Number(value);

  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue <= 0 ||
    !Number.isFinite(parsedValue)
  ) {
    throw new CustomerDepositLedgerError({
      code: "INVALID_AMOUNT",
      message: "Nominal Dana Titip harus berupa rupiah positif tanpa desimal.",
    });
  }

  return parsedValue;
}

function assertLedgerDirection({
  direction,
  entryType,
}: {
  direction: CustomerDepositLedgerDirection;
  entryType: CustomerDepositLedgerEntryType;
}) {
  const isValidDirection =
    (entryType === "deposit_in" && direction === "credit") ||
    ((entryType === "deposit_used" || entryType === "deposit_withdrawal") &&
      direction === "debit") ||
    entryType === "adjustment";

  if (!isValidDirection) {
    throw new CustomerDepositLedgerError({
      code: "INVALID_DIRECTION",
      message: "Arah mutasi Dana Titip tidak sesuai dengan jenis transaksi.",
    });
  }
}

function getDeltaAmount({
  amount,
  direction,
}: {
  amount: number;
  direction: CustomerDepositLedgerDirection;
}) {
  return direction === "credit" ? amount : -amount;
}

function createScopeLockKey(scope: CustomerDepositScope) {
  return [scope.organizationId, scope.outletId, scope.customerId].join(":");
}

function clampLedgerLimit(value: number | undefined) {
  if (!value || !Number.isSafeInteger(value)) {
    return DEFAULT_LEDGER_LIMIT;
  }

  return Math.min(Math.max(value, 1), MAX_LEDGER_LIMIT);
}

export async function getCustomerDepositBalance(
  scope: CustomerDepositScope,
): Promise<CustomerDepositBalance> {
  const [latestEntry] = await db
    .select({
      balanceAfter: customerDepositLedger.balanceAfter,
      occurredAt: customerDepositLedger.occurredAt,
    })
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
    .limit(1);

  const balanceAmount = latestEntry?.balanceAfter ?? "0";

  return {
    ...scope,
    balanceAmount,
    balance: parseAmount(balanceAmount),
    lastLedgerEntryAt: latestEntry?.occurredAt ?? null,
  };
}

export async function getCustomerDepositBalancesForCustomer({
  customerId,
  organizationId,
  outletIds,
}: {
  organizationId: string;
  customerId: string;
  outletIds: string[];
}): Promise<CustomerDepositOutletBalance[]> {
  if (outletIds.length === 0) {
    return [];
  }

  const [outletRows, ledgerRows] = await Promise.all([
    db
      .select({
        outletId: outlets.id,
        outletCode: outlets.code,
        outletName: outlets.name,
      })
      .from(outlets)
      .where(
        and(
          eq(outlets.organizationId, organizationId),
          inArray(outlets.id, outletIds),
        ),
      ),

    db
      .select({
        outletId: customerDepositLedger.outletId,
        balanceAfter: customerDepositLedger.balanceAfter,
        occurredAt: customerDepositLedger.occurredAt,
        createdAt: customerDepositLedger.createdAt,
      })
      .from(customerDepositLedger)
      .where(
        and(
          eq(customerDepositLedger.organizationId, organizationId),
          eq(customerDepositLedger.customerId, customerId),
          inArray(customerDepositLedger.outletId, outletIds),
        ),
      )
      .orderBy(
        desc(customerDepositLedger.occurredAt),
        desc(customerDepositLedger.createdAt),
      ),
  ]);

  const latestLedgerByOutletId = new Map<string, (typeof ledgerRows)[number]>();

  for (const ledgerRow of ledgerRows) {
    if (!latestLedgerByOutletId.has(ledgerRow.outletId)) {
      latestLedgerByOutletId.set(ledgerRow.outletId, ledgerRow);
    }
  }

  return outletRows.map((outlet): CustomerDepositOutletBalance => {
    const latestLedger = latestLedgerByOutletId.get(outlet.outletId) ?? null;
    const balanceAmount = latestLedger?.balanceAfter ?? "0";

    return {
      organizationId,
      outletId: outlet.outletId,
      outletCode: outlet.outletCode,
      outletName: outlet.outletName,
      customerId,
      balanceAmount,
      balance: parseAmount(balanceAmount),
      lastLedgerEntryAt: latestLedger?.occurredAt ?? null,
    };
  });
}

export async function getCustomerDepositLedgerEntries(
  filters: CustomerDepositLedgerListFilters,
): Promise<CustomerDepositLedgerListRow[]> {
  const conditions: SQL[] = [
    eq(customerDepositLedger.organizationId, filters.organizationId),
  ];

  if (filters.outletId) {
    conditions.push(eq(customerDepositLedger.outletId, filters.outletId));
  }

  if (filters.customerId) {
    conditions.push(eq(customerDepositLedger.customerId, filters.customerId));
  }

  const rows = await db
    .select({
      ...customerDepositLedgerSelectFields,
      outletName: outlets.name,
      customerName: customers.fullName,
      customerCode: customers.customerCode,
      createdByName: users.fullName,
      invoiceNumber: sales.invoiceNumber,
    })
    .from(customerDepositLedger)
    .innerJoin(outlets, eq(customerDepositLedger.outletId, outlets.id))
    .innerJoin(customers, eq(customerDepositLedger.customerId, customers.id))
    .innerJoin(users, eq(customerDepositLedger.createdBy, users.id))
    .leftJoin(sales, eq(customerDepositLedger.saleId, sales.id))
    .where(and(...conditions))
    .orderBy(
      desc(customerDepositLedger.occurredAt),
      desc(customerDepositLedger.createdAt),
    )
    .limit(clampLedgerLimit(filters.limit));

  return rows;
}

export async function createCustomerDepositLedgerEntry(
  input: CreateCustomerDepositLedgerEntryInput,
): Promise<CustomerDepositLedgerRow> {
  const amount = normalizeLedgerAmount(input.amount);

  assertLedgerDirection({
    direction: input.direction,
    entryType: input.entryType,
  });

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${createScopeLockKey(input)}))`,
    );

    if (input.idempotencyKey) {
      const [existingEntry] = await tx
        .select(customerDepositLedgerSelectFields)
        .from(customerDepositLedger)
        .where(
          and(
            eq(customerDepositLedger.organizationId, input.organizationId),
            eq(customerDepositLedger.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1)
        .for("update");

      if (existingEntry) {
        return existingEntry;
      }
    }

    const [latestEntry] = await tx
      .select({
        balanceAfter: customerDepositLedger.balanceAfter,
      })
      .from(customerDepositLedger)
      .where(
        and(
          eq(customerDepositLedger.organizationId, input.organizationId),
          eq(customerDepositLedger.outletId, input.outletId),
          eq(customerDepositLedger.customerId, input.customerId),
        ),
      )
      .orderBy(
        desc(customerDepositLedger.occurredAt),
        desc(customerDepositLedger.createdAt),
      )
      .limit(1)
      .for("update");

    const currentBalance = parseAmount(latestEntry?.balanceAfter);
    const nextBalance = currentBalance + getDeltaAmount({
      amount,
      direction: input.direction,
    });

    if (nextBalance < 0) {
      throw new CustomerDepositLedgerError({
        code: "INSUFFICIENT_BALANCE",
        message: "Saldo Dana Titip customer tidak mencukupi.",
      });
    }

    const [createdEntry] = await tx
      .insert(customerDepositLedger)
      .values({
        organizationId: input.organizationId,
        outletId: input.outletId,
        customerId: input.customerId,
        saleId: input.saleId ?? null,
        paymentId: input.paymentId ?? null,
        cashMovementId: input.cashMovementId ?? null,
        approvalId: input.approvalId ?? null,
        entryType: input.entryType,
        direction: input.direction,
        amount: String(amount),
        balanceAfter: String(nextBalance),
        idempotencyKey: input.idempotencyKey?.trim() || null,
        referenceType: input.referenceType?.trim() || null,
        referenceId: input.referenceId ?? null,
        description: input.description?.trim() || null,
        metadata: input.metadata ?? {},
        createdBy: input.createdByUserId,
        occurredAt: input.occurredAt ?? new Date(),
      })
      .returning(customerDepositLedgerSelectFields);

    if (!createdEntry) {
      throw new Error("Gagal membuat mutasi Dana Titip.");
    }

    return createdEntry;
  });
}
