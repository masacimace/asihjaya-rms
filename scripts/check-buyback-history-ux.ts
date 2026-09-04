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

const contracts = read("src/features/buybacks/contracts.ts");
const queries = read("src/features/buybacks/queries.ts");
const panel = read("src/components/buybacks/buyback-history-panel.tsx");
const mainPage = read("src/app/(pos)/pos/buyback/page.tsx");
const historyPage = read("src/app/(pos)/pos/buyback/riwayat/page.tsx");

assert(
  contracts.includes(
    'BuybackHistoryProcessingFilter = "all" | "pending" | "clear"',
  ) &&
    contracts.includes(
      'BuybackHistoryPayoutFilter = "all" | BuybackPayoutMethod',
    ) &&
    contracts.includes("totalCount: number;"),
  "Contract history pagination/filter belum lengkap.",
);

assert(
  queries.includes("offset = 0") &&
    queries.includes('processingFilter = "all"') &&
    queries.includes('payoutFilter = "all"') &&
    queries.includes(".offset(safeOffset)") &&
    queries.includes("totalCount"),
  "Query history belum mendukung count/filter/pagination.",
);

assert(
  /detailId,\s*limit:\s*5,/m.test(mainPage),
  "Halaman /pos/buyback wajib hanya mengambil lima history terbaru.",
);

assert(
  historyPage.includes('title="Riwayat Buyback"') &&
    historyPage.includes("PAGE_SIZE = 10") &&
    historyPage.includes('action="/pos/buyback/riwayat"') &&
    historyPage.includes("processingFilter") &&
    historyPage.includes("payoutFilter"),
  "Dedicated history page belum lengkap.",
);

const responsiveChecks = {
  previewMode: panel.includes('mode = "preview"'),
  totalCount: panel.includes("data.totalCount"),
  mobileCards: panel.includes("md:hidden"),
  desktopTable: panel.includes("hidden overflow-x-auto md:block"),
  allHistoryCta: panel.includes("Lihat semua riwayat"),
  paginationRange:
    panel.includes("Menampilkan {firstRow}-{lastRow} dari") ||
    /Menampilkan \{firstRow\}[^\r\n]*\{lastRow\} dari/.test(panel),
  detailBack: panel.includes("href={backHref}"),
};

const missingResponsiveChecks = Object.entries(responsiveChecks)
  .filter(([, valid]) => !valid)
  .map(([name]) => name);

assert(
  missingResponsiveChecks.length === 0,
  `Responsive preview/history panel belum lengkap: ${missingResponsiveChecks.join(
    ", ",
  )}.`,
);

assert(
  !panel.includes("â€“") &&
    !panel.includes("â†") &&
    !panel.includes("Ã"),
  "Masih ditemukan karakter mojibake hasil encoding PowerShell.",
);

console.log(
  "OK: Buyback history UX V2 valid — 5 preview, total count, 10/page history, filters, mobile cards.",
);
