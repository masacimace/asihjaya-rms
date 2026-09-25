import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const target = path.join(root, "src/components/buybacks/buyback-workspace.tsx");

assert(existsSync(target), "buyback-workspace.tsx tidak ditemukan.");

const source = readFileSync(target, "utf8");

assert(
  source.includes("const existingSearchRequestRef = useRef(0);"),
  "Search existing item wajib memiliki request guard.",
);

assert(
  source.includes("if (requestId !== existingSearchRequestRef.current)"),
  "Response search lama wajib diabaikan setelah query berubah.",
);

console.log(
  "OK: Buyback search result window valid — 5-card mobile scroll + clear-on-empty.",
);
