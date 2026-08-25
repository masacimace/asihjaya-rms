import { ArrowLeft, CircleDollarSign, PackagePlus, Zap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PosPageContainer } from "@/components/layout/pos-page";
import { ProductItemForm } from "@/components/inventory/product-item-form";
import { getProductItemCreateOutletOptions } from "@/features/inventory/product-item-queries";
import { getActiveGoldPriceRates } from "@/features/pricing/metal-price-rates";
import {
  getActiveProductMasterOptions,
  getProductMasterCategoryOptions,
} from "@/features/products/product-master-queries";
import { hasPermission, requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Tambah Produk | POS",
};

export const runtime = "nodejs";

export default async function PosCreateProductPage() {
  const auth = await requirePermission("pos.access");

  if (!hasPermission(auth, "sales.create")) {
    redirect("/akses-ditolak");
  }

  const primaryOutlet =
    auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0] ?? null;

  const [categories, productMasters, outlets, priceRates] = await Promise.all([
    getProductMasterCategoryOptions(auth.organization.id),
    getActiveProductMasterOptions(auth.organization.id),
    getProductItemCreateOutletOptions({
      organizationId: auth.organization.id,
      allowedOutletIds: primaryOutlet ? [primaryOutlet.id] : [],
    }),
    getActiveGoldPriceRates({ organizationId: auth.organization.id }),
  ]);

  return (
    <PosPageContainer>
      <section className="mb-5 rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <PackagePlus className="size-3.5" />
              Produk baru dari POS
            </span>
            <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Tambah Produk
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Tambahkan item fisik untuk outlet POS aktif. Setelah disimpan,
              produk langsung berstatus tersedia dan kembali muncul di katalog
              POS tanpa perlu input ulang.
            </p>
          </div>

          <div className="grid min-w-[260px] gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-xs text-neutral-700">
            <div className="flex items-start gap-2">
              <Zap className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
              Outlet otomatis mengikuti outlet aktif pada POS ini.
            </div>
            <div className="flex items-start gap-2">
              <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
              Harga / Gram mengikuti rate aktif berdasarkan Kadar Persen.
            </div>
          </div>
        </div>
      </section>

      <ProductItemForm
        categories={categories}
        productMasters={productMasters}
        outlets={outlets}
        priceRates={priceRates.map((rate) => ({
          purityKey: rate.purityKey,
          ratePerGram: rate.ratePerGram,
        }))}
        canCreateProductMaster
        creationSource="pos"
      />
    </PosPageContainer>
  );
}
