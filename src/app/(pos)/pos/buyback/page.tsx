import { randomUUID } from "node:crypto";

import {
  CircleDollarSign,
  RefreshCcw,
  Store,
  WalletCards,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BuybackHistoryPanel } from "@/components/buybacks/buyback-history-panel";
import { BuybackWorkspace } from "@/components/buybacks/buyback-workspace";
import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";
import {
  getBuybackHistoryData,
  getBuybackInitialData,
} from "@/features/buybacks/queries";
import { getProductMasterCategoryOptions } from "@/features/products/product-master-queries";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Buyback | POS",
};

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
  searchParams: Promise<{
    detail?: string;
    bb_type?: string;
    bb_msg?: string;
  }>;
};

export default async function PosBuybackPage({ searchParams }: PageProps) {
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

  const detailId =
    query.detail && UUID_PATTERN.test(query.detail) ? query.detail : null;

  const [initialData, categories, historyData] = await Promise.all([
    getBuybackInitialData({
      organizationId: auth.organization.id,
      outletId: primaryOutlet.id,
    }),
    getProductMasterCategoryOptions(auth.organization.id),
    getBuybackHistoryData({
      organizationId: auth.organization.id,
      outletId: primaryOutlet.id,
      detailId,
    }),
  ]);

  const canCreate = hasPermission(auth, "buybacks.create");
  const context = initialData.context;
  const expectedCashAmount = Number(context.activeShift?.expectedCash ?? 0);
  const formattedExpectedCash = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(expectedCashAmount);

  const feedback: {
    type: "success" | "error" | "info";
    message: string;
  } | null =
    query.bb_msg &&
    (query.bb_type === "success" ||
      query.bb_type === "error" ||
      query.bb_type === "info")
      ? {
          type: query.bb_type,
          message: query.bb_msg.slice(0, 300),
        }
      : null;

  return (
    <PosPageContainer>
      <PosPageHeader
        eyebrow="Transaksi barang masuk dari customer"
        title="Buyback Pembelian"
        description="Catat barang yang dibeli kembali, tentukan Cuci/Rongsok, lalu masukkan Total Harga final. Barang belum tersedia di inventory dan POS sampai pemrosesan rekondisi selesai di proses."
        icon={<RefreshCcw className="size-5" />}
        actions={
          <div className="w-full rounded-[22px] border border-[var(--border)] bg-neutral-50 p-4 sm:p-5 lg:w-[560px] xl:w-[500px]">
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-white/80 p-3.5">
                <div className="flex items-start gap-2 text-[11px] font-medium text-[var(--muted)]">
                  <Store className="size-3.5 shrink-0 text-[var(--accent)]" />
                  Outlet aktif
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-neutral-950">
                  {context.outlet?.name ?? "Outlet belum tersedia"}
                </p>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">
                  {context.register?.name ?? "Register belum tersedia"}
                </p>
              </div>

              <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-white/80 p-3.5">
                <div className="flex items-start gap-2 text-[11px] font-medium text-[var(--muted)]">
                  <WalletCards className="size-3.5 shrink-0 text-[var(--accent)]" />
                  Status kasir
                </div>
                <p className="mt-2 text-sm font-semibold text-neutral-950">
                  {context.activeShift ? "Shift aktif" : "Shift belum dibuka"}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    context.activeShift && expectedCashAmount < 0
                      ? "font-semibold text-red-600"
                      : "text-[var(--muted)]",
                  )}
                >
                  {context.activeShift
                    ? `Kas tersedia ${formattedExpectedCash}`
                    : "Buka shift sebelum transaksi Buyback"}
                </p>
              </div>
            </div>

            <Link
              href="/pos/buyback/pemrosesan"
              className="mt-3 mb-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold !text-white transition hover:bg-neutral-800"
            >
              <Wrench className="size-4" />
              Pemrosesan Cuci/Rongsok
            </Link>
          </div>
        }
      />

      {historyData.detail ? (
        <BuybackHistoryPanel
          data={historyData}
          timeZone={auth.organization.timezone}
          feedback={feedback}
        />
      ) : (
        <div className="space-y-5">
          <BuybackWorkspace
            initialData={initialData}
            categories={categories}
            initialIdempotencyKey={randomUUID()}
            canCreate={canCreate}
          />
          <div id="riwayat-buyback">
            <BuybackHistoryPanel
              data={historyData}
              timeZone={auth.organization.timezone}
              feedback={feedback}
            />
          </div>
        </div>
      )}
    </PosPageContainer>
  );
}
