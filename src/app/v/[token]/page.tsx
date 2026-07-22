import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Gem,
  History,
  LockKeyhole,
  MapPin,
  PackageCheck,
  ReceiptText,
  ShieldX,
  UserRound,
} from "lucide-react";
import Image from "next/image";

import {
  getPublicCustomerHistoryData,
  getPublicCustomerHistoryImageUrl,
  type PublicCustomerHistoryTransaction,
} from "@/features/customers/public-history";

export const metadata = {
  title: "Riwayat Transaksi Pelanggan",
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

function formatDateTime(value: Date | null | undefined) {
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

function getStatusLabel(status: PublicCustomerHistoryTransaction["status"]) {
  const labels: Record<PublicCustomerHistoryTransaction["status"], string> = {
    completed: "Selesai",
    partially_refunded: "Retur Sebagian",
    refunded: "Diretur",
  };

  return labels[status];
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
            Riwayat transaksi pelanggan
          </p>
        </div>
      </div>

      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600">
        <LockKeyhole className="size-3.5" />
        Customer History · Read only
      </div>
    </header>
  );
}

function InvalidState({ message }: { message: string }) {
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
              Data tidak tersedia
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              Riwayat transaksi tidak dapat ditampilkan
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
                Scan ulang QR pada nota fisik.
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
                Hubungi outlet penerbit nota jika informasi tetap tidak tersedia.
              </li>
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}

function NoCustomerState({
  message,
  outletName,
  saleDate,
  invoiceNumber,
}: {
  message: string;
  outletName: string;
  saleDate: Date | null;
  invoiceNumber: string;
}) {
  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-neutral-950 sm:px-6 sm:py-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(211,164,77,0.14),_transparent_68%)]" />

      <section className="relative mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_24px_70px_-38px_rgba(23,23,23,0.35)]">
        <BrandHeader />

        <div className="px-5 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#fff6df] text-[#9a681d] ring-1 ring-[#ead7ad]">
              <UserRound className="size-8" />
            </div>

            <p className="mt-6 text-xs font-bold uppercase text-[#9a681d]">
              Customer tidak terdaftar
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              Riwayat pelanggan belum tersedia
            </h1>
            <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
              {message}
            </p>
          </div>

          <dl className="mx-auto mt-9 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[150px_1fr] sm:items-center">
              <dt className="text-sm text-neutral-500">Nomor nota</dt>
              <dd className="font-mono text-sm font-bold text-neutral-950 sm:text-right">
                {invoiceNumber}
              </dd>
            </div>
            <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:items-center">
              <dt className="text-sm text-neutral-500">Tanggal</dt>
              <dd className="text-sm font-semibold text-neutral-900 sm:text-right">
                {formatDateTime(saleDate)}
              </dd>
            </div>
            <div className="grid gap-1 py-3 last:pb-0 sm:grid-cols-[150px_1fr] sm:items-center">
              <dt className="text-sm text-neutral-500">Outlet</dt>
              <dd className="text-sm font-semibold text-neutral-900 sm:text-right">
                {outletName}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}

