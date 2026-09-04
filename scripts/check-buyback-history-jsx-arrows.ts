import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const target = path.join(
  process.cwd(),
  "src/components/buybacks/buyback-history-panel.tsx",
);

if (!existsSync(target)) {
  throw new Error("buyback-history-panel.tsx tidak ditemukan.");
}

const source = readFileSync(target, "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  source.includes("Lihat semua riwayat &rarr;"),
  "CTA riwayat belum memakai entity JSX-safe.",
);

assert(
  (source.match(/&larr; Sebelumnya/g) ?? []).length === 2,
  "Label Sebelumnya harus memakai &larr; pada state aktif dan disabled.",
);

assert(
  (source.match(/Berikutnya &rarr;/g) ?? []).length === 2,
  "Label Berikutnya harus memakai &rarr; pada state aktif dan disabled.",
);

assert(
  !source.includes("Lihat semua riwayat ->") &&
    !source.includes("< Sebelumnya") &&
    !source.includes("Berikutnya >"),
  "Masih ditemukan label panah mentah yang dapat merusak JSX.",
);

console.log("OK: Buyback history JSX arrow labels valid.");
