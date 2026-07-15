import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Gem,
  LockKeyhole,
  MapPin,
  PackageCheck,
  ReceiptText,
  ShieldX,
} from "lucide-react";
import Image from "next/image";

import {
  getPublicReceiptVerificationData,
  getPublicVerificationImageUrl,
} from "@/features/sales/verification/receipt-verification";

export const metadata = {
  title: "Verifikasi Dokumen",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

function formatAmount(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "Rp 0";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function formatGram(value: string | null) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "-";
  }

  return `${amount.toLocaleString("id-ID", { maximumFractionDigits: 2 })} g`;
}

function formatPercent(value: string | null) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "-";
  }

  return `${amount.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}

function formatCustomerName(value: string | null | undefined) {
  const words = value?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (words.length === 0) {
    return "Pelanggan Umum";
  }

  const [firstName, ...remainingNames] = words;

  if (remainingNames.length === 0) {
    return firstName;
  }

  return `${firstName} ${remainingNames
    .map((name) => `${name.charAt(0).toUpperCase()}.`)
    .join(" ")}`;
}

function BrandHeader() {
  return (
    <header className="flex flex-col gap-4 border-b border-neutral-200/80 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div className="flex items-center gap-3">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden">
          <Image
            src="/logo/asihjaya-brand-icon.png"
            alt="Asihjaya"
            width={72}
            height={72}
            className="h-14 w-auto object-contain"
            priority
          />
        </div>

        <div className="min-w-0">
          <Image
            src="/logo/asihjaya-brand-text.png"
            alt="Asihjaya"
            width={124}
            height={28}
            className="h-6 w-auto object-contain"
            priority
          />
          <p className="mt-1 text-[11px] font-semibold uppercase text-neutral-500">
            Verifikasi dokumen resmi
          </p>
        </div>
      </div>

      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600">
        <LockKeyhole className="size-3.5" />
        Digital Certificate · Read only
      </div>
    </header>
  );
}

function InvalidVerification({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-neutral-950 sm:px-6 sm:py-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(211,164,77,0.14),_transparent_68%)]" />

      <section className="relative mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_24px_70px_-38px_rgba(23,23,23,0.35)]">
        <BrandHeader />

        <div className="px-5 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
              <ShieldX className="size-8" />
            </div>

            <p className="mt-6 text-xs font-bold uppercase text-red-600">
              Verifikasi tidak berhasil
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              Dokumen tidak dapat diverifikasi
            </h1>
            <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
              {message}
            </p>
          </div>

          <div className="mx-auto mt-9 max-w-xl rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <p className="text-sm font-semibold text-neutral-900">
              Yang dapat kamu lakukan
            </p>
            <ol className="mt-4 grid gap-3 text-sm leading-6 text-neutral-600">
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-neutral-700 ring-1 ring-neutral-200">
                  1
                </span>
                Scan ulang QR pada nota atau sertifikat fisik.
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-neutral-700 ring-1 ring-neutral-200">
                  2
                </span>
                Pastikan alamat situs berasal dari domain resmi Asihjaya.
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-neutral-700 ring-1 ring-neutral-200">
                  3
                </span>
                Hubungi outlet yang menerbitkan dokumen jika informasi tetap
                tidak tersedia.
              </li>
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function PublicReceiptVerificationPage({
  params,
}: PageProps) {
  const { token } = await params;
  const data = await getPublicReceiptVerificationData(token);

  if (data.status === "invalid") {
    return <InvalidVerification message={data.message} />;
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-neutral-950 sm:px-6 sm:py-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(211,164,77,0.16),_transparent_68%)]" />

      <section className="relative mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_24px_70px_-38px_rgba(23,23,23,0.35)]">
        <BrandHeader />

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-[#fffaf0]">
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-800">
                    <BadgeCheck className="size-3.5" />
                    Terverifikasi
                  </div>
                  <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
                    Dokumen tercatat di sistem Asihjaya
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600 sm:text-base">
                    Cocokkan nomor transaksi dan rincian barang di bawah dengan
                    nota atau sertifikat fisik yang kamu scan.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#ead7ad] bg-white/90 p-4 shadow-sm lg:min-w-72">
                <p className="text-[11px] font-semibold uppercase text-neutral-500">
                  Nomor transaksi
                </p>
                <p className="mt-2 break-all font-mono text-base font-bold text-neutral-950 sm:text-lg">
                  {data.sale.invoiceNumber}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-[#fff6df] text-[#9a681d]">
                  <ReceiptText className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">
                    Informasi transaksi
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold">
                    Dokumen pembelian
                  </h2>
                </div>
              </div>

              <dl className="mt-6 divide-y divide-neutral-100">
                <div className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[150px_1fr] sm:items-center">
                  <dt className="flex items-center gap-2 text-sm text-neutral-500">
                    <CalendarDays className="size-4" />
                    Tanggal transaksi
                  </dt>
                  <dd className="text-sm font-semibold text-neutral-900 sm:text-right">
                    {formatDateTime(data.sale.completedAt)}
                  </dd>
                </div>
                <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:items-center">
                  <dt className="flex items-center gap-2 text-sm text-neutral-500">
                    <MapPin className="size-4" />
                    Outlet
                  </dt>
                  <dd className="text-sm font-semibold text-neutral-900 sm:text-right">
                    {data.outlet.name}
                  </dd>
                </div>
                <div className="grid gap-1 py-3 last:pb-0 sm:grid-cols-[150px_1fr] sm:items-center">
                  <dt className="text-sm text-neutral-500">Customer</dt>
                  <dd className="text-sm font-semibold text-neutral-900 sm:text-right">
                    {formatCustomerName(data.customer?.name)}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-3xl border border-neutral-200 bg-neutral-950 p-5 text-white sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-white/10 text-[#f1ce80]">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-400">
                    Ringkasan pembelian
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold">
                    Pembayaran terverifikasi
                  </h2>
                </div>
              </div>

              <dl className="mt-6 divide-y divide-white/10">
                <div className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[130px_1fr] sm:items-center">
                  <dt className="text-sm text-neutral-400">Total</dt>
                  <dd className="text-2xl font-bold text-[#f3d891] sm:text-right">
                    {formatAmount(data.sale.totalAmount)}
                  </dd>
                </div>
                <div className="grid gap-1 py-3 sm:grid-cols-[130px_1fr] sm:items-center">
                  <dt className="text-sm text-neutral-400">Pembayaran</dt>
                  <dd className="text-sm font-semibold sm:text-right">
                    {data.paymentSummary}
                  </dd>
                </div>
                <div className="grid gap-1 py-3 last:pb-0 sm:grid-cols-[130px_1fr] sm:items-center">
                  <dt className="text-sm text-neutral-400">Jumlah barang</dt>
                  <dd className="text-sm font-semibold sm:text-right">
                    {data.totalItems} item
                  </dd>
                </div>
              </dl>
            </article>
          </section>

          <section className="mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-[#9a681d]">
                  Barang terverifikasi
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {data.totalItems} item pada dokumen ini
                </h2>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600">
                <PackageCheck className="size-4" />
                Cocokkan dengan barang fisik
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {data.items.map((item) => {
                const imageUrl = getPublicVerificationImageUrl({
                  imageKey: item.imageKey,
                  token: data.token,
                });

                return (
                  <article
                    key={`${item.lineNumber}-${item.productCode}`}
                    className="grid gap-5 rounded-3xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm sm:grid-cols-[112px_minmax(0,1fr)] sm:p-5"
                  >
                    <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-2xl border border-neutral-200 bg-[#faf8f2] text-[#9a681d]">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.productName}
                          width={160}
                          height={160}
                          className="size-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <Gem className="size-8" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold leading-snug text-neutral-950">
                            {item.productName}
                          </h3>
                          <p className="mt-1 break-all font-mono text-xs font-medium text-neutral-500">
                            {item.productCode}
                          </p>
                        </div>

                        <span className="w-fit shrink-0 rounded-full border border-[#ead7ad] bg-[#fff8e8] px-3 py-1 text-xs font-semibold text-[#815618]">
                          {item.categoryName ?? "Perhiasan"}
                        </span>
                      </div>

                      <dl className="mt-5 grid grid-cols-3 divide-x divide-neutral-200 rounded-2xl bg-neutral-50 px-2 py-4">
                        <div className="px-2 sm:px-4">
                          <dt className="text-[11px] font-medium uppercase text-neutral-500">
                            Berat
                          </dt>
                          <dd className="mt-1 text-xs font-bold text-neutral-950">
                            {formatGram(item.weightGram)}
                          </dd>
                        </div>
                        <div className="px-2 sm:px-4">
                          <dt className="text-[11px] font-medium uppercase text-neutral-500">
                            Kadar
                          </dt>
                          <dd className="mt-1 text-xs font-bold text-neutral-950">
                            {formatPercent(item.purityPercent)}
                          </dd>
                        </div>
                        <div className="px-2 sm:px-4">
                          <dt className="text-[11px] font-medium uppercase text-neutral-500">
                            Tukar
                          </dt>
                          <dd className="mt-1 text-xs font-bold text-neutral-950">
                            {formatPercent(item.exchangePurityPercent)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <footer className="mt-8 rounded-3xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
            <div className="flex gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-neutral-700 ring-1 ring-neutral-200">
                <LockKeyhole className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-950">
                  Tentang verifikasi ini
                </h2>
                <p className="mt-2 text-xs leading-6 text-neutral-600 sm:text-sm">
                  Halaman ini hanya menampilkan informasi yang diperlukan untuk
                  mencocokkan dokumen. Data transaksi lengkap tetap tersimpan
                  secara internal di sistem Asihjaya.
                </p>
                <ul className="mt-3 grid gap-1.5 text-xs leading-5 text-neutral-500 sm:text-sm">
                  <li>
                    • Pastikan alamat situs berasal dari domain resmi Asihjaya.
                  </li>
                  <li>
                    • Jangan membagikan tautan atau QR verifikasi kepada pihak
                    yang tidak berkepentingan.
                  </li>
                  <li>
                    • Hubungi outlet penerbit jika rincian dokumen tidak sesuai.
                  </li>
                </ul>
              </div>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
