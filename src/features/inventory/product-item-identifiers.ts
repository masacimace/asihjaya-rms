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
  const values = await getNextProductItemIdentifierBatch(execute, 1);
  const nextValue = values[0];

  if (!nextValue) {
    throw new Error("Nomor identitas item fisik gagal dibuat.");
  }

  return formatProductItemIdentifiers(nextValue);
}

export async function getNextProductItemIdentifierBatch(
  execute: (query: SQL) => Promise<unknown>,
  count: number,
): Promise<string[]> {
  if (!Number.isSafeInteger(count) || count < 1 || count > 50_000) {
    throw new Error("Jumlah identitas item fisik yang diminta tidak valid.");
  }

  const result = (await execute(
    sql`select nextval('product_item_number_seq')::text as "nextValue" from generate_series(1, ${count})`,
  )) as {
    rows?: Array<{ nextValue?: string }>;
  };

  const values = (result.rows ?? [])
    .map((row) => row.nextValue)
    .filter((value): value is string => Boolean(value));

  if (values.length !== count) {
    throw new Error("Batch nomor identitas item fisik gagal dibuat.");
  }

  return values;
}
