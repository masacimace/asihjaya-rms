import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

const pageSource = read(
  "src/app/(admin)/admin/pengaturan/integrasi/telegram/page.tsx",
);
const querySource = read("src/features/telegram/admin-queries.ts");
const cardSource = read(
  "src/components/admin/telegram/telegram-delivery-history-card.tsx",
);

assert(
  querySource.includes("TELEGRAM_DELIVERY_HISTORY_PAGE_SIZE = 20") &&
    querySource.includes(".limit(pageSize)") &&
    querySource.includes(".offset(offset)") &&
    querySource.includes("deliveryPagination"),
  "Delivery history harus memakai server-side pagination 20/page.",
);

assert(
  !querySource.includes(".limit(50)"),
  "Hardcoded limit 50 lama harus sudah dihapus.",
);

assert(
  pageSource.includes("historyPage?: string") &&
    pageSource.includes("buildHistoryPageHref") &&
    pageSource.includes("deliveryPagination.from") &&
    pageSource.includes("deliveryPagination.to") &&
    pageSource.includes("Previous") &&
    pageSource.includes("Next"),
  "Telegram admin page harus mempertahankan server pagination.",
);

assert(
  pageSource.includes("TelegramDeliveryHistoryCard") &&
    pageSource.includes('id="delivery-history"') === false,
  "Disclosure history harus tetap memakai shared card.",
);

assert(
  cardSource.includes("<details") &&
    cardSource.includes("<summary") &&
    cardSource.includes("group-open:hidden") &&
    cardSource.includes("sm:group-open:inline") &&
    cardSource.includes("group-open:rotate-180") &&
    cardSource.includes("Buka history") &&
    cardSource.includes("Tutup history"),
  "Delivery History harus tetap memakai native disclosure.",
);

assert(
  !cardSource.includes('"use client"') &&
    !cardSource.includes("useSyncExternalStore") &&
    !cardSource.includes("localStorage") &&
    !cardSource.includes("bg-gradient") &&
    !cardSource.includes("shadow-"),
  "Header Delivery History harus tetap sederhana tanpa gradient/shadow.",
);

assert(
  pageSource.includes('data-telegram-layout="compact-delivery-row"') &&
    pageSource.includes("Outlet / Destination") &&
    pageSource.includes("Pengiriman") &&
    pageSource.includes("Telegram") &&
    pageSource.includes("Error") &&
    pageSource.includes("Detail delivery"),
  "Delivery History harus menggunakan compact responsive row layout.",
);

assert(
  !pageSource.includes("<table") &&
    !pageSource.includes("overflow-x-auto"),
  "Classic table dan horizontal scroll harus sudah dihapus dari Telegram history.",
);

assert(
  pageSource.includes("delivery.destinationName") &&
    pageSource.includes("delivery.telegramMessageId") &&
    pageSource.includes("delivery.lastErrorCode") &&
    pageSource.includes("delivery.lastErrorMessage") &&
    pageSource.includes("delivery.attemptCount") &&
    pageSource.includes("delivery.maxAttempts"),
  "Compact row harus mempertahankan seluruh data audit penting.",
);

console.log(
  "Batch 2.1 Telegram compact history contract passed: responsive row cards, no classic table/horizontal scroll, pagination and disclosure preserved.",
);
