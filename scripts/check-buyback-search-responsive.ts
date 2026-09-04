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
  source.includes(
    'mt-4 min-w-0 max-w-full overflow-hidden rounded-2xl bg-[var(--surface-muted)] p-3',
  ),
  "Container pencarian existing item wajib membatasi intrinsic width.",
);

assert(
  source.includes(
    'mt-3 grid min-w-0 w-full max-w-full gap-2 lg:grid-cols-2',
  ),
  "Grid hasil pencarian wajib mengikuti lebar parent.",
);

assert(
  source.includes(
    'min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white p-3 text-left',
  ),
  "Card hasil pencarian wajib dapat shrink di viewport sempit.",
);

assert(
  source.includes(
    'flex min-w-0 w-full max-w-full items-start justify-between gap-3 overflow-hidden',
  ) &&
    source.includes('className="min-w-0 flex-1 overflow-hidden"'),
  "Konten internal result card wajib shrink-safe.",
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
