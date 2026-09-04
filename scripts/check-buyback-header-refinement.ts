import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const pagePath = path.join(root, "src/app/(pos)/pos/buyback/page.tsx");
assert(existsSync(pagePath), "Halaman /pos/buyback tidak ditemukan.");

const page = readFileSync(pagePath, "utf8");

assert(
  page.includes("Operasional Buyback"),
  "Header Buyback wajib memiliki operational card yang terpisah dari title.",
);

assert(
  page.includes("bg-neutral-50") &&
    page.includes("lg:w-[360px]") &&
    page.includes("xl:w-[400px]"),
  "Operational card wajib memakai background soft dan responsive width.",
);

assert(
  page.includes("sm:grid-cols-2") && page.includes("sm:col-span-2"),
  "Info Outlet, Shift, dan helper Buyback wajib responsive.",
);

assert(
  page.includes('href="/pos/buyback/pemrosesan"') &&
    page.includes("Pemrosesan Cuci/Rongsok"),
  "CTA Pemrosesan Cuci/Rongsok wajib tetap tersedia.",
);

assert(
  page.includes("h-11 w-full") && page.includes("bg-neutral-950"),
  "CTA pemrosesan wajib berada di bawah card dan full-width.",
);

assert(
  page.includes("expectedCashAmount < 0") &&
    page.includes("font-semibold text-red-600"),
  "Kas negatif wajib memiliki treatment visual ringan.",
);

assert(
  !page.includes("shadow"),
  "Refinement header /pos/buyback tidak boleh menggunakan efek shadow.",
);

console.log(
  "OK: /pos/buyback header refinement valid — soft card, no shadow, responsive, CTA separated.",
);
