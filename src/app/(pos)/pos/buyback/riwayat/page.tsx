import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Download,
  Filter,
  History,
  Search,
  Store,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BuybackBankPayoutSnapshotCard } from "@/components/buybacks/buyback-bank-payout-snapshot";
import { BuybackCompactHistoryPanel } from "@/components/buybacks/buyback-compact-history-panel";
import { BuybackHistoryPanel } from "@/components/buybacks/buyback-history-panel";
import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";
import {
  buybackHistoryDateRanges,
  type BuybackHistoryDateRange,
  type BuybackHistoryPayoutFilter,
  type BuybackHistoryProcessingFilter,
} from "@/features/buybacks/contracts";
import {
  buybackHistoryDateRangeLabels,
  normalizeBuybackHistoryDateRange,
  normalizeBuybackHistoryPayoutFilter,
  normalizeBuybackHistoryProcessingFilter,
} from "@/features/buybacks/history-filters";
import { getBuybackHistoryData } from "@/features/buybacks/queries";
import { hasPermission, requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Riwayat Buyback | POS",
};

export const runtime = "nodejs";

const PAGE_SIZE = 10;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    process?: string;
    payout?: string;
    range?: string;
    detail?: string;
  }>;
};

function normalizePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildListHref({
  page,
  q,
  process,
  payout,
  range,
}: {
  page: number;
  q: string;
  process: BuybackHistoryProcessingFilter;
  payout: BuybackHistoryPayoutFilter;
  range: BuybackHistoryDateRange;
}) {
  const params = new URLSearchParams();

  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  if (process !== "all") params.set("process", process);
  if (payout !== "all") params.set("payout", payout);
  if (range !== "today") params.set("range", range);

  const query = params.toString();
  return query ? `/pos/buyback/riwayat?${query}` : "/pos/buyback/riwayat";
}

