import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  new URL(
    "../src/app/(admin)/admin/laporan/stok/page.tsx",
    import.meta.url,
  ),
  "utf8",
);

assert.match(pageSource, /Laporan Pergerakan Stok/);

assert.match(pageSource, /Filter laporan stok/);
assert.match(pageSource, /<details className="group overflow-hidden rounded-2xl/);
assert.match(pageSource, /Buka filter/);
assert.match(pageSource, /Tutup filter/);
assert.doesNotMatch(
  pageSource,
  /function StockReportFilter[\s\S]*?<details[^>]*\sopen(?:=|\s|>)/,
);

assert.match(pageSource, /data-stock-insights-layout="responsive-four-card-grid"/);
assert.match(pageSource, /grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4/);
assert.match(pageSource, /Distribusi stok tersedia/);
assert.match(pageSource, /Komposisi kategori stok/);
assert.match(pageSource, /Produk paling cepat bergerak/);
assert.match(pageSource, /Item tersedia paling lama/);
assert.match(pageSource, /min-w-0/);
assert.match(pageSource, /overflow-hidden/);
assert.match(pageSource, /line-clamp-2/);

assert.match(pageSource, /data-stock-history-layout="collapsed-compact-history"/);
assert.match(pageSource, /data-stock-movement-layout="compact-row-card"/);
assert.match(pageSource, /Buka riwayat/);
assert.match(pageSource, /Tutup riwayat/);
assert.doesNotMatch(pageSource, /min-w-\[84rem\]/);
assert.doesNotMatch(
  pageSource,
  /Riwayat pergerakan stok[\s\S]*?hidden overflow-x-auto/,
);
assert.doesNotMatch(
  pageSource,
  /function MovementTable/,
);

assert.match(pageSource, /getReportStockData\(auth, filters\)/);
assert.match(pageSource, /Maksimal 80 movement terbaru sesuai filter/);

console.log(
  "Stock report compact UX contracts: OK — collapsed filters/history, responsive four-card insights, compact movement cards.",
);
