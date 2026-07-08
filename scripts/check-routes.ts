import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.resolve(process.cwd(), "src");

const legacyRoutes = [
  "/admin/operasional/" + "outlet",
  "/admin/operasional/" + "register",
  "/admin/produk/" + "varian",
];

const expectedRouteFiles = [
  "app/page.tsx",
  "app/(public)/login/page.tsx",
  "app/(public)/akses-ditolak/page.tsx",

  "app/(admin)/admin/layout.tsx",
  "app/(admin)/admin/page.tsx",
  "app/(admin)/admin/[section]/page.tsx",

  "app/(admin)/admin/administrasi/page.tsx",
  "app/(admin)/admin/administrasi/staff/page.tsx",
  "app/(admin)/admin/administrasi/staff/tambah/page.tsx",
  "app/(admin)/admin/administrasi/staff/[staffId]/page.tsx",
  "app/(admin)/admin/administrasi/peran-akses/page.tsx",
  "app/(admin)/admin/administrasi/peran-akses/tambah/page.tsx",
  "app/(admin)/admin/administrasi/peran-akses/[roleId]/page.tsx",
  "app/(admin)/admin/administrasi/outlet/page.tsx",
  "app/(admin)/admin/administrasi/outlet/tambah/page.tsx",
  "app/(admin)/admin/administrasi/outlet/[outletId]/page.tsx",
  "app/(admin)/admin/administrasi/register/page.tsx",
  "app/(admin)/admin/administrasi/register/tambah/page.tsx",
  "app/(admin)/admin/administrasi/register/[registerId]/page.tsx",

  "app/(admin)/admin/produk/page.tsx",
  "app/(admin)/admin/produk/tambah/page.tsx",
  "app/(admin)/admin/produk/[productId]/page.tsx",
  "app/(admin)/admin/produk/[productId]/item/tambah/page.tsx",
  "app/(admin)/admin/produk/kategori/page.tsx",
  "app/(admin)/admin/produk/kategori/tambah/page.tsx",
  "app/(admin)/admin/produk/kategori/[categoryId]/page.tsx",

  "app/(admin)/admin/inventaris/page.tsx",
  "app/(admin)/admin/inventaris/item/[itemId]/page.tsx",
  "app/(admin)/admin/inventaris/item/[itemId]/edit/page.tsx",

  "app/(admin)/admin/penjualan/page.tsx",
  "app/(admin)/admin/penjualan/[transactionId]/page.tsx",
  "app/(admin)/admin/pelanggan/page.tsx",
  "app/(admin)/admin/pelanggan/baru/page.tsx",
  "app/(admin)/admin/pelanggan/[customerId]/page.tsx",
  "app/(admin)/admin/pelanggan/[customerId]/edit/page.tsx",
  "app/(admin)/admin/operasional/page.tsx",
  "app/(admin)/admin/operasional/shift/page.tsx",
  "app/(admin)/admin/operasional/kas/page.tsx",
  "app/(admin)/admin/operasional/approval/page.tsx",
  "app/(admin)/admin/operasional/hardware/page.tsx",
  "app/(admin)/admin/laporan/page.tsx",
  "app/(admin)/admin/laporan/penjualan/page.tsx",
  "app/(admin)/admin/laporan/stok/page.tsx",
  "app/(admin)/admin/laporan/kas/page.tsx",

  "app/(pos)/pos/layout.tsx",
  "app/(pos)/pos/page.tsx",
  "app/(pos)/pos/[section]/page.tsx",

  "app/api/health/route.ts",
  "app/api/health/database/route.ts",
  "app/api/print-jobs/route.ts",
  "app/api/hardware-agents/heartbeat/route.ts",
  "app/api/hardware-jobs/claim/route.ts",
  "app/api/hardware-jobs/[jobId]/route.ts",
  "app/media/[...key]/route.ts",
];

const searchableExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function walkDirectory(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkDirectory(fullPath)));
      continue;
    }

    if (searchableExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const problems: string[] = [];

  for (const expectedFile of expectedRouteFiles) {
    const absolutePath = path.join(sourceRoot, expectedFile);

    try {
      await access(absolutePath);
    } catch {
      problems.push(`Route file tidak ditemukan: ${expectedFile}`);
    }
  }

  const sourceFiles = await walkDirectory(sourceRoot);

  for (const file of sourceFiles) {
    const content = await readFile(file, "utf8");
    const lines = content.split(/\r?\n/);

    for (const legacyRoute of legacyRoutes) {
      lines.forEach((line, index) => {
        if (line.includes(legacyRoute)) {
          problems.push(
            `${path.relative(process.cwd(), file)}:${index + 1} masih memakai route lama ${legacyRoute}`,
          );
        }
      });
    }
  }

  if (problems.length > 0) {
    console.error("\nPemeriksaan route gagal:\n");

    for (const problem of problems) {
      console.error(`- ${problem}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log("Pemeriksaan route berhasil.");
  console.log(
    "Route Admin, POS, API, Media, Produk, Inventaris, Penjualan, Pelanggan, Operasional, dan Laporan tersedia tanpa referensi route lama.",
  );
}

main().catch((error: unknown) => {
  console.error("Pemeriksaan route gagal dijalankan:", error);

  process.exitCode = 1;
});
