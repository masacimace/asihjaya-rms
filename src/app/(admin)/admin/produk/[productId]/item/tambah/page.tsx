import { AlertTriangle, ArrowLeft, Boxes } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductItemForm } from "@/components/inventory/product-item-form";
import { ProductImage } from "@/components/media/product-image";
import { getProductItemCreateContext } from "@/features/inventory/product-item-queries";
import {
  hasPermission,
  requireAnyPermission,
} from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";

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
  const context = await getProductItemCreateContext({
    organizationId: auth.organization.id,
    productId,
    allowedOutletIds: auth.outlets.map((outlet) => outlet.id),
  });

  if (!context) {
    notFound();
  }

  const canManagePricing = hasPermission(auth, "pricing.manage");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link
          href={`/admin/produk/${context.product.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke produk
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <ProductImage
              src={getImageUrl(context.product.imageKey)}
              alt={context.product.name}
              className="size-20 shrink-0 rounded-2xl border border-[var(--border)]"
            />

            <div>
              <p className="text-sm font-medium text-[var(--accent)]">
                {context.product.code}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                Tambah Item Fisik
              </h1>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {context.product.name} · SKU dan barcode dibuat otomatis
              </p>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]">
            <Boxes className="size-4" />
            1 item = 1 barang fisik
          </div>
        </div>
      </header>

      {context.product.status === "inactive" ? (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <h2 className="font-semibold">Produk sedang nonaktif</h2>
            <p className="mt-1 text-sm leading-6">
              Item fisik baru tidak dapat ditambahkan. Aktifkan produk terlebih
              dahulu melalui halaman detail produk.
            </p>
          </div>
        </section>
      ) : (
        <ProductItemForm
          product={context.product}
          outlets={context.outlets}
          canManagePricing={canManagePricing}
        />
      )}
    </div>
  );
}
