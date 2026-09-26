"use client";

import { ChevronDown, History } from "lucide-react";
import {
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

const DELIVERY_HISTORY_EXPANDED_KEY =
  "asihjaya:telegram-delivery-history-expanded";
const DELIVERY_HISTORY_PREFERENCE_EVENT =
  "asihjaya:telegram-delivery-history-preference";

function subscribeDeliveryHistoryPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(DELIVERY_HISTORY_PREFERENCE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DELIVERY_HISTORY_PREFERENCE_EVENT, callback);
  };
}

function getDeliveryHistoryPreferenceSnapshot() {
  const stored = window.localStorage.getItem(DELIVERY_HISTORY_EXPANDED_KEY);
  return stored === null ? true : stored === "1";
}

function getDeliveryHistoryPreferenceServerSnapshot() {
  return true;
}

export function TelegramDeliveryHistoryCard({
  totalCount,
  queueCount,
  sentCount,
  failedCount,
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
  const isExpanded = useSyncExternalStore(
    subscribeDeliveryHistoryPreference,
    getDeliveryHistoryPreferenceSnapshot,
    getDeliveryHistoryPreferenceServerSnapshot,
  );

  const toggleExpanded = useCallback(() => {
    const nextValue = !isExpanded;
    window.localStorage.setItem(
      DELIVERY_HISTORY_EXPANDED_KEY,
      nextValue ? "1" : "0",
    );
    window.dispatchEvent(new Event(DELIVERY_HISTORY_PREFERENCE_EVENT));
  }, [isExpanded]);

  return (
    <section
      id="delivery-history"
      className="scroll-mt-24 overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm"
    >
      <div className="bg-gradient-to-br from-white via-white to-[var(--accent-soft)]">
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--border)]">
              <History className="size-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-neutral-950">
                  Delivery history
                </h2>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 ring-1 ring-[var(--border)]">
                  {pageSize} / halaman
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Audit pengiriman Telegram, status worker, attempt, dan error
                terbaru. Timezone tampilan: {timezone}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
            aria-controls="telegram-delivery-history-content"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950"
          >
            {isExpanded ? "Collapse" : "Expand"}
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:px-6 sm:pb-6 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/80 bg-white/90 p-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Total history
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950">
              {totalCount}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/90 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
              Queue
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-blue-950">
              {queueCount}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/90 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Terkirim
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-950">
              {sentCount}
            </p>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-3.5",
              failedCount > 0
                ? "border-red-100 bg-red-50/90"
                : "border-neutral-200 bg-white/90",
            )}
          >
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wide",
                failedCount > 0 ? "text-red-700" : "text-[var(--muted)]",
              )}
            >
              Failed
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-semibold tabular-nums",
                failedCount > 0 ? "text-red-950" : "text-neutral-950",
              )}
            >
              {failedCount}
            </p>
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div
          id="telegram-delivery-history-content"
          className="border-t border-[var(--border)]"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
