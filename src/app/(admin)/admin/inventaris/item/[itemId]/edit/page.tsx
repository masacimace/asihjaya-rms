import {
  ArrowLeft,
  Barcode,
  Box,
  FilePenLine,
  ImageIcon,
  MapPin,
  PackageCheck,
  Scale,
  ShieldCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProductItemEditForm } from "@/components/inventory/product-item-edit-form";
import { getProductItemEditContext } from "@/features/inventory/product-item-queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";

export const runtime = "nodejs";

const availabilityLabels = {
  draft: "Draft",
  available: "Tersedia",
  reserved: "Reserved",
  sold: "Terjual",
} as const;

const conditionLabels = {
  good: "Baru",
  damaged: "Bekas",
  lost: "Hilang",
  returned: "Retur",
} as const;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

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
  const context = await getProductItemEditContext({
    organizationId: auth.organization.id,
    itemId,
    allowedOutletIds: auth.outlets.map((outlet) => outlet.id),
  });

  if (!context) {
    notFound();
  }

  if (!["draft", "available"].includes(context.item.availability)) {
    redirect(`/admin/inventaris/item/${context.item.id}`);
  }

  const canManagePricing = hasPermission(auth, "pricing.manage");
  const imageUrl = getImageUrl(context.item.imageKey);
  const itemName = context.item.displayName || context.item.productName;
  const isDraft = context.item.availability === "draft";

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-clip pb-6">
      <header className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <Link
          href={`/admin/inventaris/item/${context.item.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke detail item
        </Link>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <div className="size-84 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-neutral-50 sm:size-64">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={itemName}
                  className="size-full object-cover"
                />
              ) : (
                <div className="grid size-full place-items-center text-neutral-300">
                  <ImageIcon className="size-9" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600">
                  <FilePenLine className="size-3.5" />
                  Mode edit item
                </span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                    isDraft
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {availabilityLabels[context.item.availability]}
                </span>
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
                  {conditionLabels[context.item.condition]}
                </span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                    context.item.isActive
                      ? "border-sky-200 bg-sky-50 text-sky-700"
                      : "border-neutral-200 bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {context.item.isActive ? "Aktif" : "Diarsipkan"}
                </span>
              </div>

              <p className="mt-4 font-mono text-xs font-semibold text-[var(--accent)]">
                {context.item.sku}
              </p>
              <h1 className="mt-1 break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
                Edit {itemName}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Koreksi identitas operasional, spesifikasi fisik, foto, harga,
                dan penempatan item tanpa mengubah SKU, barcode, maupun histori
                inventarisnya.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5">
                  <Barcode className="size-3.5" />
                  <span className="font-mono">{context.item.barcode}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5">
                  <Box className="size-3.5" />
                  {context.item.productName} · {context.item.productCode}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5">
                  <Store className="size-3.5" />
                  {context.item.outletName ?? "Belum ditempatkan"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5">
                  <MapPin className="size-3.5" />
                  {context.item.locationCode ?? "Lokasi belum diisi"}
                </span>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Konteks Pengelolaan
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Aturan edit mengikuti status inventaris dan permission akun.
                </p>
              </div>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--muted)]">Mode item</dt>
                <dd className="font-medium text-neutral-900">
                  {isDraft ? "Persiapan Draft" : "Koreksi Tersedia"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--muted)]">Perubahan outlet</dt>
                <dd className="font-medium text-neutral-900">
                  {isDraft ? "Diizinkan" : "Melalui transfer"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--muted)]">Pengelolaan harga</dt>
                <dd className="font-medium text-neutral-900">
                  {canManagePricing ? "Diizinkan" : "Akses terbatas"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--muted)]">Master product</dt>
                <dd className="font-medium text-neutral-900">
                  {context.item.productStatus === "active"
                    ? "Aktif"
                    : context.item.productStatus === "draft"
                      ? "Draft"
                      : "Nonaktif"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--muted)]">Diperbarui</dt>
                <dd className="text-right font-medium text-neutral-900">
                  {formatDate(context.item.updatedAt)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-xs leading-5 text-[var(--muted)]">
              {isDraft ? (
                <span className="inline-flex items-start gap-2">
                  <PackageCheck className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                  Lengkapi checklist kesiapan sebelum menjadikan item Tersedia.
                </span>
              ) : (
                <span className="inline-flex items-start gap-2">
                  <Scale className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                  Perpindahan outlet dan perubahan kondisi dilakukan melalui
                  workflow inventaris agar audit trail tetap utuh.
                </span>
              )}
            </div>
          </aside>
        </div>
      </header>

      <ProductItemEditForm
        key={context.item.updatedAt.toISOString()}
        item={{
          ...context.item,
          imageUrl,
        }}
        outlets={context.outlets}
        canManagePricing={canManagePricing}
      />
    </div>
  );
}
