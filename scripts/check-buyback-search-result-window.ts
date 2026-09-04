import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const target = path.join(
  root,
  "src/components/buybacks/buyback-workspace.tsx",
);

assert(existsSync(target), "buyback-workspace.tsx tidak ditemukan.");

const source = readFileSync(target, "utf8");

assert(
  source.includes("const existingSearchRequestRef = useRef(0);"),
  "Search existing item wajib memiliki request guard.",
);

assert(
  source.includes("existingSearchRequestRef.current += 1;") &&
    source.includes("if (!nextQuery.trim())") &&
    source.includes("setExistingResults([]);"),
  "Mengosongkan input wajib langsung menghapus hasil search.",
);

assert(
  source.includes(
    "if (requestId !== existingSearchRequestRef.current)",
  ),
  "Response search lama wajib diabaikan setelah query berubah.",
);

assert(
  source.includes(
    'max-h-[452px] gap-2 overflow-y-auto overscroll-contain pr-1 lg:max-h-none lg:grid-cols-2 lg:overflow-visible lg:pr-0',
  ),
  "Responsive search result wajib dibatasi sekitar lima card dan dapat di-scroll.",
);

assert(
  source.includes(
    'className="h-[84px] min-w-0 w-full max-w-full overflow-hidden',
  ) &&
    source.includes("lg:h-auto"),
  "Card mobile wajib mempunyai tinggi konsisten agar lima hasil terlihat.",
);

assert(
  source.includes("existingResults.length > 5") &&
    source.includes("Scroll daftar untuk melihat"),
  "Mobile UX wajib memberi petunjuk saat ada hasil tambahan.",
);

console.log(
  "OK: Buyback search result window valid — 5-card mobile scroll + clear-on-empty.",
);
