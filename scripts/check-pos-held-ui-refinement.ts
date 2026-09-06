import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  if (!existsSync(file)) throw new Error(`${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const page = read("src/app/(pos)/pos/ditahan/page.tsx");
const client = read("src/components/pos/held-carts-client.tsx");

assert(
  page.includes('eyebrow="Transaksi POS"') &&
    page.includes('title="Transaksi Ditahan"') &&
    page.includes("<Store className=\"size-5\" />") &&
    page.includes('{isOutletOnline ? "Online" : "Offline"}'),
  "Header /pos/ditahan belum sesuai pola /pos/transaksi.",
);

assert(
  !page.includes("Kembali ke POS") &&
    !page.includes("ArrowLeft") &&
    !page.includes('import Link from "next/link"'),
  "CTA Kembali ke POS masih tersisa.",
);

assert(
  !client.includes("function OutletBadge(") &&
    !client.includes("Cari hold number, customer, SKU, barcode") &&
    !client.includes("<OutletBadge"),
  "Search + outlet strip yang ditandai merah masih ada.",
);

assert(
  client.includes('title="Hold aktif"') &&
    client.includes('title="Item terkunci"') &&
    client.includes('title="Total sementara"'),
  "Summary cards /pos/ditahan tidak boleh ikut terhapus.",
);

assert(
  client.includes("<HeldCartCard") &&
    client.includes("handleResume") &&
    client.includes("handleCancel"),
  "Flow resume/cancel Hold tidak boleh berubah.",
);

console.log(
  "OK: /pos/ditahan UI valid — header transaksi-style, tanpa back CTA, tanpa search/outlet strip.",
);
