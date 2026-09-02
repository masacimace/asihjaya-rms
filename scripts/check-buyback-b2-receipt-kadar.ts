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
  receiptHtml.includes('const isBuyback = data.documentKind === "buyback";'),
  "Receipt renderer wajib mengenali documentKind Buyback.",
);

assert(
  /formatPercent\(\s*isBuyback\s*\?\s*item\.snapshot\.purityPercent\s*:\s*item\.snapshot\.exchangePurityPercent,\s*\)/m.test(
    receiptHtml,
  ),
  "Kolom Kadar wajib memakai purityPercent untuk Buyback dan mempertahankan exchangePurityPercent untuk Sale.",
);

assert(
  !/\{formatPercent\(item\.snapshot\.exchangePurityPercent\)\}/.test(
    receiptHtml,
  ),
  "Renderer lama yang selalu memakai exchangePurityPercent masih ditemukan.",
);

console.log(
  "OK: B2 receipt Kadar memakai purityPercent untuk Buyback tanpa mengubah behavior Sale.",
);
