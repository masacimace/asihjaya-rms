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
const compactPanel = read(
  "src/components/buybacks/buyback-compact-history-panel.tsx",
);
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
    historyPage.includes("buybackHistoryDateRanges.map") &&
    historyPage.includes("<details") &&
    historyPage.includes("<BuybackCompactHistoryPanel"),
  "Dedicated POS history page belum lengkap atau belum memakai compact/collapsible UX.",
);

assert(
  adminHistoryPage.includes('title: "Riwayat Buyback"') &&
    adminHistoryPage.includes('action="/admin/buyback"') &&
    adminHistoryPage.includes('historyBaseHref="/admin/buyback"') &&
    adminHistoryPage.includes("Export XLSX") &&
    adminHistoryPage.includes("<details") &&
    adminHistoryPage.includes("<BuybackCompactHistoryPanel") &&
    adminShell.includes('label: "Buyback Pembelian"') &&
    /href:\s*"\/admin\/buyback(?:\?[^\"]*)?"/.test(adminShell) &&
    historyFilters.includes('today: "Hari ini"') &&
    historyFilters.includes('last30: "30 hari terakhir"'),
  "Admin Buyback history/date filter belum lengkap atau belum memakai compact/collapsible UX.",
);

const previewChecks = {
  previewMode: panel.includes('mode = "preview"'),
  totalCount: panel.includes("data.totalCount"),
  mobileCards: panel.includes("md:hidden"),
  desktopTable: panel.includes("hidden overflow-x-auto md:block"),
  allHistoryCta: panel.includes("Lihat semua riwayat"),
  detailBack: panel.includes("href={backHref}"),
};

const missingPreviewChecks = Object.entries(previewChecks)
  .filter(([, valid]) => !valid)
  .map(([name]) => name);

assert(
  missingPreviewChecks.length === 0,
  `Preview Buyback existing berubah tanpa sengaja: ${missingPreviewChecks.join(
    ", ",
  )}.`,
);

const compactHistoryChecks = {
  explicitLayout: compactPanel.includes(
    'data-history-layout="compact-row-card"',
  ),
  noTable: !compactPanel.includes("<table"),
  payoutAmount:
    compactPanel.includes("payoutLabels[payout.method]") &&
    compactPanel.includes("formatCurrency(Number(payout.amount))"),
  photoPreview: compactPanel.includes("BuybackImagesPreview"),
  processingState: compactPanel.includes("getProcessingSummary"),
  customer: compactPanel.includes("row.customerName"),
  outletAndStaff:
    compactPanel.includes("row.outletName") &&
    compactPanel.includes("row.processedByName"),
  adaptivePagination:
    compactPanel.includes("getPaginationTokens") &&
    compactPanel.includes('aria-current={token === page ? "page" : undefined}'),
  preservedFilters:
    compactPanel.includes('params.set("process", filters.process)') &&
    compactPanel.includes('params.set("payout", filters.payout)') &&
    compactPanel.includes('params.set("range", filters.range)'),
};

const missingCompactChecks = Object.entries(compactHistoryChecks)
  .filter(([, valid]) => !valid)
  .map(([name]) => name);

assert(
  missingCompactChecks.length === 0,
  `Compact Buyback history belum lengkap: ${missingCompactChecks.join(", ")}.`,
);

assert(
  historyPage.includes("activeFilterCount") &&
    historyPage.includes("group-open:rotate-180") &&
    adminHistoryPage.includes("activeFilterCount") &&
    adminHistoryPage.includes("group-open:rotate-180") &&
    historyPage.includes("buybackHistoryDateRangeLabels[dateRange]") &&
    adminHistoryPage.includes("buybackHistoryDateRangeLabels[dateRange]"),
  "Filter collapse/active-period indicator Buyback belum konsisten di POS dan Admin.",
);

assert(
  !panel.includes("â€“") &&
    !panel.includes("â†") &&
    !panel.includes("Ã") &&
    !compactPanel.includes("â€“") &&
    !compactPanel.includes("â†") &&
    !compactPanel.includes("Ã"),
  "Masih ditemukan karakter mojibake hasil encoding PowerShell.",
);

console.log(
  "OK: Buyback history UX V4 valid — shared compact row-card, collapsible filters, adaptive pagination, preview unchanged.",
);
