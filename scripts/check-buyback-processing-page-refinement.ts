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

const page = read("src/app/(pos)/pos/buyback/pemrosesan/page.tsx");
const workspace = read(
  "src/components/buybacks/buyback-processing-workspace.tsx",
);
const query = read("src/features/buybacks/processing-queries.ts");
const contracts = read("src/features/buybacks/processing-contracts.ts");

assert(
  page.includes(
    'w-full rounded-[22px] border border-[var(--border)] bg-neutral-50 p-4 sm:p-5 lg:w-[560px] xl:w-[500px]',
  ),
  "Header Pemrosesan wajib memakai operational card yang match dengan Buyback.",
);

assert(
  page.includes("Outlet aktif") &&
    page.includes("Hasil pemrosesan") &&
    page.includes("Submit = Siap Jual") &&
    page.includes("Langsung tersedia di inventory dan POS"),
  "Konten operational card Pemrosesan belum lengkap.",
);

assert(
  page.includes(
    'mt-3 mb-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950',
  ),
  "CTA Kembali ke Buyback wajib full-width di bawah card.",
);

assert(
  workspace.includes('data-processing-layout="compact-row-card"') &&
    workspace.includes("hover:border-[var(--accent)]") &&
    !workspace.includes("<table"),
  "Summary Pemrosesan wajib memakai compact row-card tanpa classic table.",
);

assert(
  workspace.includes("Foto produk") &&
    workspace.includes("Customer") &&
    workspace.includes("Ringkasan Pemrosesan") &&
    workspace.includes("Hasil Pemrosesan"),
  "Compact row-card wajib membawa foto, customer, dan ringkasan hasil processing.",
);

assert(
  workspace.includes("Proses {processingLabel(row.processingType)}") &&
    workspace.includes("QuickLabelPrintButton") &&
    workspace.includes("border-blue-200 bg-blue-50") &&
    workspace.includes("border-amber-200 bg-amber-50"),
  "Action Cuci/Rongsok dan quick label wajib tetap tersedia pada compact card.",
);

assert(
  workspace.includes('data-processing-toolbar="filters-search"') &&
    workspace.includes("lg:flex-row lg:items-center lg:justify-between") &&
    workspace.includes('placeholder="Cari Buyback, customer, produk..."'),
  "Search processing wajib berada pada toolbar bawah bersama filter, bukan di header judul.",
);

assert(
  workspace.includes('compact ? "w-full sm:w-auto" : "w-full"') &&
    workspace.includes(
      '"h-10 w-full px-4 text-xs sm:h-9 sm:w-auto sm:px-3"',
    ),
  "Quick Cetak Label wajib full-width dan centered pada mobile, lalu kembali compact mulai sm.",
);

assert(
  page.includes("COMPLETED_PAGE_SIZE = 10") &&
    page.includes("paginateCompleted: true") &&
    page.includes('filters.status === "pending" ? null : undefined'),
  "Tab Selesai wajib memakai server-side pagination 10 item dan pending queue tidak dipaginasi.",
);

assert(
  workspace.includes("getPaginationTokens") &&
    workspace.includes("← Sebelumnya") &&
    workspace.includes("Berikutnya →") &&
    workspace.includes("pagination.pageCount") &&
    workspace.includes('filters.status === "completed"'),
  "Pagination Pemrosesan selesai wajib match pola Riwayat Buyback.",
);

assert(
  contracts.includes("BuybackProcessingPagination") &&
    contracts.includes("filteredCount: number") &&
    query.includes("filteredCountRows") &&
    query.includes("offset(offset)") &&
    query.includes("paginateCompleted"),
  "Contract/query processing wajib menyediakan count + offset server-side pagination.",
);

assert(
  query.includes("buybacks.buybackNumber") &&
    query.includes("customers.fullName") &&
    query.includes("buybackItems.snapshot") &&
    query.includes("processingType"),
  "Search/filter processing wajib dieksekusi pada query server sebelum pagination.",
);

console.log(
  "OK: Processing page refinement V3 valid — compact cards + completed server pagination.",
);
