import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  new URL(
    "../src/app/(admin)/admin/administrasi/staff/page.tsx",
    import.meta.url,
  ),
  "utf8",
);

assert.match(pageSource, /Daftar Staff/);
assert.match(pageSource, /data-staff-layout="compact-row-card"/);
assert.match(pageSource, /sm:grid-cols-2 xl:grid-cols-4/);
assert.match(pageSource, /Akses belum lengkap/);
assert.match(pageSource, /Belum memiliki role/);
assert.match(pageSource, /Belum memiliki outlet/);
assert.match(pageSource, /Edit Staff/);
assert.match(pageSource, /hover:border-\[var\(--accent\)\]/);
assert.match(pageSource, /hover:bg-\[var\(--accent-soft\)\]\/20/);
assert.match(pageSource, /lg:max-h-\[38rem\]/);
assert.match(pageSource, /getStaffList\(auth\.organization\.id\)/);
assert.doesNotMatch(pageSource, /grid-cols-\[minmax\(18rem,1\.35fr\)/);
assert.doesNotMatch(pageSource, /className="hidden lg:block"/);
assert.doesNotMatch(pageSource, /className="grid gap-3 p-4 lg:hidden"/);

console.log(
  "Admin staff compact UX contracts: OK — single responsive card layout, access warning, explicit edit action.",
);
