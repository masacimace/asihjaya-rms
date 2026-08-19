import { ArrowLeft, Boxes } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductItemForm } from "@/components/inventory/product-item-form";
import {
  getProductItemCreateContext,
  getProductItemCreateOutletOptions,
} from "@/features/inventory/product-item-queries";
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

export default async function CreatePhysicalItemPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const auth = await requireAnyPermission([
    "inventory.receive",
    "inventory.manage",
  ]);
  const { productId } = await params;

  const existingContext = await getProductItemCreateContext({
    organizationId: auth.organization.id,
    productId,
    allowedOutletIds: auth.outlets.map((outlet) => outlet.id),
  });

  if (!existingContext || existingContext.product.status !== "active") notFound();

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
          href={`/admin/produk/${existingContext.product.id}`}
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Product Master
        </Link>

        <div className="mt-5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            <Boxes className="size-3.5" />
            Produk fisik baru
          </span>
          <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
            Tambah Produk
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Product Master {existingContext.product.code} — {existingContext.product.name} sudah dipilih. Kamu tetap bisa mengganti kategori/master jika diperlukan.
          </p>
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
        initialProductMasterId={existingContext.product.id}
        canCreateProductMaster={hasPermission(auth, "products.manage")}
      />
    </div>
  );
}
