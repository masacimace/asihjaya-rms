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
  "Telegram admin page harus memakai query-string pagination dengan range dan navigation.",
);

assert(
  pageSource.includes("TelegramDeliveryHistoryCard") &&
    pageSource.includes('id="delivery-history"') === false,
  "Disclosure history harus memakai shared client card; anchor ID dimiliki component.",
);

assert(
  cardSource.includes('"use client"') &&
    cardSource.includes("useSyncExternalStore") &&
    cardSource.includes("asihjaya:telegram-delivery-history-expanded") &&
    cardSource.includes("aria-expanded={isExpanded}") &&
    cardSource.includes("Collapse") &&
    cardSource.includes("Expand"),
  "Delivery History card harus persistent dan accessible untuk expand/collapse.",
);

assert(
  cardSource.includes("Total history") &&
    cardSource.includes("Queue") &&
    cardSource.includes("Terkirim") &&
    cardSource.includes("Failed"),
  "Collapsed card harus tetap menampilkan ringkasan status utama.",
);

assert(
  pageSource.includes("delivery.destinationName") &&
    pageSource.includes("Detail") &&
    pageSource.includes("hover:bg-neutral-50/70"),
  "Table history harus menampilkan destination context dan polished row interaction.",
);

console.log(
  "Batch 2.1 Telegram Delivery History UX contract passed: 20/page server pagination, total count, persistent disclosure, status summary, dan polished table.",
);
