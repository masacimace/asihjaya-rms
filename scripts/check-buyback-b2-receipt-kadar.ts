import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  assert(existsSync(file), `${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

const receiptHtml = read(
  "src/features/sales/documents/receipt-certificate-html.tsx",
);

assert(
  /formatPercent\(item\.snapshot\.purityPercent\)/.test(receiptHtml),
  "Kolom Kadar wajib memakai purityPercent untuk Sale dan Buyback.",
);

assert(
  !receiptHtml.includes("item.snapshot.exchangePurityPercent"),
  "Nota tidak boleh menampilkan Kadar Tukaran sebagai Kadar Persen produk.",
);

console.log(
  "OK: receipt Kadar memakai purityPercent untuk Sale dan Buyback.",
);
