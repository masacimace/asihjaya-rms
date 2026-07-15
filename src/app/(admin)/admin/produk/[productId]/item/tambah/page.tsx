import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Gem,
  PackageCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductItemForm } from "@/components/inventory/product-item-form";
import { ProductImage } from "@/components/media/product-image";
import { getProductItemCreateContext } from "@/features/inventory/product-item-queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Tambah Item Inventaris",
};

export const runtime = "nodejs";

const productStatusMeta = {
  draft: {
    label: "Draft",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  active: {
    label: "Aktif",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  inactive: {
    label: "Nonaktif",
    className: "border-neutral-200 bg-neutral-100 text-neutral-600",
  },
} as const;

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
  const productStatus = productStatusMeta[context.product.status];

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <Link
          href={`/admin/produk/${context.product.id}`}
          className="inline-flex h-10 w-fit items-center gap-2 bg-white px-3 text-sm font-medium text-neutral-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke detail produk
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <ProductImage
              src={getImageUrl(context.product.imageKey)}
              alt={context.product.name}
              className="size-64 shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] sm:size-64"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  <Boxes className="size-3.5" />
                  Item fisik baru
                </span>

                <span
                  className={cn(
                    "inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold",
                    productStatus.className,
                  )}
                >
                  Produk {productStatus.label}
                </span>
              </div>

              <h1 className="mt-3 text-2xl font-semibold text-neutral-950 sm:text-3xl">
                Tambah Item Fisik
              </h1>

              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Daftarkan unit perhiasan serialized untuk {context.product.name}
                . SKU dan barcode akan dibuat otomatis setelah item disimpan.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-700">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                  <Gem className="size-3.5 text-[var(--accent)]" />
                  {context.product.code}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5">
                  <Store className="size-3.5 text-[var(--accent)]" />
                  {context.outlets.length > 0
                    ? `${context.outlets.length} outlet tersedia`
                    : "Belum ada outlet aktif"}
                </span>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                <PackageCheck className="size-5" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  Alur penerimaan item
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Satu item fisik mewakili satu barang nyata yang memiliki
                  berat, harga, outlet, foto, barcode, dan status stok sendiri.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-xs text-neutral-700">
              <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5">
                Lengkapi detail fisik dan harga label sebelum menjadikan item
                tersedia.
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2.5">
                Simpan sebagai draft jika foto, harga, atau outlet belum siap.
              </div>
            </div>
          </aside>
        </div>
      </section>

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
