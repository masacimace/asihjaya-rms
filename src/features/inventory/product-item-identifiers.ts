import { sql, type SQL } from "drizzle-orm";

const IDENTIFIER_WIDTH = 8;

export function formatProductItemIdentifiers(sequenceValue: string | number) {
  const normalized = String(sequenceValue).padStart(IDENTIFIER_WIDTH, "0");

  return {
    sku: `AJ-ITEM-${normalized}`,
    barcode: `AJ${normalized}`,
    qrValue: `AJ${normalized}`,
  };
}

export async function getNextProductItemIdentifiers(
  execute: (query: SQL) => Promise<unknown>,
) {
  const result = (await execute(
    sql`select nextval('product_item_number_seq')::text as "nextValue"`,
  )) as {
    rows?: Array<{ nextValue?: string }>;
  };

  const nextValue = result.rows?.[0]?.nextValue;

  if (!nextValue) {
    throw new Error("Nomor identitas item fisik gagal dibuat.");
  }

  return formatProductItemIdentifiers(nextValue);
}
