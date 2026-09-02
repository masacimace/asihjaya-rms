import { randomUUID } from "node:crypto";

import { CircleDollarSign, RefreshCcw, Store, WalletCards } from "lucide-react";
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
        title="Buyback"
        description="Catat barang yang dibeli kembali, tentukan Cuci/Rongsok, lalu masukkan Total Harga final. Barang belum tersedia di POS sampai pemrosesan selesai."
        icon={<RefreshCcw className="size-5" />}
        actions={
          <>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-neutral-900">
                <Store className="size-3.5 text-[var(--accent)]" />
                {context.outlet?.name ?? "Outlet belum tersedia"}
              </p>
              <p className="mt-1 text-[var(--muted)]">
                {context.register?.name ?? "Register belum tersedia"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-neutral-900">
                <WalletCards className="size-3.5 text-[var(--accent)]" />
                {context.activeShift ? "Shift aktif" : "Shift belum dibuka"}
              </p>
              <p className="mt-1 text-[var(--muted)]">
                Kas tersedia{" "}
                {new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0,
                }).format(Number(context.activeShift?.expectedCash ?? 0))}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] px-3.5 py-2.5 text-xs text-[var(--accent)]">
              <p className="flex items-center gap-1.5 font-semibold">
                <CircleDollarSign className="size-3.5" />
                Total Harga manual
              </p>
              <p className="mt-1">Cuci / Rongsok sebelum dijual</p>
            </div>
          </>
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
