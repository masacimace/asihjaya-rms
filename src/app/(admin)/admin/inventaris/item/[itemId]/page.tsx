import {
  ArrowLeft,
  Barcode,
  Boxes,
  CircleDollarSign,
  Clock3,
  FilePenLine,
  MapPin,
  Scale,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductImage } from "@/components/media/product-image";
import { getProductItemDetail } from "@/features/inventory/product-item-queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";

import { PrintLabelButton } from "./print-button";

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

const movementLabels = {
  goods_receipt: "Penerimaan barang",
  sale: "Penjualan",
  sale_return: "Retur penjualan",
  transfer_out: "Transfer keluar",
  transfer_in: "Transfer masuk",
  reservation: "Reservasi",
  reservation_release: "Pelepasan reservasi",
  adjustment: "Penyesuaian",
  damaged: "Ditandai rusak",
  lost: "Ditandai hilang",
  repair_out: "Keluar untuk perbaikan",
  repair_in: "Kembali dari perbaikan",
  reversal: "Pembalikan movement",
} as const;

function formatMoney(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default async function ProductItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const auth = await requireAnyPermission([
    "inventory.view",
    "inventory.receive",
    "inventory.adjust",
    "inventory.transfer",
    "inventory.manage",
  ]);
  const { itemId } = await params;
  const query = await searchParams;
  const item = await getProductItemDetail(auth.organization.id, itemId);

  if (!item) {
    notFound();
  }

  const canViewCost =
    hasPermission(auth, "pricing.view_cost") ||
    hasPermission(auth, "pricing.manage");
  const canEdit =
    ["draft", "available"].includes(item.availability) &&
    ["inventory.receive", "inventory.adjust", "inventory.manage"].some(
      (permission) => hasPermission(auth, permission),
    );
  const imageUrl = getImageUrl(item.imageKey ?? item.productImageKey);
  const usesCatalogPhoto = !item.imageKey && Boolean(item.productImageKey);
  const itemDisplayName = item.displayName ?? item.productName;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <Link
          href="/admin/inventaris"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] transition hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          Kembali ke inventaris
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                {item.sku}
              </h1>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
                {availabilityLabels[item.availability]}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {itemDisplayName} · {item.barcode}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Link
                href={`/admin/inventaris/item/${item.id}/edit`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <FilePenLine className="size-4" />
                Edit Item
              </Link>
            ) : null}

            <PrintLabelButton item={{ ...item, productName: itemDisplayName }} />

            <Link
              href={`/admin/produk/${item.productId}`}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Lihat Product
            </Link>
          </div>
        </div>
      </header>

      {query.created === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Item fisik berhasil dibuat.
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
          <ProductImage
            src={imageUrl}
            alt={`${itemDisplayName} ${item.sku}`}
            className="aspect-square w-full rounded-xl"
            badge={usesCatalogPhoto ? "Foto katalog" : "Foto item aktual"}
          />
          {usesCatalogPhoto ? (
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              Item belum mempunyai foto aktual. Foto katalog Product digunakan
              sebagai fallback.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <Barcode className="size-5 text-[var(--accent)]" />
            <p className="mt-4 text-xs text-[var(--muted)]">Barcode</p>
            <p className="mt-1 font-mono text-lg font-semibold text-neutral-950">
              {item.barcode}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <Scale className="size-5 text-blue-700" />
            <p className="mt-4 text-xs text-[var(--muted)]">Berat aktual</p>
            <p className="mt-1 text-lg font-semibold text-neutral-950">
              {item.weightGram ? `${item.weightGram} gram` : "Belum diisi"}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <CircleDollarSign className="size-5 text-emerald-700" />
            <p className="mt-4 text-xs text-[var(--muted)]">Harga label</p>
            <p className="mt-1 text-lg font-semibold text-neutral-950">
              {formatMoney(item.sellingAmount)}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <MapPin className="size-5 text-violet-700" />
            <p className="mt-4 text-xs text-[var(--muted)]">Lokasi</p>
            <p className="mt-1 text-lg font-semibold text-neutral-950">
              {item.outletName ?? "Belum ditempatkan"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {item.locationCode ?? "Tanpa kode lokasi"}
            </p>
          </article>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-3">
            <Tag className="size-5 text-[var(--accent)]" />
            <h2 className="font-semibold text-neutral-950">
              Identitas & Spesifikasi
            </h2>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--muted)]">Nama item di POS</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {itemDisplayName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Master Product</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {item.productName} · {item.productCode}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Kadar</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {item.purityPercent ? `${item.purityPercent}%` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Kadar tukar</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {item.exchangePurityPercent
                  ? `${item.exchangePurityPercent}%`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Ukuran</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {item.size ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Warna</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {item.color ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Batu</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {item.gemstone ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Kondisi</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {conditionLabels[item.condition]}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">QR value</dt>
              <dd className="mt-1 break-all font-mono text-xs text-neutral-950">
                {item.qrValue ?? "—"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-3">
            <CircleDollarSign className="size-5 text-emerald-700" />
            <h2 className="font-semibold text-neutral-950">Harga & Catatan</h2>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--muted)]">Harga label</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {formatMoney(item.sellingAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Harga modal</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {canViewCost ? formatMoney(item.costAmount) : "Akses terbatas"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Harga per gram</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {formatMoney(item.pricePerGram)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Potongan per gram</dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {formatMoney(item.deductionPerGram)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-[var(--muted)]">Catatan internal</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-950">
                {item.internalNotes ?? "Belum ada catatan."}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <Clock3 className="size-5 text-[var(--accent)]" />
          <div>
            <h2 className="font-semibold text-neutral-950">
              Riwayat Inventaris
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Movement stok dan lokasi yang bersifat append-only.
            </p>
          </div>
        </div>

        {item.movements.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Boxes className="mx-auto size-6 text-neutral-400" />
            <p className="mt-3 text-sm text-[var(--muted)]">
              Item Draft belum memiliki movement inventaris.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {item.movements.map((movement) => (
              <article key={movement.id} className="px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-950">
                      {movementLabels[movement.movementType]}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {movement.fromOutletName
                        ? `${movement.fromOutletName} → `
                        : ""}
                      {movement.toOutletName ?? "Tanpa outlet tujuan"}
                    </p>
                    {movement.reason ? (
                      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                        {movement.reason}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--muted)] sm:text-right">
                    <p>{movement.occurredAt.toLocaleString("id-ID")}</p>
                    <p className="mt-1">oleh {movement.performerName}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">Metadata</h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[var(--muted)]">Dibuat</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-950">
              {item.createdAt.toLocaleString("id-ID")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Diperbarui</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-950">
              {item.updatedAt.toLocaleString("id-ID")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Aktif</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-950">
              {item.isActive ? "Ya" : "Tidak"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
