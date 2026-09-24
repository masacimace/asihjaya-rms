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

const transactionCardStart = pageSource.indexOf("function TransactionCard({");
const transactionCardEnd = pageSource.indexOf(
  "function DetailSection({",
  transactionCardStart,
);
assert.ok(
  transactionCardStart >= 0 && transactionCardEnd > transactionCardStart,
  "TransactionCard harus tetap tersedia.",
);
const transactionCardSource = pageSource.slice(
  transactionCardStart,
  transactionCardEnd,
);

assert.match(transactionCardSource, />\s*Produk\s*</);
assert.match(transactionCardSource, />\s*Customer\s*</);
assert.match(transactionCardSource, />\s*Payment\s*</);
assert.match(transactionCardSource, />\s*Total\s*</);
assert.match(transactionCardSource, />\s*Aksi\s*</);
assert.match(
  transactionCardSource,
  /xl:grid-cols-\[minmax\(300px,1\.45fr\)_minmax\(170px,0\.9fr\)_minmax\(180px,0\.95fr\)_minmax\(150px,0\.75fr\)_auto\]/,
);
assert.match(transactionCardSource, /sm:p-4/);
assert.match(transactionCardSource, /xl:hidden/);
assert.match(transactionCardSource, /hidden shrink-0 flex-col gap-2 xl:flex/);
assert.match(transactionCardSource, /TransactionImagesPreview/);
assert.match(transactionCardSource, /TransactionItemsPreview/);
assert.equal(
  (transactionCardSource.match(/<PaymentStatusPill/g) ?? []).length,
  1,
  "Status pembayaran cukup sekali di header compact card.",
);
assert.doesNotMatch(transactionCardSource, />\s*Foto produk\s*</);
assert.doesNotMatch(transactionCardSource, />\s*Item transaksi\s*</);
assert.doesNotMatch(transactionCardSource, />\s*Payment & total\s*</);
assert.doesNotMatch(
  transactionCardSource,
  /bg-neutral-50\/70/,
  "Compact row tidak boleh kembali memakai nested neutral cards.",
);

const imagesPreviewStart = pageSource.indexOf(
  "function TransactionImagesPreview({",
);
const imagesPreviewEnd = pageSource.indexOf(
  "function TransactionItemsPreview({",
  imagesPreviewStart,
);
const imagesPreviewSource = pageSource.slice(
  imagesPreviewStart,
  imagesPreviewEnd,
);
assert.match(imagesPreviewSource, /: "size-14";/);
assert.match(imagesPreviewSource, /transaction\.items\.slice\(0, 3\)/);
assert.match(imagesPreviewSource, />\s*\+\{hiddenCount\}\s*</);

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
  "POS transaction compact UX V2 contracts: OK — compact product/customer/payment/total row, inline desktop actions, responsive fallback actions, 10-row database pagination preserved.",
);
