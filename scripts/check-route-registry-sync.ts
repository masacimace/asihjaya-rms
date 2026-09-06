import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "scripts/check-routes.ts");

if (!existsSync(target)) {
  throw new Error("scripts/check-routes.ts tidak ditemukan.");
}

const source = readFileSync(target, "utf8");

const requiredRoutes = [
  "app/(admin)/admin/pengaturan/harga-gram/page.tsx",
  "app/(admin)/admin/produk/master/tambah/page.tsx",
  "app/(pos)/pos/buyback/page.tsx",
  "app/(pos)/pos/buyback/pemrosesan/page.tsx",
  "app/(pos)/pos/buyback/riwayat/page.tsx",
  "app/(pos)/pos/produk/tambah/page.tsx",
  "app/api/buybacks/[buybackId]/receipt-certificate/route.ts",
  "app/documents/buybacks/[buybackId]/receipt-certificate-html/page.tsx",
];

for (const route of requiredRoutes) {
  const count = source.split(`"${route}"`).length - 1;
  if (count !== 1) {
    throw new Error(
      `${route} harus terdaftar tepat satu kali; ditemukan ${count}.`,
    );
  }
}

console.log(
  "OK: 8 route aktif terbaru sudah terklasifikasi tepat satu kali.",
);
