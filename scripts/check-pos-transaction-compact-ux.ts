import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  new URL("../src/app/(pos)/pos/transaksi/page.tsx", import.meta.url),
  "utf8",
);
const paginationSource = readFileSync(
  new URL(
    "../src/features/pos/transaction-history-pagination.ts",
    import.meta.url,
  ),
  "utf8",
);

assert.match(pageSource, /Filter transaksi/);
assert.match(pageSource, /Buka filter/);
assert.match(pageSource, /Tutup filter/);
assert.match(pageSource, /<details className="group mt-5/);
assert.doesNotMatch(
  pageSource,
  /<details[^>]*\sopen(?:=|\s|>)/,
  "Filter transaksi harus default tertutup.",
);
assert.match(pageSource, /name="range"/);
assert.match(pageSource, /<select/);
assert.match(pageSource, /Reset/);
assert.match(pageSource, /Hapus filter shift/);

assert.match(pageSource, /data-transaction-layout="compact-row-card"/);
assert.match(pageSource, /hover:border-\[var\(--accent\)\]/);
assert.match(pageSource, /hover:bg-\[var\(--accent-soft\)\]\/20/);
assert.match(pageSource, /Riwayat transaksi/);
assert.doesNotMatch(pageSource, /<table/);
assert.doesNotMatch(pageSource, /overflow-x-auto/);
assert.doesNotMatch(pageSource, /sm:hidden/);
assert.doesNotMatch(pageSource, /hidden overflow-hidden.*sm:block/);

assert.match(pageSource, /Menampilkan \{firstRow\}–\{lastRow\}/);
assert.match(pageSource, /Halaman \{data\.pagination\.page\} dari/);
assert.match(pageSource, /← Sebelumnya/);
assert.match(pageSource, /Berikutnya →/);
assert.match(pageSource, /page: data\.pagination\.page/);

assert.match(
  paginationSource,
  /export const POS_TRANSACTION_HISTORY_PAGE_SIZE = 10/,
);
assert.match(paginationSource, /\.limit\(POS_TRANSACTION_HISTORY_PAGE_SIZE\)/);
assert.match(paginationSource, /\.offset\(offset\)/);
assert.match(paginationSource, /select\(\{ value: count\(\) \}\)/);
assert.match(paginationSource, /pagination:/);
assert.match(paginationSource, /pageCount/);
assert.match(
  paginationSource,
  /getPosTransactionListData\(\{[\s\S]*?query: null/,
  "Analytics harus tetap memakai pipeline existing tanpa search list.",
);

console.log(
  "POS transaction compact UX contracts: OK — collapsed proper filter, unified responsive cards, 10-row database pagination, analytics semantics preserved.",
);
