import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  new URL("../src/app/(pos)/pos/pelanggan/page.tsx", import.meta.url),
  "utf8",
);

assert.match(pageSource, /Customer outlet aktif/);
assert.match(pageSource, /data-customer-layout="compact-row-card"/);

assert.match(
  pageSource,
  /min-w-0 overflow-hidden rounded-2xl border border-\[var\(--border\)\] bg-white p-4 transition hover:border-\[var\(--accent\)\] hover:bg-\[var\(--accent-soft\)\]\/20 sm:p-5/,
);
assert.doesNotMatch(pageSource, /hover:shadow-md/);
assert.doesNotMatch(pageSource, /hover:border-neutral-300/);

assert.match(
  pageSource,
  /mt-5 rounded-2xl border border-\[var\(--border\)\] bg-white p-3 sm:p-4/,
);
assert.match(pageSource, /xl:flex-row xl:items-start xl:justify-between/);
assert.match(pageSource, /lg:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(0,1\.1fr\)\]/);
assert.match(pageSource, /grid grid-cols-1 gap-2 sm:grid-cols-2/);

assert.match(pageSource, />\s*WhatsApp\s*</);
assert.match(pageSource, />\s*Transaksi\s*</);
assert.match(
  pageSource,
  /bg-neutral-950 px-4 text-xs font-semibold !text-white transition hover:bg-neutral-800/,
);
assert.match(pageSource, /Total belanja/);

assert.match(pageSource, /buildTransactionsHref\(customer\)/);
assert.match(pageSource, /buildWhatsAppHref\(customer\.phone\)/);
assert.match(pageSource, /formatMoney\(customer\.lastTransaction\.totalAmount\)/);

console.log(
  "POS customer Admin-style card contracts: OK — white list surface, accent hover, responsive metrics, preserved POS actions.",
);
