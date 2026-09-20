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
  source.includes(
    "mt-4 min-w-0 max-w-full overflow-hidden rounded-2xl bg-[var(--surface-muted)] p-3",
  ),
  "Container pencarian existing item wajib membatasi intrinsic width.",
);

assert(
  /className="[^"]*grid[^"]*min-w-0[^"]*w-full[^"]*max-w-full[^"]*lg:grid-cols-2[^"]*"/.test(
    source,
  ),
  "Grid hasil pencarian wajib mengikuti lebar parent.",
);

assert(
  source.includes(
    'className="mt-1 max-w-full truncate text-[11px] text-neutral-500"',
  ),
  "Nomor Sale panjang wajib tidak mendorong lebar card.",
);

console.log(
  "OK: Buyback existing-item search responsive overflow guard valid.",
);
