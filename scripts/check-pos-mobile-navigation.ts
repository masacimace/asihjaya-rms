import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const posShellSource = readFileSync(
  resolve("src/components/layout/pos-shell.tsx"),
  "utf8",
);

assert.match(
  posShellSource,
  /CircleEllipsis/,
  "Menu Lainnya harus memakai icon dengan footprint visual yang setara dengan menu utama.",
);
assert.doesNotMatch(
  posShellSource,
  /MoreHorizontal/,
  "Icon tiga titik horizontal lama terlihat terlalu kecil dibanding icon menu utama.",
);
assert.match(
  posShellSource,
  /const mobileBottomNavigationItemClassName =[\s\S]*text-\[11px\] font-semibold leading-none/,
  "Semua item bottom navigation harus memakai typography bersama.",
);
assert.match(
  posShellSource,
  /const mobileBottomNavigationIconClassName = "size-\[21px\] shrink-0"/,
  "Semua icon bottom navigation harus memakai ukuran bersama 21px.",
);
assert.match(
  posShellSource,
  /active \? "text-\[var\(--accent\)\]" : "text-neutral-700"/,
  "Warna active dan inactive bottom navigation harus ditentukan dari helper yang sama.",
);
assert.equal(
  posShellSource.match(/getMobileBottomNavigationItemClassName\(/g)?.length,
  3,
  "Helper style bersama harus dipakai oleh definisi, primary navigation, dan tombol Lainnya.",
);
assert.equal(
  posShellSource.match(/mobileBottomNavigationIconClassName/g)?.length,
  3,
  "Class icon bersama harus dipakai oleh definisi, primary navigation, dan tombol Lainnya.",
);
assert.equal(
  posShellSource.match(/strokeWidth=\{1\.9\}/g)?.length,
  2,
  "Icon primary dan Lainnya harus memakai stroke width yang sama.",
);
assert.match(
  posShellSource,
  /aria-current=\{active \? "page" : undefined\}/,
  "Primary navigation harus memberi informasi active page untuk aksesibilitas.",
);
assert.match(
  posShellSource,
  /aria-haspopup="dialog"[\s\S]*aria-expanded=\{isMoreOpen\}/,
  "Tombol Lainnya harus mengekspos status bottom sheet kepada assistive technology.",
);
assert.match(
  posShellSource,
  /href !== "\/pos\/ditahan" && isNavigationActive\(pathname, href\)/,
  "Route transaksi tertahan tetap harus menyorot menu Transaksi, bukan dua menu sekaligus.",
);

console.log(
  "OK: mobile POS bottom navigation memakai ukuran icon, stroke, typography, warna, dan active state yang seragam.",
);
