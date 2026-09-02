import { ArrowLeft, Barcode, Box, CircleDollarSign, Store } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProductItemEditForm } from "@/components/inventory/product-item-edit-form";
import { getProductItemEditContext } from "@/features/inventory/product-item-queries";
import { getActiveGoldPriceRates } from "@/features/pricing/metal-price-rates";
import { requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";

export const metadata = {
  title: "Edit Produk Fisik",
};

export const runtime = "nodejs";

const availabilityLabels = {
  draft: "Draft",
  migration_hold: "Hold Migrasi",
  processing: "Pemrosesan Buyback",
  available: "Tersedia",
  reserved: "Reserved",
  inspection: "Pemeriksaan Retur",
  sold: "Terjual",
} as const;

const conditionLabels = {
  good: "Baru",
  used: "Bekas",
  damaged: "Rusak",
  lost: "Hilang",
  returned: "Retur",
} as const;

export default async function EditProductItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const auth = await requireAnyPermission([
    "inventory.receive",
    "inventory.adjust",
    "inventory.manage",
  ]);
  const { itemId } = await params;

  const [context, priceRates] = await Promise.all([
    getProductItemEditContext({
      organizationId: auth.organization.id,
      itemId,
      allowedOutletIds: auth.outlets.map((outlet) => outlet.id),
    }),
    getActiveGoldPriceRates({ organizationId: auth.organization.id }),
  ]);

  if (!context) {
    notFound();
  }

  if (!["draft", "available"].includes(context.item.availability)) {
    redirect(`/admin/inventaris/item/${context.item.id}`);
  }

  const imageUrl = getImageUrl(context.item.imageKey);
  const itemName = context.item.displayName || context.item.productName;

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href={`/admin/inventaris/item/${context.item.id}`}
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke detail produk
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
                {availabilityLabels[context.item.availability]}
              </span>
              <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
                {conditionLabels[context.item.condition]}
              </span>
            </div>
            <h1 className="mt-3 break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Edit {itemName}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Koreksi data fisik produk tanpa mengubah SKU, barcode, Product Master, atau histori inventaris. Harga jual final tetap ditentukan pada transaksi POS.
            </p>
          </div>

          <div className="grid min-w-[280px] gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-xs text-neutral-700">
            <div className="flex items-center gap-2">
              <Barcode className="size-4 shrink-0 text-[var(--accent)]" />
              <span className="font-mono">{context.item.barcode}</span>
            </div>
            <div className="flex items-center gap-2">
              <Box className="size-4 shrink-0 text-[var(--accent)]" />
              <span>{context.item.productCode} — {context.item.productName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Store className="size-4 shrink-0 text-[var(--accent)]" />
              <span>{context.item.outletName ?? "Belum ditempatkan"}</span>
            </div>
            <div className="flex items-center gap-2">
              <CircleDollarSign className="size-4 shrink-0 text-[var(--accent)]" />
              <span>Harga / Gram mengikuti Kadar Persen aktif.</span>
            </div>
          </div>
        </div>
      </section>

      <ProductItemEditForm
        key={context.item.updatedAt.toISOString()}
        item={{
          id: context.item.id,
          sku: context.item.sku,
          barcode: context.item.barcode,
          displayName: context.item.displayName,
          weightGram: context.item.weightGram,
          purityPercent: context.item.purityPercent,
          exchangePurityPercent: context.item.exchangePurityPercent,
          color: context.item.color,
          deductionPerGram: context.item.deductionPerGram,
          availability: context.item.availability,
          condition: context.item.condition,
          currentOutletId: context.item.currentOutletId,
          outletName: context.item.outletName,
          imageUrl,
          productName: context.item.productName,
          productCode: context.item.productCode,
          productStatus: context.item.productStatus,
          isActive: context.item.isActive,
        }}
        outlets={context.outlets}
        priceRates={priceRates.map((rate) => ({
          purityKey: rate.purityKey,
          ratePerGram: rate.ratePerGram,
        }))}
      />
    </div>
  );
}
