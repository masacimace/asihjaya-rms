import { ArrowLeft, PackageCheck, Store, Wrench } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BuybackProcessingWorkspace } from "@/components/buybacks/buyback-processing-workspace";
import { PosPageContainer, PosPageHeader } from "@/components/layout/pos-page";
import { getBuybackProcessingData } from "@/features/buybacks/processing-queries";
import { getActiveGoldPriceRates } from "@/features/pricing/metal-price-rates";
import {
  getActiveProductMasterOptions,
  getProductMasterCategoryOptions,
} from "@/features/products/product-master-queries";
import { hasPermission, requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Pemrosesan Buyback | POS",
};

export const runtime = "nodejs";

export default async function BuybackProcessingPage() {
  const auth = await requirePermission("buybacks.view");
  if (!hasPermission(auth, "pos.access")) {
    redirect("/akses-ditolak");
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0] ?? null;

  if (!primaryOutlet) {
    redirect("/akses-ditolak");
  }

  const [data, categories, productMasters, activeRates] = await Promise.all([
    getBuybackProcessingData({
      organizationId: auth.organization.id,
      outletId: primaryOutlet.id,
    }),
    getProductMasterCategoryOptions(auth.organization.id),
    getActiveProductMasterOptions(auth.organization.id),
    getActiveGoldPriceRates({ organizationId: auth.organization.id }),
  ]);

  return (
    <PosPageContainer>
      <PosPageHeader
        eyebrow="Buyback · Inventory admission"
        title="Pemrosesan Cuci / Rongsok"
        description="Selesaikan pekerjaan fisik, catat hasil barang, lalu item langsung masuk inventory saleable. Tidak ada approval atau aktivasi tambahan."
        icon={<Wrench className="size-5" />}
        actions={
          <>
            <Link
              href="/pos/buyback"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Buyback
            </Link>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-neutral-900">
                <Store className="size-3.5 text-[var(--accent)]" />
                {primaryOutlet.name}
              </p>
              <p className="mt-1 text-[var(--muted)]">
                {data.pendingCount} item menunggu proses
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] px-3.5 py-2.5 text-xs text-[var(--accent)]">
              <p className="flex items-center gap-1.5 font-semibold">
                <PackageCheck className="size-3.5" />
                Submit = Siap Jual
              </p>
              <p className="mt-1">Langsung tersedia di POS</p>
            </div>
          </>
        }
      />

      <BuybackProcessingWorkspace
        data={data}
        categories={categories}
        productMasters={productMasters}
        priceRates={activeRates.map((rate) => ({
          purityKey: rate.purityKey,
          purityPercent: rate.purityPercent,
          ratePerGram: rate.ratePerGram,
        }))}
        canProcess={hasPermission(auth, "buybacks.create")}
      />
    </PosPageContainer>
  );
}
