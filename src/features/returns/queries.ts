import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  customers,
  productItems,
  productMasters,
  saleItems,
  saleReturnCases,
  saleReturnItems,
  sales,
  users,
  outlets,
} from "@/db/schema";
import type { SaleReturnWorkflowData } from "@/features/returns/contracts";
import type { AuthContext } from "@/lib/auth/session";

const receivedByUsers = alias(users, "return_received_by_users");
const inspectedByUsers = alias(users, "return_inspected_by_users");
const decidedByUsers = alias(users, "return_decided_by_users");
const createdByUsers = alias(users, "return_created_by_users");

export async function getSaleReturnCaseSummary({
  auth,
  saleId,
}: {
  auth: AuthContext;
  saleId: string;
}) {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) return null;

  const [row] = await db
    .select({
      id: saleReturnCases.id,
      status: saleReturnCases.status,
      expectedItemCount: saleReturnCases.expectedItemCount,
      receivedItemCount: saleReturnCases.receivedItemCount,
      inspectedItemCount: saleReturnCases.inspectedItemCount,
    })
    .from(saleReturnCases)
    .where(
      and(
        eq(saleReturnCases.organizationId, auth.organization.id),
        inArray(saleReturnCases.outletId, outletIds),
        eq(saleReturnCases.saleId, saleId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function getSaleReturnWorkflowData({
  auth,
  saleId,
}: {
  auth: AuthContext;
  saleId: string;
}): Promise<SaleReturnWorkflowData | null> {
  const outletIds = auth.outlets.map((outlet) => outlet.id);

  if (outletIds.length === 0) return null;

  const [caseRow] = await db
    .select({
      id: saleReturnCases.id,
      saleId: saleReturnCases.saleId,
      invoiceNumber: sales.invoiceNumber,
      saleStatus: sales.status,
      outletId: saleReturnCases.outletId,
      outletCode: outlets.code,
      outletName: outlets.name,
      customerName: customers.fullName,
      status: saleReturnCases.status,
      expectedItemCount: saleReturnCases.expectedItemCount,
      receivedItemCount: saleReturnCases.receivedItemCount,
      inspectedItemCount: saleReturnCases.inspectedItemCount,
      notes: saleReturnCases.notes,
      createdAt: saleReturnCases.createdAt,
      completedAt: saleReturnCases.completedAt,
      createdByName: createdByUsers.fullName,
    })
    .from(saleReturnCases)
    .innerJoin(sales, eq(saleReturnCases.saleId, sales.id))
    .innerJoin(outlets, eq(saleReturnCases.outletId, outlets.id))
    .innerJoin(
      createdByUsers,
      eq(saleReturnCases.createdBy, createdByUsers.id),
    )
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(
      and(
        eq(saleReturnCases.organizationId, auth.organization.id),
        inArray(saleReturnCases.outletId, outletIds),
        eq(saleReturnCases.saleId, saleId),
      ),
    )
    .limit(1);

  if (!caseRow) return null;

  const itemRows = await db
    .select({
      id: saleReturnItems.id,
      saleItemId: saleReturnItems.saleItemId,
      productItemId: saleReturnItems.productItemId,
      lineNumber: saleItems.lineNumber,
      productName: productMasters.name,
      sku: saleReturnItems.expectedSku,
      barcode: saleReturnItems.expectedBarcode,
      serialNumber: saleReturnItems.expectedSerialNumber,
      expectedWeightGram: saleReturnItems.expectedWeightGram,
      finalPriceAmount: saleItems.finalPriceAmount,
      status: saleReturnItems.status,
      receivedCode: saleReturnItems.receivedCode,
      actualWeightGram: saleReturnItems.actualWeightGram,
      identityConfirmed: saleReturnItems.identityConfirmed,
      certificateComplete: saleReturnItems.certificateComplete,
      packagingComplete: saleReturnItems.packagingComplete,
      conditionGood: saleReturnItems.conditionGood,
      decision: saleReturnItems.decision,
      inspectionNotes: saleReturnItems.inspectionNotes,
      photoKey: saleReturnItems.photoKey,
      receivedByName: receivedByUsers.fullName,
      receivedAt: saleReturnItems.receivedAt,
      inspectedByName: inspectedByUsers.fullName,
      inspectedAt: saleReturnItems.inspectedAt,
      decidedByName: decidedByUsers.fullName,
      decidedAt: saleReturnItems.decidedAt,
      currentAvailability: productItems.availability,
      currentCondition: productItems.condition,
      currentLocationState: productItems.locationState,
    })
    .from(saleReturnItems)
    .innerJoin(saleItems, eq(saleReturnItems.saleItemId, saleItems.id))
    .innerJoin(
      productItems,
      eq(saleReturnItems.productItemId, productItems.id),
    )
    .innerJoin(
      productMasters,
      eq(productItems.productMasterId, productMasters.id),
    )
    .leftJoin(
      receivedByUsers,
      eq(saleReturnItems.receivedBy, receivedByUsers.id),
    )
    .leftJoin(
      inspectedByUsers,
      eq(saleReturnItems.inspectedBy, inspectedByUsers.id),
    )
    .leftJoin(
      decidedByUsers,
      eq(saleReturnItems.decidedBy, decidedByUsers.id),
    )
    .where(eq(saleReturnItems.returnCaseId, caseRow.id))
    .orderBy(asc(saleItems.lineNumber));

  return {
    ...caseRow,
    items: itemRows,
  } satisfies SaleReturnWorkflowData;
}
