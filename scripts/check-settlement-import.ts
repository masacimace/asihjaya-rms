import assert from "node:assert/strict";

import {
  normalizeSettlementImportRow,
  parseCsv,
  suggestSettlementImportMapping,
  validateSettlementImportMapping,
} from "@/features/reconciliation/csv-parser";

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

const normalized = normalizeSettlementImportRow(
  firstRow,
  mapping,
  "Asia/Jakarta",
);
assert.equal(normalized.normalizedReference, "ABC001");
assert.equal(normalized.grossAmount, 1_000_000);
assert.equal(normalized.feeAmount, 7_000);
assert.equal(normalized.netAmount, 993_000);

assert.throws(
  () => parseCsv("Reference,Amount\n=HYPERLINK(1),1000"),
  /formula spreadsheet/i,
);
assert.throws(
  () =>
    validateSettlementImportMapping(parsed.headers, {
      ...mapping,
      transactionDate: null,
    }),
  /mapping/i,
);

console.log("Settlement import parser checks passed.");
