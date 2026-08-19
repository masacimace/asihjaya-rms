import { ArrowLeft, Boxes, CircleDollarSign, Plus } from "lucide-react";
import Link from "next/link";

import { ProductItemForm } from "@/components/inventory/product-item-form";
import { getProductItemCreateOutletOptions } from "@/features/inventory/product-item-queries";
import { getActiveGoldPriceRates } from "@/features/pricing/metal-price-rates";
import {
  getActiveProductMasterOptions,
  getProductMasterCategoryOptions,
} from "@/features/products/product-master-queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";

export const metadata = {
  title: "Tambah Produk",
};

export const runtime = "nodejs";

export default async function CreateProductPage() {
  const auth = await requireAnyPermission([
    "inventory.receive",
    "inventory.manage",
  ]);

  const [categories, productMasters, outlets, priceRates] = await Promise.all([
    getProductMasterCategoryOptions(auth.organization.id),
    getActiveProductMasterOptions(auth.organization.id),
    getProductItemCreateOutletOptions({
      organizationId: auth.organization.id,
      allowedOutletIds: auth.outlets.map((outlet) => outlet.id),
    }),
    getActiveGoldPriceRates({ organizationId: auth.organization.id }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href="/admin/inventaris"
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke inventaris
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <Boxes className="size-3.5" />
              Produk fisik baru
            </span>
            <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Tambah Produk
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Buat barang fisik langsung dari satu form. Pilih kategori dan Product Master, atau buat Product Master baru dari tombol + jika belum tersedia.
            </p>
          </div>

          <div className="grid min-w-[260px] gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-xs text-neutral-700">
            <div className="flex items-start gap-2">
              <Plus className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
              Product Master baru bisa dibuat langsung dari form tanpa pindah halaman.
            </div>
            <div className="flex items-start gap-2">
              <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
              Harga / Gram otomatis mengikuti Kadar Persen aktif.
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
        canCreateProductMaster={hasPermission(auth, "products.manage")}
      />
    </div>
  );
}
