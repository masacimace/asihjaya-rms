import {
  ArrowLeft,
  CalendarDays,
  Download,
  Filter,
  History,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BuybackHistoryPanel } from "@/components/buybacks/buyback-history-panel";
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
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Riwayat Buyback",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return query ? `/admin/buyback?${query}` : "/admin/buyback";
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
    ? `/admin/buyback/export/xlsx?${query}`
    : "/admin/buyback/export/xlsx";
}

export default async function AdminBuybackHistoryPage({
  searchParams,
}: PageProps) {
  const [auth, query] = await Promise.all([
    requirePermission("buybacks.view"),
    searchParams,
  ]);

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0] ?? null;

  if (!primaryOutlet) {
    redirect("/akses-ditolak");
  }

  const page = normalizePage(query.page);
  const search = String(query.q ?? "")
    .trim()
    .slice(0, 160);
  const processingFilter = normalizeBuybackHistoryProcessingFilter(
    query.process,
  );
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

  const totalPages = Math.max(1, Math.ceil(historyData.totalCount / PAGE_SIZE));

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
  const isFiltered = Boolean(
    search ||
    processingFilter !== "all" ||
    payoutFilter !== "all" ||
    dateRange !== "today",
  );

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="inline-flex h-10 items-center gap-2 text-sm font-medium text-neutral-700"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>

            <div className="mt-4 flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <History className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-neutral-950 sm:text-3xl">
                  Riwayat Buyback
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Tinjau transaksi Buyback, status pemrosesan, metode payout,
                  dan export laporan XLSX dari halaman Admin.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 xl:max-w-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
                  <CalendarDays className="size-3.5 text-[var(--accent)]" />
                  Periode aktif
                </p>
                <p className="mt-2 text-lg font-semibold text-neutral-950">
                  {buybackHistoryDateRangeLabels[dateRange]}
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  {historyData.totalCount} transaksi sesuai filter.
                </p>
              </div>
            </div>

            <p className="mt-3 truncate text-xs font-medium text-neutral-600">
              Outlet: {primaryOutlet.name}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2">
              <a
                href={exportHref}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-3 text-xs font-semibold !text-white transition hover:bg-neutral-800"
              >
                <Download className="size-4" />
                Export XLSX
              </a>
            </div>
          </div>
        </div>
      </header>

      {historyData.detail ? (
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
          historyBaseHref="/admin/buyback"
        />
      ) : (
        <>
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Filter riwayat Buyback
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Cari No. Buyback atau customer, lalu batasi periode, status
                  proses, dan metode payout.
                </p>
              </div>
              {isFiltered ? (
                <Link
                  href="/admin/buyback"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
                >
                  Reset filter
                </Link>
              ) : null}
            </div>

            <form
              action="/admin/buyback"
              method="get"
              className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_170px_190px_190px_auto]"
            >
              <input
                name="q"
                type="search"
                defaultValue={search}
                placeholder="No. Buyback atau customer..."
                className="h-11 min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
              />

              <select
                name="range"
                defaultValue={dateRange}
                className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
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
                className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
              >
                <option value="all">Semua status proses</option>
                <option value="pending">Menunggu proses</option>
                <option value="clear">Tidak ada antrean</option>
              </select>

              <select
                name="payout"
                defaultValue={payoutFilter}
                className="h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-700 outline-none focus:border-[var(--accent)]"
              >
                <option value="all">Semua payout</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Transfer</option>
                <option value="customer_deposit">Dana Titip</option>
              </select>

              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800"
              >
                <Filter className="size-4" />
                Terapkan
              </button>
            </form>
          </section>

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
            historyBaseHref="/admin/buyback"
          />
        </>
      )}
    </div>
  );
}
