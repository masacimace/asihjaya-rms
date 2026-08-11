import { sql, type SQL } from "drizzle-orm";

const PRODUCT_MASTER_IDENTIFIER_WIDTH = 6;
const MAX_COLLISION_SKIPS = 10_000;

export function formatProductMasterCode(sequenceValue: string | number) {
  const normalized = String(sequenceValue).padStart(
    PRODUCT_MASTER_IDENTIFIER_WIDTH,
    "0",
  );
  return `PM-${normalized}`;
}

export async function getNextProductMasterCode({
  execute,
  isCodeUsed,
}: {
  execute: (query: SQL) => Promise<unknown>;
  isCodeUsed: (code: string) => Promise<boolean>;
}) {
  for (let attempt = 0; attempt < MAX_COLLISION_SKIPS; attempt += 1) {
    const result = (await execute(
      sql`select nextval('product_master_number_seq')::text as "nextValue"`,
    )) as {
      rows?: Array<{ nextValue?: string }>;
    };

    const nextValue = result.rows?.[0]?.nextValue;
    if (!nextValue) {
      throw new Error("Nomor Product Master gagal dibuat.");
    }

    const code = formatProductMasterCode(nextValue);
    if (!(await isCodeUsed(code))) {
      return code;
    }
  }

  throw new Error(
    "Nomor Product Master tidak dapat dialokasikan karena terlalu banyak code existing yang bertabrakan.",
  );
}
