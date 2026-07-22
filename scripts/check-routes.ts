import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.resolve(process.cwd(), "src");
const appRoot = path.join(sourceRoot, "app");

const legacyRoutes = [
  "/admin/operasional/" + "outlet",
  "/admin/operasional/" + "register",
  "/admin/produk/" + "varian",
];

const retiredExactRoutes = [
  "/admin/operasional",
  "/admin/laporan/export",
  "/admin/laporan/export/xlsx",
];

const retiredRouteFiles: string[] = [];

const expectedRouteFiles = [
  "app/(admin)/admin/[section]/page.tsx",
  "app/(admin)/admin/administrasi/outlet/[outletId]/page.tsx",
  "app/(admin)/admin/administrasi/outlet/page.tsx",
  "app/(admin)/admin/administrasi/outlet/tambah/page.tsx",
  "app/(admin)/admin/administrasi/page.tsx",
  "app/(admin)/admin/administrasi/peran-akses/[roleId]/page.tsx",
  "app/(admin)/admin/administrasi/peran-akses/page.tsx",
  "app/(admin)/admin/administrasi/peran-akses/tambah/page.tsx",
  "app/(admin)/admin/administrasi/register/[registerId]/page.tsx",
  "app/(admin)/admin/administrasi/register/page.tsx",
  "app/(admin)/admin/administrasi/register/tambah/page.tsx",
  "app/(admin)/admin/administrasi/staff/[staffId]/page.tsx",
  "app/(admin)/admin/administrasi/staff/page.tsx",
  "app/(admin)/admin/administrasi/staff/tambah/page.tsx",
  "app/(admin)/admin/inventaris/item/[itemId]/edit/page.tsx",
  "app/(admin)/admin/inventaris/item/[itemId]/page.tsx",
  "app/(admin)/admin/inventaris/page.tsx",
  "app/(admin)/admin/keuangan/rekonsiliasi/[paymentId]/page.tsx",
  "app/(admin)/admin/keuangan/rekonsiliasi/import/[batchId]/page.tsx",
  "app/(admin)/admin/keuangan/rekonsiliasi/import/page.tsx",
  "app/(admin)/admin/keuangan/rekonsiliasi/page.tsx",
  "app/(admin)/admin/laporan/kas/page.tsx",
  "app/(admin)/admin/laporan/layout.tsx",
  "app/(admin)/admin/laporan/page.tsx",
  "app/(admin)/admin/laporan/penjualan/export/route.ts",
  "app/(admin)/admin/laporan/penjualan/export/xlsx/route.ts",
  "app/(admin)/admin/laporan/penjualan/page.tsx",
  "app/(admin)/admin/laporan/stok/export/route.ts",
  "app/(admin)/admin/laporan/stok/export/xlsx/route.ts",
  "app/(admin)/admin/laporan/stok/page.tsx",
  "app/(admin)/admin/layout.tsx",
  "app/(admin)/admin/notifikasi/page.tsx",
  "app/(admin)/admin/operasional/approval/page.tsx",
  "app/(admin)/admin/operasional/hardware/jobs/[jobId]/page.tsx",
  "app/(admin)/admin/operasional/hardware/page.tsx",
  "app/(admin)/admin/operasional/hardware/setup-guide/page.tsx",
  "app/(admin)/admin/operasional/kas/export/route.ts",
  "app/(admin)/admin/operasional/kas/export/xlsx/route.ts",
  "app/(admin)/admin/operasional/kas/page.tsx",
  "app/(admin)/admin/operasional/shift/page.tsx",
  "app/(admin)/admin/page.tsx",
  "app/(admin)/admin/pelanggan/[customerId]/edit/page.tsx",
  "app/(admin)/admin/pelanggan/[customerId]/page.tsx",
  "app/(admin)/admin/pelanggan/baru/page.tsx",
  "app/(admin)/admin/pelanggan/page.tsx",
  "app/(admin)/admin/pengaturan/page.tsx",
  "app/(admin)/admin/penjualan/[transactionId]/page.tsx",
  "app/(admin)/admin/penjualan/[transactionId]/retur/page.tsx",
  "app/(admin)/admin/penjualan/export/route.ts",
  "app/(admin)/admin/penjualan/export/xlsx/route.ts",
  "app/(admin)/admin/penjualan/page.tsx",
  "app/(admin)/admin/penjualan/preview-nota/html/page.tsx",
  "app/(admin)/admin/penjualan/preview-nota/page.tsx",
  "app/(admin)/admin/produk/[productId]/item/tambah/page.tsx",
  "app/(admin)/admin/produk/[productId]/page.tsx",
  "app/(admin)/admin/produk/kategori/[categoryId]/page.tsx",
  "app/(admin)/admin/produk/kategori/page.tsx",
  "app/(admin)/admin/produk/kategori/tambah/page.tsx",
  "app/(admin)/admin/produk/page.tsx",
  "app/(admin)/admin/produk/tambah/page.tsx",
  "app/(pos)/pos/[section]/page.tsx",
  "app/(pos)/pos/ditahan/page.tsx",
  "app/(pos)/pos/layout.tsx",
  "app/(pos)/pos/page.tsx",
  "app/(pos)/pos/pelanggan/page.tsx",
  "app/(pos)/pos/shift/page.tsx",
  "app/(pos)/pos/transaksi/page.tsx",
  "app/(public)/akses-ditolak/page.tsx",
  "app/(public)/login/page.tsx",
  "app/api/admin/live-counts/route.ts",
  "app/api/hardware-agents/heartbeat/route.ts",
  "app/api/hardware-jobs/[jobId]/route.ts",
  "app/api/hardware-jobs/claim/route.ts",
  "app/api/hardware/v2/jobs/[jobId]/attempts/[attemptId]/lease/route.ts",
  "app/api/hardware/v2/jobs/[jobId]/attempts/[attemptId]/route.ts",
  "app/api/hardware/v2/jobs/claim/route.ts",
  "app/api/health/database/route.ts",
  "app/api/health/route.ts",
  "app/api/pos/checkout-attempts/[idempotencyKey]/route.ts",
  "app/api/print-jobs/route.ts",
  "app/api/sales/[saleId]/receipt-certificate/route.ts",
  "app/api/sales/receipt-certificate-preview/route.ts",
  "app/documents/sales/[saleId]/receipt-certificate-html/page.tsx",
  "app/documents/sales/receipt-certificate-preview-html/page.tsx",
  "app/layout.tsx",
  "app/media/[...key]/route.ts",
  "app/media/payment-evidence/[...key]/route.ts",
  "app/media/payment-reconciliation/[...key]/route.ts",
  "app/media/return-inspection/[...key]/route.ts",
  "app/media/settlement-import/[...key]/route.ts",
  "app/page.tsx",
  "app/v/[token]/image/[...key]/route.ts",
  "app/v/[token]/page.tsx",
];

const searchableExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const routeFileNames = new Set(["layout.tsx", "page.tsx", "route.ts"]);

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

async function walkRouteFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkRouteFiles(fullPath)));
      continue;
    }

    if (routeFileNames.has(entry.name)) {
      files.push(path.relative(sourceRoot, fullPath).replaceAll(path.sep, "/"));
    }
  }

  return files.sort();
}

function findDuplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  }

  return Array.from(duplicates).sort();
}

async function main() {
  const problems: string[] = [];
  const expectedRouteFileSet = new Set(expectedRouteFiles);
  const retiredRouteFileSet = new Set(retiredRouteFiles);

  for (const duplicate of findDuplicateValues(expectedRouteFiles)) {
    problems.push(`Route file terdaftar lebih dari sekali: ${duplicate}`);
  }

  for (const duplicate of findDuplicateValues(retiredRouteFiles)) {
    problems.push(
      `Retired route file terdaftar lebih dari sekali: ${duplicate}`,
    );
  }

  for (const expectedFile of expectedRouteFiles) {
    if (retiredRouteFileSet.has(expectedFile)) {
      problems.push(
        `Route file tidak boleh masuk expected dan retired sekaligus: ${expectedFile}`,
      );
    }

    const absolutePath = path.join(sourceRoot, expectedFile);

    try {
      await access(absolutePath);
    } catch {
      problems.push(`Route file tidak ditemukan: ${expectedFile}`);
    }
  }

  for (const retiredFile of retiredRouteFiles) {
    const absolutePath = path.join(sourceRoot, retiredFile);

    try {
      await access(absolutePath);
      problems.push(`Route file harus dihapus karena sudah tidak dipakai: ${retiredFile}`);
    } catch {
      // File memang sudah tidak ada, sesuai yang diharapkan.
    }
  }

  const actualRouteFiles = await walkRouteFiles(appRoot);

  for (const actualRouteFile of actualRouteFiles) {
    if (!expectedRouteFileSet.has(actualRouteFile)) {
      problems.push(
        `Route file aktif belum diklasifikasi di scripts/check-routes.ts: ${actualRouteFile}`,
      );
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

    for (const retiredRoute of retiredExactRoutes) {
      lines.forEach((line, index) => {
        const usesRetiredRoute =
          line.includes(`href="${retiredRoute}"`) ||
          line.includes(`href='${retiredRoute}'`) ||
          line.includes(`href: "${retiredRoute}"`) ||
          line.includes(`href: '${retiredRoute}'`);

        if (usesRetiredRoute) {
          problems.push(
            `${path.relative(process.cwd(), file)}:${index + 1} masih memakai route nonaktif ${retiredRoute}`,
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
    "Route Admin, POS, API, Media, Dokumen, Verification, dan route export aktif sudah terdaftar tanpa referensi route lama/nonaktif.",
  );
}

main().catch((error: unknown) => {
  console.error("Pemeriksaan route gagal dijalankan:", error);

  process.exitCode = 1;
});