function TransactionItemList({
  token,
  transaction,
}: {
  token: string;
  transaction: PublicCustomerHistoryTransaction;
}) {
  if (transaction.itemSummary.length === 0) {
    return (
      <p className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
        Detail item transaksi tidak tersedia.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {transaction.itemSummary.map((item) => {
        const imageUrl = transaction.isScannedSale
          ? getPublicCustomerHistoryImageUrl({
              imageKey: item.imageKey,
              token,
            })
          : null;

        return (
          <article
            key={`${transaction.id}-${item.lineNumber}-${item.productCode}`}
            className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-3 sm:grid-cols-[76px_minmax(0,1fr)]"
          >
            <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-neutral-200 bg-[#faf8f2] text-[#9a681d]">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={item.productName}
                  width={120}
                  height={120}
                  className="size-full object-cover"
                  unoptimized
                />
              ) : (
                <Gem className="size-7" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-bold leading-snug text-neutral-950">
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

              <dl className="mt-4 grid grid-cols-4 divide-x divide-neutral-200 rounded-2xl bg-neutral-50 px-2 py-3">
                <div className="px-2">
                  <dt className="text-[10px] font-medium uppercase text-neutral-500">
                    Berat
                  </dt>
                  <dd className="mt-1 text-xs font-bold text-neutral-950">
                    {formatGram(item.weightGram)}
                  </dd>
                </div>
                <div className="px-2">
                  <dt className="text-[10px] font-medium uppercase text-neutral-500">
                    Kadar
                  </dt>
                  <dd className="mt-1 text-xs font-bold text-neutral-950">
                    {formatPercent(item.purityPercent)}
                  </dd>
                </div>
                <div className="px-2">
                  <dt className="text-[10px] font-medium uppercase text-neutral-500">
                    Tukar
                  </dt>
                  <dd className="mt-1 text-xs font-bold text-neutral-950">
                    {formatPercent(item.exchangePurityPercent)}
                  </dd>
                </div>
                <div className="px-2">
                  <dt className="text-[10px] font-medium uppercase text-neutral-500">
                    Harga
                  </dt>
                  <dd className="mt-1 text-xs font-bold text-neutral-950">
                    {formatAmount(item.finalPriceAmount)}
                  </dd>
                </div>
              </dl>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TransactionCard({
  token,
  transaction,
}: {
  token: string;
  transaction: PublicCustomerHistoryTransaction;
}) {
  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white ${
        transaction.isScannedSale
          ? "border-[#d4a64a] shadow-[0_18px_44px_-32px_rgba(122,78,29,0.55)]"
          : "border-neutral-200"
      }`}
    >
      <div className="grid gap-4 border-b border-neutral-100 p-5 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {transaction.isScannedSale ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff1cd] px-3 py-1 text-xs font-bold uppercase text-[#815618]">
                <BadgeCheck className="size-3.5" />
                Nota yang discan
              </span>
            ) : null}
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
              {getStatusLabel(transaction.status)}
            </span>
          </div>
          <h2 className="mt-3 break-all font-mono text-lg font-bold text-neutral-950">
            {transaction.invoiceNumber}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {formatDateTime(transaction.completedAt ?? transaction.createdAt)}
          </p>
        </div>

        <div className="rounded-2xl bg-neutral-950 px-4 py-3 text-white sm:min-w-48 sm:text-right">
          <p className="text-[11px] font-semibold uppercase text-neutral-400">
            Total pembayaran
          </p>
          <p className="mt-1 text-xl font-bold text-[#f3d891]">
            {formatAmount(transaction.totalAmount)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_220px]">
        <TransactionItemList token={token} transaction={transaction} />

        <dl className="h-fit divide-y divide-neutral-100 rounded-2xl bg-neutral-50 p-4">
          <div className="grid gap-1 py-3 first:pt-0">
            <dt className="text-xs font-semibold uppercase text-neutral-500">
              Subtotal
            </dt>
            <dd className="text-sm font-bold text-neutral-950">
              {formatAmount(transaction.subtotalAmount)}
            </dd>
          </div>
          <div className="grid gap-1 py-3">
            <dt className="text-xs font-semibold uppercase text-neutral-500">
              Diskon
            </dt>
            <dd className="text-sm font-bold text-neutral-950">
              {formatAmount(transaction.discountAmount)}
            </dd>
          </div>
          <div className="grid gap-1 py-3">
            <dt className="text-xs font-semibold uppercase text-neutral-500">
              Pembayaran
            </dt>
            <dd className="text-sm font-bold text-neutral-950">
              {transaction.paymentMethods.length > 0
                ? transaction.paymentMethods.join(" + ")
                : "Pembayaran tercatat"}
            </dd>
          </div>
          <div className="grid gap-1 py-3 last:pb-0">
            <dt className="text-xs font-semibold uppercase text-neutral-500">
              Jumlah item
            </dt>
            <dd className="text-sm font-bold text-neutral-950">
              {transaction.totalItems} item
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export default async function PublicCustomerHistoryPage({ params }: PageProps) {
  const { token } = await params;
  const data = await getPublicCustomerHistoryData(token);

  if (data.status === "invalid") {
    return <InvalidState message={data.message} />;
  }

  if (data.status === "no_customer") {
    return (
      <NoCustomerState
        message={data.message}
        outletName={data.outlet.name}
        saleDate={data.sale.completedAt ?? data.sale.createdAt}
        invoiceNumber={data.sale.invoiceNumber}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-4 py-6 text-neutral-950 sm:px-6 sm:py-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(211,164,77,0.16),_transparent_68%)]" />

      <section className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_24px_70px_-38px_rgba(23,23,23,0.35)]">
        <BrandHeader />

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-[#fffaf0]">
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase text-emerald-800">
                  <BadgeCheck className="size-3.5" />
                  Riwayat resmi Asihjaya
                </div>
                <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
                  Riwayat transaksi pelanggan di {data.outlet.name}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600 sm:text-base">
                  Halaman ini menampilkan riwayat transaksi customer terdaftar
                  pada outlet yang sama dengan nota yang kamu scan.
                </p>
              </div>

              <div className="rounded-2xl border border-[#ead7ad] bg-white/90 p-4 shadow-sm lg:min-w-80">
                <p className="text-[11px] font-semibold uppercase text-neutral-500">
                  Customer
                </p>
                <p className="mt-2 text-lg font-bold text-neutral-950">
                  {data.customer.name}
                </p>
                <p className="mt-1 text-xs font-medium text-neutral-500">
                  {data.customer.customerCode ?? "Kode customer tidak tersedia"}
                  {data.customer.phone ? ` · ${data.customer.phone}` : ""}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-3xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-[#fff6df] text-[#9a681d]">
                  <History className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">
                    Total transaksi
                  </p>
                  <p className="mt-1 text-2xl font-bold text-neutral-950">
                    {data.summary.totalTransactions}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-[#fff6df] text-[#9a681d]">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">
                    Total belanja
                  </p>
                  <p className="mt-1 text-xl font-bold text-neutral-950">
                    {formatAmount(data.summary.totalSpent)}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-[#fff6df] text-[#9a681d]">
                  <PackageCheck className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">
                    Total item
                  </p>
                  <p className="mt-1 text-2xl font-bold text-neutral-950">
                    {data.summary.totalItems}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-[#fff6df] text-[#9a681d]">
                  <CalendarDays className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">
                    Transaksi terakhir
                  </p>
                  <p className="mt-1 text-sm font-bold text-neutral-950">
                    {formatDateTime(data.summary.lastTransactionAt)}
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className="mt-8 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="h-fit rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-neutral-950 text-[#f1ce80]">
                  <ReceiptText className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">
                    Nota yang discan
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold">Ringkasan nota</h2>
                </div>
              </div>

              <dl className="mt-6 divide-y divide-neutral-100">
                <div className="grid gap-1 py-3 first:pt-0">
                  <dt className="text-sm text-neutral-500">Nomor nota</dt>
                  <dd className="break-all font-mono text-sm font-bold text-neutral-950">
                    {data.scannedSale.invoiceNumber}
                  </dd>
                </div>
                <div className="grid gap-1 py-3">
                  <dt className="flex items-center gap-2 text-sm text-neutral-500">
                    <CalendarDays className="size-4" />
                    Tanggal
                  </dt>
                  <dd className="text-sm font-semibold text-neutral-900">
                    {formatDateTime(
                      data.scannedSale.completedAt ?? data.scannedSale.createdAt,
                    )}
                  </dd>
                </div>
                <div className="grid gap-1 py-3">
                  <dt className="flex items-center gap-2 text-sm text-neutral-500">
                    <MapPin className="size-4" />
                    Outlet
                  </dt>
                  <dd className="text-sm font-semibold text-neutral-900">
                    {data.outlet.name}
                  </dd>
                </div>
                <div className="grid gap-1 py-3 last:pb-0">
                  <dt className="text-sm text-neutral-500">Total nota</dt>
                  <dd className="text-2xl font-bold text-[#9a681d]">
                    {formatAmount(data.scannedSale.totalAmount)}
                  </dd>
                </div>
              </dl>
            </aside>

            <section className="grid gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase text-[#9a681d]">
                    Detail riwayat
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">
                    {data.transactions.length} transaksi terakhir
                  </h2>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-600">
                  <LockKeyhole className="size-4" />
                  Data sensitif dimasking
                </div>
              </div>

              {data.transactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  token={data.token}
                  transaction={transaction}
                />
              ))}
            </section>
          </section>

          <footer className="mt-8 rounded-3xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
            <div className="flex gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-neutral-700 ring-1 ring-neutral-200">
                <LockKeyhole className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-950">
                  Tentang halaman ini
                </h2>
                <p className="mt-2 text-xs leading-6 text-neutral-600 sm:text-sm">
                  Riwayat ini hanya tersedia melalui QR nota resmi dan dibatasi
                  untuk customer serta outlet yang sama. Nomor kontak dan data
                  sensitif pelanggan ditampilkan secara terbatas.
                </p>
                <ul className="mt-3 grid gap-1.5 text-xs leading-5 text-neutral-500 sm:text-sm">
                  <li>• Pastikan alamat situs berasal dari domain resmi Asihjaya.</li>
                  <li>• Jangan membagikan tautan atau QR kepada pihak yang tidak berkepentingan.</li>
                  <li>• Hubungi outlet penerbit jika rincian riwayat tidak sesuai.</li>
                </ul>
              </div>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
