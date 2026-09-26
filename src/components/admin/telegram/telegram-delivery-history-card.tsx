import { ChevronDown, History } from "lucide-react";
import type { ReactNode } from "react";

export function TelegramDeliveryHistoryCard({
  totalCount,
  timezone,
  pageSize,
  children,
}: {
  totalCount: number;
  queueCount: number;
  sentCount: number;
  failedCount: number;
  timezone: string;
  pageSize: number;
  children: ReactNode;
}) {
  return (
    <details
      id="delivery-history"
      className="group scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--border)] bg-white"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-neutral-50 text-neutral-600">
          <History className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-950">
              Delivery history
            </p>

            <span className="inline-flex rounded-full border border-[var(--border)] bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
              {pageSize} / halaman
            </span>

            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              {totalCount} delivery
            </span>
          </div>

          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
            Audit pengiriman Telegram · Timezone {timezone}. Buka untuk melihat
            riwayat, status, attempt, dan detail error.
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-semibold text-neutral-500 sm:inline group-open:hidden">
            Buka history
          </span>
          <span className="hidden text-xs font-semibold text-neutral-500 sm:group-open:inline">
            Tutup history
          </span>
          <ChevronDown className="size-4 text-neutral-500 transition-transform duration-200 group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-[var(--border)]">{children}</div>
    </details>
  );
}
