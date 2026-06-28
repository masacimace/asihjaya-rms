import { ArrowLeft, FilePenLine } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProductItemEditForm } from "@/components/inventory/product-item-edit-form";
import { getProductItemEditContext } from "@/features/inventory/product-item-queries";
import {
  hasPermission,
  requireAnyPermission,
} from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";

export const runtime = "nodejs";

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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <Link
          href={`/admin/inventaris/item/${context.item.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke detail item
        </Link>

        <div className="mt-5 flex items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <FilePenLine className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">
              {context.item.sku}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Edit Item Fisik
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Lengkapi data Draft atau koreksi informasi item Tersedia tanpa
              mengubah histori outlet.
            </p>
          </div>
        </div>
      </header>

      <ProductItemEditForm
        key={context.item.updatedAt.toISOString()}
        item={{
          ...context.item,
          imageUrl: getImageUrl(context.item.imageKey),
        }}
        outlets={context.outlets}
        canManagePricing={canManagePricing}
      />
    </div>
  );
}
