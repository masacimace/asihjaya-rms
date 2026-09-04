import { ArrowLeft, History, Store } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BuybackHistoryPanel } from "@/components/buybacks/buyback-history-panel";
import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";
import type {
  BuybackHistoryPayoutFilter,
  BuybackHistoryProcessingFilter,
} from "@/features/buybacks/contracts";
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
    detail?: string;
  }>;
};

function normalizePage(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeProcessingFilter(
  value: string | undefined,
): BuybackHistoryProcessingFilter {
  return value === "pending" || value === "clear" ? value : "all";
}

function normalizePayoutFilter(
  value: string | undefined,
): BuybackHistoryPayoutFilter {
  return value === "cash" ||
    value === "bank_transfer" ||
    value === "customer_deposit"
    ? value
    : "all";
}

function buildListHref({
  page,
  q,
  process,
  payout,
}: {
  page: number;
  q: string;
  process: BuybackHistoryProcessingFilter;
  payout: BuybackHistoryPayoutFilter;
}) {
  const params = new URLSearchParams();

  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  if (process !== "all") params.set("process", process);
  if (payout !== "all") params.set("payout", payout);

  const query = params.toString();
  return query ? `/pos/buyback/riwayat?${query}` : "/pos/buyback/riwayat";
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
  const processingFilter = normalizeProcessingFilter(query.process);
  const payoutFilter = normalizePayoutFilter(query.payout);
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
      }),
    );
  }

  const listHref = buildListHref({
    page,
    q: search,
    process: processingFilter,
    payout: payoutFilter,
  });

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
            </div>

            <Link
              href="/pos/buyback"
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Buyback
            </Link>
          </div>
        }
      />

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
          }}
          detailBackHref={listHref}
        />
      ) : (
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div>
              <h2 className="font-semibold text-neutral-950">
                Cari & filter riwayat
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Search No. Buyback, nama customer, kode customer, atau nomor
                telepon.
              </p>
            </div>

            <form
              action="/pos/buyback/riwayat"
              method="get"
              className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px_auto]"
            >
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-neutral-700">
                  Pencarian
                </span>
                <input
                  name="q"
                  defaultValue={search}
                  placeholder="No. Buyback atau customer..."
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-700">
                  Status proses
                </span>
                <select
                  name="process"
                  defaultValue={processingFilter}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none"
                >
                  <option value="all">Semua</option>
                  <option value="pending">Menunggu proses</option>
                  <option value="clear">Tidak ada antrean</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-700">
                  Payout
                </span>
                <select
                  name="payout"
                  defaultValue={payoutFilter}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none"
                >
                  <option value="all">Semua</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Transfer</option>
                  <option value="customer_deposit">Dana Titip</option>
                </select>
              </label>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="h-11 flex-1 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white lg:flex-none"
                >
                  Terapkan
                </button>
                <Link
                  href="/pos/buyback/riwayat"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700"
                >
                  Reset
                </Link>
              </div>
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
            }}
            detailBackHref={listHref}
          />
        </div>
      )}
    </PosPageContainer>
  );
}
