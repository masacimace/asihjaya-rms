import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve("src/app/(admin)/admin/keuangan/rekonsiliasi/import/page.tsx"),
  "utf8",
);

assert.match(
  source,
  /w-full min-w-0 max-w-full space-y-6 overflow-x-clip/,
  "Halaman import harus membatasi seluruh konten ke lebar viewport.",
);
assert.match(
  source,
  /grid w-full min-w-0 max-w-full gap-6 xl:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(420px,1\.1fr\)\]/,
  "Grid upload dan guardrail harus dapat menyusut pada mobile.",
);
assert.equal(
  source.match(/h-11 w-full min-w-0 max-w-full rounded-xl border/g)?.length,
  2,
  "Kedua select harus memakai width penuh tanpa intrinsic min-width.",
);
assert.match(
  source,
  /type="file"[\s\S]*block w-full min-w-0 max-w-full overflow-hidden/,
  "Native file input harus dibatasi agar nama file tidak melebarkan card.",
);
assert.equal(
  source.match(/className="w-full min-w-0 max-w-full rounded-3xl border/g)?.length,
  3,
  "Card upload, guardrail, dan riwayat harus memiliki min-width nol dan lebar maksimum penuh.",
);
assert.match(
  source,
  /CheckCircle2 className="mt-0\.5 size-4 shrink-0[\s\S]*span className="min-w-0 break-words"/,
  "Item guardrail harus membungkus teks tanpa mendorong card melebar.",
);
assert.doesNotMatch(
  source,
  /className="h-11 rounded-xl border border-\[var\(--border\)\]/,
  "Select lama tanpa min-w-0 tidak boleh tersisa.",
);
assert.doesNotMatch(
  source,
  /type="file"[\s\S]{0,300}className="rounded-xl border border-dashed/,
  "File input lama tanpa width guard tidak boleh tersisa.",
);

console.log(
  "OK: layout import settlement membatasi grid, select, file input, dan guardrail agar tidak overflow pada mobile.",
);
