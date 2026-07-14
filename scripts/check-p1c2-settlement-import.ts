import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  normalizeSettlementImportRow,
  parseCsv,
  suggestSettlementImportMapping,
  validateSettlementImportMapping,
} from "../src/features/reconciliation/csv-parser";

async function main() {
  const csv = [
    "Tanggal Transaksi,Reference,Gross Amount,MDR,Net Settlement",
    '2026-07-14,"ABC-001",1.000.000,7.000,993.000',
  ].join("\n");
  const parsed = parseCsv(csv);
  assert.equal(parsed.delimiter, ",");
  assert.equal(parsed.rows.length, 1);

  const mapping = suggestSettlementImportMapping(parsed.headers);
  validateSettlementImportMapping(parsed.headers, mapping);
  const firstRow = parsed.rows[0];
  assert.ok(firstRow);
  const normalized = normalizeSettlementImportRow(firstRow, mapping);
  assert.equal(normalized.normalizedReference, "ABC001");
  assert.equal(normalized.grossAmount, 1_000_000);
  assert.equal(normalized.feeAmount, 7_000);
  assert.equal(normalized.netAmount, 993_000);

  assert.throws(
    () => parseCsv("Reference,Amount\n=HYPERLINK(1),1000"),
    /formula spreadsheet/i,
  );

  const [schema, action, importPage, detailPage, storage, nav] =
    await Promise.all([
      readFile("src/db/schema/index.ts", "utf8"),
      readFile("src/app/actions/settlement-import.ts", "utf8"),
      readFile(
        "src/app/(admin)/admin/keuangan/rekonsiliasi/import/page.tsx",
        "utf8",
      ),
      readFile(
        "src/app/(admin)/admin/keuangan/rekonsiliasi/import/[batchId]/page.tsx",
        "utf8",
      ),
      readFile("src/lib/storage/settlement-import-storage.ts", "utf8"),
      readFile("src/components/layout/admin-shell.tsx", "utf8"),
    ]);

  assert.match(schema, /settlement_import_batches/);
  assert.match(schema, /settlement_import_rows/);
  assert.match(schema, /settlement_import_mappings/);
  assert.match(action, /pg_advisory_xact_lock/);
  assert.match(action, /fileHash/);
  assert.match(action, /payments\.reconciliation\.import/);
  assert.match(importPage, /Import settlement CSV/i);
  assert.match(detailPage, /Mapping kolom CSV/i);
  assert.match(detailPage, /Import dan rekonsiliasi exact match/i);
  assert.match(storage, /private, no-store/);
  assert.match(nav, /Import Settlement/);

  console.log("P1-C.2 settlement import and auto-matching checks passed.");
}

main().catch((error) => {
  console.error("P1-C.2 check gagal.", error);
  process.exitCode = 1;
});
