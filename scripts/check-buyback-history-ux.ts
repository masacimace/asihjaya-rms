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
const adminHistoryPage = read("src/app/(admin)/admin/buyback/page.tsx");
const adminShell = read("src/components/layout/admin-shell.tsx");
const historyFilters = read("src/features/buybacks/history-filters.ts");

assert(
  contracts.includes(
    'BuybackHistoryProcessingFilter = "all" | "pending" | "clear"',
  ) &&
    contracts.includes(
      'BuybackHistoryPayoutFilter = "all" | BuybackPayoutMethod',
    ) &&
    contracts.includes("buybackHistoryDateRanges") &&
    contracts.includes("BuybackHistoryDateRange") &&
    contracts.includes("totalCount: number;"),
  "Contract history pagination/filter belum lengkap.",
);

assert(
  queries.includes("offset = 0") &&
    queries.includes('processingFilter = "all"') &&
    queries.includes('payoutFilter = "all"') &&
    queries.includes(".offset(safeOffset)") &&
    queries.includes("totalCount") &&
    queries.includes("createBuybackHistoryPeriod(dateRange, timeZone)"),
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
    historyPage.includes("payoutFilter") &&
    historyPage.includes('name="range"') &&
    historyPage.includes("buybackHistoryDateRanges.map"),
  "Dedicated history page belum lengkap.",
);

assert(
  adminHistoryPage.includes('title: "Riwayat Buyback"') &&
    adminHistoryPage.includes('action="/admin/buyback"') &&
    adminHistoryPage.includes('historyBaseHref="/admin/buyback"') &&
    adminHistoryPage.includes("Export XLSX") &&
    adminShell.includes('label: "Riwayat Buyback"') &&
    adminShell.includes('href: "/admin/buyback"') &&
    historyFilters.includes('today: "Hari ini"') &&
    historyFilters.includes('last30: "30 hari terakhir"'),
  "Admin Buyback history/date filter belum lengkap.",
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
  "OK: Buyback history UX V3 valid — date filter, Admin history, 10/page, XLSX, mobile cards.",
);
