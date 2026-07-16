import type { ReactNode } from "react";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Barcode,
  Boxes,
  CircleDollarSign,
  CircleOff,
  Clock3,
  FilePenLine,
  Gem,
  Hash,
  ImageIcon,
  Info,
  MapPin,
  PackageCheck,
  PackageOpen,
  Scale,
  ShieldAlert,
  Store,
  Tag,
  Warehouse,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductImage } from "@/components/media/product-image";
import { getProductItemDetail } from "@/features/inventory/product-item-queries";
import { hasPermission, requireAnyPermission } from "@/lib/auth/session";
import { getImageUrl } from "@/lib/storage/image-storage";
import { cn } from "@/lib/utils";

import { PrintLabelButton } from "./print-button";

export const metadata = {
  title: "Detail Item Inventaris",
};

const availabilityLabels = {
  draft: "Draft",
  available: "Tersedia",
  reserved: "Reserved",
  inspection: "Pemeriksaan Retur",
  sold: "Terjual",
} as const;

const conditionLabels = {
  good: "Baru",
  damaged: "Bekas",
  lost: "Hilang",
  returned: "Retur",
} as const;

const locationStateLabels = {
  outlet: "Outlet",
  warehouse: "Gudang",
  in_transit: "Dalam perjalanan",
  customer: "Pelanggan",
  repair: "Perbaikan",
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

function getAvailabilityClass(
  availability: keyof typeof availabilityLabels,
) {
  if (availability === "available") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (availability === "reserved") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (availability === "sold") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-neutral-200 bg-neutral-100 text-neutral-600";
}

function getConditionClass(condition: keyof typeof conditionLabels) {
  if (condition === "good") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (condition === "returned") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (condition === "damaged") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function formatMoney(value: string | null) {
  if (!value) {
    return "Belum diisi";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Belum diisi";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDecimal(value: string | null, suffix: string) {
  if (!value) {
    return "Belum diisi";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Belum diisi";
  }

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
  }).format(amount)} ${suffix}`;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatReferenceType(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--muted)] sm:text-sm">
            {title}
          </p>
          <p className="mt-2 break-words text-base font-semibold text-neutral-950 sm:text-xl">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            {helper}
          </p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] sm:size-11">
          {icon}
        </div>
      </div>
    </article>
  );
}

function DetailTile({
  label,
  value,
  helper,
  icon,
  mono = false,
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-neutral-50/70 p-3.5">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div className="mt-0.5 shrink-0 text-neutral-400">{icon}</div>
        ) : null}
        <div className="min-w-0">
          <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
          <dd
            className={cn(
              "mt-1 break-words text-sm font-semibold text-neutral-900",
              mono && "font-mono",
            )}
          >
            {value}
          </dd>
          {helper ? (
            <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
              {helper}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="font-semibold text-neutral-950">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function SuccessNotice({
  sku,
  barcode,
}: {
  sku: string;
  barcode: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-emerald-800">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/80">
        <BadgeCheck className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">Item fisik berhasil dibuat</p>
        <p className="mt-1 text-xs leading-5 text-emerald-700">
          SKU <span className="font-mono font-semibold">{sku}</span> dan barcode{" "}
          <span className="font-mono font-semibold">{barcode}</span> sudah siap
          digunakan. Periksa lokasi, status stok, dan label sebelum item dipakai
          pada operasional POS.
        </p>
      </div>
    </div>
  );
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
  const canPrintLabel =
    hasPermission(auth, "inventory.print_label") &&
    ["draft", "available", "reserved"].includes(item.availability) &&
    item.isActive &&
    Boolean(item.outletId);
  const imageUrl = getImageUrl(item.imageKey ?? item.productImageKey);
  const usesCatalogPhoto = !item.imageKey && Boolean(item.productImageKey);
  const hasPhoto = Boolean(item.imageKey ?? item.productImageKey);
  const itemDisplayName = item.displayName ?? item.productName;
  const isReadyToSell =
    item.isActive &&
    item.availability === "available" &&
    item.condition === "good" &&
    Boolean(item.outletId);
  const locationName = item.outletName ?? "Belum ditempatkan";
  const editRestriction =
    item.availability === "sold"
      ? "Item sudah terjual sehingga data operasionalnya dikunci."
      : item.availability === "reserved"
        ? "Item sedang direservasi. Lepaskan reservasi sebelum mengubah detail utama."
        : null;

  return (
    <div className="w-full min-w-0 space-y-6 overflow-x-clip pb-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/admin/inventaris"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-[var(--muted)] transition hover:text-neutral-950"
          >
            <ArrowLeft className="size-4" />
            Kembali ke inventaris
          </Link>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {canEdit ? (
              <Link
                href={`/admin/inventaris/item/${item.id}/edit`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-medium !text-white transition hover:bg-neutral-800 [&_svg]:!text-white"
              >
                <FilePenLine className="size-4" />
                Edit Item
              </Link>
            ) : null}

            {canPrintLabel ? <PrintLabelButton itemId={item.id} /> : null}

            <Link
              href={`/admin/produk/${item.productId}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Lihat Master Product
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] xl:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="size-24 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-neutral-50 sm:size-28">
                <ProductImage
                  src={imageUrl}
                  alt={`${itemDisplayName} ${item.sku}`}
                  className="size-full rounded-none"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">
                    {itemDisplayName}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                      getAvailabilityClass(item.availability),
                    )}
                  >
                    {availabilityLabels[item.availability]}
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                      getConditionClass(item.condition),
                    )}
                  >
                    {conditionLabels[item.condition]}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
                  <span className="font-mono font-semibold text-neutral-800">
                    {item.sku}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="font-mono">{item.barcode}</span>
                </div>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Item fisik dari master product <strong>{item.productName}</strong>{" "}
                  dengan lokasi saat ini di <strong>{locationName}</strong>.
                  Gunakan halaman ini untuk memverifikasi identitas, harga,
                  kesiapan stok, dan audit movement inventaris.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700">
                    <Store className="size-3.5 text-[var(--accent)]" />
                    {item.outletName ?? "Tanpa outlet"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700">
                    <MapPin className="size-3.5 text-[var(--accent)]" />
                    {item.locationCode ?? "Tanpa kode lokasi"}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700">
                    <ImageIcon className="size-3.5 text-[var(--accent)]" />
                    {item.imageKey
                      ? "Foto item aktual"
                      : usesCatalogPhoto
                        ? "Foto katalog"
                        : "Belum ada foto"}
                  </span>
                </div>
              </div>
            </div>

            {editRestriction ? (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5">
                  <strong>Perubahan item dibatasi.</strong> {editRestriction}
                </p>
              </div>
            ) : null}
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950">
                  Kesiapan Operasional
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Kondisi item berdasarkan status stok, lokasi, dan kelayakan.
                </p>
              </div>
              <div
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  isReadyToSell
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700",
                )}
              >
                {isReadyToSell ? (
                  <PackageCheck className="size-5" />
                ) : (
                  <PackageOpen className="size-5" />
                )}
              </div>
            </div>

            <dl className="mt-5 space-y-3">
              {[
                ["Status stok", availabilityLabels[item.availability]],
                ["Kondisi", conditionLabels[item.condition]],
                ["Outlet", item.outletName ?? "Belum ditempatkan"],
                ["Lokasi rak", item.locationCode ?? "Belum diatur"],
                ["Item aktif", item.isActive ? "Ya" : "Tidak"],
                ["Siap dijual", isReadyToSell ? "Ya" : "Belum"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                >
                  <dt className="text-xs text-[var(--muted)]">{label}</dt>
                  <dd className="max-w-[58%] text-right text-xs font-semibold text-neutral-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <div
              className={cn(
                "mt-5 rounded-xl border px-3.5 py-3",
                isReadyToSell
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800",
              )}
            >
              <p className="text-xs font-semibold">
                {isReadyToSell ? "Item siap ditawarkan" : "Perlu pemeriksaan"}
              </p>
              <p className="mt-1 text-xs leading-5 opacity-90">
                {isReadyToSell
                  ? "Item aktif, tersedia, berkondisi baik, dan sudah ditempatkan pada outlet."
                  : "Periksa status stok, kondisi, status aktif, serta penempatan outlet sebelum item digunakan pada POS."}
              </p>
            </div>
          </aside>
        </div>
      </section>

      {query.created === "1" ? (
        <SuccessNotice sku={item.sku} barcode={item.barcode} />
      ) : null}

      <section className="grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-950">
                Visual Item
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Foto untuk pemeriksaan barang fisik dan katalog.
              </p>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
              {item.imageKey
                ? "Aktual"
                : usesCatalogPhoto
                  ? "Katalog"
                  : "Kosong"}
            </span>
          </div>

          <ProductImage
            src={imageUrl}
            alt={`${itemDisplayName} ${item.sku}`}
            className="mt-4 aspect-square w-full rounded-2xl"
            badge={
              item.imageKey
                ? "Foto item aktual"
                : usesCatalogPhoto
                  ? "Foto katalog"
                  : undefined
            }
          />

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-neutral-50/70 px-3.5 py-3">
            {hasPhoto ? (
              <ImageIcon className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
            )}
            <p className="text-xs leading-5 text-[var(--muted)]">
              {item.imageKey
                ? "Foto aktual item digunakan sebagai referensi utama untuk verifikasi fisik."
                : usesCatalogPhoto
                  ? "Item belum mempunyai foto aktual. Foto master product digunakan sebagai fallback."
                  : "Belum ada foto item maupun foto master product. Tambahkan foto saat melakukan edit item."}
            </p>
          </div>
        </article>

        <div className="grid min-w-0 grid-cols-2 gap-4">
          <SummaryCard
            title="Harga Label"
            value={formatMoney(item.sellingAmount)}
            helper="Harga jual yang tercetak pada label item."
            icon={<CircleDollarSign className="size-5" />}
          />
          <SummaryCard
            title="Berat Aktual"
            value={formatDecimal(item.weightGram, "gram")}
            helper="Berat fisik item yang tersimpan saat ini."
            icon={<Scale className="size-5" />}
          />
          <SummaryCard
            title="Harga per Gram"
            value={formatMoney(item.pricePerGram)}
            helper="Nilai referensi harga berdasarkan berat item."
            icon={<Tag className="size-5" />}
          />
          <SummaryCard
            title="Lokasi Saat Ini"
            value={locationName}
            helper={item.locationCode ?? "Kode lokasi belum diatur."}
            icon={<MapPin className="size-5" />}
          />
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-2">
        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <SectionHeader
            icon={<Hash className="size-5" />}
            title="Identitas Permanen"
            description="Referensi utama untuk pencarian, scan, pencetakan label, dan audit item."
          />

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <DetailTile
              label="SKU"
              value={item.sku}
              helper="Kode unik item fisik."
              icon={<Hash className="size-4" />}
              mono
            />
            <DetailTile
              label="Barcode"
              value={item.barcode}
              helper="Digunakan untuk scan label dan POS."
              icon={<Barcode className="size-4" />}
              mono
            />
            <DetailTile
              label="QR value"
              value={item.qrValue ?? "Belum diisi"}
              helper="Nilai payload untuk kode QR item."
              icon={<Boxes className="size-4" />}
              mono
            />
            <DetailTile
              label="Nama item di POS"
              value={itemDisplayName}
              helper="Nama yang tampil pada pencarian dan transaksi."
              icon={<Tag className="size-4" />}
            />
            <div className="sm:col-span-2">
              <DetailTile
                label="Master Product"
                value={`${item.productName} · ${item.productCode}`}
                helper="Item fisik ini tetap terhubung dengan master product tersebut."
                icon={<PackageOpen className="size-4" />}
              />
            </div>
          </dl>
        </article>

        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <SectionHeader
            icon={<Gem className="size-5" />}
            title="Spesifikasi Produk"
            description="Karakteristik fisik yang membantu verifikasi, penilaian, dan pelayanan pelanggan."
          />

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <DetailTile
              label="Berat"
              value={formatDecimal(item.weightGram, "gram")}
            />
            <DetailTile
              label="Kondisi"
              value={conditionLabels[item.condition]}
            />
            <DetailTile
              label="Kadar"
              value={formatDecimal(item.purityPercent, "%")}
            />
            <DetailTile
              label="Kadar tukar"
              value={formatDecimal(item.exchangePurityPercent, "%")}
            />
            <DetailTile label="Ukuran" value={item.size ?? "Belum diisi"} />
            <DetailTile label="Warna" value={item.color ?? "Belum diisi"} />
            <div className="col-span-2">
              <DetailTile
                label="Batu / Gemstone"
                value={item.gemstone ?? "Belum diisi"}
                icon={<Gem className="size-4" />}
              />
            </div>
          </dl>
        </article>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <SectionHeader
            icon={<CircleDollarSign className="size-5" />}
            title="Harga & Nilai Persediaan"
            description="Ringkasan nilai komersial item sesuai akses pricing pengguna."
          />

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <DetailTile
              label="Harga label"
              value={formatMoney(item.sellingAmount)}
              helper="Harga jual yang tampil pada label."
            />
            {canViewCost ? (
              <DetailTile
                label="Harga modal"
                value={formatMoney(item.costAmount)}
                helper="Nilai modal item pada persediaan."
              />
            ) : (
              <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-amber-700">
                      Harga modal
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-amber-900">
                      Akses terbatas
                    </dd>
                    <p className="mt-1.5 text-xs leading-5 text-amber-700">
                      Memerlukan permission pricing.view_cost atau pricing.manage.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <DetailTile
              label="Harga per gram"
              value={formatMoney(item.pricePerGram)}
              helper="Referensi harga berdasarkan berat."
            />
            <DetailTile
              label="Potongan per gram"
              value={formatMoney(item.deductionPerGram)}
              helper="Nilai potongan yang tersimpan pada item."
            />
          </dl>
        </article>

        <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
          <SectionHeader
            icon={<MapPin className="size-5" />}
            title="Lokasi & Status Inventaris"
            description="Posisi operasional dan state stok item pada jaringan outlet."
          />

          <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <DetailTile
              label="Outlet saat ini"
              value={item.outletName ?? "Belum ditempatkan"}
              helper={item.outletCode ?? "Kode outlet belum tersedia."}
              icon={<Store className="size-4" />}
            />
            <DetailTile
              label="Kode lokasi"
              value={item.locationCode ?? "Belum diatur"}
              helper="Rak, etalase, atau area penyimpanan item."
              icon={<MapPin className="size-4" />}
              mono
            />
            <DetailTile
              label="Location state"
              value={locationStateLabels[item.locationState]}
              helper="Konteks posisi item dalam alur inventaris."
              icon={
                item.locationState === "warehouse" ? (
                  <Warehouse className="size-4" />
                ) : item.locationState === "repair" ? (
                  <Wrench className="size-4" />
                ) : (
                  <Store className="size-4" />
                )
              }
            />
            <DetailTile
              label="Status item"
              value={item.isActive ? "Aktif" : "Nonaktif"}
              helper={
                item.isActive
                  ? "Item dapat digunakan sesuai availability."
                  : "Item tidak tersedia untuk alur operasional baru."
              }
              icon={
                item.isActive ? (
                  <PackageCheck className="size-4" />
                ) : (
                  <CircleOff className="size-4" />
                )
              }
            />
          </dl>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <SectionHeader
          icon={<Info className="size-5" />}
          title="Catatan Internal"
          description="Informasi operasional untuk tim internal dan tidak ditampilkan pada label atau POS."
        />

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-4 sm:p-5">
          {item.internalNotes ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-800">
              {item.internalNotes}
            </p>
          ) : (
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-neutral-400" />
              <div>
                <p className="text-sm font-medium text-neutral-800">
                  Belum ada catatan internal
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Catatan dapat digunakan untuk kondisi khusus, hasil inspeksi,
                  atau arahan penanganan item.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <SectionHeader
            icon={<Clock3 className="size-5" />}
            title="Riwayat Inventaris"
            description="Timeline movement stok dan perpindahan lokasi yang bersifat append-only."
          />
          <div className="w-fit rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">
            {item.movements.length} movement
          </div>
        </div>

        {item.movements.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-400">
              <Boxes className="size-6" />
            </div>
            <p className="mt-4 text-sm font-medium text-neutral-800">
              Belum ada movement inventaris
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[var(--muted)]">
              Item Draft biasanya belum memiliki movement. Timeline akan terisi
              setelah penerimaan, transfer, reservasi, penjualan, atau penyesuaian.
            </p>
          </div>
        ) : (
          <div className="px-5 py-5 sm:px-6">
            <div className="relative space-y-0 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-[var(--border)]">
              {item.movements.map((movement, index) => {
                const movementReference = formatReferenceType(
                  movement.referenceType,
                );
                const movementRoute =
                  movement.fromOutletName && movement.toOutletName
                    ? `${movement.fromOutletName} → ${movement.toOutletName}`
                    : movement.fromOutletName
                      ? `Dari ${movement.fromOutletName}`
                      : movement.toOutletName
                        ? `Menuju ${movement.toOutletName}`
                        : "Tidak terkait perpindahan outlet";

                return (
                  <article
                    key={movement.id}
                    className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-6 last:pb-0"
                  >
                    <div
                      className={cn(
                        "relative z-10 mt-1 grid size-9 place-items-center rounded-full border-4 border-white",
                        index === 0
                          ? "bg-[var(--accent)] text-white"
                          : "bg-neutral-200 text-neutral-600",
                      )}
                    >
                      {index === 0 ? (
                        <BadgeCheck className="size-4" />
                      ) : (
                        <Boxes className="size-4" />
                      )}
                    </div>

                    <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-neutral-50/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-neutral-950">
                              {movementLabels[movement.movementType]}
                            </p>
                            {index === 0 ? (
                              <span className="rounded-full border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                                Terbaru
                              </span>
                            ) : null}
                            {movementReference ? (
                              <span className="rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                                {movementReference}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                            <MapPin className="mt-0.5 size-3.5 shrink-0" />
                            <span>{movementRoute}</span>
                          </p>

                          {movement.reason ? (
                            <p className="mt-3 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-xs leading-5 text-neutral-700">
                              {movement.reason}
                            </p>
                          ) : null}
                        </div>

                        <div className="shrink-0 text-xs text-[var(--muted)] sm:text-right">
                          <p className="font-medium text-neutral-700">
                            {formatDateTime(movement.occurredAt)}
                          </p>
                          <p className="mt-1">oleh {movement.performerName}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeader
            icon={<Warehouse className="size-5" />}
            title="Metadata & Audit"
            description="Informasi sistem untuk penelusuran perubahan dan sumber data item."
          />
          <span
            className={cn(
              "w-fit rounded-full border px-2.5 py-1 text-xs font-semibold",
              item.isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-neutral-200 bg-neutral-100 text-neutral-600",
            )}
          >
            {item.isActive ? "Item aktif" : "Item nonaktif"}
          </span>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailTile
            label="Dibuat"
            value={formatDateTime(item.createdAt)}
            icon={<Clock3 className="size-4" />}
          />
          <DetailTile
            label="Terakhir diperbarui"
            value={formatDateTime(item.updatedAt)}
            icon={<Clock3 className="size-4" />}
          />
          <DetailTile
            label="Jumlah movement"
            value={`${item.movements.length} movement`}
            icon={<Boxes className="size-4" />}
          />
          <DetailTile
            label="Sumber foto"
            value={
              item.imageKey
                ? "Foto item aktual"
                : usesCatalogPhoto
                  ? "Foto master product"
                  : "Belum tersedia"
            }
            icon={<ImageIcon className="size-4" />}
          />
        </dl>
      </section>
    </div>
  );
}
