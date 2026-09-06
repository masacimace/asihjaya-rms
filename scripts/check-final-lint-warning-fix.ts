import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  if (!existsSync(file)) {
    throw new Error(`${relativePath} tidak ditemukan.`);
  }
  return readFileSync(file, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const card = read(
  "src/components/sales/sale-sensitive-actions-card.tsx",
);
const page = read(
  "src/app/(admin)/admin/penjualan/[transactionId]/page.tsx",
);

assert(
  card.includes(`export function SaleSensitiveActionsCard({
  saleId,
  saleStatus,`),
  "SaleSensitiveActionsCard signature belum bersih.",
);

assert(
  !card.includes("invoiceNumber: string;") &&
    !card.includes("  invoiceNumber,\n"),
  "Unused invoiceNumber masih ada di SaleSensitiveActionsCard.",
);

assert(
  !page.includes("invoiceNumber={sale.invoiceNumber}"),
  "Caller masih mengirim invoiceNumber ke SaleSensitiveActionsCard.",
);

console.log(
  "OK: final lint warning cleanup valid — invoiceNumber prop sudah dihapus.",
);