function buildExportHref({
  q,
  process,
  payout,
  range,
}: {
  q: string;
  process: BuybackHistoryProcessingFilter;
  payout: BuybackHistoryPayoutFilter;
  range: BuybackHistoryDateRange;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (process !== "all") params.set("process", process);
  if (payout !== "all") params.set("payout", payout);
  if (range !== "today") params.set("range", range);

  const query = params.toString();
  return query
    ? `/pos/buyback/riwayat/export/xlsx?${query}`
    : "/pos/buyback/riwayat/export/xlsx";
}

export default async function BuybackHistoryPage({
  searchParams,
}: PageProps) {
  const [auth, query] = await Promise.all([
    requirePermission("buybacks.view"),
    searchParams,
  ]);

  if (!hasPermission(auth, "pos.access")) {
    redirect("/akses-ditolak");
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0] ?? null;

  if (!primaryOutlet) {
    redirect("/akses-ditolak");
  }

  const page = normalizePage(query.page);
  const search = String(query.q ?? "").trim().slice(0, 160);
  const processingFilter = normalizeBuybackHistoryProcessingFilter(query.process);
  const payoutFilter = normalizeBuybackHistoryPayoutFilter(query.payout);
  const dateRange = normalizeBuybackHistoryDateRange(query.range);
  const detailId =
    query.detail && UUID_PATTERN.test(query.detail) ? query.detail : null;

  const historyData = await getBuybackHistoryData({
    organizationId: auth.organization.id,
    outletId: primaryOutlet.id,
    detailId,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    search,
    processingFilter,
    payoutFilter,
    dateRange,
    timeZone: auth.organization.timezone,
  });

  const totalPages = Math.max(
    1,
    Math.ceil(historyData.totalCount / PAGE_SIZE),
  );

  if (!detailId && historyData.totalCount > 0 && page > totalPages) {
    redirect(
      buildListHref({
        page: totalPages,
        q: search,
        process: processingFilter,
        payout: payoutFilter,
        range: dateRange,
      }),
    );
  }

  const listHref = buildListHref({
    page,
    q: search,
    process: processingFilter,
    payout: payoutFilter,
    range: dateRange,
  });
  const exportHref = buildExportHref({
    q: search,
    process: processingFilter,
    payout: payoutFilter,
    range: dateRange,
  });
  const activeFilterCount = [
    search || null,
    processingFilter !== "all" ? processingFilter : null,
    payoutFilter !== "all" ? payoutFilter : null,
    dateRange !== "today" ? dateRange : null,
  ].filter(Boolean).length;
  const isFiltered = activeFilterCount > 0;

  return (
    <PosPageContainer>
      <PosPageHeader
        eyebrow="Buyback · Historical transactions"
        title="Riwayat Buyback"
        description="Cari dan tinjau transaksi Buyback tanpa membuat halaman transaksi utama menjadi panjang. Detail tetap memakai snapshot historis transaksi."
        icon={<History className="size-5" />}
        actions={
          <div className="w-full rounded-[22px] border border-[var(--border)] bg-neutral-50 p-4 sm:p-5 lg:w-[420px]">
            <div className="rounded-2xl border border-[var(--border)] bg-white/80 p-3.5">
              <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--muted)]">
                <Store className="size-3.5 shrink-0 text-[var(--accent)]" />
                Outlet aktif
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-neutral-950">
                {primaryOutlet.name}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {historyData.totalCount} transaksi sesuai filter
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
                <CalendarDays className="size-3.5" />
                {buybackHistoryDateRangeLabels[dateRange]}
              </p>
            </div>

            <a
              href={exportHref}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              <Download className="size-4" />
              Export XLSX
            </a>

            <Link
              href="/pos/buyback"
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Buyback
            </Link>
          </div>
        }
      />

      {historyData.detail ? (
        <div className="space-y-5">
          <BuybackHistoryPanel
            data={historyData}
            timeZone={auth.organization.timezone}
            mode="history"
            page={page}
            pageSize={PAGE_SIZE}
            filters={{
              q: search,
              process: processingFilter,
              payout: payoutFilter,
              range: dateRange,
            }}
            detailBackHref={listHref}
          />
          <BuybackBankPayoutSnapshotCard buybackId={historyData.detail.id} />
        </div>
      ) : (
        <div className="space-y-5">
          <details className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-5 [&::-webkit-details-marker]:hidden">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-neutral-50 text-neutral-600">
                <Filter className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-950">
                    Filter riwayat Buyback
                  </p>
                  {isFiltered ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      {activeFilterCount} filter aktif
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
                      Opsional
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    <CalendarDays className="size-3" />
                    {buybackHistoryDateRangeLabels[dateRange]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                  {isFiltered
                    ? `${historyData.totalCount} transaksi sesuai filter. Buka untuk mengubah pencarian, periode, status proses, atau payout.`
                    : "Buka untuk mencari No. Buyback atau customer, lalu batasi periode, status proses, dan metode payout."}
                </p>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <span className="hidden text-xs font-semibold text-neutral-500 sm:inline group-open:hidden">
                  Buka filter
                </span>
                <span className="hidden text-xs font-semibold text-neutral-500 sm:group-open:inline">
                  Tutup filter
                </span>
                <ChevronDown className="size-4 text-neutral-500 transition-transform duration-200 group-open:rotate-180" />
              </div>
            </summary>

            <div className="border-t border-[var(--border)] p-4 sm:p-5">
              <form
                action="/pos/buyback/riwayat"
                method="get"
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
              >
                <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 transition focus-within:border-[var(--accent)] focus-within:bg-white md:col-span-2 xl:col-span-2">
                  <Search className="size-4 shrink-0 text-neutral-400" />
                  <input
                    name="q"
                    type="search"
                    defaultValue={search}
                    placeholder="No. Buyback, nama, kode, atau telepon customer..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
                  />
                </label>

                <select
                  name="range"
                  defaultValue={dateRange}
                  className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
                >
                  {buybackHistoryDateRanges.map((range) => (
                    <option key={range} value={range}>
                      {buybackHistoryDateRangeLabels[range]}
                    </option>
                  ))}
                </select>

                <select
                  name="process"
                  defaultValue={processingFilter}
                  className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
                >
                  <option value="all">Semua status proses</option>
                  <option value="pending">Menunggu proses</option>
                  <option value="clear">Tidak ada antrean</option>
                </select>

                <select
                  name="payout"
                  defaultValue={payoutFilter}
                  className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
                >
                  <option value="all">Semua payout</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Transfer</option>
                  <option value="customer_deposit">Dana Titip</option>
                </select>

                <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-3 xl:flex xl:justify-end">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold !text-white transition hover:bg-neutral-800"
                  >
                    <Filter className="size-4" />
                    Terapkan
                  </button>
                  <Link
                    href="/pos/buyback/riwayat"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
                  >
                    Reset
                  </Link>
                </div>
              </form>
            </div>
          </details>

          <BuybackCompactHistoryPanel
            data={historyData}
            timeZone={auth.organization.timezone}
            page={page}
            pageSize={PAGE_SIZE}
            filters={{
              q: search,
              process: processingFilter,
              payout: payoutFilter,
              range: dateRange,
            }}
            historyBaseHref="/pos/buyback/riwayat"
          />
        </div>
      )}
    </PosPageContainer>
  );
}
